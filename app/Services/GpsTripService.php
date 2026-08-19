<?php

namespace App\Services;

use App\Models\GpsPing;
use App\Models\TripTicket;
use App\Models\TripHistory;
use App\Models\FuelReceipt;
use App\Models\User;
use App\Helpers\NotificationHelper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GpsTripService
{
    /**
     * Start a trip with GPS location
     */
    public function startTrip($tripId, $latitude, $longitude, $accuracy = null)
    {
        $trip = TripTicket::with(['gasSlip.fuelReceipt', 'driver.user'])->find($tripId);
        
        if (!$trip) {
            throw new \Exception('Trip not found');
        }

        if ($trip->status !== 'acknowledged' && $trip->status !== 'funds_issued') {
            throw new \Exception('Cannot start trip. Current status: ' . $trip->status);
        }

        DB::beginTransaction();

        try {
            // Update trip status
            $trip->status = 'in_transit';
            $trip->save();

            // Create trip history entry
            $tripHistory = TripHistory::create([
                'trip_ticket_id' => $tripId,
                'trip_number' => $this->getNextTripNumber($tripId),
                'start_lat' => $latitude,
                'start_lng' => $longitude,
                'started_at' => now(),
                'status' => 'in_progress',
            ]);

            // Update fuel receipt with start GPS
            if ($trip->gasSlip && $trip->gasSlip->fuelReceipt) {
                $fuelReceipt = $trip->gasSlip->fuelReceipt;
                $fuelReceipt->trip_started_at = now();
                $fuelReceipt->trip_start_gps_lat = $latitude;
                $fuelReceipt->trip_start_gps_lng = $longitude;
                $fuelReceipt->trip_start_gps_accuracy = $accuracy;
                $fuelReceipt->save();
            }

            // Save first GPS ping
            $this->saveGpsPing($tripId, $latitude, $longitude, $accuracy);

            // ✅ Broadcast event
            broadcast(new \App\Events\DriverLocationUpdated(
                $tripId,
                $latitude,
                $longitude,
                null
            ));

            // ✅ Send notifications
            $this->sendTripStartedNotifications($trip);

            DB::commit();

            Log::info('Trip started', [
                'trip_id' => $tripId,
                'trip_number' => $trip->trip_ticket_number,
                'latitude' => $latitude,
                'longitude' => $longitude,
            ]);

            return [
                'success' => true,
                'trip_id' => $tripId,
                'status' => 'in_transit',
                'started_at' => now(),
                'trip_history_id' => $tripHistory->history_id,
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * End a trip with GPS location
     */
    public function endTrip($tripId, $latitude, $longitude, $accuracy = null, $gpsDistance = null)
    {
        $trip = TripTicket::with(['gasSlip.fuelReceipt', 'driver.user'])->find($tripId);

        if (!$trip) {
            throw new \Exception('Trip not found');
        }

        if ($trip->status !== 'in_transit') {
            throw new \Exception('Cannot end trip. Current status: ' . $trip->status);
        }

        DB::beginTransaction();

        try {
            // Update trip status
            $trip->status = 'pending_reconciliation';
            $trip->save();

            // Complete trip history
            $currentTrip = TripHistory::where('trip_ticket_id', $tripId)
                ->where('status', 'in_progress')
                ->orderBy('trip_number', 'desc')
                ->first();

            $calculatedDistance = null;

            if ($currentTrip) {
                $currentTrip->end_lat = $latitude;
                $currentTrip->end_lng = $longitude;
                $currentTrip->ended_at = now();
                $currentTrip->status = 'completed';
                
                // Calculate distance from GPS pings
                if ($gpsDistance !== null) {
                    $currentTrip->distance_km = $gpsDistance;
                    $calculatedDistance = $gpsDistance;
                } else {
                    $calculatedDistance = $this->calculateTripDistance($tripId);
                    $currentTrip->distance_km = $calculatedDistance;
                }
                
                $currentTrip->save();
            }

            // Update fuel receipt with end GPS
            if ($trip->gasSlip && $trip->gasSlip->fuelReceipt) {
                $fuelReceipt = $trip->gasSlip->fuelReceipt;
                $fuelReceipt->trip_ended_at = now();
                $fuelReceipt->trip_end_gps_lat = $latitude;
                $fuelReceipt->trip_end_gps_lng = $longitude;
                
                if ($gpsDistance !== null) {
                    $fuelReceipt->gps_distance_km = $gpsDistance;
                } else {
                    $fuelReceipt->gps_distance_km = $calculatedDistance;
                }
                
                $fuelReceipt->trip_elapsed_minutes = $fuelReceipt->trip_started_at ? 
                    $fuelReceipt->trip_started_at->diffInMinutes(now()) : null;
                $fuelReceipt->save();
            }

            // Save final GPS ping
            $this->saveGpsPing($tripId, $latitude, $longitude, $accuracy);

            // ✅ Broadcast event
            broadcast(new \App\Events\TripCompleted(
                $tripId,
                $latitude,
                $longitude
            ));

            // ✅ Send notifications
            $this->sendTripEndedNotifications($trip, $calculatedDistance);

            DB::commit();

            Log::info('Trip ended', [
                'trip_id' => $tripId,
                'trip_number' => $trip->trip_ticket_number,
                'latitude' => $latitude,
                'longitude' => $longitude,
                'distance_km' => $calculatedDistance ?? $gpsDistance ?? null,
            ]);

            return [
                'success' => true,
                'trip_id' => $tripId,
                'status' => 'pending_reconciliation',
                'ended_at' => now(),
                'distance_km' => $calculatedDistance ?? $gpsDistance ?? null,
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Get active trips with latest GPS location (for live tracking)
     */
    public function getActiveTrips()
    {
        $trips = TripTicket::with(['vehicle', 'driver.user', 'department'])
            ->whereIn('status', ['in_transit', 'funds_issued', 'acknowledged'])
            ->orderBy('updated_at', 'desc')
            ->get();

        $result = [];

        foreach ($trips as $trip) {
            $latestPing = GpsPing::where('trip_ticket_id', $trip->trip_ticket_id)
                ->orderBy('recorded_at', 'desc')
                ->first();

            // Get route points (limited for performance)
            $routePings = GpsPing::where('trip_ticket_id', $trip->trip_ticket_id)
                ->where('is_low_accuracy', false)
                ->orderBy('recorded_at', 'asc')
                ->limit(200)
                ->get(['latitude', 'longitude', 'recorded_at', 'speed_kmh']);

            $result[] = [
                'trip_id' => $trip->trip_ticket_id,
                'ticket_number' => $trip->trip_ticket_number,
                'destination' => $trip->destination,
                'status' => $trip->status,
                'vehicle' => [
                    'plate_number' => $trip->vehicle?->plate_number ?? 'Unknown',
                    'vehicle_model' => $trip->vehicle?->vehicle_model ?? 'Unknown',
                ],
                'driver' => [
                    'name' => $trip->driver?->user?->full_name ?? 'Unknown',
                ],
                'department' => $trip->department?->department_name ?? 'Unknown',
                'current_location' => $latestPing ? [
                    'latitude' => (float) $latestPing->latitude,
                    'longitude' => (float) $latestPing->longitude,
                    'speed_kmh' => (float) ($latestPing->speed_kmh ?? 0),
                    'accuracy_meters' => (float) ($latestPing->accuracy_meters ?? 0),
                    'recorded_at' => $latestPing->recorded_at,
                ] : null,
                'route' => $routePings->map(fn($ping) => [
                    'latitude' => (float) $ping->latitude,
                    'longitude' => (float) $ping->longitude,
                    'speed_kmh' => (float) ($ping->speed_kmh ?? 0),
                    'recorded_at' => $ping->recorded_at,
                ]),
                'ping_count' => GpsPing::where('trip_ticket_id', $trip->trip_ticket_id)->count(),
                'last_update' => $latestPing?->recorded_at ?? $trip->updated_at,
            ];
        }

        return $result;
    }

    /**
     * Save GPS ping
     */
    private function saveGpsPing($tripId, $latitude, $longitude, $accuracy = null)
    {
        return GpsPing::create([
            'trip_ticket_id' => $tripId,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'accuracy_meters' => $accuracy,
            'is_low_accuracy' => $accuracy && $accuracy > 50,
            'is_queued_upload' => false,
            'has_mock_location_flag' => false,
            'recorded_at' => now(),
            'received_at' => now(),
        ]);
    }

    /**
     * Calculate total distance from GPS pings
     */
    private function calculateTripDistance($tripId)
    {
        $pings = GpsPing::where('trip_ticket_id', $tripId)
            ->where('is_low_accuracy', false)
            ->orderBy('recorded_at', 'asc')
            ->get();

        if ($pings->count() < 2) {
            return 0;
        }

        $totalDistance = 0;
        $prevPing = null;

        foreach ($pings as $ping) {
            if ($prevPing) {
                $distance = $this->haversineDistance(
                    $prevPing->latitude, $prevPing->longitude,
                    $ping->latitude, $ping->longitude
                );
                if ($distance > 0.01) { // Filter noise
                    $totalDistance += $distance;
                }
            }
            $prevPing = $ping;
        }

        return round($totalDistance, 2);
    }

    /**
     * Haversine distance calculation
     */
    private function haversineDistance($lat1, $lon1, $lat2, $lon2)
    {
        $earthRadius = 6371; // km

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }

    /**
     * Get next trip number for trip history
     */
    private function getNextTripNumber($tripId)
    {
        $last = TripHistory::where('trip_ticket_id', $tripId)
            ->max('trip_number');
        return ($last ?? 0) + 1;
    }

    // ============ PRIVATE NOTIFICATION METHODS ============

    /**
     * Send notifications when trip starts
     */
    private function sendTripStartedNotifications($trip)
    {
        $driverName = $trip->driver?->user?->full_name ?? 'Driver';
        $tripNumber = $trip->trip_ticket_number;

        try {
            // 1. Notify the person who submitted the trip
            if ($trip->submitted_by) {
                NotificationHelper::send(
                    $trip->submitted_by,
                    'trip_started',
                    'trip_ticket',
                    $trip->trip_ticket_id,
                    "Trip {$tripNumber} has been started by {$driverName}"
                );
            }

            // 2. Notify all GSO users
            $gsoUsers = User::where('role', 'gso_office')
                ->where('status', 'active')
                ->get();

            foreach ($gsoUsers as $gsoUser) {
                NotificationHelper::send(
                    $gsoUser->user_id,
                    'trip_started',
                    'trip_ticket',
                    $trip->trip_ticket_id,
                    "Trip {$tripNumber} is now in transit with {$driverName}"
                );
            }

            Log::info('Trip start notifications sent', [
                'trip_id' => $trip->trip_ticket_id,
                'recipients' => count($gsoUsers) + ($trip->submitted_by ? 1 : 0)
            ]);

        } catch (\Exception $e) {
            // Don't fail the trip if notifications fail
            Log::error('Failed to send trip start notifications: ' . $e->getMessage(), [
                'trip_id' => $trip->trip_ticket_id
            ]);
        }
    }

    /**
     * Send notifications when trip ends
     */
    private function sendTripEndedNotifications($trip, $distance = null)
    {
        $driverName = $trip->driver?->user?->full_name ?? 'Driver';
        $tripNumber = $trip->trip_ticket_number;
        $distanceText = $distance ? " ({$distance}km)" : '';

        try {
            // 1. Notify the person who submitted the trip
            if ($trip->submitted_by) {
                NotificationHelper::send(
                    $trip->submitted_by,
                    'trip_completed',
                    'trip_ticket',
                    $trip->trip_ticket_id,
                    "Trip {$tripNumber} has been completed by {$driverName}{$distanceText}"
                );
            }

            // 2. Notify all GSO users
            $gsoUsers = User::where('role', 'gso_office')
                ->where('status', 'active')
                ->get();

            foreach ($gsoUsers as $gsoUser) {
                NotificationHelper::send(
                    $gsoUser->user_id,
                    'trip_completed',
                    'trip_ticket',
                    $trip->trip_ticket_id,
                    "Trip {$tripNumber} completed by {$driverName}{$distanceText} - Pending reconciliation"
                );
            }

            Log::info('Trip end notifications sent', [
                'trip_id' => $trip->trip_ticket_id,
                'distance' => $distance,
                'recipients' => count($gsoUsers) + ($trip->submitted_by ? 1 : 0)
            ]);

        } catch (\Exception $e) {
            // Don't fail the trip if notifications fail
            Log::error('Failed to send trip end notifications: ' . $e->getMessage(), [
                'trip_id' => $trip->trip_ticket_id
            ]);
        }
    }
}
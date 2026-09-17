<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\GpsPing;
use App\Models\TripTicket;
use App\Models\TripHistory;
use App\Models\FuelReceipt;
use App\Models\GasSlip;
use App\Models\Driver;
use App\Helpers\NotificationHelper;
use App\Events\DriverLocationUpdated;
use App\Events\TripCompleted;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class GpsPingController extends Controller
{
    /**
     * Store a single GPS ping
     * ✅ FIXED: compute is_low_accuracy server-side, skip broadcast for low accuracy, server-side jitter filter
     */
    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'trip_ticket_id' => 'required|exists:trip_ticket,trip_ticket_id',
                'latitude' => 'required|numeric|between:-90,90',
                'longitude' => 'required|numeric|between:-180,180',
                'accuracy_meters' => 'nullable|numeric|min:0',
                'speed_kmh' => 'nullable|numeric|min:0',
                'heading_degrees' => 'nullable|numeric|between:0,360',
                'recorded_at' => 'nullable|date',
                'is_low_accuracy' => 'nullable|boolean',
                'has_mock_location_flag' => 'nullable|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver record not found'
                ], 404);
            }

            $trip = TripTicket::where('trip_ticket_id', $request->trip_ticket_id)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$trip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found or not assigned to you'
                ], 404);
            }

            // ✅ Only 'acknowledged' and 'in_transit' can receive pings
            $allowedPingStatuses = ['acknowledged', 'in_transit'];
            if (!in_array($trip->status, $allowedPingStatuses)) {
                // ✅ Return success (not error) so mobile doesn't retry on completed trip
                return response()->json([
                    'success' => true,
                    'skipped' => true,
                    'reason' => 'trip_not_active',
                    'status' => $trip->status,
                ]);
            }

            // ✅ Compute is_low_accuracy server-side — don't trust client
            $accuracy = (float) ($request->accuracy_meters ?? 0);
            $isLowAccuracy = $accuracy > 30;

            // ✅ Server-side jitter filter — mirror frontend logic
            if (!$isLowAccuracy) {
                $lastAccuratePing = GpsPing::where('trip_ticket_id', $request->trip_ticket_id)
                    ->where('is_low_accuracy', false)
                    ->orderBy('recorded_at', 'desc')
                    ->first();

                if ($lastAccuratePing) {
                    $distMeters = $this->haversineKm(
                        (float) $lastAccuratePing->latitude,
                        (float) $lastAccuratePing->longitude,
                        (float) $request->latitude,
                        (float) $request->longitude
                    ) * 1000;

                    $speed = (float) ($request->speed_kmh ?? 0);

                    if ($distMeters < 15 && $speed < 2) {
                        Log::info('Server skipped jitter ping', [
                            'trip_id' => $request->trip_ticket_id,
                            'dist_m' => round($distMeters, 1),
                            'speed' => $speed,
                        ]);
                        return response()->json([
                            'success' => true,
                            'skipped' => true,
                            'reason' => 'jitter',
                        ]);
                    }
                }
            }

            $ping = GpsPing::create([
                'trip_ticket_id' => $request->trip_ticket_id,
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                'accuracy_meters' => $request->accuracy_meters ?? null,
                'speed_kmh' => $request->speed_kmh ?? null,
                'heading_degrees' => $request->heading_degrees ?? null,
                'is_low_accuracy' => $isLowAccuracy,
                'is_queued_upload' => $request->is_queued_upload ?? false,
                'has_mock_location_flag' => $request->has_mock_location_flag ?? false,
                'recorded_at' => $request->recorded_at ?? now(),
                'received_at' => now(),
            ]);

            // ✅ Only broadcast accurate pings
            if (!$isLowAccuracy) {
                try {
                    broadcast(new DriverLocationUpdated(
                        $request->trip_ticket_id,
                        $request->latitude,
                        $request->longitude,
                        $request->speed_kmh ?? null,
                        $request->accuracy_meters ?? null
                    ));
                } catch (\Exception $e) {
                    Log::warning('Failed to broadcast location: ' . $e->getMessage());
                }
            } else {
                Log::info('Low-accuracy ping stored but not broadcast', [
                    'trip_id' => $request->trip_ticket_id,
                    'accuracy' => $accuracy,
                ]);
            }

            Log::info('GPS ping stored', [
                'ping_id' => $ping->ping_id,
                'trip_id' => $request->trip_ticket_id,
                'lat' => $request->latitude,
                'lng' => $request->longitude,
                'is_low_accuracy' => $isLowAccuracy,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'GPS ping stored successfully',
                'data' => [
                    'ping_id' => $ping->ping_id,
                    'latitude' => $ping->latitude,
                    'longitude' => $ping->longitude,
                    'recorded_at' => $ping->recorded_at,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('GPS Ping store error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to save GPS ping: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store batch GPS pings (offline sync)
     * ✅ FIXED: compute is_low_accuracy server-side, only broadcast if last ping is accurate
     */
    public function storeBatch(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'trip_ticket_id' => 'required|exists:trip_ticket,trip_ticket_id',
                'pings' => 'required|array|min:1',
                'pings.*.latitude' => 'required|numeric|between:-90,90',
                'pings.*.longitude' => 'required|numeric|between:-180,180',
                'pings.*.accuracy_meters' => 'nullable|numeric|min:0',
                'pings.*.speed_kmh' => 'nullable|numeric|min:0',
                'pings.*.heading_degrees' => 'nullable|numeric|between:0,360',
                'pings.*.recorded_at' => 'required|date',
                'pings.*.is_low_accuracy' => 'nullable|boolean',
                'pings.*.has_mock_location_flag' => 'nullable|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver record not found'
                ], 404);
            }

            $trip = TripTicket::where('trip_ticket_id', $request->trip_ticket_id)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$trip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found or not assigned to you'
                ], 404);
            }

            $allowedPingStatuses = ['acknowledged', 'in_transit'];
            if (!in_array($trip->status, $allowedPingStatuses)) {
                return response()->json([
                    'success' => true,
                    'skipped' => true,
                    'reason' => 'trip_not_active',
                    'status' => $trip->status,
                ]);
            }

            $createdPings = [];

            DB::beginTransaction();

            foreach ($request->pings as $pingData) {
                // ✅ Compute is_low_accuracy server-side
                $accuracy = (float) ($pingData['accuracy_meters'] ?? 0);
                $isLowAccuracy = $accuracy > 30;

                $ping = GpsPing::create([
                    'trip_ticket_id' => $request->trip_ticket_id,
                    'latitude' => $pingData['latitude'],
                    'longitude' => $pingData['longitude'],
                    'accuracy_meters' => $pingData['accuracy_meters'] ?? null,
                    'speed_kmh' => $pingData['speed_kmh'] ?? null,
                    'heading_degrees' => $pingData['heading_degrees'] ?? null,
                    'is_low_accuracy' => $isLowAccuracy,
                    'is_queued_upload' => true,
                    'has_mock_location_flag' => $pingData['has_mock_location_flag'] ?? false,
                    'recorded_at' => $pingData['recorded_at'],
                    'received_at' => now(),
                ]);
                $createdPings[] = $ping->ping_id;
            }

            DB::commit();

            // ✅ Only broadcast the last ping if it's accurate
            if (!empty($request->pings)) {
                $lastPing = end($request->pings);
                $lastAccuracy = (float) ($lastPing['accuracy_meters'] ?? 0);
                if ($lastAccuracy <= 30) {
                    try {
                        broadcast(new DriverLocationUpdated(
                            $request->trip_ticket_id,
                            $lastPing['latitude'],
                            $lastPing['longitude'],
                            $lastPing['speed_kmh'] ?? null,
                            $lastPing['accuracy_meters'] ?? null
                        ));
                    } catch (\Exception $e) {
                        Log::warning('Failed to broadcast batch location: ' . $e->getMessage());
                    }
                }
            }

            Log::info('Batch GPS pings stored', [
                'count' => count($createdPings),
                'trip_id' => $request->trip_ticket_id
            ]);

            return response()->json([
                'success' => true,
                'message' => count($createdPings) . ' GPS pings stored successfully',
                'data' => [
                    'stored_count' => count($createdPings),
                    'ping_ids' => $createdPings,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('GPS Ping batch store error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to save GPS pings: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Start GPS tracking for a trip
     */
    public function startTracking(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'trip_ticket_id' => 'required|exists:trip_ticket,trip_ticket_id',
                'latitude' => 'required|numeric|between:-90,90',
                'longitude' => 'required|numeric|between:-180,180',
                'accuracy_meters' => 'nullable|numeric|min:0',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver record not found'
                ], 404);
            }

            $trip = TripTicket::with(['vehicle', 'gasSlip.fuelReceipt'])
                ->where('trip_ticket_id', $request->trip_ticket_id)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$trip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found or not assigned to you'
                ], 404);
            }

            if ($trip->status === 'in_transit') {
                return response()->json([
                    'success' => true,
                    'message' => 'Trip already in progress',
                    'data' => [
                        'trip_ticket_id' => $trip->trip_ticket_id,
                        'status' => $trip->status
                    ]
                ]);
            }

            $allowedStartStatuses = ['funds_issued', 'acknowledged', 'completed'];
            if (!in_array($trip->status, $allowedStartStatuses)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot start trip. Current status: ' . $trip->status .
                                '. Allowed: ' . implode(', ', $allowedStartStatuses)
                ], 422);
            }

            $otherActive = TripTicket::where('driver_id', $driver->driver_id)
                ->where('status', 'in_transit')
                ->where('trip_ticket_id', '!=', $trip->trip_ticket_id)
                ->exists();

            if ($otherActive) {
                return response()->json([
                    'success' => false,
                    'message' => 'You already have another trip in progress. Complete it first.'
                ], 400);
            }

            DB::beginTransaction();

            $gasSlip = GasSlip::where('trip_ticket_id', $trip->trip_ticket_id)->first();
            if ($gasSlip && !$gasSlip->acknowledged_at) {
                $gasSlip->acknowledged_by = $user->user_id;
                $gasSlip->acknowledged_at = now();
                $gasSlip->save();
                Log::info("Auto-acknowledged gas slip for ticket {$trip->trip_ticket_number}");
            }

            $trip->trip_count = ($trip->trip_count ?? 0) + 1;
            $trip->status = 'in_transit';
            $trip->save();

            $tripHistory = TripHistory::create([
                'trip_ticket_id' => $trip->trip_ticket_id,
                'trip_number' => $trip->trip_count,
                'start_lat' => $request->latitude,
                'start_lng' => $request->longitude,
                'started_at' => now(),
                'status' => 'in_progress',
            ]);

            if ($gasSlip) {
                $fuelReceipt = FuelReceipt::firstOrNew(['gas_slip_id' => $gasSlip->gas_slip_id]);
                $fuelReceipt->trip_started_at = now();
                $fuelReceipt->trip_start_gps_lat = $request->latitude;
                $fuelReceipt->trip_start_gps_lng = $request->longitude;
                $fuelReceipt->trip_start_gps_accuracy = $request->accuracy_meters ?? null;
                $fuelReceipt->save();
            }

            // Store initial GPS ping
            $accuracy = (float) ($request->accuracy_meters ?? 0);
            GpsPing::create([
                'trip_ticket_id' => $trip->trip_ticket_id,
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                'accuracy_meters' => $request->accuracy_meters ?? null,
                'is_low_accuracy' => $accuracy > 30,
                'is_queued_upload' => false,
                'recorded_at' => now(),
                'received_at' => now(),
            ]);

            DB::commit();

            // ✅ Only broadcast if accuracy is good
            if ($accuracy <= 30) {
                try {
                    broadcast(new DriverLocationUpdated(
                        $trip->trip_ticket_id,
                        $request->latitude,
                        $request->longitude,
                        null,
                        $request->accuracy_meters ?? null
                    ));
                } catch (\Exception $e) {
                    Log::warning('Failed to broadcast trip start: ' . $e->getMessage());
                }
            }

            Log::info('GPS tracking started', [
                'trip_id' => $trip->trip_ticket_id,
                'driver_id' => $driver->driver_id,
                'history_id' => $tripHistory->history_id,
            ]);

            NotificationHelper::send(
                $trip->submitted_by,
                'trip_started',
                'trip_ticket',
                $trip->trip_ticket_id,
                "Trip {$trip->trip_ticket_number} has been started by driver " . $user->full_name
            );

            return response()->json([
                'success' => true,
                'message' => 'GPS tracking started successfully',
                'data' => [
                    'trip_ticket_id' => $trip->trip_ticket_id,
                    'status' => $trip->status,
                    'trip_started_at' => now(),
                    'trip_history_id' => $tripHistory->history_id,
                    'trip_number' => $trip->trip_count,
                    'latitude' => $request->latitude,
                    'longitude' => $request->longitude,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Start GPS tracking error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to start GPS tracking: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Stop GPS tracking for a trip
     * (kept for backward compat — mobile uses DriverController::completeTrip)
     */
    public function stopTracking(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'trip_ticket_id' => 'required|exists:trip_ticket,trip_ticket_id',
                'latitude' => 'required|numeric|between:-90,90',
                'longitude' => 'required|numeric|between:-180,180',
                'accuracy_meters' => 'nullable|numeric|min:0',
                'is_done' => 'nullable|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver record not found'
                ], 404);
            }

            $trip = TripTicket::with(['vehicle', 'gasSlip.fuelReceipt'])
                ->where('trip_ticket_id', $request->trip_ticket_id)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$trip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found or not assigned to you'
                ], 404);
            }

            if (in_array($trip->status, ['completed', 'pending_gso_validation', 'closed'])) {
                return response()->json([
                    'success' => true,
                    'message' => 'Trip already completed',
                    'data' => [
                        'trip_ticket_id' => $trip->trip_ticket_id,
                        'status' => $trip->status
                    ]
                ]);
            }

            if ($trip->status !== 'in_transit') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot stop trip. Current status: ' . $trip->status . '. Required: in_transit'
                ], 422);
            }

            DB::beginTransaction();

            $pings = GpsPing::where('trip_ticket_id', $trip->trip_ticket_id)
                ->where('is_low_accuracy', false)
                ->orderBy('recorded_at', 'asc')
                ->get(['latitude', 'longitude']);

            $serverDistance = 0.0;
            $pingCount = $pings->count();

            if ($pingCount > 1) {
                for ($i = 1; $i < $pingCount; $i++) {
                    $serverDistance += $this->haversineKm(
                        (float) $pings[$i - 1]->latitude,
                        (float) $pings[$i - 1]->longitude,
                        (float) $pings[$i]->latitude,
                        (float) $pings[$i]->longitude
                    );
                }
            }

            $finalDistance = round($serverDistance, 2);

            $currentTrip = TripHistory::where('trip_ticket_id', $trip->trip_ticket_id)
                ->where('status', 'in_progress')
                ->orderBy('trip_number', 'desc')
                ->first();

            if ($currentTrip) {
                $currentTrip->end_lat = $request->latitude;
                $currentTrip->end_lng = $request->longitude;
                $currentTrip->ended_at = now();
                $currentTrip->distance_km = $finalDistance;
                $currentTrip->status = 'completed';
                $currentTrip->save();
            }

            if ($trip->gasSlip && $trip->gasSlip->fuelReceipt) {
                $fuelReceipt = $trip->gasSlip->fuelReceipt;
                $fuelReceipt->trip_ended_at = now();
                $fuelReceipt->gps_distance_km =
                    round((float) $fuelReceipt->gps_distance_km + $finalDistance, 2);
                $fuelReceipt->trip_elapsed_minutes = $fuelReceipt->trip_started_at ?
                    $fuelReceipt->trip_started_at->diffInMinutes(now()) : null;
                $fuelReceipt->save();
            }

            GpsPing::where('trip_ticket_id', $trip->trip_ticket_id)->delete();

            $isDone = $request->is_done ?? true;

            if ($isDone) {
                $trip->status = 'pending_gso_validation';
                $message = 'Trip completed! Awaiting GSO validation.';
            } else {
                $trip->status = 'completed';
                $message = 'Trip completed for today! You can start again tomorrow.';
            }

            $trip->syncActuals();
            $trip->save();

            DB::commit();

            try {
                broadcast(new TripCompleted(
                    $trip->trip_ticket_id,
                    $request->latitude,
                    $request->longitude
                ));
            } catch (\Exception $e) {
                Log::warning('Failed to broadcast trip completion: ' . $e->getMessage());
            }

            Log::info('GPS tracking stopped', [
                'trip_id' => $trip->trip_ticket_id,
                'driver_id' => $driver->driver_id,
                'distance_km' => $finalDistance,
                'ping_count' => $pingCount,
                'is_done' => $isDone,
            ]);

            NotificationHelper::send(
                $trip->submitted_by,
                'trip_completed',
                'trip_ticket',
                $trip->trip_ticket_id,
                "Trip {$trip->trip_ticket_number} has been completed by driver " . $user->full_name
            );

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => [
                    'trip_ticket_id' => $trip->trip_ticket_id,
                    'status' => $trip->status,
                    'trip_ended_at' => now(),
                    'latitude' => $request->latitude,
                    'longitude' => $request->longitude,
                    'distance_km' => $finalDistance,
                    'ping_count' => $pingCount,
                    'is_complete' => $isDone,
                    'actual_distance_km' => $trip->actual_distance_km,
                    'actual_fuel_used' => $trip->actual_fuel_used,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Stop GPS tracking error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to stop GPS tracking: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Calculate total distance from GPS pings for a trip
     */
    public function calculateDistance($tripId)
    {
        try {
            $user = auth()->user();

            $trip = TripTicket::with(['driver'])->find($tripId);
            if (!$trip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip not found'
                ], 404);
            }

            $isGSO = $user->role === 'gso_office';
            $isDriver = $trip->driver && (int) $trip->driver->user_id === (int) $user->user_id;

            if (!$isGSO && !$isDriver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }

            $distance = $this->calculateTripDistance($tripId);

            return response()->json([
                'success' => true,
                'data' => [
                    'trip_id' => $tripId,
                    'distance_km' => $distance,
                    'calculated_at' => now(),
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Calculate distance error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to calculate distance: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check if trip is deviating from route
     */
    public function checkDeviation(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'trip_ticket_id' => 'required|exists:trip_ticket,trip_ticket_id',
                'latitude' => 'required|numeric|between:-90,90',
                'longitude' => 'required|numeric|between:-180,180',
                'deviation_threshold_km' => 'nullable|numeric|min:0.1|max:10',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = $request->user();
            $trip = TripTicket::with(['driver'])->find($request->trip_ticket_id);

            if (!$trip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip not found'
                ], 404);
            }

            $isGSO = $user->role === 'gso_office';
            $isDriver = $trip->driver && (int) $trip->driver->user_id === (int) $user->user_id;

            if (!$isGSO && !$isDriver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }

            $threshold = $request->deviation_threshold_km ?? 2.0;

            $startPing = TripHistory::where('trip_ticket_id', $trip->trip_ticket_id)
                ->where('status', 'in_progress')
                ->orderBy('trip_number', 'desc')
                ->first();

            if (!$startPing) {
                $fuelReceipt = FuelReceipt::whereHas('gasSlip', function ($q) use ($trip) {
                    $q->where('trip_ticket_id', $trip->trip_ticket_id);
                })->first();

                if ($fuelReceipt && $fuelReceipt->trip_start_gps_lat) {
                    $startLat = $fuelReceipt->trip_start_gps_lat;
                    $startLng = $fuelReceipt->trip_start_gps_lng;
                } else {
                    return response()->json([
                        'success' => false,
                        'message' => 'No start location found for this trip'
                    ]);
                }
            } else {
                $startLat = $startPing->start_lat;
                $startLng = $startPing->start_lng;
            }

            $distanceFromStart = $this->haversineDistance(
                $startLat, $startLng,
                $request->latitude, $request->longitude
            );

            $isDeviating = $distanceFromStart > $threshold;

            return response()->json([
                'success' => true,
                'data' => [
                    'trip_id' => $trip->trip_ticket_id,
                    'ticket_number' => $trip->trip_ticket_number,
                    'current_latitude' => $request->latitude,
                    'current_longitude' => $request->longitude,
                    'start_latitude' => $startLat,
                    'start_longitude' => $startLng,
                    'distance_from_start_km' => round($distanceFromStart, 2),
                    'deviation_threshold_km' => $threshold,
                    'is_deviating' => $isDeviating,
                    'status' => $isDeviating ? 'DEVIATING' : 'ON_ROUTE',
                    'warning' => $isDeviating ? 'Vehicle has deviated from the trip route' : null,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Check deviation error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to check deviation: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get trip details with all locations
     */
    public function getTripWithLocations(Request $request, $tripId)
    {
        try {
            $user = $request->user();

            $trip = TripTicket::with(['driver', 'vehicle', 'department'])->find($tripId);

            if (!$trip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip not found'
                ], 404);
            }

            $isGSO = $user->role === 'gso_office';
            $isDriver = $trip->driver && (int) $trip->driver->user_id === (int) $user->user_id;
            $isRequester = (int) $trip->submitted_by === (int) $user->user_id;

            if (!$isGSO && !$isDriver && !$isRequester) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }

            $pings = GpsPing::where('trip_ticket_id', $tripId)
                ->orderBy('recorded_at', 'asc')
                ->get();

            $totalDistance = 0;
            $maxSpeed = 0;
            $prevPing = null;
            $duration = 0;

            foreach ($pings as $ping) {
                if ($ping->speed_kmh && $ping->speed_kmh > $maxSpeed) {
                    $maxSpeed = $ping->speed_kmh;
                }

                if ($prevPing) {
                    $distance = $this->haversineDistance(
                        $prevPing->latitude, $prevPing->longitude,
                        $ping->latitude, $ping->longitude
                    );
                    if ($distance > 0.01) {
                        $totalDistance += $distance;
                    }
                    $duration += $prevPing->recorded_at->diffInSeconds($ping->recorded_at);
                }
                $prevPing = $ping;
            }

            $avgSpeed = ($duration > 0 && $totalDistance > 0) ? ($totalDistance / $duration) * 3.6 : 0;

            $tripHistory = TripHistory::where('trip_ticket_id', $tripId)
                ->orderBy('trip_number', 'asc')
                ->get();

            $vehicle = $trip->vehicle;
            $driver = $trip->driver;
            $driverUser = $driver ? $driver->user : null;
            $department = $trip->department;

            return response()->json([
                'success' => true,
                'data' => [
                    'trip' => [
                        'trip_ticket_id' => $trip->trip_ticket_id,
                        'trip_ticket_number' => $trip->trip_ticket_number,
                        'destination' => $trip->destination,
                        'status' => $trip->status,
                        'trip_date' => $trip->trip_date,
                        'vehicle' => [
                            'plate_number' => $vehicle ? $vehicle->plate_number : 'Unknown',
                            'vehicle_model' => $vehicle ? $vehicle->vehicle_model : 'Unknown',
                        ],
                        'driver' => [
                            'name' => $driverUser ? $driverUser->full_name : 'Unknown',
                        ],
                        'department' => $department ? $department->department_name : 'Unknown',
                    ],
                    'stats' => [
                        'total_pings' => $pings->count(),
                        'total_distance_km' => round($totalDistance, 2),
                        'max_speed_kmh' => round($maxSpeed, 2),
                        'avg_speed_kmh' => round($avgSpeed, 2),
                        'duration_minutes' => round($duration / 60, 2),
                        'start_time' => $pings->first() ? $pings->first()->recorded_at : null,
                        'end_time' => $pings->last() ? $pings->last()->recorded_at : null,
                    ],
                    'locations' => $pings->map(fn($ping) => [
                        'latitude' => (float) $ping->latitude,
                        'longitude' => (float) $ping->longitude,
                        'speed_kmh' => (float) ($ping->speed_kmh ?? 0),
                        'accuracy_meters' => (float) ($ping->accuracy_meters ?? 0),
                        'recorded_at' => $ping->recorded_at,
                    ]),
                    'trip_history' => $tripHistory->map(fn($history) => [
                        'trip_number' => $history->trip_number,
                        'start_lat' => $history->start_lat,
                        'start_lng' => $history->start_lng,
                        'started_at' => $history->started_at,
                        'end_lat' => $history->end_lat,
                        'end_lng' => $history->end_lng,
                        'ended_at' => $history->ended_at,
                        'distance_km' => $history->distance_km,
                        'status' => $history->status,
                    ]),
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Get trip with locations error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch trip: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all active trips with latest GPS location
     * ✅ FIXED: prefer latest ACCURATE ping (not latest ping)
     */
    public function getActiveTrips(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user || $user->role !== 'gso_office') {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. Only GSO can view live tracking.'
                ], 403);
            }

            $activeTrips = TripTicket::with(['vehicle', 'driver.user', 'department'])
                ->whereIn('status', ['in_transit', 'acknowledged', 'funds_issued'])
                ->orderBy('updated_at', 'desc')
                ->limit(50)
                ->get();

            $result = [];

            foreach ($activeTrips as $trip) {
                // ✅ Prefer latest ACCURATE ping — not the latest ping
                $latestPing = GpsPing::where('trip_ticket_id', $trip->trip_ticket_id)
                    ->where('is_low_accuracy', false)
                    ->orderBy('recorded_at', 'desc')
                    ->first();

                // Fallback: if no accurate ping yet, use the newest (so trip still shows)
                if (!$latestPing) {
                    $latestPing = GpsPing::where('trip_ticket_id', $trip->trip_ticket_id)
                        ->orderBy('recorded_at', 'desc')
                        ->first();
                }

                // Still no ping at all? Skip this trip
                if (!$latestPing) {
                    continue;
                }

                $routePings = GpsPing::where('trip_ticket_id', $trip->trip_ticket_id)
                    ->where('is_low_accuracy', false)
                    ->orderBy('recorded_at', 'asc')
                    ->limit(50)
                    ->get(['latitude', 'longitude', 'recorded_at', 'speed_kmh']);

                $vehicle = $trip->vehicle;
                $driver = $trip->driver;
                $driverUser = $driver ? $driver->user : null;
                $department = $trip->department;

                $result[] = [
                    'trip_id' => $trip->trip_ticket_id,
                    'ticket_number' => $trip->trip_ticket_number ?? 'N/A',
                    'destination' => $trip->destination ?? 'N/A',
                    'status' => $trip->status ?? 'unknown',
                    'vehicle' => [
                        'plate_number' => $vehicle ? $vehicle->plate_number : 'Unknown',
                        'vehicle_model' => $vehicle ? $vehicle->vehicle_model : 'Unknown',
                    ],
                    'driver' => [
                        'name' => $driverUser ? $driverUser->full_name : 'Unknown',
                    ],
                    'department' => $department ? $department->department_name : 'Unknown',
                    'current_location' => [
                        'latitude' => (float) $latestPing->latitude,
                        'longitude' => (float) $latestPing->longitude,
                        'speed_kmh' => (float) ($latestPing->speed_kmh ?? 0),
                        'accuracy_meters' => (float) ($latestPing->accuracy_meters ?? 0),
                        'recorded_at' => $latestPing->recorded_at,
                        'is_low_accuracy' => (bool) $latestPing->is_low_accuracy,
                    ],
                    'route' => $routePings->map(function ($ping) {
                        return [
                            'latitude' => (float) $ping->latitude,
                            'longitude' => (float) $ping->longitude,
                            'speed_kmh' => (float) ($ping->speed_kmh ?? 0),
                            'recorded_at' => $ping->recorded_at,
                        ];
                    }),
                    'ping_count' => GpsPing::where('trip_ticket_id', $trip->trip_ticket_id)->count(),
                    'last_update' => $latestPing->recorded_at,
                ];
            }

            return response()->json([
                'success' => true,
                'data' => $result,
                'meta' => [
                    'total_active' => count($result),
                    'updated_at' => now()->toDateTimeString(),
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Get active trips GPS error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch active trips: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get GPS pings for a trip (driver-only)
     */
    public function getPings(Request $request, $tripId)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver record not found'
                ], 404);
            }

            $trip = TripTicket::where('trip_ticket_id', $tripId)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$trip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found or not assigned to you'
                ], 404);
            }

            $limit = $request->get('limit', 100);
            $since = $request->get('since');

            $query = GpsPing::where('trip_ticket_id', $tripId)
                ->orderBy('recorded_at', 'desc');

            if ($since) {
                $query->where('recorded_at', '>=', $since);
            }

            $pings = $query->limit($limit)->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'trip_ticket_id' => $tripId,
                    'total_pings' => $pings->count(),
                    'pings' => $pings->map(function ($ping) {
                        return [
                            'ping_id' => $ping->ping_id,
                            'latitude' => $ping->latitude,
                            'longitude' => $ping->longitude,
                            'accuracy_meters' => $ping->accuracy_meters,
                            'speed_kmh' => $ping->speed_kmh,
                            'heading_degrees' => $ping->heading_degrees,
                            'is_low_accuracy' => $ping->is_low_accuracy,
                            'recorded_at' => $ping->recorded_at,
                        ];
                    }),
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Get GPS pings error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch GPS pings: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get latest GPS ping for a trip (driver-only)
     */
    public function getLatestPing(Request $request, $tripId)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver record not found'
                ], 404);
            }

            $trip = TripTicket::where('trip_ticket_id', $tripId)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$trip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found or not assigned to you'
                ], 404);
            }

            $ping = GpsPing::where('trip_ticket_id', $tripId)
                ->orderBy('recorded_at', 'desc')
                ->first();

            if (!$ping) {
                return response()->json([
                    'success' => true,
                    'data' => null,
                    'message' => 'No GPS pings found for this trip'
                ]);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'ping_id' => $ping->ping_id,
                    'latitude' => $ping->latitude,
                    'longitude' => $ping->longitude,
                    'accuracy_meters' => $ping->accuracy_meters,
                    'speed_kmh' => $ping->speed_kmh,
                    'heading_degrees' => $ping->heading_degrees,
                    'is_low_accuracy' => $ping->is_low_accuracy,
                    'recorded_at' => $ping->recorded_at,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Get latest GPS ping error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch latest GPS ping: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get GPS track for a trip (full route) — driver-only
     */
    public function getTrack(Request $request, $tripId)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver record not found'
                ], 404);
            }

            $trip = TripTicket::where('trip_ticket_id', $tripId)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$trip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found or not assigned to you'
                ], 404);
            }

            $pings = GpsPing::where('trip_ticket_id', $tripId)
                ->where('is_low_accuracy', false)
                ->orderBy('recorded_at', 'asc')
                ->get();

            $trackData = [];
            $totalDistance = 0;
            $maxSpeed = 0;
            $avgSpeed = 0;
            $totalTime = 0;
            $prevPing = null;

            foreach ($pings as $ping) {
                $trackData[] = [
                    'latitude' => $ping->latitude,
                    'longitude' => $ping->longitude,
                    'speed_kmh' => $ping->speed_kmh,
                    'heading_degrees' => $ping->heading_degrees,
                    'recorded_at' => $ping->recorded_at,
                ];

                if ($ping->speed_kmh && $ping->speed_kmh > $maxSpeed) {
                    $maxSpeed = $ping->speed_kmh;
                }

                if ($prevPing) {
                    $distance = $this->haversineDistance(
                        $prevPing->latitude, $prevPing->longitude,
                        $ping->latitude, $ping->longitude
                    );
                    $totalDistance += $distance;
                    $timeDiff = $prevPing->recorded_at->diffInSeconds($ping->recorded_at);
                    $totalTime += $timeDiff;
                }

                $prevPing = $ping;
            }

            if ($totalTime > 0 && $trackData) {
                $avgSpeed = ($totalDistance / $totalTime) * 3.6;
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'trip_ticket_id' => $tripId,
                    'total_pings' => $pings->count(),
                    'total_distance_km' => round($totalDistance, 2),
                    'max_speed_kmh' => round($maxSpeed, 2),
                    'avg_speed_kmh' => round($avgSpeed, 2),
                    'duration_minutes' => round($totalTime / 60, 2),
                    'start_time' => $pings->first()?->recorded_at,
                    'end_time' => $pings->last()?->recorded_at,
                    'track' => $trackData,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Get GPS track error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch GPS track: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get route for a trip (alias for getTrack)
     */
    public function getTripRoute(Request $request, $tripId)
    {
        try {
            $user = $request->user();

            $trip = TripTicket::with(['driver'])->find($tripId);
            if (!$trip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip not found'
                ], 404);
            }

            $isGSO = $user->role === 'gso_office';
            $isDriver = $trip->driver && (int) $trip->driver->user_id === (int) $user->user_id;

            if (!$isGSO && !$isDriver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }

            return $this->getTrack($request, $tripId);

        } catch (\Exception $e) {
            Log::error('Get trip route error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch trip route: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get trip summary with GPS stats
     */
    public function getTripSummary(Request $request, $tripId)
    {
        try {
            $user = $request->user();

            $trip = TripTicket::with(['driver'])->find($tripId);
            if (!$trip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip not found'
                ], 404);
            }

            $isGSO = $user->role === 'gso_office';
            $isDriver = $trip->driver && (int) $trip->driver->user_id === (int) $user->user_id;

            if (!$isGSO && !$isDriver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }

            $pings = GpsPing::where('trip_ticket_id', $tripId)
                ->where('is_low_accuracy', false)
                ->orderBy('recorded_at', 'asc')
                ->get();

            $firstPing = $pings->first();
            $lastPing = $pings->last();

            $totalDistance = 0;
            $prevPing = null;
            $maxSpeed = 0;
            $avgSpeed = 0;
            $totalTime = 0;

            foreach ($pings as $ping) {
                if ($ping->speed_kmh && $ping->speed_kmh > $maxSpeed) {
                    $maxSpeed = $ping->speed_kmh;
                }

                if ($prevPing) {
                    $distance = $this->haversineDistance(
                        $prevPing->latitude, $prevPing->longitude,
                        $ping->latitude, $ping->longitude
                    );
                    $totalDistance += $distance;
                    $totalTime += $prevPing->recorded_at->diffInSeconds($ping->recorded_at);
                }

                $prevPing = $ping;
            }

            if ($totalTime > 0 && $pings->count() > 1) {
                $avgSpeed = ($totalDistance / $totalTime) * 3.6;
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'trip_ticket_id' => $tripId,
                    'trip_ticket_number' => $trip->trip_ticket_number,
                    'destination' => $trip->destination,
                    'status' => $trip->status,
                    'total_pings' => $pings->count(),
                    'total_distance_km' => round($totalDistance, 2),
                    'max_speed_kmh' => round($maxSpeed, 2),
                    'avg_speed_kmh' => round($avgSpeed, 2),
                    'duration_minutes' => round($totalTime / 60, 2),
                    'start_location' => $firstPing ? [
                        'latitude' => $firstPing->latitude,
                        'longitude' => $firstPing->longitude,
                        'recorded_at' => $firstPing->recorded_at,
                    ] : null,
                    'end_location' => $lastPing ? [
                        'latitude' => $lastPing->latitude,
                        'longitude' => $lastPing->longitude,
                        'recorded_at' => $lastPing->recorded_at,
                    ] : null,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Get trip summary error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch trip summary: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete GPS pings for a trip (GSO only)
     */
    public function deletePings(Request $request, $tripId)
    {
        try {
            if (!auth()->user() || auth()->user()->role !== 'gso_office') {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. Only GSO can delete GPS data.'
                ], 403);
            }

            $count = GpsPing::where('trip_ticket_id', $tripId)->delete();

            Log::warning('GPS pings deleted', [
                'trip_id' => $tripId,
                'count' => $count,
                'deleted_by' => auth()->user()->user_id
            ]);

            return response()->json([
                'success' => true,
                'message' => "{$count} GPS pings deleted successfully",
                'data' => [
                    'trip_ticket_id' => $tripId,
                    'deleted_count' => $count,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Delete GPS pings error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete GPS pings: ' . $e->getMessage()
            ], 500);
        }
    }

    // ============ PRIVATE HELPERS ============

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
                if ($distance > 0.01) {
                    $totalDistance += $distance;
                }
            }
            $prevPing = $ping;
        }

        return round($totalDistance, 2);
    }

    private function haversineDistance($lat1, $lon1, $lat2, $lon2)
    {
        $earthRadius = 6371;

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }

    private function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        return $this->haversineDistance($lat1, $lon1, $lat2, $lon2);
    }

    /**
     * Get real-time trip stats (distance, fuel consumption, speed)
     */
    public function getRealtimeStats(Request $request, $tripId)
    {
        try {
            $user = $request->user();

            $trip = TripTicket::with(['driver', 'vehicle'])->find($tripId);
            if (!$trip) {
                return response()->json(['success' => false, 'message' => 'Trip not found'], 404);
            }

            $isGSO = $user->role === 'gso_office';
            $isDriver = $trip->driver && (int) $trip->driver->user_id === (int) $user->user_id;
            if (!$isGSO && !$isDriver) {
                return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
            }

            $latestPing = GpsPing::where('trip_ticket_id', $tripId)
                ->orderBy('recorded_at', 'desc')
                ->first();

            $pings = GpsPing::where('trip_ticket_id', $tripId)
                ->where('is_low_accuracy', false)
                ->orderBy('recorded_at', 'asc')
                ->get();

            $totalDistance = 0;
            $maxSpeed = 0;
            $avgSpeed = 0;
            $totalTime = 0;
            $prevPing = null;
            $estimatedFuelConsumed = 0;

            $fuelEfficiency = $trip->vehicle?->fuel_efficiency ?? 10;

            foreach ($pings as $ping) {
                if ($ping->speed_kmh && $ping->speed_kmh > $maxSpeed) {
                    $maxSpeed = $ping->speed_kmh;
                }

                if ($prevPing) {
                    $distance = $this->haversineDistance(
                        $prevPing->latitude, $prevPing->longitude,
                        $ping->latitude, $ping->longitude
                    );
                    if ($distance > 0.01) {
                        $totalDistance += $distance;
                    }
                    $totalTime += $prevPing->recorded_at->diffInSeconds($ping->recorded_at);
                }
                $prevPing = $ping;
            }

            if ($totalTime > 0 && $pings->count() > 1) {
                $avgSpeed = ($totalDistance / $totalTime) * 3.6;
            }

            if ($totalDistance > 0 && $fuelEfficiency > 0) {
                $estimatedFuelConsumed = $totalDistance / $fuelEfficiency;
            }

            $currentTripNumber = TripHistory::where('trip_ticket_id', $tripId)
                ->where('status', 'in_progress')
                ->value('trip_number') ?? $trip->trip_count ?? 0;

            return response()->json([
                'success' => true,
                'data' => [
                    'trip_ticket_id' => $tripId,
                    'trip_ticket_number' => $trip->trip_ticket_number,
                    'status' => $trip->status,
                    'trip_number' => $currentTripNumber,
                    'ping_count' => $pings->count(),
                    'total_distance_km' => round($totalDistance, 2),
                    'current_speed_kmh' => $latestPing?->speed_kmh ?? 0,
                    'max_speed_kmh' => round($maxSpeed, 2),
                    'avg_speed_kmh' => round($avgSpeed, 2),
                    'duration_minutes' => $totalTime > 0 ? round($totalTime / 60, 2) : 0,
                    'estimated_fuel_liters' => round($estimatedFuelConsumed, 2),
                    'fuel_efficiency_kmpl' => $fuelEfficiency,
                    'latest_location' => $latestPing ? [
                        'latitude' => (float) $latestPing->latitude,
                        'longitude' => (float) $latestPing->longitude,
                        'speed_kmh' => (float) ($latestPing->speed_kmh ?? 0),
                        'accuracy_meters' => (float) ($latestPing->accuracy_meters ?? 0),
                        'recorded_at' => $latestPing->recorded_at,
                    ] : null,
                    'route_points' => $pings->map(function ($ping) {
                        return [
                            'latitude' => (float) $ping->latitude,
                            'longitude' => (float) $ping->longitude,
                            'speed_kmh' => (float) ($ping->speed_kmh ?? 0),
                            'recorded_at' => $ping->recorded_at,
                        ];
                    }),
                    'start_location' => $pings->first() ? [
                        'latitude' => (float) $pings->first()->latitude,
                        'longitude' => (float) $pings->first()->longitude,
                    ] : null,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get realtime stats error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get realtime stats: ' . $e->getMessage()
            ], 500);
        }
    }
}
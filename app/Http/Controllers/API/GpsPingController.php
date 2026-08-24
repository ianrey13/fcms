<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\GpsPing;
use App\Models\TripTicket;
use App\Models\TripHistory;
use App\Models\FuelReceipt;
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
     * POST /api/gps/pings
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

            if ($trip->status !== 'in_transit') {
                return response()->json([
                    'success' => false,
                    'message' => 'GPS pings can only be recorded for trips in transit. Current status: ' . $trip->status
                ], 422);
            }

            $ping = GpsPing::create([
                'trip_ticket_id' => $request->trip_ticket_id,
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                'accuracy_meters' => $request->accuracy_meters ?? null,
                'speed_kmh' => $request->speed_kmh ?? null,
                'heading_degrees' => $request->heading_degrees ?? null,
                'is_low_accuracy' => $request->is_low_accuracy ?? false,
                'is_queued_upload' => $request->is_queued_upload ?? false,
                'has_mock_location_flag' => $request->has_mock_location_flag ?? false,
                'recorded_at' => $request->recorded_at ?? now(),
                'received_at' => now(),
            ]);

            // ✅ Broadcast location to WebSocket
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

            Log::info('GPS ping stored', [
                'ping_id' => $ping->ping_id,
                'trip_id' => $request->trip_ticket_id,
                'lat' => $request->latitude,
                'lng' => $request->longitude
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
     * Store batch GPS pings (for offline sync)
     * POST /api/gps/pings/batch
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

            if ($trip->status !== 'in_transit') {
                return response()->json([
                    'success' => false,
                    'message' => 'GPS pings can only be recorded for trips in transit. Current status: ' . $trip->status
                ], 422);
            }

            $createdPings = [];
            
            DB::beginTransaction();
            
            foreach ($request->pings as $pingData) {
                $ping = GpsPing::create([
                    'trip_ticket_id' => $request->trip_ticket_id,
                    'latitude' => $pingData['latitude'],
                    'longitude' => $pingData['longitude'],
                    'accuracy_meters' => $pingData['accuracy_meters'] ?? null,
                    'speed_kmh' => $pingData['speed_kmh'] ?? null,
                    'heading_degrees' => $pingData['heading_degrees'] ?? null,
                    'is_low_accuracy' => $pingData['is_low_accuracy'] ?? false,
                    'is_queued_upload' => true,
                    'has_mock_location_flag' => $pingData['has_mock_location_flag'] ?? false,
                    'recorded_at' => $pingData['recorded_at'],
                    'received_at' => now(),
                ]);
                $createdPings[] = $ping->ping_id;
            }
            
            DB::commit();

            // ✅ Broadcast last ping in batch
            if (!empty($request->pings)) {
                $lastPing = end($request->pings);
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
     * Start GPS tracking for a trip (Enhanced with TripHistory)
     * POST /api/gps/start
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

            if ($trip->status !== 'acknowledged') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot start trip. Current status: ' . $trip->status . '. Required: acknowledged'
                ], 422);
            }

            DB::beginTransaction();

            // Update trip status
            $trip->status = 'in_transit';
            $trip->save();

            // ✅ Create TripHistory entry
            $nextTripNumber = TripHistory::where('trip_ticket_id', $trip->trip_ticket_id)->max('trip_number') + 1;
            $tripHistory = TripHistory::create([
                'trip_ticket_id' => $trip->trip_ticket_id,
                'trip_number' => $nextTripNumber,
                'start_lat' => $request->latitude,
                'start_lng' => $request->longitude,
                'started_at' => now(),
                'status' => 'in_progress',
            ]);

            if ($trip->gasSlip) {
                $fuelReceipt = FuelReceipt::firstOrNew(['gas_slip_id' => $trip->gasSlip->gas_slip_id]);
                $fuelReceipt->trip_started_at = now();
                $fuelReceipt->trip_start_gps_lat = $request->latitude;
                $fuelReceipt->trip_start_gps_lng = $request->longitude;
                $fuelReceipt->trip_start_gps_accuracy = $request->accuracy_meters ?? null;
                $fuelReceipt->save();

                GpsPing::create([
                    'trip_ticket_id' => $trip->trip_ticket_id,
                    'latitude' => $request->latitude,
                    'longitude' => $request->longitude,
                    'accuracy_meters' => $request->accuracy_meters ?? null,
                    'is_queued_upload' => false,
                    'recorded_at' => now(),
                    'received_at' => now(),
                ]);
            }

            DB::commit();

            // ✅ Broadcast trip started
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

            Log::info('GPS tracking started', [
                'trip_id' => $trip->trip_ticket_id,
                'driver_id' => $driver->driver_id,
                'history_id' => $tripHistory->history_id
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
     * Stop GPS tracking for a trip (Enhanced with TripHistory)
     * POST /api/gps/stop
     */
    public function stopTracking(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'trip_ticket_id' => 'required|exists:trip_ticket,trip_ticket_id',
                'latitude' => 'required|numeric|between:-90,90',
                'longitude' => 'required|numeric|between:-180,180',
                'accuracy_meters' => 'nullable|numeric|min:0',
                'gps_distance_km' => 'nullable|numeric|min:0',
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

            if ($trip->status === 'pending_reconciliation') {
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
                    'message' => 'Cannot complete trip. Current status: ' . $trip->status . '. Required: in_transit'
                ], 422);
            }

            DB::beginTransaction();

            // Update trip status
            $trip->status = 'pending_reconciliation';
            $trip->save();

            // ✅ Complete TripHistory
            $currentTrip = TripHistory::where('trip_ticket_id', $trip->trip_ticket_id)
                ->where('status', 'in_progress')
                ->orderBy('trip_number', 'desc')
                ->first();

            if ($currentTrip) {
                $currentTrip->end_lat = $request->latitude;
                $currentTrip->end_lng = $request->longitude;
                $currentTrip->ended_at = now();
                $currentTrip->status = 'completed';
                
                if ($request->has('gps_distance_km')) {
                    $currentTrip->distance_km = $request->gps_distance_km;
                } else {
                    $currentTrip->distance_km = $this->calculateTripDistance($trip->trip_ticket_id);
                }
                
                $currentTrip->save();
            }

            if ($trip->gasSlip && $trip->gasSlip->fuelReceipt) {
                $fuelReceipt = $trip->gasSlip->fuelReceipt;
                $fuelReceipt->trip_ended_at = now();
                if ($request->has('gps_distance_km')) {
                    $fuelReceipt->gps_distance_km = $request->gps_distance_km;
                } else {
                    $fuelReceipt->gps_distance_km = $this->calculateTripDistance($trip->trip_ticket_id);
                }
                $fuelReceipt->trip_elapsed_minutes = $fuelReceipt->trip_started_at ? 
                    $fuelReceipt->trip_started_at->diffInMinutes(now()) : null;
                $fuelReceipt->save();

                GpsPing::create([
                    'trip_ticket_id' => $trip->trip_ticket_id,
                    'latitude' => $request->latitude,
                    'longitude' => $request->longitude,
                    'accuracy_meters' => $request->accuracy_meters ?? null,
                    'is_queued_upload' => false,
                    'recorded_at' => now(),
                    'received_at' => now(),
                ]);
            }

            DB::commit();

            // ✅ Broadcast trip completed
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
                'distance_km' => $fuelReceipt->gps_distance_km ?? null
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
                'message' => 'GPS tracking stopped successfully',
                'data' => [
                    'trip_ticket_id' => $trip->trip_ticket_id,
                    'status' => $trip->status,
                    'trip_ended_at' => now(),
                    'latitude' => $request->latitude,
                    'longitude' => $request->longitude,
                    'distance_km' => $fuelReceipt->gps_distance_km ?? null,
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
     * GET /api/gps/trips/{id}/distance
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
            $isDriver = $trip->driver && $trip->driver->user_id === $user->user_id;
            
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
     * Check if trip is deviating from route (Geofencing)
     * POST /api/gps/check-deviation
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
            $isDriver = $trip->driver && $trip->driver->user_id === $user->user_id;
            
            if (!$isGSO && !$isDriver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }

            $threshold = $request->deviation_threshold_km ?? 2.0;

            // Get start location from TripHistory or FuelReceipt
            $startPing = TripHistory::where('trip_ticket_id', $trip->trip_ticket_id)
                ->where('status', 'in_progress')
                ->orderBy('trip_number', 'desc')
                ->first();

            if (!$startPing) {
                $fuelReceipt = FuelReceipt::whereHas('gasSlip', function($q) use ($trip) {
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
     * GET /api/gps/trips/{id}/locations
     */
    public function getTripWithLocations(Request $request, $tripId)
    {
        try {
            $user = $request->user();
            
            $trip = TripTicket::with(['driver', 'vehicle', 'department'])
                ->find($tripId);

            if (!$trip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip not found'
                ], 404);
            }

            $isGSO = $user->role === 'gso_office';
            $isDriver = $trip->driver && $trip->driver->user_id === $user->user_id;
            $isRequester = $trip->submitted_by === $user->user_id;

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

            // Safe null handling
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
     * Get all active trips with their latest GPS location
     * GET /api/gps/active-trips
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
                ->whereIn('status', ['in_transit', 'funds_issued', 'acknowledged'])
                ->orderBy('updated_at', 'desc')
                ->limit(50) // ✅ Prevent memory issues
                ->get();

            $result = [];

            foreach ($activeTrips as $trip) {
                $latestPing = GpsPing::where('trip_ticket_id', $trip->trip_ticket_id)
                    ->orderBy('recorded_at', 'desc')
                    ->first();

                $routePings = GpsPing::where('trip_ticket_id', $trip->trip_ticket_id)
                    ->where('is_low_accuracy', false)
                    ->orderBy('recorded_at', 'asc')
                    ->limit(50)
                    ->get(['latitude', 'longitude', 'recorded_at', 'speed_kmh']);

                // ✅ Safe null handling
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
                    'current_location' => $latestPing ? [
                        'latitude' => (float) $latestPing->latitude,
                        'longitude' => (float) $latestPing->longitude,
                        'speed_kmh' => (float) ($latestPing->speed_kmh ?? 0),
                        'accuracy_meters' => (float) ($latestPing->accuracy_meters ?? 0),
                        'recorded_at' => $latestPing->recorded_at,
                        'is_low_accuracy' => (bool) $latestPing->is_low_accuracy,
                    ] : null,
                    'route' => $routePings->map(function($ping) {
                        return [
                            'latitude' => (float) $ping->latitude,
                            'longitude' => (float) $ping->longitude,
                            'speed_kmh' => (float) ($ping->speed_kmh ?? 0),
                            'recorded_at' => $ping->recorded_at,
                        ];
                    }),
                    'ping_count' => GpsPing::where('trip_ticket_id', $trip->trip_ticket_id)->count(),
                    'last_update' => $latestPing ? $latestPing->recorded_at : $trip->updated_at,
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
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch active trips: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get GPS pings for a trip
     * GET /api/gps/trips/{id}/pings
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
                    'pings' => $pings->map(function($ping) {
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
     * Get latest GPS ping for a trip
     * GET /api/gps/trips/{id}/latest
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
     * Get GPS track for a trip (full route)
     * GET /api/gps/trips/{id}/track
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
     * Get route for a specific trip (alias for getTrack)
     * GET /api/gps/trips/{id}/route
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
            $isDriver = $trip->driver && $trip->driver->user_id === $user->user_id;
            
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
     * GET /api/gps/trips/{id}/summary
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
            $isDriver = $trip->driver && $trip->driver->user_id === $user->user_id;
            
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
     * Delete GPS pings for a trip (admin only)
     * DELETE /api/gps/trips/{id}/pings
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

    // ============ PRIVATE HELPER METHODS ============

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
                if ($distance > 0.01) {
                    $totalDistance += $distance;
                }
            }
            $prevPing = $ping;
        }

        return round($totalDistance, 2);
    }

    /**
     * Calculate distance between two points using Haversine formula
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
 * Get real-time trip stats (distance, fuel consumption, speed)
 * GET /api/gps/trips/{id}/stats
 */
public function getRealtimeStats(Request $request, $tripId)
{
    try {
        $user = $request->user();
        
        $trip = TripTicket::with(['driver', 'vehicle'])->find($tripId);
        if (!$trip) {
            return response()->json(['success' => false, 'message' => 'Trip not found'], 404);
        }
        
        // Check authorization
        $isGSO = $user->role === 'gso_office';
        $isDriver = $trip->driver && $trip->driver->user_id === $user->user_id;
        if (!$isGSO && !$isDriver) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }
        
        // Get latest ping
        $latestPing = GpsPing::where('trip_ticket_id', $tripId)
            ->orderBy('recorded_at', 'desc')
            ->first();
        
        // Get all pings for distance calculation
        $pings = GpsPing::where('trip_ticket_id', $tripId)
            ->where('is_low_accuracy', false)
            ->orderBy('recorded_at', 'asc')
            ->get();
        
        // Calculate total distance
        $totalDistance = 0;
        $maxSpeed = 0;
        $avgSpeed = 0;
        $totalTime = 0;
        $prevPing = null;
        $estimatedFuelConsumed = 0;
        
        // Get fuel efficiency from vehicle or use default
        $fuelEfficiency = $trip->vehicle?->fuel_efficiency ?? 10; // km per liter
        
        foreach ($pings as $ping) {
            if ($ping->speed_kmh && $ping->speed_kmh > $maxSpeed) {
                $maxSpeed = $ping->speed_kmh;
            }
            
            if ($prevPing) {
                $distance = $this->haversineDistance(
                    $prevPing->latitude, $prevPing->longitude,
                    $ping->latitude, $ping->longitude
                );
                // Only add significant movements (> 10 meters)
                if ($distance > 0.01) {
                    $totalDistance += $distance;
                }
                $totalTime += $prevPing->recorded_at->diffInSeconds($ping->recorded_at);
            }
            $prevPing = $ping;
        }
        
        // Calculate average speed
        if ($totalTime > 0 && $pings->count() > 1) {
            $avgSpeed = ($totalDistance / $totalTime) * 3.6; // Convert to km/h
        }
        
        // Estimate fuel consumption
        if ($totalDistance > 0 && $fuelEfficiency > 0) {
            $estimatedFuelConsumed = $totalDistance / $fuelEfficiency;
        }
        
        // Get trip history for multi-trip tracking
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
                'route_points' => $pings->map(function($ping) {
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
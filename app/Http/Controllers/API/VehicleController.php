<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use App\Models\Department;
use App\Models\TripTicket;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class VehicleController extends Controller
{
    /**
     * Display a listing of vehicles.
     */
    public function index(Request $request)
    {
        try {
            $query = Vehicle::with('department');

            // Apply filters
            if ($request->has('department_id')) {
                $query->where('department_id', $request->department_id);
            }

            if ($request->has('status')) {
                $query->where('status', $request->status);
            }

            if ($request->has('fuel_type')) {
                $query->where('fuel_type', $request->fuel_type);
            }

            if ($request->has('search')) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('plate_number', 'like', "%{$search}%")
                      ->orWhere('vehicle_model', 'like', "%{$search}%");
                });
            }

            $vehicles = $query->orderBy('created_at', 'desc')->get();

            // ✅ Add availability status to each vehicle
            $vehiclesWithStatus = $vehicles->map(function($vehicle) {
                $availability = $vehicle->getAvailabilityStatus();
                return [
                    'vehicle_id' => $vehicle->vehicle_id,
                    'department_id' => $vehicle->department_id,
                    'vehicle_model' => $vehicle->vehicle_model,
                    'plate_number' => $vehicle->plate_number,
                    'fuel_type' => $vehicle->fuel_type,
                    'status' => $vehicle->status,
                    'maintenance_flag' => $vehicle->maintenance_flag,
                    'current_fuel_balance' => $vehicle->current_fuel_balance,
                    'fuel_capacity' => $vehicle->fuel_capacity,
                    'fuel_percentage' => $vehicle->fuel_percentage,
                    'fuel_status' => $vehicle->fuel_status,
                    'is_available' => $availability['is_available'],
                    'has_active_trip' => $availability['has_active_trip'],
                    'active_trip_id' => $availability['active_trip_id'],
                    'active_trip_number' => $availability['active_trip_number'],
                    'availability_reason' => $availability['reason'],
                    'department' => $vehicle->department,
                    'created_at' => $vehicle->created_at,
                    'updated_at' => $vehicle->updated_at,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $vehiclesWithStatus,
                'total' => $vehicles->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Vehicle index error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch vehicles: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created Vehicle.
     */
    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'department_id' => 'required|exists:departments,department_id',
                'vehicle_model' => 'required|string|max:120',
                'plate_number' => 'required|string|max:20|unique:vehicles,plate_number',
'fuel_type' => 'required|in:diesel,regular,premium',
                'status' => 'sometimes|in:active,inactive',
                'maintenance_flag' => 'sometimes|boolean',
                'fuel_capacity' => 'nullable|numeric|min:0',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $vehicle = Vehicle::create([
                'department_id' => $request->department_id,
                'vehicle_model' => $request->vehicle_model,
                'plate_number' => strtoupper($request->plate_number),
                'fuel_type' => $request->fuel_type,
                'status' => $request->status ?? 'active',
                'maintenance_flag' => $request->maintenance_flag ?? false,
                'fuel_capacity' => $request->fuel_capacity ?? 60,
                'current_fuel_balance' => 0,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Vehicle created successfully',
                'data' => $vehicle->load('department')
            ], 201);

        } catch (\Exception $e) {
            Log::error('Vehicle store error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to create vehicle: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified vehicle.
     */
    public function show($id)
    {
        try {
            $vehicle = Vehicle::with('department')->findOrFail($id);
            
            $availability = $vehicle->getAvailabilityStatus();

            return response()->json([
                'success' => true,
                'data' => [
                    'vehicle_id' => $vehicle->vehicle_id,
                    'department_id' => $vehicle->department_id,
                    'vehicle_model' => $vehicle->vehicle_model,
                    'plate_number' => $vehicle->plate_number,
                    'fuel_type' => $vehicle->fuel_type,
                    'status' => $vehicle->status,
                    'maintenance_flag' => $vehicle->maintenance_flag,
                    'current_fuel_balance' => $vehicle->current_fuel_balance,
                    'fuel_capacity' => $vehicle->fuel_capacity,
                    'fuel_percentage' => $vehicle->fuel_percentage,
                    'fuel_status' => $vehicle->fuel_status,
                    'is_available' => $availability['is_available'],
                    'has_active_trip' => $availability['has_active_trip'],
                    'active_trip_id' => $availability['active_trip_id'],
                    'active_trip_number' => $availability['active_trip_number'],
                    'availability_reason' => $availability['reason'],
                    'department' => $vehicle->department,
                    'created_at' => $vehicle->created_at,
                    'updated_at' => $vehicle->updated_at,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Vehicle not found'
            ], 404);
        }
    }

       
       /**
     * Update the specified vehicle.
     */
    public function update(Request $request, $id)
    {
        try {
            $vehicle = Vehicle::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'department_id' => 'sometimes|required|exists:departments,department_id',
                'vehicle_model' => 'sometimes|required|string|max:120',
                'plate_number' => 'sometimes|required|string|max:20|unique:vehicles,plate_number,' . $id . ',vehicle_id',
              'fuel_type' => 'sometimes|required|in:diesel,regular,premium',
                'status' => 'sometimes|in:active,inactive',
                'maintenance_flag' => 'sometimes|boolean',
                'fuel_capacity' => 'nullable|numeric|min:0',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            if ($request->has('department_id')) {
                $vehicle->department_id = $request->department_id;
            }
            if ($request->has('vehicle_model')) {
                $vehicle->vehicle_model = $request->vehicle_model;
            }
            if ($request->has('plate_number')) {
                $vehicle->plate_number = strtoupper($request->plate_number);
            }
            if ($request->has('fuel_type')) {
                $vehicle->fuel_type = $request->fuel_type;
            }
            if ($request->has('status')) {
                $vehicle->status = $request->status;
            }
            if ($request->has('maintenance_flag')) {
                $vehicle->maintenance_flag = $request->maintenance_flag;
            }
            if ($request->has('fuel_capacity')) {
                $vehicle->fuel_capacity = $request->fuel_capacity;
            }

            $vehicle->updated_at = now();
            $vehicle->save();

            return response()->json([
                'success' => true,
                'message' => 'Vehicle updated successfully',
                'data' => $vehicle->load('department')
            ]);

        } catch (\Exception $e) {
            Log::error('Vehicle update error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update vehicle: ' . $e->getMessage()
            ], 500);
        }
    }
       /**
     * Deactivate the specified vehicle.
     */
    public function destroy($id)
    {
        try {
            $vehicle = Vehicle::findOrFail($id);

            $hasActiveTrips = $vehicle->tripTickets()
                ->whereIn('status', Vehicle::getActiveTripStatuses())
                ->exists();

            if ($hasActiveTrips) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot deactivate vehicle with active trip tickets'
                ], 400);
            }

            $vehicle->status = 'inactive';
            $vehicle->save();

            return response()->json([
                'success' => true,
                'message' => 'Vehicle deactivated successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Vehicle destroy error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to deactivate vehicle: ' . $e->getMessage()
            ], 500);
        }
    }

         /**
     * Update vehicle status (activate/deactivate + maintenance flag)
     */
    public function updateStatus(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'status' => 'required|in:active,inactive',
                'maintenance_flag' => 'sometimes|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $vehicle = Vehicle::findOrFail($id);

            if ($request->status === 'inactive' && $vehicle->hasActiveTrip()) {
                $activeTrip = $vehicle->getActiveTrip();
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot deactivate vehicle with active trip ticket #' . ($activeTrip ? $activeTrip->trip_ticket_number : ''),
                    'data' => [
                        'active_trip_id' => $activeTrip ? $activeTrip->trip_ticket_id : null,
                        'active_trip_number' => $activeTrip ? $activeTrip->trip_ticket_number : null,
                    ]
                ], 400);
            }

            $vehicle->status = $request->status;

            if ($request->has('maintenance_flag')) {
                $vehicle->maintenance_flag = $request->maintenance_flag;
            }

            $vehicle->save();

            return response()->json([
                'success' => true,
                'message' => 'Vehicle status updated successfully',
                'data' => [
                    'status' => $vehicle->status,
                    'maintenance_flag' => $vehicle->maintenance_flag,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Vehicle status update error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update vehicle status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update vehicle maintenance flag
     */
    public function updateMaintenance(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'maintenance_flag' => 'required|boolean'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $vehicle = Vehicle::findOrFail($id);
            
            // ✅ Check if trying to set maintenance on a vehicle with active trip
            if ($request->maintenance_flag && $vehicle->hasActiveTrip()) {
                $activeTrip = $vehicle->getActiveTrip();
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot put vehicle under maintenance with active trip ticket #' . ($activeTrip ? $activeTrip->trip_ticket_number : ''),
                    'data' => [
                        'active_trip_id' => $activeTrip ? $activeTrip->trip_ticket_id : null,
                        'active_trip_number' => $activeTrip ? $activeTrip->trip_ticket_number : null,
                    ]
                ], 400);
            }
            
            $vehicle->maintenance_flag = $request->maintenance_flag;
            $vehicle->save();

            return response()->json([
                'success' => true,
                'message' => $request->maintenance_flag ? 'Vehicle marked as under maintenance' : 'Vehicle removed from maintenance',
                'data' => [
                    'maintenance_flag' => $vehicle->maintenance_flag,
                    'status' => $vehicle->status,
                    'is_available' => $vehicle->isAvailableForTrip(),
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Vehicle maintenance update error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update maintenance status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * ✅ Get available vehicles (not in active trips)
     * This is the main method for 1 Vehicle = 1 Trip policy
     */
    public function getAvailableVehicles(Request $request)
    {
        try {
            $user = auth()->user();
            $departmentId = $request->get('department_id', $user->department_id ?? null);
            $includeAll = $request->get('include_all', false);
            
            // ✅ Get vehicle IDs that are currently in active trips
            $activeTripVehicleIds = TripTicket::whereIn('status', Vehicle::getActiveTripStatuses())
                ->pluck('vehicle_id')
                ->toArray();
            
            // ✅ Query vehicles that are NOT in active trips
            $query = Vehicle::where('status', 'active')
                ->where('maintenance_flag', false);
            
            // Filter by department if specified
            if ($departmentId && !$includeAll) {
                $query->where('department_id', $departmentId);
            }
            
            // ✅ Exclude vehicles in active trips
            if (!empty($activeTripVehicleIds)) {
                $query->whereNotIn('vehicle_id', $activeTripVehicleIds);
            }
            
            $vehicles = $query->orderBy('vehicle_model')
                ->get()
                ->map(function ($vehicle) {
                    return [
                        'vehicle_id' => $vehicle->vehicle_id,
                        'vehicle_model' => $vehicle->vehicle_model,
                        'plate_number' => $vehicle->plate_number,
                        'fuel_type' => $vehicle->fuel_type,
                        'department_id' => $vehicle->department_id,
                        'department_name' => $vehicle->department?->department_name ?? 'N/A',
                        'status' => $vehicle->status,
                        'is_available' => true,
                        'current_fuel_balance' => $vehicle->current_fuel_balance,
                        'fuel_capacity' => $vehicle->fuel_capacity,
                        'fuel_percentage' => $vehicle->fuel_percentage,
                        'fuel_status' => $vehicle->fuel_status,
                    ];
                });
            
            // ✅ Get vehicles in active trips (for reference)
            $activeVehicles = [];
            if (!empty($activeTripVehicleIds)) {
                $activeVehicles = Vehicle::whereIn('vehicle_id', $activeTripVehicleIds)
                    ->with(['tripTickets' => function($q) {
                        $q->whereIn('status', Vehicle::getActiveTripStatuses())
                          ->select('trip_ticket_id', 'trip_ticket_number', 'vehicle_id', 'status');
                    }])
                    ->get()
                    ->map(function ($vehicle) {
                        $activeTrip = $vehicle->tripTickets->first();
                        return [
                            'vehicle_id' => $vehicle->vehicle_id,
                            'plate_number' => $vehicle->plate_number,
                            'vehicle_model' => $vehicle->vehicle_model,
                            'active_trip_id' => $activeTrip ? $activeTrip->trip_ticket_id : null,
                            'active_trip_number' => $activeTrip ? $activeTrip->trip_ticket_number : null,
                            'status' => $activeTrip ? $activeTrip->status : null,
                            'is_available' => false,
                        ];
                    });
            }

            return response()->json([
                'success' => true,
                'data' => $vehicles,
                'active_vehicles' => $activeVehicles,
                'total_available' => $vehicles->count(),
                'total_active' => count($activeTripVehicleIds),
                'message' => 'Showing vehicles available for new trip assignments'
            ]);

        } catch (\Exception $e) {
            Log::error('Get available vehicles error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch available vehicles: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get vehicles by department
     */
    public function getByDepartment($departmentId)
    {
        try {
            $department = Department::findOrFail($departmentId);
            
            $vehicles = Vehicle::where('department_id', $departmentId)
                ->orderBy('plate_number')
                ->get()
                ->map(function ($vehicle) {
                    $availability = $vehicle->getAvailabilityStatus();
                    return [
                        'vehicle_id' => $vehicle->vehicle_id,
                        'vehicle_model' => $vehicle->vehicle_model,
                        'plate_number' => $vehicle->plate_number,
                        'fuel_type' => $vehicle->fuel_type,
                        'status' => $vehicle->status,
                        'maintenance_flag' => $vehicle->maintenance_flag,
                        'is_available' => $availability['is_available'],
                        'has_active_trip' => $availability['has_active_trip'],
                        'active_trip_number' => $availability['active_trip_number'],
                        'availability_reason' => $availability['reason'],
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => [
                    'department' => [
                        'id' => $department->department_id,
                        'name' => $department->department_name,
                        'code' => $department->department_code,
                    ],
                    'vehicles' => $vehicles,
                    'total' => $vehicles->count()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Get vehicles by department error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch vehicles: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get vehicle statistics
     */
    public function getStats(Request $request)
    {
        try {
            $activeTripVehicleIds = TripTicket::whereIn('status', Vehicle::getActiveTripStatuses())
                ->pluck('vehicle_id')
                ->toArray();
            
            $stats = [
                'total' => Vehicle::count(),
                'active' => Vehicle::where('status', 'active')->count(),
                'inactive' => Vehicle::where('status', 'inactive')->count(),
                'under_maintenance' => Vehicle::where('maintenance_flag', true)->count(),
                'available' => Vehicle::where('status', 'active')
                    ->where('maintenance_flag', false)
                    ->whereNotIn('vehicle_id', $activeTripVehicleIds)
                    ->count(),
                'in_use' => count($activeTripVehicleIds),
               'by_fuel_type' => [
    'diesel'  => Vehicle::where('fuel_type', 'diesel')->count(),
    'regular' => Vehicle::where('fuel_type', 'regular')->count(),
    'premium' => Vehicle::where('fuel_type', 'premium')->count(),
],
                'by_department' => Vehicle::select('department_id', DB::raw('count(*) as count'))
                    ->with('department')
                    ->groupBy('department_id')
                    ->get()
                    ->map(function($item) {
                        return [
                            'department_id' => $item->department_id,
                            'department_name' => $item->department->department_name ?? 'Unknown',
                            'count' => $item->count,
                        ];
                    }),
            ];

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);

        } catch (\Exception $e) {
            Log::error('Vehicle stats error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch vehicle statistics: ' . $e->getMessage()
            ], 500);
        }
    }

    // /**
    //  * ✅ DEPRECATED: Update odometer status
    //  */
    // public function updateOdometerStatus(Request $request, $id)
    // {
    //     return response()->json([
    //         'success' => false,
    //         'message' => 'Odometer tracking has been deprecated. This feature is no longer available.',
    //         'data' => [
    //             'vehicle_id' => $id,
    //             'recommendation' => 'Use GPS tracking for distance measurement instead.',
    //         ]
    //     ], 410);
    // }
}
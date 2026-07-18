<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use App\Models\Department;
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

            return response()->json([
                'success' => true,
                'data' => $vehicles,
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
     * Store a newly created vehicle.
     * ✅ REMOVED: odometer_status
     */
    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'department_id' => 'required|exists:departments,department_id',
                'vehicle_model' => 'required|string|max:120',
                'plate_number' => 'required|string|max:20|unique:vehicles,plate_number',
                'fuel_type' => 'required|in:regular,premium,diesel',
                'status' => 'sometimes|in:active,inactive',
                // ✅ REMOVED: odometer_status
                'maintenance_flag' => 'sometimes|boolean',
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
                // ✅ REMOVED: odometer_status - using default from database
                'maintenance_flag' => $request->maintenance_flag ?? false,
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

            return response()->json([
                'success' => true,
                'data' => $vehicle
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
     * ✅ REMOVED: odometer_status
     */
    public function update(Request $request, $id)
    {
        try {
            $vehicle = Vehicle::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'department_id' => 'sometimes|required|exists:departments,department_id',
                'vehicle_model' => 'sometimes|required|string|max:120',
                'plate_number' => 'sometimes|required|string|max:20|unique:vehicles,plate_number,' . $id . ',vehicle_id',
                'fuel_type' => 'sometimes|required|in:regular,premium,diesel',
                'status' => 'sometimes|in:active,inactive',
                // ✅ REMOVED: odometer_status
                'maintenance_flag' => 'sometimes|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Update fields
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
            // ✅ REMOVED: odometer_status update
            if ($request->has('maintenance_flag')) {
                $vehicle->maintenance_flag = $request->maintenance_flag;
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
     * Remove the specified vehicle (soft delete).
     */
    public function destroy($id)
    {
        try {
            $vehicle = Vehicle::findOrFail($id);

            // Check if vehicle has active trip tickets
            $hasActiveTrips = $vehicle->tripTickets()
                ->whereIn('status', ['pending_mayors_office', 'funds_issued', 'in_transit', 'acknowledged'])
                ->exists();

            if ($hasActiveTrips) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete vehicle with active trip tickets'
                ], 400);
            }

            // Soft delete
            $vehicle->deleted_at = now();
            $vehicle->deleted_by = auth()->id();
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
     * Update vehicle status (activate/deactivate)
     */
    public function updateStatus(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'status' => 'required|in:active,inactive'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $vehicle = Vehicle::findOrFail($id);
            $vehicle->status = $request->status;
            
            if ($request->status === 'inactive') {
                $vehicle->deactivated_at = now();
                $vehicle->deactivated_by = auth()->id();
            } else {
                $vehicle->deactivated_at = null;
                $vehicle->deactivated_by = null;
            }
            
            $vehicle->save();

            return response()->json([
                'success' => true,
                'message' => 'Vehicle status updated successfully',
                'data' => ['status' => $vehicle->status]
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
            $vehicle->maintenance_flag = $request->maintenance_flag;
            $vehicle->save();

            return response()->json([
                'success' => true,
                'message' => $request->maintenance_flag ? 'Vehicle marked as under maintenance' : 'Vehicle removed from maintenance',
                'data' => [
                    'maintenance_flag' => $vehicle->maintenance_flag,
                    'status' => $vehicle->status
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
     * Get available vehicles for department staff
     */
    public function getAvailableVehicles(Request $request)
    {
        try {
            $user = auth()->user();
            $departmentId = $request->get('department_id', $user->department_id);
            
            $vehicles = Vehicle::where('department_id', $departmentId)
                ->where('status', 'active')
                ->where('maintenance_flag', false)
                ->orderBy('vehicle_model')
                ->get();
            
            return response()->json([
                'success' => true,
                'data' => $vehicles
            ]);
        } catch (\Exception $e) {
            Log::error('Get available vehicles error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch vehicles: ' . $e->getMessage()
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
                ->get();

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
            $stats = [
                'total' => Vehicle::count(),
                'active' => Vehicle::where('status', 'active')->count(),
                'inactive' => Vehicle::where('status', 'inactive')->count(),
                'under_maintenance' => Vehicle::where('maintenance_flag', true)->count(),
                'by_fuel_type' => [
                    'regular' => Vehicle::where('fuel_type', 'regular')->count(),
                    'premium' => Vehicle::where('fuel_type', 'premium')->count(),
                    'diesel' => Vehicle::where('fuel_type', 'diesel')->count(),
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

    /**
     * ✅ DEPRECATED: Update odometer status
     * This method is no longer needed since odometer is removed
     */
    public function updateOdometerStatus(Request $request, $id)
    {
        return response()->json([
            'success' => false,
            'message' => 'Odometer tracking has been deprecated. This feature is no longer available.',
            'data' => [
                'vehicle_id' => $id,
                'recommendation' => 'Use GPS tracking for distance measurement instead.',
            ]
        ], 410); // 410 Gone
    }
}
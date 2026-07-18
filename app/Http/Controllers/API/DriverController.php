<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Driver;
use App\Models\TripTicket;
use App\Models\GasSlip;
use App\Models\GpsPing;
use App\Models\FuelReceipt;
use App\Models\Notification;
use App\Models\SystemSetting;
use App\Helpers\NotificationHelper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class DriverController extends Controller
{
    // ============================================
    // ADMIN METHODS (For GSO)
    // ============================================

    /**
     * Get all drivers (for GSO admin)
     */
    public function index(Request $request)
    {
        try {
            $departmentId = $request->get('department_id');
            
            $query = Driver::with('user.department');
            
            if ($departmentId) {
                $query->whereHas('user', function($q) use ($departmentId) {
                    $q->where('department_id', $departmentId);
                });
            }
            
            $drivers = $query->get()->map(function($driver) {
                return [
                    'driver_id' => $driver->driver_id,
                    'user_id' => $driver->user_id,
                    'full_name' => $driver->user ? $driver->user->full_name : 'Unknown',
                    'email' => $driver->user ? $driver->user->email : null,
                    'status' => $driver->status,
                    'department_id' => $driver->user ? $driver->user->department_id : null,
                    'department_name' => $driver->user && $driver->user->department ? 
                        $driver->user->department->department_name : null,
                    'license_number' => $driver->license_number,
                    'license_expiry' => $driver->license_expiry,
                    'created_at' => $driver->created_at,
                ];
            });
            
            return response()->json([
                'success' => true,
                'data' => $drivers
            ]);
        } catch (\Exception $e) {
            Log::error('Get drivers error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch drivers: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get a specific driver
     */
    public function show($id)
    {
        try {
            $driver = Driver::with('user')->findOrFail($id);
            
            return response()->json([
                'success' => true,
                'data' => [
                    'driver_id' => $driver->driver_id,
                    'user_id' => $driver->user_id,
                    'full_name' => $driver->user ? $driver->user->full_name : 'Unknown',
                    'email' => $driver->user ? $driver->user->email : null,
                    'status' => $driver->status,
                    'license_number' => $driver->license_number,
                    'license_expiry' => $driver->license_expiry,
                    'created_at' => $driver->created_at,
                    'user' => $driver->user,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Driver not found'
            ], 404);
        }
    }

    /**
     * Create a new driver (link user to driver)
     */
    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'user_id' => 'required|exists:users,user_id|unique:drivers,user_id',
                'license_number' => 'nullable|string|max:50',
                'license_expiry' => 'nullable|date',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $driver = Driver::create([
                'user_id' => $request->user_id,
                'license_number' => $request->license_number,
                'license_expiry' => $request->license_expiry,
                'status' => 'active',
            ]);

            $user = User::find($request->user_id);
            if ($user && $user->role !== 'driver') {
                $user->role = 'driver';
                $user->can_drive = true;
                $user->save();
            }

            return response()->json([
                'success' => true,
                'message' => 'Driver created successfully',
                'data' => $driver->load('user')
            ], 201);
        } catch (\Exception $e) {
            Log::error('Store driver error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to create driver: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update a driver
     */
    public function update(Request $request, $id)
    {
        try {
            $driver = Driver::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'license_number' => 'nullable|string|max:50',
                'license_expiry' => 'nullable|date',
                'status' => 'sometimes|in:active,inactive',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $driver->update($request->only([
                'license_number',
                'license_expiry',
                'status'
            ]));

            return response()->json([
                'success' => true,
                'message' => 'Driver updated successfully',
                'data' => $driver->load('user')
            ]);
        } catch (\Exception $e) {
            Log::error('Update driver error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update driver: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update driver status (activate/deactivate)
     */
    public function updateStatus(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'status' => 'required|in:active,inactive'
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $driver = Driver::findOrFail($id);
            $driver->status = $request->status;
            $driver->save();

            if ($driver->user) {
                $driver->user->can_drive = $request->status === 'active';
                $driver->user->save();
            }

            return response()->json([
                'success' => true,
                'message' => 'Driver status updated successfully',
                'data' => ['status' => $driver->status]
            ]);
        } catch (\Exception $e) {
            Log::error('Update driver status error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update driver status'
            ], 500);
        }
    }

    /**
     * Delete a driver
     */
    public function destroy($id)
    {
        try {
            $driver = Driver::findOrFail($id);
            
            $hasActiveTrips = TripTicket::where('driver_id', $id)
                ->whereIn('status', ['funds_issued', 'acknowledged', 'in_transit'])
                ->exists();
            
            if ($hasActiveTrips) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete driver with active trips'
                ], 400);
            }

            if ($driver->user) {
                $driver->user->role = 'staff';
                $driver->user->can_drive = false;
                $driver->user->save();
            }

            $driver->delete();

            return response()->json([
                'success' => true,
                'message' => 'Driver deleted successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Delete driver error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete driver'
            ], 500);
        }
    }

    // ============================================
    // DRIVER APP METHODS (For Authenticated Driver)
    // ============================================

    /**
     * Get mobile dashboard data
     */
    public function mobileDashboard(Request $request)
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
            
            // Get active trip count
            $activeTrips = TripTicket::where('driver_id', $driver->driver_id)
                ->whereIn('status', ['funds_issued', 'acknowledged', 'in_transit'])
                ->count();
            
            // Get pending receipts count (in_transit without receipt)
            $pendingReceipts = TripTicket::where('driver_id', $driver->driver_id)
                ->where('status', 'in_transit')
                ->whereHas('gasSlip.fuelReceipt', function($q) {
                    $q->whereNull('receipt_photo_path');
                })
                ->count();
            
            // Get completed trips count
            $completedTrips = TripTicket::where('driver_id', $driver->driver_id)
                ->whereIn('status', ['closed', 'pending_reconciliation'])
                ->count();
            
            // Get total trips
            $totalTrips = TripTicket::where('driver_id', $driver->driver_id)->count();
            
            // Get current active trip
            $currentTrip = TripTicket::with(['vehicle', 'department', 'gasSlip.fuelReceipt'])
                ->where('driver_id', $driver->driver_id)
                ->whereIn('status', ['in_transit', 'acknowledged', 'funds_issued'])
                ->orderBy('created_at', 'desc')
                ->first();
            
            // Get unread notifications
            $unreadNotifications = Notification::where('recipient_user_id', $user->user_id)
                ->where('is_read', 0)
                ->count();
            
            // Get fuel prices
            $fuelPrices = $this->getFuelPrices();
            
            return response()->json([
                'success' => true,
                'data' => [
                    'profile' => [
                        'driver_id' => $driver->driver_id,
                        'full_name' => $user->full_name,
                        'employee_number' => $user->employee_number,
                        'email' => $user->email,
                        'license_number' => $driver->license_number,
                        'license_expiry' => $driver->license_expiry,
                        'department' => $user->department ? $user->department->department_name : null,
                    ],
                    'stats' => [
                        'active_trips' => $activeTrips,
                        'pending_receipts' => $pendingReceipts,
                        'completed_trips' => $completedTrips,
                        'total_trips' => $totalTrips,
                        'unread_notifications' => $unreadNotifications,
                    ],
                    'current_trip' => $currentTrip ? [
                        'trip_ticket_id' => $currentTrip->trip_ticket_id,
                        'trip_ticket_number' => $currentTrip->trip_ticket_number,
                        'destination' => $currentTrip->destination,
                        'purpose' => $currentTrip->purpose,
                        'status' => $currentTrip->status,
                        'vehicle' => $currentTrip->vehicle ? [
                            'plate_number' => $currentTrip->vehicle->plate_number,
                            'vehicle_model' => $currentTrip->vehicle->vehicle_model,
                            'fuel_type' => $currentTrip->vehicle->fuel_type,
                        ] : null,
                        'amount_released' => $currentTrip->gasSlip ? $currentTrip->gasSlip->amount_released : 0,
                        'trip_started_at' => $currentTrip->gasSlip && $currentTrip->gasSlip->fuelReceipt ? 
                            $currentTrip->gasSlip->fuelReceipt->trip_started_at : null,
                    ] : null,
                    'fuel_prices' => $fuelPrices,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Mobile dashboard error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch dashboard: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get driver profile
     */
    public function getProfile(Request $request)
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
            
            return response()->json([
                'success' => true,
                'data' => [
                    'driver_id' => $driver->driver_id,
                    'user_id' => $user->user_id,
                    'first_name' => $user->first_name,
                    'middle_name' => $user->middle_name,
                    'last_name' => $user->last_name,
                    'full_name' => $user->full_name,
                    'email' => $user->email,
                    'employee_number' => $user->employee_number,
                    'license_number' => $driver->license_number,
                    'license_expiry' => $driver->license_expiry,
                    'status' => $driver->status,
                    'department_id' => $user->department_id,
                    'department_name' => $user->department ? $user->department->department_name : null,
                    'created_at' => $driver->created_at,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get profile error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch profile: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update driver profile
     */
    public function updateProfile(Request $request)
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
            
            $validator = Validator::make($request->all(), [
                'first_name' => 'nullable|string|max:50',
                'middle_name' => 'nullable|string|max:50',
                'last_name' => 'nullable|string|max:50',
                'license_number' => 'nullable|string|max:50',
                'license_expiry' => 'nullable|date',
            ]);
            
            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            
            // Update user
            if ($request->has('first_name')) {
                $user->first_name = $request->first_name;
            }
            if ($request->has('middle_name')) {
                $user->middle_name = $request->middle_name;
            }
            if ($request->has('last_name')) {
                $user->last_name = $request->last_name;
            }
            $user->save();
            
            // Update driver
            if ($request->has('license_number')) {
                $driver->license_number = $request->license_number;
            }
            if ($request->has('license_expiry')) {
                $driver->license_expiry = $request->license_expiry;
            }
            $driver->save();
            
            return response()->json([
                'success' => true,
                'message' => 'Profile updated successfully',
                'data' => [
                    'driver_id' => $driver->driver_id,
                    'full_name' => $user->full_name,
                    'license_number' => $driver->license_number,
                    'license_expiry' => $driver->license_expiry,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Update profile error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update profile: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get driver statistics - FIXED (No Odometer)
     */
    public function getStats(Request $request)
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
            
            // Monthly stats
            $monthlyTrips = TripTicket::where('driver_id', $driver->driver_id)
                ->whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->count();
            
            // Weekly stats
            $weeklyTrips = TripTicket::where('driver_id', $driver->driver_id)
                ->whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])
                ->count();
            
            // ✅ Total distance driven - GPS only
            $totalDistance = FuelReceipt::whereHas('gasSlip.tripTicket', function($q) use ($driver) {
                $q->where('driver_id', $driver->driver_id);
            })->sum('gps_distance_km');
            
            // Total fuel consumed
            $totalFuel = FuelReceipt::whereHas('gasSlip.tripTicket', function($q) use ($driver) {
                $q->where('driver_id', $driver->driver_id);
            })->sum('liters_availed');
            
            return response()->json([
                'success' => true,
                'data' => [
                    'monthly_trips' => $monthlyTrips,
                    'weekly_trips' => $weeklyTrips,
                    'total_distance_km' => round($totalDistance, 2),
                    'total_fuel_liters' => round($totalFuel, 2),
                    'average_fuel_per_trip' => $monthlyTrips > 0 ? round($totalFuel / $monthlyTrips, 2) : 0,
                    'total_trips' => TripTicket::where('driver_id', $driver->driver_id)->count(),
                    'active_trips' => TripTicket::where('driver_id', $driver->driver_id)
                        ->whereIn('status', ['in_transit', 'acknowledged', 'funds_issued'])
                        ->count(),
                    'completed_trips' => TripTicket::where('driver_id', $driver->driver_id)
                        ->whereIn('status', ['closed', 'pending_reconciliation'])
                        ->count(),
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get stats error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch stats: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get trip history with pagination
     */
    public function getTripHistory(Request $request)
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
            
            $limit = $request->get('limit', 10);
            $page = $request->get('page', 1);
            
            $trips = TripTicket::with(['vehicle', 'department', 'gasSlip.fuelReceipt'])
                ->where('driver_id', $driver->driver_id)
                ->whereIn('status', ['closed', 'pending_reconciliation'])
                ->orderBy('created_at', 'desc')
                ->paginate($limit, ['*'], 'page', $page);
            
            return response()->json([
                'success' => true,
                'data' => $trips->map(function($trip) {
                    return [
                        'trip_ticket_id' => $trip->trip_ticket_id,
                        'trip_ticket_number' => $trip->trip_ticket_number,
                        'destination' => $trip->destination,
                        'purpose' => $trip->purpose,
                        'trip_date' => $trip->trip_date,
                        'status' => $trip->status,
                        'vehicle' => $trip->vehicle ? [
                            'plate_number' => $trip->vehicle->plate_number,
                            'vehicle_model' => $trip->vehicle->vehicle_model,
                        ] : null,
                        'department' => $trip->department ? $trip->department->department_name : null,
                        'amount_released' => $trip->gasSlip ? $trip->gasSlip->amount_released : 0,
                        'fuel_consumed' => $trip->gasSlip && $trip->gasSlip->fuelReceipt ? 
                            $trip->gasSlip->fuelReceipt->liters_availed : 0,
                        'trip_started_at' => $trip->gasSlip && $trip->gasSlip->fuelReceipt ? 
                            $trip->gasSlip->fuelReceipt->trip_started_at : null,
                        'trip_ended_at' => $trip->gasSlip && $trip->gasSlip->fuelReceipt ? 
                            $trip->gasSlip->fuelReceipt->trip_ended_at : null,
                        'created_at' => $trip->created_at,
                    ];
                }),
                'pagination' => [
                    'current_page' => $trips->currentPage(),
                    'last_page' => $trips->lastPage(),
                    'per_page' => $trips->perPage(),
                    'total' => $trips->total(),
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get trip history error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch trip history: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get detailed trip information - FIXED (No Odometer)
     */
    public function getTripDetails(Request $request, $id)
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
            
            $trip = TripTicket::with([
                'vehicle',
                'department',
                'gasSlip',
                'gasSlip.fuelReceipt',
                'gasSlip.budgetPeriod',
                'submittedBy',
                'tripReturns',
                'tripCancellation'
            ])->where('trip_ticket_id', $id)
              ->where('driver_id', $driver->driver_id)
              ->first();
            
            if (!$trip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found'
                ], 404);
            }
            
            return response()->json([
                'success' => true,
                'data' => [
                    'trip_ticket_id' => $trip->trip_ticket_id,
                    'trip_ticket_number' => $trip->trip_ticket_number,
                    'destination' => $trip->destination,
                    'purpose' => $trip->purpose,
                    'trip_date' => $trip->trip_date,
                    'status' => $trip->status,
                    'charge_to' => $trip->charge_to,
                    'passenger_name' => $trip->passenger_name,
                    'estimated_distance_km' => $trip->estimated_distance_km,
                    'estimated_fuel_liters' => $trip->estimated_fuel_liters,
                    'has_insufficient_budget' => $trip->has_insufficient_budget ?? false,
                    'budget_shortage' => $trip->budget_shortage ?? 0,
                    'submitted_by' => $trip->submittedBy ? $trip->submittedBy->full_name : null,
                    'submitted_at' => $trip->submitted_at,
                    'vehicle' => $trip->vehicle ? [
                        'vehicle_id' => $trip->vehicle->vehicle_id,
                        'plate_number' => $trip->vehicle->plate_number,
                        'vehicle_model' => $trip->vehicle->vehicle_model,
                        'fuel_type' => $trip->vehicle->fuel_type,
                    ] : null,
                    'department' => $trip->department ? $trip->department->department_name : null,
                    'gas_slip' => $trip->gasSlip ? [
                        'gas_slip_id' => $trip->gasSlip->gas_slip_id,
                        'amount_released' => $trip->gasSlip->amount_released,
                        'budget_before' => $trip->gasSlip->budget_before,
                        'budget_after' => $trip->gasSlip->budget_after,
                        'reconciliation_status' => $trip->gasSlip->reconciliation_status,
                        'acknowledged_at' => $trip->gasSlip->acknowledged_at,
                        'created_at' => $trip->gasSlip->created_at,
                        'fuel_receipt' => $trip->gasSlip->fuelReceipt ? [
                            'fuel_receipt_id' => $trip->gasSlip->fuelReceipt->fuel_receipt_id,
                            'liters_availed' => $trip->gasSlip->fuelReceipt->liters_availed,
                            'amount_on_receipt' => $trip->gasSlip->fuelReceipt->amount_on_receipt,
                            // ✅ REMOVED: odometer_start, odometer_end
                            'receipt_photo_path' => $trip->gasSlip->fuelReceipt->receipt_photo_path,
                            'receipt_uploaded_at' => $trip->gasSlip->fuelReceipt->receipt_uploaded_at,
                            'trip_started_at' => $trip->gasSlip->fuelReceipt->trip_started_at,
                            'trip_ended_at' => $trip->gasSlip->fuelReceipt->trip_ended_at,
                            'trip_elapsed_minutes' => $trip->gasSlip->fuelReceipt->trip_elapsed_minutes,
                            'trip_start_gps_lat' => $trip->gasSlip->fuelReceipt->trip_start_gps_lat,
                            'trip_start_gps_lng' => $trip->gasSlip->fuelReceipt->trip_start_gps_lng,
                            'gps_distance_km' => $trip->gasSlip->fuelReceipt->gps_distance_km,
                        ] : null,
                    ] : null,
                    'returns' => $trip->tripReturns ? $trip->tripReturns->map(function($return) {
                        return [
                            'return_type' => $return->return_type,
                            'return_note' => $return->return_note,
                            'actioned_at' => $return->actioned_at,
                        ];
                    }) : [],
                    'cancellation' => $trip->tripCancellation ? [
                        'cancellation_reason' => $trip->tripCancellation->cancellation_reason,
                        'cancelled_at' => $trip->tripCancellation->cancelled_at,
                        'fund_return_required' => $trip->tripCancellation->fund_return_required,
                        'fund_returned_at' => $trip->tripCancellation->fund_returned_at,
                    ] : null,
                    'created_at' => $trip->created_at,
                    'updated_at' => $trip->updated_at,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get trip details error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch trip details: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Acknowledge receipt (after uploading)
     */
    public function acknowledgeReceipt(Request $request, $id)
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
            
            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();
            
            if (!$ticket) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found'
                ], 404);
            }
            
            $gasSlip = GasSlip::where('trip_ticket_id', $id)->first();
            
            if (!$gasSlip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Gas slip not found'
                ], 404);
            }
            
            // Check if receipt is uploaded
            $fuelReceipt = FuelReceipt::where('gas_slip_id', $gasSlip->gas_slip_id)->first();
            if (!$fuelReceipt || !$fuelReceipt->receipt_photo_path) {
                return response()->json([
                    'success' => false,
                    'message' => 'Please upload receipt first before acknowledging'
                ], 422);
            }
            
            $gasSlip->receipt_acknowledged_by = $user->user_id;
            $gasSlip->receipt_acknowledged_at = now();
            $gasSlip->save();
            
            return response()->json([
                'success' => true,
                'message' => 'Receipt acknowledged successfully',
                'data' => [
                    'receipt_acknowledged_at' => $gasSlip->receipt_acknowledged_at,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Acknowledge receipt error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to acknowledge receipt: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get receipt status for a trip
     */
    public function getReceiptStatus(Request $request, $id)
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
            
            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();
            
            if (!$ticket) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found'
                ], 404);
            }
            
            $gasSlip = GasSlip::where('trip_ticket_id', $id)->first();
            
            if (!$gasSlip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Gas slip not found'
                ], 404);
            }
            
            $fuelReceipt = FuelReceipt::where('gas_slip_id', $gasSlip->gas_slip_id)->first();
            
            return response()->json([
                'success' => true,
                'data' => [
                    'is_uploaded' => $fuelReceipt && $fuelReceipt->receipt_photo_path ? true : false,
                    'receipt_photo_path' => $fuelReceipt ? $fuelReceipt->receipt_photo_path : null,
                    'receipt_url' => $fuelReceipt && $fuelReceipt->receipt_photo_path ? 
                        Storage::url($fuelReceipt->receipt_photo_path) : null,
                    'liters_availed' => $fuelReceipt ? $fuelReceipt->liters_availed : null,
                    'amount_on_receipt' => $fuelReceipt ? $fuelReceipt->amount_on_receipt : null,
                    'uploaded_at' => $fuelReceipt ? $fuelReceipt->receipt_uploaded_at : null,
                    'is_acknowledged' => $gasSlip->receipt_acknowledged_by ? true : false,
                    'acknowledged_at' => $gasSlip->receipt_acknowledged_at,
                    'amount_released' => $gasSlip->amount_released,
                    'remaining_amount' => $gasSlip->amount_released - ($fuelReceipt ? $fuelReceipt->amount_on_receipt : 0),
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get receipt status error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch receipt status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get current fuel prices
     */
    public function getFuelPrices()
    {
        try {
            return [
                'diesel' => SystemSetting::where('setting_key', 'diesel_price_per_liter')->first()?->setting_value ?? 50.00,
                'premium' => SystemSetting::where('setting_key', 'premium_price_per_liter')->first()?->setting_value ?? 65.00,
                'regular' => SystemSetting::where('setting_key', 'regular_price_per_liter')->first()?->setting_value ?? 55.00,
            ];
        } catch (\Exception $e) {
            return [
                'diesel' => 50.00,
                'premium' => 65.00,
                'regular' => 55.00,
            ];
        }
    }

    /**
     * Get assigned trips for the authenticated driver
     */
    public function getTrips(Request $request)
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
            
            $statusFilter = $request->get('status');
            $query = TripTicket::with(['vehicle', 'department', 'gasSlip'])
                ->where('driver_id', $driver->driver_id);
            
            if ($statusFilter) {
                $query->where('status', $statusFilter);
            } else {
                $query->whereIn('status', [
                    'funds_issued',
                    'acknowledged',
                    'in_transit',
                    'pending_reconciliation',
                    'closed'
                ]);
            }
            
            $trips = $query->orderBy('trip_date', 'desc')
                ->get()
                ->map(function($ticket) {
                    return [
                        'trip_ticket_id' => $ticket->trip_ticket_id,
                        'trip_ticket_number' => $ticket->trip_ticket_number,
                        'destination' => $ticket->destination,
                        'purpose' => $ticket->purpose,
                        'trip_date' => $ticket->trip_date,
                        'status' => $ticket->status,
                        'estimated_fuel_liters' => $ticket->estimated_fuel_liters,
                        'estimated_distance_km' => $ticket->estimated_distance_km,
                        'has_insufficient_budget' => $ticket->has_insufficient_budget ?? false,
                        'vehicle' => $ticket->vehicle ? [
                            'vehicle_id' => $ticket->vehicle->vehicle_id,
                            'plate_number' => $ticket->vehicle->plate_number,
                            'vehicle_model' => $ticket->vehicle->vehicle_model,
                        ] : null,
                        'department_name' => $ticket->department ? $ticket->department->department_name : null,
                        'amount_released' => $ticket->gasSlip ? $ticket->gasSlip->amount_released : 0,
                        'created_at' => $ticket->created_at,
                    ];
                });
            
            return response()->json([
                'success' => true,
                'data' => $trips
            ]);
        } catch (\Exception $e) {
            Log::error('Get trips error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch trips: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Get current active trip for the driver
     */
    public function getActiveTrip(Request $request)
    {
        try {
            $user = $request->user();
            
            Log::info('getActiveTrip called', ['user_id' => $user->user_id]);
            
            $driver = Driver::where('user_id', $user->user_id)->first();
            
            if (!$driver) {
                Log::warning('Driver not found', ['user_id' => $user->user_id]);
                return response()->json([
                    'success' => false,
                    'message' => 'Driver record not found'
                ], 404);
            }
            
            Log::info('Driver found', ['driver_id' => $driver->driver_id]);
            
            // Check for active trips in priority order
            $activeTrip = TripTicket::with(['vehicle', 'department', 'gasSlip', 'driver.user'])
                ->where('driver_id', $driver->driver_id)
                ->where('status', 'in_transit')
                ->orderBy('trip_ticket_id', 'desc')
                ->first();
            
            if (!$activeTrip) {
                $activeTrip = TripTicket::with(['vehicle', 'department', 'gasSlip', 'driver.user'])
                    ->where('driver_id', $driver->driver_id)
                    ->where('status', 'acknowledged')
                    ->orderBy('trip_ticket_id', 'desc')
                    ->first();
            }
            
            if (!$activeTrip) {
                $activeTrip = TripTicket::with(['vehicle', 'department', 'gasSlip', 'driver.user'])
                    ->where('driver_id', $driver->driver_id)
                    ->where('status', 'funds_issued')
                    ->orderBy('trip_ticket_id', 'desc')
                    ->first();
            }
            
            if (!$activeTrip) {
                Log::info('No active trip found', ['driver_id' => $driver->driver_id]);
                return response()->json([
                    'success' => true,
                    'data' => null,
                    'message' => 'No active trip'
                ]);
            }
            
            Log::info('Active trip found', [
                'trip_id' => $activeTrip->trip_ticket_id,
                'trip_number' => $activeTrip->trip_ticket_number,
                'status' => $activeTrip->status
            ]);
            
            return response()->json([
                'success' => true,
                'data' => [
                    'trip_ticket_id' => $activeTrip->trip_ticket_id,
                    'trip_ticket_number' => $activeTrip->trip_ticket_number,
                    'destination' => $activeTrip->destination,
                    'purpose' => $activeTrip->purpose,
                    'trip_date' => $activeTrip->trip_date,
                    'status' => $activeTrip->status,
                    'charge_to' => $activeTrip->charge_to,
                    'amount_released' => $activeTrip->gasSlip ? $activeTrip->gasSlip->amount_released : 0,
                    'estimated_fuel_liters' => $activeTrip->estimated_fuel_liters,
                    'estimated_distance_km' => $activeTrip->estimated_distance_km,
                    'has_insufficient_budget' => $activeTrip->has_insufficient_budget ?? false,
                    'budget_shortage' => $activeTrip->budget_shortage ?? 0,
                    'vehicle' => $activeTrip->vehicle ? [
                        'vehicle_id' => $activeTrip->vehicle->vehicle_id,
                        'plate_number' => $activeTrip->vehicle->plate_number,
                        'vehicle_model' => $activeTrip->vehicle->vehicle_model,
                        'fuel_type' => $activeTrip->vehicle->fuel_type,
                    ] : null,
                    'driver' => $activeTrip->driver && $activeTrip->driver->user ? [
                        'full_name' => $activeTrip->driver->user->full_name,
                    ] : null,
                    'department_name' => $activeTrip->department ? $activeTrip->department->department_name : null,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get active trip error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch active trip: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Acknowledge fund issuance (gas slip receipt)
     */
    public function acknowledgeFunds(Request $request, $id)
    {
        try {
            $user = $request->user();
            Log::info('acknowledgeFunds called', ['trip_id' => $id, 'user_id' => $user->user_id]);
            
            $driver = Driver::where('user_id', $user->user_id)->first();
            
            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver record not found'
                ], 404);
            }
            
            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();
            
            if (!$ticket) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found'
                ], 404);
            }
            
            if ($ticket->status !== 'funds_issued') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot acknowledge. Current status: ' . $ticket->status . '. Required: funds_issued'
                ], 400);
            }
            
            DB::beginTransaction();
            
            $ticket->status = 'acknowledged';
            $ticket->save();
            
            $gasSlip = GasSlip::where('trip_ticket_id', $id)->first();
            if ($gasSlip) {
                $gasSlip->acknowledged_by = $user->user_id;
                $gasSlip->acknowledged_at = now();
                $gasSlip->save();
            }
            
            DB::commit();
            
            Log::info('Gas slip acknowledged', ['trip_id' => $id, 'new_status' => $ticket->status]);
            
            return response()->json([
                'success' => true,
                'message' => 'Gas slip acknowledged successfully',
                'data' => [
                    'trip_ticket_id' => $ticket->trip_ticket_id,
                    'status' => $ticket->status
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Acknowledge funds error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to acknowledge: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Start trip and begin GPS tracking - FIXED (No Odometer)
     */
    public function startTrip(Request $request, $id)
    {
        try {
            $user = $request->user();
            
            $validator = Validator::make($request->all(), [
                'latitude' => 'nullable|numeric|between:-90,90',
                'longitude' => 'nullable|numeric|between:-180,180',
                'accuracy' => 'nullable|numeric',
                // ✅ REMOVED: odometer_start
            ]);
            
            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            
            Log::info('startTrip called', ['trip_id' => $id, 'user_id' => $user->user_id]);
            
            $driver = Driver::where('user_id', $user->user_id)->first();
            
            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver record not found'
                ], 404);
            }
            
            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();
            
            if (!$ticket) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found'
                ], 404);
            }
            
            Log::info('Trip found', [
                'trip_id' => $ticket->trip_ticket_id,
                'current_status' => $ticket->status
            ]);
            
            if ($ticket->status === 'in_transit') {
                Log::info('Trip already in progress', ['trip_id' => $id]);
                return response()->json([
                    'success' => true,
                    'message' => 'Trip already in progress',
                    'data' => [
                        'trip_ticket_id' => $ticket->trip_ticket_id,
                        'status' => $ticket->status
                    ]
                ]);
            }
            
            if ($ticket->status !== 'acknowledged') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot start trip. Current status: ' . $ticket->status . '. Required: acknowledged'
                ], 400);
            }
            
            DB::beginTransaction();
            
            $ticket->status = 'in_transit';
            $ticket->save();
            
            $gasSlip = GasSlip::where('trip_ticket_id', $id)->first();
            if ($gasSlip) {
                $fuelReceipt = FuelReceipt::firstOrNew(['gas_slip_id' => $gasSlip->gas_slip_id]);
                $fuelReceipt->trip_started_at = now();
                if ($request->has('latitude') && $request->has('longitude')) {
                    $fuelReceipt->trip_start_gps_lat = $request->latitude;
                    $fuelReceipt->trip_start_gps_lng = $request->longitude;
                    $fuelReceipt->trip_start_gps_accuracy = $request->accuracy ?? null;
                }
                // ✅ REMOVED: odometer_start
                $fuelReceipt->save();
                
                // Store initial GPS ping
                if ($request->has('latitude') && $request->has('longitude')) {
                    GpsPing::create([
                        'trip_ticket_id' => $ticket->trip_ticket_id,
                        'latitude' => $request->latitude,
                        'longitude' => $request->longitude,
                        'accuracy_meters' => $request->accuracy ?? null,
                        'recorded_at' => now(),
                        'received_at' => now(),
                    ]);
                }
            }
            
            DB::commit();
            
            Log::info('Trip started successfully', [
                'trip_id' => $ticket->trip_ticket_id,
                'new_status' => $ticket->status
            ]);
            
            // Send notification
            NotificationHelper::send(
                $ticket->submitted_by,
                'trip_started',
                'trip_ticket',
                $ticket->trip_ticket_id,
                "Trip {$ticket->trip_ticket_number} has been started by driver " . $user->full_name
            );
            
            return response()->json([
                'success' => true,
                'message' => 'Trip started successfully',
                'data' => [
                    'trip_ticket_id' => $ticket->trip_ticket_id,
                    'status' => $ticket->status,
                    'trip_started_at' => now(),
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Start trip error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to start trip: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Complete trip - FIXED (No Odometer)
     */
    public function completeTrip(Request $request, $id)
    {
        try {
            $user = $request->user();
            
            $validator = Validator::make($request->all(), [
                'latitude' => 'nullable|numeric|between:-90,90',
                'longitude' => 'nullable|numeric|between:-180,180',
                'gps_distance_km' => 'nullable|numeric|min:0',
                // ✅ REMOVED: odometer_end
            ]);
            
            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            
            Log::info('completeTrip called', ['trip_id' => $id, 'user_id' => $user->user_id]);
            
            $driver = Driver::where('user_id', $user->user_id)->first();
            
            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver record not found'
                ], 404);
            }
            
            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();
            
            if (!$ticket) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found'
                ], 404);
            }
            
            Log::info('Trip found for completion', [
                'trip_id' => $ticket->trip_ticket_id,
                'current_status' => $ticket->status
            ]);
            
            if ($ticket->status === 'pending_reconciliation') {
                return response()->json([
                    'success' => true,
                    'message' => 'Trip already completed',
                    'data' => [
                        'trip_ticket_id' => $ticket->trip_ticket_id,
                        'status' => $ticket->status
                    ]
                ]);
            }
            
            if ($ticket->status !== 'in_transit') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot complete trip. Current status: ' . $ticket->status . '. Required: in_transit'
                ], 400);
            }
            
            DB::beginTransaction();
            
            $ticket->status = 'pending_reconciliation';
            $ticket->save();
            
            $gasSlip = GasSlip::where('trip_ticket_id', $id)->first();
            if ($gasSlip) {
                $fuelReceipt = FuelReceipt::where('gas_slip_id', $gasSlip->gas_slip_id)->first();
                if ($fuelReceipt) {
                    $fuelReceipt->trip_ended_at = now();
                    if ($request->has('gps_distance_km')) {
                        $fuelReceipt->gps_distance_km = $request->gps_distance_km;
                    }
                    $fuelReceipt->trip_elapsed_minutes = $fuelReceipt->trip_started_at ? 
                        $fuelReceipt->trip_started_at->diffInMinutes(now()) : null;
                    // ✅ REMOVED: odometer_end
                    $fuelReceipt->save();
                    
                    // Store final GPS ping
                    if ($request->has('latitude') && $request->has('longitude')) {
                        GpsPing::create([
                            'trip_ticket_id' => $ticket->trip_ticket_id,
                            'latitude' => $request->latitude,
                            'longitude' => $request->longitude,
                            'accuracy_meters' => $request->accuracy ?? null,
                            'recorded_at' => now(),
                            'received_at' => now(),
                        ]);
                    }
                }
            }
            
            DB::commit();
            
            Log::info('Trip completed successfully', [
                'trip_id' => $ticket->trip_ticket_id,
                'new_status' => $ticket->status
            ]);
            
            // Send notification
            NotificationHelper::send(
                $ticket->submitted_by,
                'trip_completed',
                'trip_ticket',
                $ticket->trip_ticket_id,
                "Trip {$ticket->trip_ticket_number} has been completed by driver " . $user->full_name
            );
            
            return response()->json([
                'success' => true,
                'message' => 'Trip completed successfully',
                'data' => [
                    'trip_ticket_id' => $ticket->trip_ticket_id,
                    'status' => $ticket->status,
                    'trip_ended_at' => now(),
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Complete trip error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to complete trip: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Upload fuel receipt - WITH AMOUNT VALIDATION
     */
    public function uploadReceipt(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'receipt' => 'required|image|mimes:jpeg,png,jpg|max:5120',
                'liters_availed' => 'nullable|numeric|min:0',
                'amount_on_receipt' => 'nullable|numeric|min:0',
            ]);
            
            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            
            $user = $request->user();
            Log::info('uploadReceipt called', ['trip_id' => $id, 'user_id' => $user->user_id]);
            
            $driver = Driver::where('user_id', $user->user_id)->first();
            
            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver record not found'
                ], 404);
            }
            
            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();
            
            if (!$ticket) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found'
                ], 404);
            }
            
            $gasSlip = GasSlip::where('trip_ticket_id', $id)->first();
            
            if (!$gasSlip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Gas slip not found'
                ], 404);
            }
            
            $amountReleased = $gasSlip->amount_released;
            $amountOnReceipt = $request->amount_on_receipt ?? 0;
            $litersAvailed = $request->liters_availed ?? 0;
            
            // VALIDATION 1: Amount on receipt cannot exceed released amount
            if ($amountOnReceipt > $amountReleased) {
                return response()->json([
                    'success' => false,
                    'message' => "Receipt amount (₱{$amountOnReceipt}) exceeds the released amount (₱{$amountReleased}). Please upload the correct receipt.",
                    'max_amount' => $amountReleased,
                    'suggestion' => "Please ensure the receipt amount is ₱{$amountReleased} or less."
                ], 422);
            }
            
            // VALIDATION 2: Calculate expected liters based on fuel price
            if ($litersAvailed > 0 && $amountOnReceipt > 0) {
                $fuelType = $ticket->vehicle ? $ticket->vehicle->fuel_type : 'regular';
                $fuelPrice = $this->getFuelPrice($fuelType);
                $expectedLiters = round($amountOnReceipt / $fuelPrice, 2);
                $tolerance = 0.5;
                
                if (abs($litersAvailed - $expectedLiters) > $tolerance) {
                    Log::warning('Liters mismatch', [
                        'liters_availed' => $litersAvailed,
                        'expected_liters' => $expectedLiters,
                        'amount_on_receipt' => $amountOnReceipt,
                        'fuel_price' => $fuelPrice
                    ]);
                }
            }
            
            $file = $request->file('receipt');
            $filename = time() . '_' . $file->getClientOriginalName();
            $path = $file->storeAs('receipts', $filename, 'public');
            
            $fuelReceipt = FuelReceipt::firstOrNew(['gas_slip_id' => $gasSlip->gas_slip_id]);
            $fuelReceipt->receipt_photo_path = $path;
            $fuelReceipt->receipt_uploaded_at = now();
            
            if ($request->has('liters_availed') && $litersAvailed > 0) {
                $fuelReceipt->liters_availed = $litersAvailed;
            } else {
                $fuelType = $ticket->vehicle ? $ticket->vehicle->fuel_type : 'regular';
                $fuelPrice = $this->getFuelPrice($fuelType);
                $fuelReceipt->liters_availed = round($amountOnReceipt / $fuelPrice, 2);
            }
            
            if ($request->has('amount_on_receipt') && $amountOnReceipt > 0) {
                $fuelReceipt->amount_on_receipt = $amountOnReceipt;
            } else {
                $fuelReceipt->amount_on_receipt = $amountReleased;
            }
            
            $fuelReceipt->save();
            
            Log::info('Receipt uploaded', [
                'trip_id' => $id, 
                'path' => $path,
                'amount_released' => $amountReleased,
                'amount_on_receipt' => $fuelReceipt->amount_on_receipt,
                'liters_availed' => $fuelReceipt->liters_availed
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'Receipt uploaded successfully',
                'data' => [
                    'receipt_path' => $path,
                    'receipt_url' => Storage::url($path),
                    'amount_released' => $amountReleased,
                    'amount_on_receipt' => $fuelReceipt->amount_on_receipt,
                    'liters_availed' => $fuelReceipt->liters_availed,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Upload receipt error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to upload receipt: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Get fuel price based on fuel type
     */
    private function getFuelPrice($fuelType)
    {
        try {
            $prices = [
                'regular' => SystemSetting::where('setting_key', 'regular_price_per_liter')->first()?->setting_value ?? 55.00,
                'premium' => SystemSetting::where('setting_key', 'premium_price_per_liter')->first()?->setting_value ?? 65.00,
                'diesel' => SystemSetting::where('setting_key', 'diesel_price_per_liter')->first()?->setting_value ?? 50.00,
            ];
            return $prices[$fuelType] ?? 55.00;
        } catch (\Exception $e) {
            return 55.00;
        }
    }
    
    /**
     * ✅ DEPRECATED: Update odometer readings
     * This method is no longer needed since odometer is removed
     */
    public function updateOdometer(Request $request, $id)
    {
        return response()->json([
            'success' => false,
            'message' => 'Odometer tracking has been deprecated. Please use GPS distance instead.',
            'data' => [
                'gps_recommendation' => 'Use the GPS tracking feature to record trip distance.',
                'trip_id' => $id,
            ]
        ], 410); // 410 Gone
    }

    /**
     * Get gas slip details for a trip - FIXED (No Odometer)
     */
    public function getGasSlip(Request $request, $id)
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
            
            $ticket = TripTicket::with(['vehicle', 'department', 'gasSlip', 'gasSlip.fuelReceipt'])
                ->where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();
            
            if (!$ticket) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trip ticket not found'
                ], 404);
            }
            
            $gasSlip = GasSlip::where('trip_ticket_id', $id)->first();
            
            if (!$gasSlip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Gas slip not found'
                ], 404);
            }
            
            return response()->json([
                'success' => true,
                'data' => [
                    'gas_slip_id' => $gasSlip->gas_slip_id,
                    'trip_ticket_id' => $ticket->trip_ticket_id,
                    'trip_ticket_number' => $ticket->trip_ticket_number,
                    'destination' => $ticket->destination,
                    'trip_date' => $ticket->trip_date,
                    'purpose' => $ticket->purpose,
                    'charge_to' => $ticket->charge_to,
                    'vehicle' => $ticket->vehicle ? [
                        'vehicle_id' => $ticket->vehicle->vehicle_id,
                        'plate_number' => $ticket->vehicle->plate_number,
                        'vehicle_model' => $ticket->vehicle->vehicle_model,
                        'fuel_type' => $ticket->vehicle->fuel_type,
                    ] : null,
                    'driver_name' => $driver->user ? $driver->user->full_name : null,
                    'amount_released' => $gasSlip->amount_released,
                    'budget_before' => $gasSlip->budget_before,
                    'budget_after' => $gasSlip->budget_after,
                    'issued_at' => $gasSlip->created_at,
                    'acknowledged_at' => $gasSlip->acknowledged_at,
                    'reconciliation_status' => $gasSlip->reconciliation_status,
                    'fuel_receipt' => $gasSlip->fuelReceipt ? [
                        'liters_availed' => $gasSlip->fuelReceipt->liters_availed,
                        'amount_on_receipt' => $gasSlip->fuelReceipt->amount_on_receipt,
                        // ✅ REMOVED: odometer_start, odometer_end
                        'trip_started_at' => $gasSlip->fuelReceipt->trip_started_at,
                        'trip_ended_at' => $gasSlip->fuelReceipt->trip_ended_at,
                    ] : null,
                    'status' => $ticket->status,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get gas slip error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch gas slip: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get active drivers for department staff
     */
    public function getActiveDrivers(Request $request)
    {
        try {
            $user = auth()->user();
            $departmentId = $request->get('department_id', $user->department_id);
            
            $drivers = User::where('role', 'driver')
                ->where('status', 'active')
                ->with('driver')
                ->when($departmentId, function($query) use ($departmentId) {
                    $query->where('department_id', $departmentId);
                })
                ->orderBy('first_name')
                ->get()
                ->map(function($user) {
                    return [
                        'driver_id' => $user->driver->driver_id ?? null,
                        'user_id' => $user->user_id,
                        'full_name' => $user->full_name,
                        'email' => $user->email,
                        'first_name' => $user->first_name,
                        'last_name' => $user->last_name,
                        'status' => $user->status,
                        'can_drive' => $user->can_drive,
                        'department_id' => $user->department_id,
                    ];
                });
            
            return response()->json([
                'success' => true,
                'data' => $drivers
            ]);
        } catch (\Exception $e) {
            Log::error('Get active drivers error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch drivers: ' . $e->getMessage()
            ], 500);
        }
    }
}
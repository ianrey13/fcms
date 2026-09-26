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
use App\Models\TripHistory;
use App\Helpers\NotificationHelper;
use App\Events\TripCompleted;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class DriverController extends Controller
{
    // ============================================
    // ADMIN METHODS (For GSO)
    // ============================================

    public function index(Request $request)
    {
        try {
            $departmentId = $request->get('department_id');

            $query = Driver::with('user.department')
                // ✅ Only active driver records
                ->where('status', 'active')
                // ✅ Only drivers whose user account is also active
                ->whereHas('user', function ($q) use ($departmentId) {
                    $q->where('status', 'active');
                    if ($departmentId) {
                        $q->where('department_id', $departmentId);
                    }
                });

            $drivers = $query->get()->map(function ($driver) {
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
            return response()->json(['success' => false, 'message' => 'Driver not found'], 404);
        }
    }

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
            return response()->json(['success' => false, 'message' => 'Failed to create driver: ' . $e->getMessage()], 500);
        }
    }

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

            $driver->update($request->only(['license_number', 'license_expiry', 'status']));

            return response()->json([
                'success' => true,
                'message' => 'Driver updated successfully',
                'data' => $driver->load('user')
            ]);
        } catch (\Exception $e) {
            Log::error('Update driver error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to update driver: ' . $e->getMessage()], 500);
        }
    }

    public function updateStatus(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), ['status' => 'required|in:active,inactive']);
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
            return response()->json(['success' => false, 'message' => 'Failed to update driver status'], 500);
        }
    }

    public function destroy($id)
    {
        try {
            $driver = Driver::findOrFail($id);

            $hasActiveTrips = TripTicket::where('driver_id', $id)
                ->whereIn('status', ['funds_issued', 'acknowledged', 'in_transit'])
                ->exists();

            if ($hasActiveTrips) {
                return response()->json(['success' => false, 'message' => 'Cannot delete driver with active trips'], 400);
            }

            if ($driver->user) {
                $driver->user->role = 'driver';
                $driver->user->can_drive = false;
                $driver->user->save();
            }

            $driver->delete();

            return response()->json(['success' => true, 'message' => 'Driver deleted successfully']);
        } catch (\Exception $e) {
            Log::error('Delete driver error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to delete driver'], 500);
        }
    }

    // ============================================
    // DRIVER APP METHODS
    // ============================================

    public function mobileDashboard(Request $request)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
            }

            $activeTrips = TripTicket::where('driver_id', $driver->driver_id)
                ->whereIn('status', ['funds_issued', 'acknowledged', 'in_transit'])
                ->count();

            $pendingReceipts = TripTicket::where('driver_id', $driver->driver_id)
                ->whereIn('status', ['funds_issued', 'acknowledged', 'in_transit'])
                ->where(function ($q) {
                    $q->whereDoesntHave('gasSlip.fuelReceipt')
                      ->orWhereHas('gasSlip.fuelReceipt', function ($q2) {
                          $q2->whereNull('receipt_photo_path');
                      });
                })
                ->count();

            $completedTrips = TripTicket::where('driver_id', $driver->driver_id)
                ->whereIn('status', ['closed'])
                ->count();

            $totalTrips = TripTicket::where('driver_id', $driver->driver_id)->count();

            $currentTrip = TripTicket::with(['vehicle', 'department', 'gasSlip.fuelReceipt'])
                ->where('driver_id', $driver->driver_id)
                ->whereIn('status', ['in_transit', 'acknowledged', 'funds_issued'])
                ->orderBy('created_at', 'desc')
                ->first();

            $unreadNotifications = Notification::where('recipient_user_id', $user->user_id)
                ->where('is_read', 0)
                ->count();

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
            return response()->json(['success' => false, 'message' => 'Failed to fetch dashboard: ' . $e->getMessage()], 500);
        }
    }

    public function getProfile(Request $request)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
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
            return response()->json(['success' => false, 'message' => 'Failed to fetch profile: ' . $e->getMessage()], 500);
        }
    }

    public function updateProfile(Request $request)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
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

            if ($request->has('first_name')) $user->first_name = $request->first_name;
            if ($request->has('middle_name')) $user->middle_name = $request->middle_name;
            if ($request->has('last_name')) $user->last_name = $request->last_name;
            $user->save();

            if ($request->has('license_number')) $driver->license_number = $request->license_number;
            if ($request->has('license_expiry')) $driver->license_expiry = $request->license_expiry;
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
            return response()->json(['success' => false, 'message' => 'Failed to update profile: ' . $e->getMessage()], 500);
        }
    }

    public function getStats(Request $request)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
            }

            $monthlyTrips = TripTicket::where('driver_id', $driver->driver_id)
                ->whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->count();

            $weeklyTrips = TripTicket::where('driver_id', $driver->driver_id)
                ->whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])
                ->count();

            $totalDistance = FuelReceipt::whereHas('gasSlip.tripTicket', function ($q) use ($driver) {
                $q->where('driver_id', $driver->driver_id);
            })->sum('gps_distance_km');

            $totalFuel = FuelReceipt::whereHas('gasSlip.tripTicket', function ($q) use ($driver) {
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
                        ->whereIn('status', ['closed'])
                        ->count(),
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get stats error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch stats: ' . $e->getMessage()], 500);
        }
    }

    public function getTripHistory(Request $request)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
            }

            $limit = $request->get('limit', 10);
            $page = $request->get('page', 1);

            $trips = TripTicket::with(['vehicle', 'department', 'gasSlip.fuelReceipt'])
                ->where('driver_id', $driver->driver_id)
                ->whereIn('status', ['closed'])
                ->orderBy('created_at', 'desc')
                ->paginate($limit, ['*'], 'page', $page);

            return response()->json([
                'success' => true,
                'data' => $trips->map(function ($trip) {
                    return [
                        'trip_ticket_id' => $trip->trip_ticket_id,
                        'trip_ticket_number' => $trip->trip_ticket_number,
                        'destination' => $trip->destination,
                        'purpose' => $trip->purpose,
                        'trip_date' => $trip->trip_date,
                        'status' => $trip->status,
                        'estimated_distance_km' => $trip->estimated_distance_km,
                        'actual_distance_km' => $trip->actual_distance_km,
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
            return response()->json(['success' => false, 'message' => 'Failed to fetch trip history: ' . $e->getMessage()], 500);
        }
    }

    public function getTripHistoryByTicket(Request $request, $id)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
            }

            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$ticket) {
                return response()->json(['success' => false, 'message' => 'Trip ticket not found'], 404);
            }

            $history = TripHistory::where('trip_ticket_id', $id)
                ->orderBy('trip_number', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'trip_ticket_id' => $ticket->trip_ticket_id,
                    'trip_ticket_number' => $ticket->trip_ticket_number,
                    'trip_count' => $ticket->trip_count ?? 0,
                    'actual_distance_km' => $ticket->actual_distance_km,
                    'history' => $history->map(function ($trip) {
                        return [
                            'history_id' => $trip->history_id,
                            'trip_number' => $trip->trip_number,
                            'start_lat' => $trip->start_lat,
                            'start_lng' => $trip->start_lng,
                            'started_at' => $trip->started_at,
                            'end_lat' => $trip->end_lat,
                            'end_lng' => $trip->end_lng,
                            'ended_at' => $trip->ended_at,
                            'distance_km' => $trip->distance_km,
                            'status' => $trip->status,
                            'duration_minutes' => $trip->started_at && $trip->ended_at ?
                                $trip->started_at->diffInMinutes($trip->ended_at) : null,
                        ];
                    }),
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get trip history by ticket error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch trip history: ' . $e->getMessage()], 500);
        }
    }

    public function getTripDetails(Request $request, $id)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
            }

            $trip = TripTicket::with([
                'vehicle',
                'department',
                'gasSlip',
                'gasSlip.fuelReceipt',
                'submittedBy',
                'returns',
                'cancellation'
            ])->where('trip_ticket_id', $id)
              ->where('driver_id', $driver->driver_id)
              ->first();

            if (!$trip) {
                return response()->json(['success' => false, 'message' => 'Trip ticket not found'], 404);
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
                    'actual_distance_km' => $trip->actual_distance_km,
                    'actual_fuel_used' => $trip->actual_fuel_used,
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
                        'reconciliation_status' => $trip->gasSlip->reconciliation_status,
                        'acknowledged_at' => $trip->gasSlip->acknowledged_at,
                        'created_at' => $trip->gasSlip->created_at,
                        'fuel_receipt' => $trip->gasSlip->fuelReceipt ? [
                            'fuel_receipt_id' => $trip->gasSlip->fuelReceipt->fuel_receipt_id,
                            'liters_availed' => $trip->gasSlip->fuelReceipt->liters_availed,
                            'amount_on_receipt' => $trip->gasSlip->fuelReceipt->amount_on_receipt,
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
                    'returns' => $trip->returns ? $trip->returns->map(function ($return) {
                        return [
                            'return_type' => $return->return_type,
                            'return_note' => $return->return_note,
                            'actioned_at' => $return->actioned_at,
                        ];
                    }) : [],
                    'cancellation' => $trip->cancellation ? [
                        'cancellation_reason' => $trip->cancellation->cancellation_reason,
                        'cancelled_at' => $trip->cancellation->cancelled_at,
                    ] : null,
                    'created_at' => $trip->created_at,
                    'updated_at' => $trip->updated_at,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get trip details error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch trip details: ' . $e->getMessage()], 500);
        }
    }

    public function acknowledgeReceipt(Request $request, $id)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
            }

            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$ticket) {
                return response()->json(['success' => false, 'message' => 'Trip ticket not found'], 404);
            }

            $gasSlip = GasSlip::where('trip_ticket_id', $id)->first();

            if (!$gasSlip) {
                return response()->json(['success' => false, 'message' => 'Gas slip not found'], 404);
            }

            $fuelReceipt = FuelReceipt::where('gas_slip_id', $gasSlip->gas_slip_id)->first();
            if (!$fuelReceipt || !$fuelReceipt->receipt_photo_path) {
                return response()->json(['success' => false, 'message' => 'Please upload receipt first before acknowledging'], 422);
            }

            // ✅ REMOVED: 0-liters check (driver no longer enters liters)

            $gasSlip->acknowledged_by = $user->user_id;
            $gasSlip->acknowledged_at = now();
            $gasSlip->save();

            return response()->json([
                'success' => true,
                'message' => 'Receipt acknowledged successfully',
                'data' => [
                    'acknowledged_at' => $gasSlip->acknowledged_at,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Acknowledge receipt error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to acknowledge receipt: ' . $e->getMessage()], 500);
        }
    }

    public function getReceiptStatus(Request $request, $id)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
            }

            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$ticket) {
                return response()->json(['success' => false, 'message' => 'Trip ticket not found'], 404);
            }

            $gasSlip = GasSlip::where('trip_ticket_id', $id)->first();

            if (!$gasSlip) {
                return response()->json([
                    'success' => true,
                    'data' => ['is_uploaded' => false, 'message' => 'No gas slip found for this trip']
                ]);
            }

            $fuelReceipt = FuelReceipt::where('gas_slip_id', $gasSlip->gas_slip_id)->first();

            return response()->json([
                'success' => true,
                'data' => [
                    'is_uploaded' => $fuelReceipt && $fuelReceipt->receipt_photo_path ? true : false,
                    'receipt_photo_path' => $fuelReceipt ? $fuelReceipt->receipt_photo_path : null,
                    'receipt_url' => $fuelReceipt && $fuelReceipt->receipt_photo_path ?
                        asset($fuelReceipt->receipt_photo_path) : null,
                    'liters_availed' => $fuelReceipt ? $fuelReceipt->liters_availed : null,
                    'amount_on_receipt' => $fuelReceipt ? $fuelReceipt->amount_on_receipt : null,
                    'uploaded_at' => $fuelReceipt ? $fuelReceipt->receipt_uploaded_at : null,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get receipt status error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch receipt status: ' . $e->getMessage()], 500);
        }
    }

    public function getFuelPrices()
    {
        try {
            return [
                'diesel' => SystemSetting::where('setting_key', 'diesel_price_per_liter')->first()?->setting_value ?? 50.00,
                'premium' => SystemSetting::where('setting_key', 'premium_price_per_liter')->first()?->setting_value ?? 65.00,
                'regular' => SystemSetting::where('setting_key', 'regular_price_per_liter')->first()?->setting_value ?? 55.00,
            ];
        } catch (\Exception $e) {
            return ['diesel' => 50.00, 'premium' => 65.00, 'regular' => 55.00];
        }
    }

    public function getTrips(Request $request)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
            }

            $statusFilter = $request->get('status');
            $query = TripTicket::with(['vehicle', 'department', 'gasSlip'])
                ->where('driver_id', $driver->driver_id);

            if ($statusFilter) {
                $query->where('status', $statusFilter);
            } else {
                $query->whereIn('status', [
                    'funds_issued', 'acknowledged', 'in_transit',
                    'closed', 'completed', 'pending_gso_validation',
                    'cancelled', 'rejected', 'returned_for_revision'
                ]);
            }

            $trips = $query->orderBy('trip_date', 'desc')
                ->get()
                ->map(function ($ticket) {
                    return [
                        'trip_ticket_id' => $ticket->trip_ticket_id,
                        'trip_ticket_number' => $ticket->trip_ticket_number,
                        'destination' => $ticket->destination,
                        'purpose' => $ticket->purpose,
                        'trip_date' => $ticket->trip_date,
                        'status' => $ticket->status,
                        'trip_count' => $ticket->trip_count ?? 0,
                        'estimated_fuel_liters' => $ticket->estimated_fuel_liters,
                        'estimated_distance_km' => $ticket->estimated_distance_km,
                        'actual_distance_km' => $ticket->actual_distance_km,
                        'actual_fuel_used' => $ticket->actual_fuel_used,
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

            return response()->json(['success' => true, 'data' => $trips]);
        } catch (\Exception $e) {
            Log::error('Get trips error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch trips: ' . $e->getMessage()], 500);
        }
    }

    public function getActiveTrip(Request $request)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
            }

            // ✅ Priority order: in_transit → acknowledged → funds_issued → completed
            // Only return trips that have a valid destination and vehicle
            $activeTrip = TripTicket::with(['vehicle', 'department', 'gasSlip.fuelReceipt', 'driver.user'])
                ->where('driver_id', $driver->driver_id)
                ->whereIn('status', ['in_transit', 'acknowledged', 'funds_issued', 'completed', 'pending_gso_ticket'])
                ->whereNotNull('destination')
                ->whereNotNull('vehicle_id')
                ->orderByRaw("FIELD(status, 'in_transit', 'acknowledged', 'funds_issued', 'pending_gso_ticket', 'completed')")
                ->orderBy('updated_at', 'desc')
                ->first();

            if (!$activeTrip) {
                return response()->json(['success' => true, 'data' => null, 'message' => 'No active trip']);
            }

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
                    'amount_released' => $activeTrip->gasSlip ? (float) $activeTrip->gasSlip->amount_released : 0,
                    'estimated_fuel_liters' => $activeTrip->estimated_fuel_liters,
                    'estimated_distance_km' => $activeTrip->estimated_distance_km,
                    'actual_distance_km' => $activeTrip->actual_distance_km,
                    'actual_fuel_used' => $activeTrip->actual_fuel_used,
                    'has_insufficient_budget' => (bool) ($activeTrip->has_insufficient_budget ?? false),
                    'budget_shortage' => (float) ($activeTrip->budget_shortage ?? 0),
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
            return response()->json(['success' => false, 'message' => 'Failed to fetch active trip: ' . $e->getMessage()], 500);
        }
    }

    public function acknowledgeFunds(Request $request, $id)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
            }

            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$ticket) {
                return response()->json(['success' => false, 'message' => 'Trip ticket not found'], 404);
            }

            // ✅ Idempotency: if the driver already acknowledged, don't re-process
            $existingGasSlip = GasSlip::where('trip_ticket_id', $id)->first();
            if ($existingGasSlip && $existingGasSlip->acknowledged_at) {
                return response()->json([
                    'success' => true,
                    'message' => 'Funds already acknowledged',
                    'data' => [
                        'trip_ticket_id' => $ticket->trip_ticket_id,
                        'status' => $ticket->status,
                        'acknowledged_at' => $existingGasSlip->acknowledged_at,
                    ],
                ]);
            }

            if (!in_array($ticket->status, ['funds_issued', 'pending_gso_ticket'])) {
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

            $gsoStaff = User::where('role', 'gso_office')->where('status', 'active')->get();
            foreach ($gsoStaff as $gso) {
                NotificationHelper::send(
                    $gso->user_id,
                    'driver_acknowledged',
                    'trip_ticket',
                    $ticket->trip_ticket_id,
                    "Driver {$user->full_name} acknowledged funds for trip {$ticket->trip_ticket_number}"
                );
            }

            $moStaff = User::where('role', 'mayors_office')->where('status', 'active')->get();
            foreach ($moStaff as $mo) {
                NotificationHelper::send(
                    $mo->user_id,
                    'driver_acknowledged',
                    'trip_ticket',
                    $ticket->trip_ticket_id,
                    "Driver {$user->full_name} acknowledged funds for trip {$ticket->trip_ticket_number}"
                );
            }

            // ✅ PM RULE: Once the driver acknowledges, clear their own stale
            // fund/trip notifications for this trip.
            Notification::where('recipient_user_id', $user->user_id)
                ->where('entity_type', 'trip_ticket')
                ->where('entity_id', $ticket->trip_ticket_id)
                ->whereIn('notification_type', ['trip_created', 'fund_released', 'fund_issued'])
                ->where('is_read', false)
                ->update(['is_read' => true, 'read_at' => now()]);

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
            return response()->json(['success' => false, 'message' => 'Failed to acknowledge: ' . $e->getMessage()], 500);
        }
    }

    public function startTrip(Request $request, $id)
    {
        try {
            $user = $request->user();

            $validator = Validator::make($request->all(), [
                'latitude' => 'nullable|numeric|between:-90,90',
                'longitude' => 'nullable|numeric|between:-180,180',
                'accuracy' => 'nullable|numeric',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $driver = Driver::where('user_id', $user->user_id)->first();
            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
            }

            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$ticket) {
                return response()->json(['success' => false, 'message' => 'Trip ticket not found'], 404);
            }

            $allowedStatuses = ['acknowledged', 'funds_issued', 'completed', 'pending_gso_ticket'];
            if (!in_array($ticket->status, $allowedStatuses)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot start trip. Current status: ' . $ticket->status .
                                '. Allowed: ' . implode(', ', $allowedStatuses)
                ], 400);
            }

            $otherActive = TripTicket::where('driver_id', $driver->driver_id)
                ->where('status', 'in_transit')
                ->where('trip_ticket_id', '!=', $id)
                ->exists();

            if ($otherActive) {
                return response()->json([
                    'success' => false,
                    'message' => 'You already have another trip in progress. Complete it first.'
                ], 400);
            }

            DB::beginTransaction();

            $gasSlip = GasSlip::where('trip_ticket_id', $id)->first();
            if ($gasSlip && !$gasSlip->acknowledged_at) {
                $gasSlip->acknowledged_by = $user->user_id;
                $gasSlip->acknowledged_at = now();
                $gasSlip->save();
                Log::info("Auto-acknowledged gas slip for ticket {$ticket->trip_ticket_number} on startTrip");

                Notification::where('recipient_user_id', $user->user_id)
                    ->where('entity_type', 'trip_ticket')
                    ->where('entity_id', $ticket->trip_ticket_id)
                    ->whereIn('notification_type', ['trip_created', 'fund_released', 'fund_issued'])
                    ->where('is_read', false)
                    ->update(['is_read' => true, 'read_at' => now()]);
            }

            $ticket->trip_count = ($ticket->trip_count ?? 0) + 1;
            $ticket->status = 'in_transit';
            $ticket->save();

            $tripHistory = TripHistory::create([
                'trip_ticket_id' => $ticket->trip_ticket_id,
                'trip_number' => $ticket->trip_count,
                'start_lat' => $request->latitude,
                'start_lng' => $request->longitude,
                'started_at' => now(),
                'status' => 'in_progress',
            ]);

            if ($gasSlip) {
                $fuelReceipt = FuelReceipt::firstOrNew(['gas_slip_id' => $gasSlip->gas_slip_id]);
                $fuelReceipt->trip_started_at = now();
                if ($request->has('latitude') && $request->has('longitude')) {
                    $fuelReceipt->trip_start_gps_lat = $request->latitude;
                    $fuelReceipt->trip_start_gps_lng = $request->longitude;
                    $fuelReceipt->trip_start_gps_accuracy = $request->accuracy ?? null;
                }
                $fuelReceipt->save();
            }

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

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Trip started! GPS tracking is active.',
                'data' => [
                    'trip_ticket_id' => $ticket->trip_ticket_id,
                    'status' => $ticket->status,
                    'trip_number' => $ticket->trip_count,
                    'trip_started_at' => now(),
                    'start_lat' => $request->latitude,
                    'start_lng' => $request->longitude,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Start trip error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to start trip: ' . $e->getMessage()], 500);
        }
    }

    public function completeTrip(Request $request, $id)
    {
        try {
            $user = $request->user();

            $validator = Validator::make($request->all(), [
                'latitude' => 'nullable|numeric|between:-90,90',
                'longitude' => 'nullable|numeric|between:-180,180',
                'accuracy' => 'nullable|numeric',
                'is_done' => 'nullable|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $driver = Driver::where('user_id', $user->user_id)->first();
            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
            }

            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$ticket) {
                return response()->json(['success' => false, 'message' => 'Trip ticket not found'], 404);
            }

            if (in_array($ticket->status, ['completed', 'pending_gso_validation', 'closed'])) {
                return response()->json([
                    'success' => true,
                    'message' => 'Trip already completed',
                    'data' => ['trip_ticket_id' => $ticket->trip_ticket_id, 'status' => $ticket->status]
                ]);
            }

            if ($ticket->status !== 'in_transit') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot complete trip. Current status: ' . $ticket->status . '. Required: in_transit'
                ], 400);
            }

            DB::beginTransaction();

            // ✅ Compute distance server-side from GPS pings BEFORE deleting
            $pings = GpsPing::where('trip_ticket_id', $id)
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

            Log::info("Trip {$ticket->trip_ticket_number} completed", [
                'trip_id' => $id,
                'pings_count' => $pingCount,
                'computed_distance_km' => $finalDistance,
                'is_done' => $request->is_done,
            ]);

            $tripHistory = TripHistory::where('trip_ticket_id', $id)
                ->where('status', 'in_progress')
                ->orderBy('trip_number', 'desc')
                ->first();

            if ($tripHistory) {
                $tripHistory->end_lat = $request->latitude;
                $tripHistory->end_lng = $request->longitude;
                $tripHistory->ended_at = now();
                $tripHistory->distance_km = $finalDistance;
                $tripHistory->status = 'completed';
                $tripHistory->save();
            }

            $gasSlip = GasSlip::where('trip_ticket_id', $id)->first();
            if ($gasSlip) {
                $fuelReceipt = FuelReceipt::where('gas_slip_id', $gasSlip->gas_slip_id)->first();
                if ($fuelReceipt) {
                    $fuelReceipt->trip_ended_at = now();
                    $fuelReceipt->gps_distance_km =
                        round((float) $fuelReceipt->gps_distance_km + $finalDistance, 2);
                    $fuelReceipt->trip_elapsed_minutes = $fuelReceipt->trip_started_at ?
                        $fuelReceipt->trip_started_at->diffInMinutes(now()) : null;

                    if ($request->has('latitude') && $request->has('longitude')) {
                        $fuelReceipt->trip_end_gps_lat = $request->latitude;
                        $fuelReceipt->trip_end_gps_lng = $request->longitude;
                    }
                    $fuelReceipt->save();
                }
            }

            $deletedPings = GpsPing::where('trip_ticket_id', $id)->delete();

            $isDone = $request->is_done ?? false;

            if ($isDone) {
                $ticket->status = 'pending_gso_validation';
                $message = 'Trip completed! Awaiting GSO validation.';
                $notifyGSO = true;
            } else {
                $ticket->status = 'completed';
                $message = 'Trip completed for today! You can start again tomorrow.';
                $notifyGSO = false;
            }

            $ticket->syncActuals();
            $ticket->save();

            DB::commit();

            try {
                broadcast(new TripCompleted(
                    $ticket->trip_ticket_id,
                    $request->latitude,
                    $request->longitude
                ));
            } catch (\Exception $e) {
                Log::warning('Failed to broadcast trip completion: ' . $e->getMessage());
            }

            if ($notifyGSO) {
                $this->notifyGsoForValidation($ticket);
            }

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => [
                    'trip_ticket_id' => $ticket->trip_ticket_id,
                    'status' => $ticket->status,
                    'trip_number' => $ticket->trip_count,
                    'trip_ended_at' => now(),
                    'pings_count' => $pingCount,
                    'pings_deleted' => $deletedPings,
                    'computed_distance_km' => $finalDistance,
                    'is_complete' => $isDone,
                    'can_restart_tomorrow' => !$isDone,
                    'actual_distance_km' => $ticket->actual_distance_km,
                    'actual_fuel_used' => $ticket->actual_fuel_used,
                    'end_lat' => $request->latitude,
                    'end_lng' => $request->longitude,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Complete trip error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to complete trip: ' . $e->getMessage()], 500);
        }
    }

    private function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $R = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2
           + cos(deg2rad($lat1)) * cos(deg2rad($lat2))
           * sin($dLon / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $R * $c;
    }

    private function notifyGsoForValidation($ticket)
    {
        $gsoStaff = User::where('role', 'gso_office')->where('status', 'active')->get();
        foreach ($gsoStaff as $gso) {
            NotificationHelper::send(
                $gso->user_id,
                'trip_pending_validation',
                'trip_ticket',
                $ticket->trip_ticket_id,
                "Trip {$ticket->trip_ticket_number} (#{$ticket->trip_count} trips) is ready for GSO validation"
            );
        }

        $moStaff = User::where('role', 'mayors_office')->where('status', 'active')->get();
        foreach ($moStaff as $mo) {
            NotificationHelper::send(
                $mo->user_id,
                'trip_pending_validation',
                'trip_ticket',
                $ticket->trip_ticket_id,
                "Trip {$ticket->trip_ticket_number} (#{$ticket->trip_count} trips) is ready for GSO validation"
            );
        }
    }

    public function uploadReceipt(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'receipt' => 'required|image|mimes:jpeg,png,jpg|max:5120',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
            }

            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$ticket) {
                return response()->json(['success' => false, 'message' => 'Trip ticket not found'], 404);
            }

            if (in_array($ticket->status, ['pending_gso_validation', 'closed', 'cancelled', 'rejected'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot modify receipt for a trip that is ' . str_replace('_', ' ', $ticket->status) . '.',
                    'current_status' => $ticket->status,
                ], 422);
            }

            $gasSlip = GasSlip::where('trip_ticket_id', $id)->first();

            if (!$gasSlip) {
                return response()->json(['success' => false, 'message' => 'Gas slip not found'], 404);
            }

            $file = $request->file('receipt');
            $extension = $file->getClientOriginalExtension() ?: 'jpg';
            $filename = 'receipt_' . $id . '_' . time() . '_' . Str::uuid() . '.' . $extension;
            $file->move(public_path('receipts'), $filename);
            $dbPath = 'receipts/' . $filename;

            $fuelReceipt = FuelReceipt::firstOrNew(['gas_slip_id' => $gasSlip->gas_slip_id]);

            if ($fuelReceipt->receipt_photo_path && $fuelReceipt->receipt_photo_path !== $dbPath) {
                $oldPath = public_path($fuelReceipt->receipt_photo_path);
                if (file_exists($oldPath)) {
                    @unlink($oldPath);
                }
            }

            $fuelReceipt->receipt_photo_path = $dbPath;
            $fuelReceipt->receipt_uploaded_at = now();
            $fuelReceipt->save();

            return response()->json([
                'success' => true,
                'message' => 'Receipt photo uploaded. GSO will review and enter the fuel details.',
                'data' => [
                    'receipt_path' => $dbPath,
                    'receipt_url' => asset($dbPath),
                    'amount_released' => (float) $gasSlip->amount_released,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Upload receipt error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to upload receipt: ' . $e->getMessage()], 500);
        }
    }

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

    public function updateOdometer(Request $request, $id)
    {
        return response()->json([
            'success' => false,
            'message' => 'Odometer tracking has been deprecated. Please use GPS distance instead.',
            'data' => ['trip_id' => $id]
        ], 410);
    }

    public function getGasSlip(Request $request, $id)
    {
        try {
            $user = $request->user();
            $driver = Driver::where('user_id', $user->user_id)->first();

            if (!$driver) {
                return response()->json(['success' => false, 'message' => 'Driver record not found'], 404);
            }

            $ticket = TripTicket::with(['vehicle', 'department', 'gasSlip', 'gasSlip.fuelReceipt'])
                ->where('trip_ticket_id', $id)
                ->where('driver_id', $driver->driver_id)
                ->first();

            if (!$ticket) {
                return response()->json(['success' => false, 'message' => 'Trip ticket not found'], 404);
            }

            $gasSlip = GasSlip::where('trip_ticket_id', $id)->first();

            if (!$gasSlip) {
                return response()->json(['success' => false, 'message' => 'Gas slip not found'], 404);
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
                    'issued_at' => $gasSlip->created_at,
                    'acknowledged_at' => $gasSlip->acknowledged_at,
                    'reconciliation_status' => $gasSlip->reconciliation_status,
                    'fuel_receipt' => $gasSlip->fuelReceipt ? [
                        'liters_availed' => $gasSlip->fuelReceipt->liters_availed,
                        'amount_on_receipt' => $gasSlip->fuelReceipt->amount_on_receipt,
                        'unit_price' => $gasSlip->fuelReceipt->unit_price,
                        'trip_started_at' => $gasSlip->fuelReceipt->trip_started_at,
                        'trip_ended_at' => $gasSlip->fuelReceipt->trip_ended_at,
                    ] : null,
                    'status' => $ticket->status,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get gas slip error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch gas slip: ' . $e->getMessage()], 500);
        }
    }

    public function getActiveDrivers(Request $request)
    {
        try {
            $user = auth()->user();
            $departmentId = $request->get('department_id', $user->department_id);

            $drivers = User::where('role', 'driver')
                ->where('status', 'active')
                // ✅ Only users who have an active driver record
                ->whereHas('driver', fn($q) => $q->where('status', 'active'))
                ->with('driver')
                ->when($departmentId, function ($query) use ($departmentId) {
                    $query->where('department_id', $departmentId);
                })
                ->orderBy('first_name')
                ->get()
                ->map(function ($user) {
                    return [
                        'driver_id' => $user->driver?->driver_id,
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

            return response()->json(['success' => true, 'data' => $drivers]);
        } catch (\Exception $e) {
            Log::error('Get active drivers error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch drivers: ' . $e->getMessage()], 500);
        }
    }
}
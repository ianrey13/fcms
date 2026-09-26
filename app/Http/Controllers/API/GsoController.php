<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\TripTicket;
use App\Models\GasSlip;
use App\Models\Notification;
use App\Models\User;
use App\Models\Department;
use App\Models\Vehicle;
use App\Models\Driver;
use App\Models\TripHistory;
use App\Models\FuelReceipt;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;
use App\Helpers\NotificationHelper;
use Illuminate\Support\Facades\Storage;

class GsoController extends Controller
{
    /**
     * Get GSO dashboard statistics
     */
    public function getDashboard(Request $request)
    {
        $user = $request->user();

        if (!$user->isGsoOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $stats = [
            'pending_mayors_office' => TripTicket::where('status', TripTicket::STATUS_PENDING_MAYORS_OFFICE)->count(),
            'funds_issued' => TripTicket::where('status', TripTicket::STATUS_FUNDS_ISSUED)->count(),
            'in_transit' => TripTicket::where('status', TripTicket::STATUS_IN_TRANSIT)->count(),
            'returned' => TripTicket::where('status', TripTicket::STATUS_RETURNED_FOR_REVISION)->count(),
            'closed' => TripTicket::where('status', TripTicket::STATUS_CLOSED)->count(),
            'total_trips_this_month' => TripTicket::whereMonth('submitted_at', now()->month)->count(),
            'total_trips_this_year' => TripTicket::whereYear('submitted_at', now()->year)->count(),
            'total_budget_allocated' => DB::table('dept_budget_period')
                ->where('status', 'active')
                ->sum('allocated_amount'),
            'total_users' => User::count(),
            'total_vehicles' => Vehicle::count(),
            'total_departments' => Department::count(),
            'available_vehicles' => Vehicle::where('status', 'active')
                ->where('maintenance_flag', false)
                ->whereNotIn('vehicle_id', function($query) {
                    $query->select('vehicle_id')
                        ->from('trip_ticket')
                        ->whereIn('status', Vehicle::getActiveTripStatuses());
                })
                ->count(),
            'vehicles_in_use' => DB::table('trip_ticket')
                ->whereIn('status', Vehicle::getActiveTripStatuses())
                ->distinct('vehicle_id')
                ->count('vehicle_id'),
        ];

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }

    /**
     * Get available vehicles (not in active trips)
     */
    public function getAvailableVehicles(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isGsoOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $departmentId = $request->get('department_id');
            $includeAll = $request->get('include_all', false);

            $activeTripVehicleIds = TripTicket::whereIn('status', Vehicle::getActiveTripStatuses())
                ->pluck('vehicle_id')
                ->toArray();

            $query = Vehicle::where('status', 'active')
                ->where('maintenance_flag', false);

            if ($departmentId && !$includeAll) {
                $query->where('department_id', $departmentId);
            }

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
                        'is_available' => true,
                        'fuel_percentage' => $vehicle->fuel_percentage,
                        'fuel_status' => $vehicle->fuel_status,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $vehicles,
                'total_available' => $vehicles->count(),
                'active_vehicle_count' => count($activeTripVehicleIds),
                'message' => 'Showing vehicles available for new trip assignments'
            ]);

        } catch (\Exception $e) {
            Log::error('GSO get available vehicles error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch available vehicles: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get pending tickets for Mayor's Office
     */
    public function getPendingTickets(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isGsoOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $pendingTickets = TripTicket::with(['vehicle', 'department', 'submittedBy', 'driver.user'])
                ->where('status', TripTicket::STATUS_PENDING_MAYORS_OFFICE)
                ->orderBy('submitted_at', 'asc')
                ->get()
                ->map(function ($ticket) {
                    return [
                        'id' => $ticket->trip_ticket_id,
                        'ticket_number' => $ticket->trip_ticket_number,
                        'trip_date' => $ticket->trip_date,
                        'destination' => $ticket->destination,
                        'purpose' => $ticket->purpose,
                        'charge_to' => $ticket->charge_to,
                        'passenger_name' => $ticket->passenger_name,
                        'submitted_at' => $ticket->submitted_at,
                        'status' => $ticket->status,
                        'has_insufficient_budget' => $ticket->has_insufficient_budget ?? false,
                        'budget_shortage' => $ticket->budget_shortage ?? 0,
                        'estimated_cost' => $ticket->estimated_fuel_liters ?
                            ($ticket->estimated_fuel_liters * 88) : null,
                        'vehicle' => $ticket->vehicle ? [
                            'plate_number' => $ticket->vehicle->plate_number,
                            'vehicle_model' => $ticket->vehicle->vehicle_model,
                        ] : null,
                        'driver' => $ticket->driver && $ticket->driver->user ? [
                            'full_name' => $ticket->driver->user->full_name,
                        ] : null,
                        'department_name' => $ticket->department ? $ticket->department->department_name : null,
                        'department_code' => $ticket->department ? $ticket->department->department_code : null,
                        'requester' => $ticket->submittedBy ? [
                            'full_name' => $ticket->submittedBy->full_name,
                        ] : null,
                        'is_staff_created' => $ticket->submitted_by_staff ?? false,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $pendingTickets,
                'meta' => [
                    'pending_count' => $pendingTickets->count()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get pending tickets error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch pending tickets: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get trips that need reconciliation
     */
    public function getPendingReconciliation(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isGsoOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $trips = TripTicket::with(['vehicle', 'department', 'driver.user', 'gasSlip'])
                ->where('status', TripTicket::STATUS_PENDING_RECONCILIATION)
                ->orderBy('submitted_at', 'asc')
                ->get()
                ->map(function ($ticket) {
                    return [
                        'id' => $ticket->trip_ticket_id,
                        'ticket_number' => $ticket->trip_ticket_number,
                        'trip_date' => $ticket->trip_date,
                        'destination' => $ticket->destination,
                        'purpose' => $ticket->purpose,
                        'status' => $ticket->status,
                        'submitted_at' => $ticket->submitted_at,
                        'amount_released' => $ticket->gasSlip ? $ticket->gasSlip->amount_released : 0,
                        'vehicle' => $ticket->vehicle ? [
                            'plate_number' => $ticket->vehicle->plate_number,
                        ] : null,
                        'driver' => $ticket->driver && $ticket->driver->user ? [
                            'full_name' => $ticket->driver->user->full_name,
                        ] : null,
                        'department_name' => $ticket->department ? $ticket->department->department_name : null,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $trips,
                'meta' => [
                    'total' => $trips->count()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get pending reconciliation error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch pending reconciliation: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get returned tickets
     */
    public function getReturnedTickets(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isGsoOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $returnedTickets = TripTicket::with(['vehicle', 'department', 'submittedBy', 'returns'])
                ->where('status', TripTicket::STATUS_RETURNED_FOR_REVISION)
                ->orderBy('submitted_at', 'desc')
                ->get()
                ->map(function ($ticket) {
                    $latestReturn = $ticket->returns->sortByDesc('actioned_at')->first();
                    return [
                        'id' => $ticket->trip_ticket_id,
                        'ticket_number' => $ticket->trip_ticket_number,
                        'trip_date' => $ticket->trip_date,
                        'destination' => $ticket->destination,
                        'status' => $ticket->status,
                        'submitted_at' => $ticket->submitted_at,
                        'has_insufficient_budget' => $ticket->has_insufficient_budget ?? false,
                        'budget_shortage' => $ticket->budget_shortage ?? 0,
                        'vehicle' => $ticket->vehicle ? [
                            'plate_number' => $ticket->vehicle->plate_number,
                        ] : null,
                        'department_name' => $ticket->department ? $ticket->department->department_name : null,
                        'return_reason' => $latestReturn ? $latestReturn->return_note : null,
                        'returned_at' => $latestReturn ? $latestReturn->actioned_at : null,
                        'requester' => $ticket->submittedBy ? [
                            'full_name' => $ticket->submittedBy->full_name,
                        ] : null,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $returnedTickets,
                'meta' => [
                    'returned_count' => $returnedTickets->count()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get returned tickets error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch returned tickets: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all trips (for GSO admin view)
     */
    public function getAllTrips(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isGsoOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $trips = TripTicket::with([
                'department',
                'driver.user',
                'vehicle',
                'gasSlip'
            ])
            ->orderBy('submitted_at', 'desc')
            ->get();

            return response()->json([
                'success' => true,
                'data' => $trips
            ]);

        } catch (\Exception $e) {
            Log::error('Get all trips error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch trips: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get single ticket details
     */
    public function show($id)
    {
        try {
            $ticket = TripTicket::with([
                'vehicle',
                'driver.user',
                'department',
                'submittedBy',
                'gasSlip',
                'gasSlip.fuelReceipt',
                'vehicleSnapshot',
            ])->find($id);

            if (!$ticket) {
                return response()->json([
                    'success' => false,
                    'message' => 'Ticket not found'
                ], 404);
            }

            $vehicleAvailability = null;
            if ($ticket->vehicle) {
                $vehicleAvailability = $ticket->vehicle->getAvailabilityStatus();
            }

            $response = [
                'trip_ticket_id' => $ticket->trip_ticket_id,
                'trip_ticket_number' => $ticket->trip_ticket_number,
                'trip_date' => $ticket->trip_date,
                'destination' => $ticket->destination,
                'purpose' => $ticket->purpose,
                'charge_to' => $ticket->charge_to,
                'passenger_name' => $ticket->passenger_name,
                'status' => $ticket->status,
                'submitted_at' => $ticket->submitted_at,
                'submitted_by_staff' => $ticket->submitted_by_staff ?? false,
                'estimated_distance_km' => $ticket->estimated_distance_km,
                'estimated_fuel_liters' => $ticket->estimated_fuel_liters,
                'actual_distance_km' => $ticket->actual_distance_km,
                'actual_fuel_used' => $ticket->actual_fuel_used,
                'trip_count' => $ticket->trip_count ?? 0,
                'is_mo_funded' => $ticket->created_by_mo_user_id !== null,
                'has_insufficient_budget' => $ticket->has_insufficient_budget ?? false,
                'budget_shortage' => $ticket->budget_shortage ?? 0,
                'driver' => $ticket->driver && $ticket->driver->user ? [
                    'driver_id' => $ticket->driver->driver_id,
                    'full_name' => $ticket->driver->user->full_name,
                    'user_id' => $ticket->driver->user->user_id,
                ] : null,
                'vehicle' => $ticket->vehicle ? [
                    'vehicle_id' => $ticket->vehicle->vehicle_id,
                    'plate_number' => $ticket->vehicle->plate_number,
                    'vehicle_model' => $ticket->vehicle->vehicle_model,
                    'fuel_type' => $ticket->vehicle->fuel_type,
                    'is_available' => $vehicleAvailability ? $vehicleAvailability['is_available'] : null,
                    'has_active_trip' => $vehicleAvailability ? $vehicleAvailability['has_active_trip'] : null,
                ] : null,
                'department' => $ticket->department ? [
                    'department_id' => $ticket->department->department_id,
                    'name' => $ticket->department->department_name,
                    'code' => $ticket->department->department_code,
                    'head_of_office' => $ticket->department->head_of_office ?? null,
                ] : null,
                'submitted_by' => $ticket->submittedBy ? [
                    'user_id' => $ticket->submittedBy->user_id,
                    'full_name' => $ticket->submittedBy->full_name,
                ] : null,
                'gas_slip' => $ticket->gasSlip ? [
                    'gas_slip_id' => $ticket->gasSlip->gas_slip_id,
                    'amount_released' => $ticket->gasSlip->amount_released,
                    'reconciliation_status' => $ticket->gasSlip->reconciliation_status,
                    'is_cross_department' => $ticket->gasSlip->is_cross_department ?? false,
                    'cross_department_reason' => $ticket->gasSlip->cross_department_reason ?? null,
                ] : null,
                'fuel_receipt' => $ticket->gasSlip && $ticket->gasSlip->fuelReceipt ? [
                    'fuel_receipt_id' => $ticket->gasSlip->fuelReceipt->fuel_receipt_id,
                    'invoice_number' => $ticket->gasSlip->fuelReceipt->invoice_number,
                    'liters_availed' => $ticket->gasSlip->fuelReceipt->liters_availed,
                    'amount_on_receipt' => $ticket->gasSlip->fuelReceipt->amount_on_receipt,
                    'unit_price' => $ticket->gasSlip->fuelReceipt->unit_price,
                    'receipt_photo_path' => $ticket->gasSlip->fuelReceipt->receipt_photo_path,
                    'gps_distance_km' => $ticket->gasSlip->fuelReceipt->gps_distance_km,
                ] : null,
                'vehicle_snapshot' => $ticket->vehicleSnapshot ? [
                    'vehicle_status' => $ticket->vehicleSnapshot->vehicle_status,
                    'fuel_type' => $ticket->vehicleSnapshot->fuel_type,
                    'snapshot_taken_at' => $ticket->vehicleSnapshot->snapshot_taken_at,
                ] : null,
            ];

            return response()->json([
                'success' => true,
                'data' => $response
            ]);

        } catch (\Exception $e) {
            Log::error('Show ticket error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch ticket: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get GSO reports
     */
    public function getReports(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isGsoOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $stats = [
                'total_trips' => TripTicket::count(),
                'total_funds_released' => GasSlip::sum('amount_released'),
                'total_allocated_budget' => DB::table('dept_budget_period')
                    ->where('status', 'active')
                    ->sum('allocated_amount'),
                'total_budget_used' => GasSlip::sum('amount_released'),
                'pending_mo' => TripTicket::where('status', TripTicket::STATUS_PENDING_MAYORS_OFFICE)->count(),
                'funds_issued' => TripTicket::where('status', TripTicket::STATUS_FUNDS_ISSUED)->count(),
                'in_transit' => TripTicket::where('status', TripTicket::STATUS_IN_TRANSIT)->count(),
                'closed' => TripTicket::where('status', TripTicket::STATUS_CLOSED)->count(),
                'rejected' => TripTicket::where('status', TripTicket::STATUS_REJECTED)->count(),
                'cancelled' => TripTicket::where('status', TripTicket::STATUS_CANCELLED)->count(),
                'this_month' => [
                    'trips' => TripTicket::whereMonth('submitted_at', now()->month)->count(),
                    'funds' => GasSlip::whereMonth('created_at', now()->month)->sum('amount_released'),
                ],
                'by_department' => DB::table('trip_ticket as tt')
                    ->join('departments as d', 'tt.department_id', '=', 'd.department_id')
                    ->select('d.department_name', DB::raw('COUNT(*) as count'))
                    ->groupBy('d.department_id', 'd.department_name')
                    ->get(),
                'vehicle_stats' => [
                    'total' => Vehicle::count(),
                    'available' => Vehicle::where('status', 'active')
                        ->where('maintenance_flag', false)
                        ->whereNotIn('vehicle_id', function($query) {
                            $query->select('vehicle_id')
                                ->from('trip_ticket')
                                ->whereIn('status', Vehicle::getActiveTripStatuses());
                        })
                        ->count(),
                    'in_use' => DB::table('trip_ticket')
                        ->whereIn('status', Vehicle::getActiveTripStatuses())
                        ->distinct('vehicle_id')
                        ->count('vehicle_id'),
                    'under_maintenance' => Vehicle::where('maintenance_flag', true)->count(),
                ],
            ];

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);
        } catch (\Exception $e) {
            Log::error('Get reports error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch reports: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get completed trips for GSO
     */
    public function getCompletedTrips(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user->isGsoOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $trips = TripTicket::with(['driver.user', 'department', 'gasSlip.fuelReceipt'])
                ->where('status', TripTicket::STATUS_CLOSED)
                ->orderBy('submitted_at', 'desc')
                ->get()
                ->map(function ($ticket) {
                    $fuelReceipt = $ticket->gasSlip ? $ticket->gasSlip->fuelReceipt : null;
                    return [
                        'id' => $ticket->trip_ticket_id,
                        'ticket_number' => $ticket->trip_ticket_number,
                        'trip_date' => $ticket->trip_date,
                        'destination' => $ticket->destination,
                        'purpose' => $ticket->purpose,
                        'driver_name' => $ticket->driver?->user?->full_name,
                        'department_name' => $ticket->department?->department_name,
                        'amount_released' => $ticket->gasSlip?->amount_released,
                        'liters_used' => $fuelReceipt?->liters_availed,
                        'distance_km' => $fuelReceipt?->gps_distance_km ?? 0,
                        'status' => $ticket->status,
                        'closed_at' => $ticket->updated_at,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $trips,
                'total' => $trips->count()
            ]);
        } catch (\Exception $e) {
            Log::error('Get completed trips error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch completed trips: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * ✅ Get a single fuel receipt with details (SINGLE VERSION — duplicate removed)
     */
    public function getFuelReceipt(Request $request, $id)
    {
        try {
            $user = $request->user();
            if (!$user->isGsoOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $receipt = DB::table('fuel_receipt as fr')
                ->join('gas_slip as gs', 'fr.gas_slip_id', '=', 'gs.gas_slip_id')
                ->join('trip_ticket as tt', 'gs.trip_ticket_id', '=', 'tt.trip_ticket_id')
                ->join('vehicles as v', 'tt.vehicle_id', '=', 'v.vehicle_id')
                ->join('drivers as d', 'tt.driver_id', '=', 'd.driver_id')
                ->join('users as u_driver', 'd.user_id', '=', 'u_driver.user_id')
                ->join('users as u_submitter', 'tt.submitted_by', '=', 'u_submitter.user_id')
                ->leftJoin('departments as dept', 'tt.department_id', '=', 'dept.department_id')
                ->select(
                    'fr.fuel_receipt_id as id',
                    'tt.trip_ticket_id',
                    'tt.trip_ticket_number as ticket_number',
                    'v.plate_number',
                    'v.vehicle_model',
                    'v.fuel_type',
                    'dept.department_name',
                    'fr.liters_availed as liters',
                    'fr.amount_on_receipt as amount',
                    'fr.receipt_photo_path as receipt_url',
                    'fr.receipt_uploaded_at as uploaded_at',
                    'fr.gps_distance_km',
                    'fr.invoice_number',
                    'fr.unit_price',
                    'fr.trip_started_at',
                    'fr.trip_ended_at',
                    'fr.trip_elapsed_minutes',
                    'gs.amount_released',
                    'gs.reconciliation_status as status',
                    'gs.reconciliation_note',
                    'tt.trip_date',
                    'tt.destination',
                    'tt.purpose',
                    'tt.estimated_distance_km',
                    'tt.actual_distance_km',
                    'tt.estimated_fuel_liters',
                    'tt.actual_fuel_used',
                    DB::raw("CONCAT(u_driver.first_name, ' ', u_driver.last_name) as driver_name"),
                    DB::raw("CONCAT(u_submitter.first_name, ' ', u_submitter.last_name) as submitted_by_name")
                )
                ->where('fr.fuel_receipt_id', $id)
                ->first();

            if (!$receipt) {
                return response()->json([
                    'success' => false,
                    'message' => 'Receipt not found'
                ], 404);
            }

            // ✅ Receipts live in public/receipts/ — use asset($path)
            if ($receipt->receipt_url && !str_starts_with($receipt->receipt_url, 'http')) {
                $receipt->receipt_url = asset($receipt->receipt_url);
            }

            return response()->json([
                'success' => true,
                'data' => $receipt
            ]);
        } catch (\Exception $e) {
            Log::error('Get fuel receipt error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch fuel receipt: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Record receipt (GSO manually records a receipt)
     */
    public function recordReceipt(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user->isGsoOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $validator = Validator::make($request->all(), [
                'trip_ticket_id' => 'required|exists:trip_ticket,trip_ticket_id',
                'liters_availed' => 'required|numeric|min:0.01',
                'amount_on_receipt' => 'required|numeric|min:0.01',
                'receipt_photo' => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
                'gps_distance_km' => 'nullable|numeric|min:0',
                'invoice_number' => 'nullable|string|max:50',
                'unit_price' => 'nullable|numeric|min:0.01',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $gasSlip = GasSlip::where('trip_ticket_id', $request->trip_ticket_id)->first();
            if (!$gasSlip) {
                return response()->json(['message' => 'Gas slip not found for this trip'], 404);
            }

            // ✅ Cap check: amount ≤ released
            if ($request->amount_on_receipt > $gasSlip->amount_released) {
                return response()->json([
                    'success' => false,
                    'message' => sprintf(
                        'Receipt amount ₱%s exceeds released amount ₱%s.',
                        number_format($request->amount_on_receipt, 2),
                        number_format($gasSlip->amount_released, 2)
                    ),
                ], 422);
            }

            DB::beginTransaction();

            $photoPath = null;
            if ($request->hasFile('receipt_photo')) {
                $file = $request->file('receipt_photo');
                $filename = 'receipt_' . time() . '_' . $request->trip_ticket_id . '.' . $file->getClientOriginalExtension();
                $file->move(public_path('receipts'), $filename);
                $photoPath = 'receipts/' . $filename;
            }

            $fuelReceipt = FuelReceipt::updateOrCreate(
                ['gas_slip_id' => $gasSlip->gas_slip_id],
                [
                    'liters_availed' => $request->liters_availed,
                    'amount_on_receipt' => $request->amount_on_receipt,
                    'receipt_photo_path' => $photoPath,
                    'gps_distance_km' => $request->gps_distance_km,
                    'invoice_number' => $request->invoice_number,
                    'unit_price' => $request->unit_price
                        ?: round($request->amount_on_receipt / max($request->liters_availed, 0.01), 2),
                    'receipt_uploaded_at' => now(),
                    'updated_at' => now(),
                ]
            );

            $gasSlip->reconciliation_status = 'pending';
            $gasSlip->save();

            if ($gasSlip->tripTicket) {
                $gasSlip->tripTicket->syncActuals()->save();
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Receipt recorded successfully',
                'data' => [
                    'fuel_receipt_id' => $fuelReceipt->fuel_receipt_id,
                    'gas_slip_id' => $gasSlip->gas_slip_id,
                    'liters_availed' => $fuelReceipt->liters_availed,
                    'amount_on_receipt' => $fuelReceipt->amount_on_receipt,
                    'invoice_number' => $fuelReceipt->invoice_number,
                    'unit_price' => $fuelReceipt->unit_price,
                    'receipt_photo_path' => $photoPath ? asset($photoPath) : null,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Record receipt error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to record receipt: ' . $e->getMessage()
            ], 500);
        }
    }

    // ============ PRIVATE METHODS ============

    private function sendMoNotification($tripTicket)
    {
        Log::info('🔔 sendMoNotification CALLED', [
            'ticket_id' => $tripTicket->trip_ticket_id,
            'ticket_number' => $tripTicket->trip_ticket_number
        ]);

        $moStaff = User::where('role', 'mayors_office')
            ->where('status', 'active')
            ->get();

        foreach ($moStaff as $staff) {
            NotificationHelper::send(
                $staff->user_id,
                'trip_created',
                'trip_ticket',
                $tripTicket->trip_ticket_id,
                "Trip ticket {$tripTicket->trip_ticket_number} is ready for fund release"
            );
        }
    }

    private function sendStaffNotification($tripTicket)
    {
        NotificationHelper::send(
            $tripTicket->submitted_by,
            'trip_submitted',
            'trip_ticket',
            $tripTicket->trip_ticket_id,
            "Trip ticket {$tripTicket->trip_ticket_number} has been created and sent to Mayor's Office"
        );
    }

    private function sendRejectionNotification($tripTicket, $reason)
    {
        $deptOffice = User::find($tripTicket->submitted_by);

        if ($deptOffice) {
            NotificationHelper::send(
                $deptOffice->user_id,
                'gso_rejected',
                'trip_ticket',
                $tripTicket->trip_ticket_id,
                "Trip ticket {$tripTicket->trip_ticket_number} was rejected: {$reason}"
            );
        }
    }

    /**
     * GSO validates and CLOSES the trip (final step)
     * ✅ Only Approve/Close - No Reject option
     */
    public function validateTrip(Request $request, $id)
    {
        try {
            $user = $request->user();

            if (!$user->isGsoOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $validator = Validator::make($request->all(), [
                'validation_note' => 'nullable|string|max:500',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->whereIn('status', ['completed', 'pending_gso_validation'])
                ->first();

            if (!$ticket) {
                return response()->json([
                    'message' => 'Trip not found or not ready for validation. Current status must be completed or pending_gso_validation.'
                ], 404);
            }

            DB::beginTransaction();

            $ticket->status = 'closed';
            $ticket->closed_by = $user->user_id;
            $ticket->closed_at = now();

            $gasSlip = GasSlip::where('trip_ticket_id', $id)->first();
            if ($gasSlip) {
                $gasSlip->reconciliation_status = 'verified';
                $gasSlip->reconciled_by = $user->user_id;
                $gasSlip->reconciled_at = now();
                $gasSlip->reconciliation_note = $request->validation_note ?? 'Validated and closed by GSO';
                $gasSlip->save();
            }

            $ticket->syncActuals();
            $ticket->save();

            DB::commit();

            $message = "Trip {$ticket->trip_ticket_number} has been validated and CLOSED by GSO";

            if ($ticket->driver_id) {
                $driver = Driver::find($ticket->driver_id);
                if ($driver && $driver->user_id) {
                    NotificationHelper::send(
                        $driver->user_id,
                        'trip_closed',
                        'trip_ticket',
                        $ticket->trip_ticket_id,
                        $message
                    );
                }
            }

            $moStaff = User::where('role', 'mayors_office')->where('status', 'active')->get();
            foreach ($moStaff as $mo) {
                NotificationHelper::send(
                    $mo->user_id,
                    'trip_closed',
                    'trip_ticket',
                    $ticket->trip_ticket_id,
                    $message
                );
            }

            $deptStaff = User::where('department_id', $ticket->department_id)
                ->where('status', 'active')
                ->where('role', '!=', 'driver')
                ->get();
            foreach ($deptStaff as $staff) {
                NotificationHelper::send(
                    $staff->user_id,
                    'trip_closed',
                    'trip_ticket',
                    $ticket->trip_ticket_id,
                    $message
                );
            }

            Log::info('Trip validated and closed by GSO', [
                'trip_id' => $ticket->trip_ticket_id,
                'ticket_number' => $ticket->trip_ticket_number,
                'closed_by' => $user->user_id,
                'trip_count' => $ticket->trip_count,
                'actual_distance_km' => $ticket->actual_distance_km,
                'actual_fuel_used' => $ticket->actual_fuel_used,
            ]);

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => [
                    'trip_ticket_id' => $ticket->trip_ticket_id,
                    'status' => $ticket->status,
                    'closed_at' => $ticket->closed_at,
                    'closed_by' => $ticket->closed_by,
                    'actual_distance_km' => $ticket->actual_distance_km,
                    'actual_fuel_used' => $ticket->actual_fuel_used,
                    'trip_count' => $ticket->trip_count,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Validate trip error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to validate trip: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get trips pending GSO validation
     * Includes both 'pending_gso_validation' AND 'completed' statuses
     */
    public function getPendingValidation(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isGsoOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $trips = TripTicket::with([
                'vehicle',
                'department',
                'driver.user',
                'gasSlip',
                'gasSlip.fuelReceipt'
            ])
            ->whereIn('status', ['pending_gso_validation', 'completed'])
            ->orderBy('submitted_at', 'desc')
            ->get()
            ->map(function ($ticket) {
                $fuelReceipt = $ticket->gasSlip?->fuelReceipt;
                $isOldCompleted = $ticket->status === 'completed' &&
                    $ticket->updated_at < now()->subHours(24);

                return [
                    'id' => $ticket->trip_ticket_id,
                    'ticket_number' => $ticket->trip_ticket_number,
                    'trip_date' => $ticket->trip_date,
                    'destination' => $ticket->destination,
                    'purpose' => $ticket->purpose,
                    'status' => $ticket->status,
                    'trip_count' => $ticket->trip_count ?? 0,
                    'submitted_at' => $ticket->submitted_at,
                    'updated_at' => $ticket->updated_at,
                    'is_old_completed' => $isOldCompleted,
                    'driver_name' => $ticket->driver?->user?->full_name,
                    'department_name' => $ticket->department?->department_name,
                    'amount_released' => $ticket->gasSlip?->amount_released,
                    'estimated_distance_km' => $ticket->estimated_distance_km,
                    'actual_distance_km' => $ticket->actual_distance_km,
                    'estimated_fuel_liters' => $ticket->estimated_fuel_liters,
                    'actual_fuel_used' => $ticket->actual_fuel_used,
                    'gps_distance_km' => $fuelReceipt?->gps_distance_km,
                    'trip_started_at' => $fuelReceipt?->trip_started_at,
                    'trip_ended_at' => $fuelReceipt?->trip_ended_at,
                    'start_lat' => $fuelReceipt?->trip_start_gps_lat,
                    'start_lng' => $fuelReceipt?->trip_start_gps_lng,
                    'end_lat' => $fuelReceipt?->trip_end_gps_lat,
                    'end_lng' => $fuelReceipt?->trip_end_gps_lng,
                    'has_receipt' => $fuelReceipt && $fuelReceipt->receipt_photo_path ? true : false,
                    'receipt_url' => $fuelReceipt && $fuelReceipt->receipt_photo_path ?
                        asset($fuelReceipt->receipt_photo_path) : null,
                    'receipt_uploaded_at' => $fuelReceipt?->receipt_uploaded_at,
                    'vehicle' => $ticket->vehicle ? [
                        'plate_number' => $ticket->vehicle->plate_number,
                        'vehicle_model' => $ticket->vehicle->vehicle_model,
                    ] : null,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $trips,
                'meta' => [
                    'pending_count' => $trips->count(),
                    'pending_validation_count' => $trips->filter(fn($t) => $t['status'] === 'pending_gso_validation')->count(),
                    'completed_old_count' => $trips->filter(fn($t) => $t['status'] === 'completed')->count(),
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Get pending validation error: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch pending validation: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get trip history for a specific ticket (GSO view)
     */
    public function getTripHistory(Request $request, $id)
    {
        try {
            $user = $request->user();

            if (!$user->isGsoOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $ticket = TripTicket::find($id);
            if (!$ticket) {
                return response()->json(['message' => 'Trip not found'], 404);
            }

            $history = TripHistory::where('trip_ticket_id', $id)
                ->orderBy('trip_number', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'trip_ticket_id' => $ticket->trip_ticket_id,
                    'trip_ticket_number' => $ticket->trip_ticket_number,
                    'total_trips' => $ticket->trip_count ?? 0,
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
                        ];
                    }),
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
     * ✅ Get cancelled trips for GSO
     */
    public function getCancelledTrips(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isGsoOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $trips = TripTicket::with(['vehicle', 'department', 'driver.user', 'gasSlip'])
                ->where('status', TripTicket::STATUS_CANCELLED)
                ->orderBy('updated_at', 'desc')
                ->get()
                ->map(function ($ticket) {
                    return [
                        'id' => $ticket->trip_ticket_id,
                        'ticket_number' => $ticket->trip_ticket_number,
                        'trip_date' => $ticket->trip_date,
                        'destination' => $ticket->destination,
                        'purpose' => $ticket->purpose,
                        'status' => $ticket->status,
                        'submitted_at' => $ticket->submitted_at,
                        'updated_at' => $ticket->updated_at,
                        'cancelled_at' => $ticket->cancelled_at,
                        'cancellation_reason' => $ticket->cancellation_reason,
                        'vehicle' => $ticket->vehicle ? [
                            'plate_number' => $ticket->vehicle->plate_number,
                            'vehicle_model' => $ticket->vehicle->vehicle_model,
                        ] : null,
                        'driver' => $ticket->driver && $ticket->driver->user ? [
                            'full_name' => $ticket->driver->user->full_name,
                        ] : null,
                        'department_name' => $ticket->department?->department_name,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $trips,
                'meta' => [
                    'total' => $trips->count(),
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get cancelled trips error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch cancelled trips: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * ✅ Cancel a trip ticket (only before funds released)
     */
    public function cancelTrip(Request $request, $id)
    {
        try {
            $user = $request->user();

            if (!$user->isGsoOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $validator = Validator::make($request->all(), [
                'reason' => 'required|string|min:5|max:500',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $cancellableStatuses = [
                TripTicket::STATUS_PENDING_MAYORS_OFFICE,
                TripTicket::STATUS_RETURNED_FOR_REVISION,
            ];

            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->whereIn('status', $cancellableStatuses)
                ->first();

            if (!$ticket) {
                return response()->json([
                    'success' => false,
                    'message' => 'Ticket cannot be cancelled. Only tickets pending approval or returned for revision can be cancelled.'
                ], 422);
            }

            $existingGasSlip = GasSlip::where('trip_ticket_id', $id)->first();
            if ($existingGasSlip) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot cancel ticket. Funds have already been released for this trip.'
                ], 422);
            }

            DB::beginTransaction();

            $ticket->status = TripTicket::STATUS_CANCELLED;
            $ticket->cancellation_reason = $request->reason;
            $ticket->cancelled_at = now();
            $ticket->cancelled_by = $user->user_id;
            $ticket->save();

            DB::commit();

            try {
                broadcast(new \App\Events\TripTicketCancelled($ticket, $request->reason, $user));
                Log::info('📡 Broadcasted TripTicketCancelled for trip: ' . $ticket->trip_ticket_number);
            } catch (\Exception $e) {
                Log::error('Failed to broadcast cancellation: ' . $e->getMessage());
            }

            if ($ticket->submitted_by) {
                NotificationHelper::send(
                    $ticket->submitted_by,
                    'trip_cancelled',
                    'trip_ticket',
                    $ticket->trip_ticket_id,
                    "Trip {$ticket->trip_ticket_number} has been cancelled: {$request->reason}"
                );
            }

            $moStaff = User::where('role', 'mayors_office')->where('status', 'active')->get();
            foreach ($moStaff as $mo) {
                NotificationHelper::send(
                    $mo->user_id,
                    'trip_cancelled',
                    'trip_ticket',
                    $ticket->trip_ticket_id,
                    "Trip {$ticket->trip_ticket_number} has been cancelled by GSO"
                );
            }

            return response()->json([
                'success' => true,
                'message' => 'Trip ticket cancelled successfully. You can now create a new ticket.',
                'data' => [
                    'trip_ticket_id' => $ticket->trip_ticket_id,
                    'trip_ticket_number' => $ticket->trip_ticket_number,
                    'status' => $ticket->status,
                    'cancelled_at' => $ticket->cancelled_at,
                    'cancellation_reason' => $ticket->cancellation_reason,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Cancel trip error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to cancel trip: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
 * ✅ Get all fuel receipts (list for GSO admin view)
 * GET /api/admin/fuel-receipts
 */
public function getFuelReceipts(Request $request)
{
    try {
        $user = $request->user();
        if (!$user->isGsoOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Optional filters
        $status       = $request->get('status');        // pending | verified | discrepancy
        $departmentId = $request->get('department_id');
        $search       = $request->get('search');

        $query = DB::table('fuel_receipt as fr')
            ->join('gas_slip as gs', 'fr.gas_slip_id', '=', 'gs.gas_slip_id')
            ->join('trip_ticket as tt', 'gs.trip_ticket_id', '=', 'tt.trip_ticket_id')
            ->join('vehicles as v', 'tt.vehicle_id', '=', 'v.vehicle_id')
            ->leftJoin('drivers as d', 'tt.driver_id', '=', 'd.driver_id')
            ->leftJoin('users as u_driver', 'd.user_id', '=', 'u_driver.user_id')
            ->leftJoin('departments as dept', 'tt.department_id', '=', 'dept.department_id')
            ->select(
                'fr.fuel_receipt_id as id',
                'fr.fuel_receipt_id',
                'tt.trip_ticket_id',
                'tt.trip_ticket_number as ticket_number',
                'tt.trip_date',
                'tt.destination',
                'tt.purpose',
                'tt.estimated_distance_km',
                'tt.actual_distance_km',
                'tt.estimated_fuel_liters',
                'tt.actual_fuel_used',
                'v.plate_number',
                'v.vehicle_model',
                'v.fuel_type',
                'dept.department_name',
                'fr.liters_availed as liters',
                'fr.amount_on_receipt as amount',
                'fr.receipt_photo_path as receipt_url',
                'fr.receipt_uploaded_at as uploaded_at',
                'fr.gps_distance_km',
                'fr.invoice_number',
                'fr.unit_price',
                'gs.amount_released',
                'gs.reconciliation_status as status',
                'gs.reconciliation_note',
                DB::raw("CONCAT(u_driver.first_name, ' ', u_driver.last_name) as driver_name")
            );

        // Filters
        if ($status) {
            $query->where('gs.reconciliation_status', $status);
        }
        if ($departmentId) {
            $query->where('tt.department_id', $departmentId);
        }
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('tt.trip_ticket_number', 'like', "%{$search}%")
                  ->orWhere('v.plate_number', 'like', "%{$search}%")
                  ->orWhere('v.vehicle_model', 'like', "%{$search}%")
                  ->orWhere(DB::raw("CONCAT(u_driver.first_name, ' ', u_driver.last_name)"), 'like', "%{$search}%");
            });
        }

        $receipts = $query->orderBy('fr.receipt_uploaded_at', 'desc')->get();

        // ✅ Fix receipt URL path (public/receipts/, not storage/)
        $receipts = $receipts->map(function ($r) {
            if ($r->receipt_url && !str_starts_with($r->receipt_url, 'http')) {
                $r->receipt_url = asset($r->receipt_url);
            }
            return $r;
        });

        return response()->json([
            'success' => true,
            'data'    => $receipts,
            'meta'    => [
                'total' => $receipts->count(),
            ],
        ]);
    } catch (\Exception $e) {
        Log::error('Get fuel receipts error: ' . $e->getMessage());
        Log::error('Stack trace: ' . $e->getTraceAsString());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch fuel receipts: ' . $e->getMessage(),
        ], 500);
    }
}

/**
 * ✅ GSO edits liters on an existing fuel receipt
 * PUT /api/admin/fuel-receipts/{id}/liters
 */
public function updateFuelReceiptLiters(Request $request, $id)
{
    try {
        $user = $request->user();
        if (!$user->isGsoOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'liters_availed' => 'required|numeric|min:0.01|max:9999.99',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $receipt = FuelReceipt::findOrFail($id);

        // ✅ Cap check: cannot exceed gas_slip.amount_released? (optional)
        // Not capping on liters — GSO can enter actual pump reading.

        DB::beginTransaction();

        $oldLiters = (float) $receipt->liters_availed;
        $receipt->liters_availed = $request->liters_availed;

        // ✅ Recompute unit_price if amount is present
        if ($receipt->amount_on_receipt && $request->liters_availed > 0) {
            $receipt->unit_price = round(
                $receipt->amount_on_receipt / $request->liters_availed,
                2
            );
        }

        $receipt->updated_at = now();
        $receipt->save();

        // ✅ Sync trip actuals (this recalculates actual_fuel_used on the parent trip)
        $trip = $receipt->gasSlip?->tripTicket;
        if ($trip) {
            $trip->syncActuals()->save();
        }

        DB::commit();

        Log::info('GSO updated fuel receipt liters', [
            'fuel_receipt_id' => $id,
            'old_liters'      => $oldLiters,
            'new_liters'      => $request->liters_availed,
            'updated_by'      => $user->user_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Liters updated successfully',
            'data'    => [
                'fuel_receipt_id' => $receipt->fuel_receipt_id,
                'liters_availed'  => (float) $receipt->liters_availed,
                'unit_price'      => (float) $receipt->unit_price,
                'updated_at'      => $receipt->updated_at,
            ],
        ]);

    } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
        return response()->json([
            'success' => false,
            'message' => 'Fuel receipt not found',
        ], 404);
    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('Update fuel receipt liters error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to update liters: ' . $e->getMessage(),
        ], 500);
    }
}

        /**
     * Get MO-created Gas Slip tickets (any status except closed/cancelled/rejected).
     * GSO sees these until the trip is closed.
     * GET /gso/pending-gas-slips
     */
    public function getMoCreatedGasSlips(Request $request)
    {
        $user = $request->user();
        if (!$user->isGsoOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $tickets = TripTicket::with([
            'driver.user',
            'vehicle',
            'department',
            'gasSlip',
            'createdByMO',
        ])
        ->where('source', 'mo_gas_slip')
        ->whereNotIn('status', ['closed', 'cancelled', 'rejected'])
        ->orderBy('submitted_at', 'desc')
        ->get()
        ->map(function ($tt) {
            return [
                'trip_ticket_id'     => $tt->trip_ticket_id,
                'trip_ticket_number' => $tt->trip_ticket_number,
                'control_number'     => $tt->gasSlip?->control_number,
                'gas_slip_id'        => $tt->gasSlip?->gas_slip_id,
                'amount_released'    => (float) ($tt->gasSlip?->amount_released ?? 0),
                'trip_date'          => $tt->trip_date,
                'destination'        => $tt->destination,
                'purpose'            => $tt->purpose,
                'charge_to'          => $tt->charge_to,
                'passenger_name'     => $tt->passenger_name,
                'status'             => $tt->status,
                'driver'             => $tt->driver && $tt->driver->user ? [
                    'driver_id' => $tt->driver->driver_id,
                    'full_name' => $tt->driver->user->full_name,
                ] : null,
                'vehicle'            => $tt->vehicle ? [
                    'vehicle_id'    => $tt->vehicle->vehicle_id,
                    'plate_number'  => $tt->vehicle->plate_number,
                    'vehicle_model' => $tt->vehicle->vehicle_model,
                    'fuel_type'     => $tt->vehicle->fuel_type,
                ] : null,
                'department_name'    => $tt->department?->department_name,
                'department_code'    => $tt->department?->department_code,
                'created_by_mo'      => $tt->createdByMO?->full_name,
                'created_at'         => $tt->submitted_at,
                'is_pending_gso_ticket' => $tt->status === TripTicket::STATUS_PENDING_GSO_TICKET,
            ];
        });

        return response()->json([
            'success' => true,
            'data'    => $tickets,
            'meta'    => ['total' => $tickets->count()],
        ]);
    }

      /**
     * GSO completes a Gas Slip ticket.
     * Idempotent — works whether the driver has acted or not.
     * Only promotes status if still in pending_gso_ticket.
     *
     * POST /gso/pending-gas-slips/{tripTicketId}/complete
     */
    public function completeGasSlipTicket(Request $request, $tripTicketId)
    {
        $user = $request->user();
        if (!$user->isGsoOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'estimated_distance_km'  => 'nullable|numeric|min:0',
            'estimated_fuel_liters'  => 'nullable|numeric|min:0',
            'passenger_name'         => 'nullable|string|max:120',
            'validation_note'        => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $ticket = TripTicket::with(['gasSlip', 'vehicle', 'driver.user'])
            ->where('trip_ticket_id', $tripTicketId)
            ->where('source', 'mo_gas_slip')
            ->whereNotIn('status', ['closed', 'cancelled', 'rejected'])
            ->first();

        if (!$ticket) {
            return response()->json([
                'success' => false,
                'message' => 'Gas Slip ticket not found or already closed',
            ], 404);
        }

        DB::beginTransaction();

        try {
            if ($request->filled('estimated_distance_km')) {
                $ticket->estimated_distance_km = $request->estimated_distance_km;
            }
            if ($request->filled('estimated_fuel_liters')) {
                $ticket->estimated_fuel_liters = $request->estimated_fuel_liters;
            }
            if ($request->filled('passenger_name')) {
                $ticket->passenger_name = $request->passenger_name;
            }

            // Only promote if still in placeholder state.
            // Never clobber an advanced status (acknowledged / in_transit / completed).
            $wasPlaceholder = $ticket->status === TripTicket::STATUS_PENDING_GSO_TICKET;
            if ($wasPlaceholder) {
                $ticket->status = TripTicket::STATUS_FUNDS_ISSUED;
            }

            $ticket->updated_at = now();
            $ticket->save();

            DB::table('audit_log')->insert([
                'user_id'    => $user->user_id,
                'action'     => 'gso_completed_gas_slip_ticket',
                'table_name' => 'trip_ticket',
                'record_id'  => $ticket->trip_ticket_id,
                'old_values' => json_encode([
                    'status' => $wasPlaceholder
                        ? TripTicket::STATUS_PENDING_GSO_TICKET
                        : $ticket->status,
                ]),
                'new_values' => json_encode([
                    'status'          => $ticket->status,
                    'validation_note' => $request->validation_note,
                ]),
                'ip_address' => $request->ip(),
                'created_at' => now(),
            ]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Complete Gas Slip ticket error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to complete Gas Slip ticket: ' . $e->getMessage(),
            ], 500);
        }

        // Only notify driver if we actually promoted from placeholder
        if ($wasPlaceholder) {
            try {
                $driver = $ticket->driver;
                if ($driver && $driver->user_id) {
                    NotificationHelper::send(
                        $driver->user_id,
                        'fund_issued',
                        'trip_ticket',
                        $ticket->trip_ticket_id,
                        "Gas Slip {$ticket->gasSlip?->control_number} is ready — Trip Ticket {$ticket->trip_ticket_number} approved by GSO"
                    );
                }
            } catch (\Exception $e) {
                Log::error('GSO completion notification failed: ' . $e->getMessage());
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Gas Slip ticket completed successfully',
            'data' => [
                'trip_ticket_id'     => $ticket->trip_ticket_id,
                'trip_ticket_number' => $ticket->trip_ticket_number,
                'control_number'     => $ticket->gasSlip?->control_number,
                'status'             => $ticket->status,
            ],
        ]);
    }


}
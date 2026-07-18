<?php

namespace App\Http\Controllers\API;

use Illuminate\Support\Facades\Cache;
use App\Http\Controllers\Controller;
use App\Models\TripTicket;
use App\Models\GasSlip;
use App\Models\FuelReceipt;
use App\Models\DeptBudgetPeriod;
use App\Models\Notification;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Driver;
use App\Models\Department;
use App\Models\TripTicketVehicleSnapshot;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class MayorsOfficeController extends Controller
{
    /**
     * Get Mayor's Office dashboard statistics
     */
    public function getDashboard(Request $request)
    {
        $user = $request->user();

        if (!$user->isMayorsOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $stats = [
            'pending_fund_release' => TripTicket::where('status', 'pending_mayors_office')->count(),
            'funds_issued' => TripTicket::where('status', TripTicket::STATUS_FUNDS_ISSUED)->count(),
            'total_amount_released' => GasSlip::sum('amount_released'),
            'pending_reconciliation' => TripTicket::where('status', TripTicket::STATUS_PENDING_RECONCILIATION)->count(),
            'pending_budget_assistance' => $this->getPendingBudgetAssistanceCount(),
            'total_budget_allocated' => DeptBudgetPeriod::where('status', 'active')->sum('allocated_amount'),
            'total_budget_remaining' => $this->getTotalRemainingBudget(),
            'pending_receipts' => FuelReceipt::whereHas('gasSlip', function($q) {
                $q->where('reconciliation_status', 'pending');
            })->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }

    /**
     * Get total remaining budget across all active periods
     */
    private function getTotalRemainingBudget()
    {
        $periods = DeptBudgetPeriod::where('status', 'active')->get();
        $total = 0;
        foreach ($periods as $period) {
            $spent = GasSlip::where('period_id', $period->period_id)
                ->whereNotNull('acknowledged_at')
                ->sum('amount_released');
            $total += ($period->allocated_amount - $spent);
        }
        return $total;
    }

    /**
     * Get pending budget assistance requests count
     */
    private function getPendingBudgetAssistanceCount()
    {
        $requestIds = Cache::get('mo_requests_list', []);
        return count($requestIds);
    }

    /**
     * Get pending tickets for fund release (pending_mayors_office status)
     */
    public function getPendingTickets(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isMayorsOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $tickets = TripTicket::with(['vehicle', 'department', 'driver.user', 'gasSlip.fuelReceipt'])
                ->where('status', 'pending_mayors_office')
                ->orderBy('submitted_at', 'asc')
                ->get()
                ->map(function ($ticket) {
                    $fuelReceipt = $ticket->gasSlip?->fuelReceipt;
                    return [
                        'id' => $ticket->trip_ticket_id,
                        'ticket_number' => $ticket->trip_ticket_number,
                        'trip_date' => $ticket->trip_date,
                        'destination' => $ticket->destination,
                        'purpose' => $ticket->purpose,
                        'charge_to' => $ticket->charge_to,
                        'passenger_name' => $ticket->passenger_name,
                        'status' => $ticket->status,
                        'submitted_at' => $ticket->submitted_at,
                        'has_insufficient_budget' => $ticket->has_insufficient_budget ?? false,
                        'budget_shortage' => $ticket->budget_shortage ?? 0,
                        'estimated_cost' => $ticket->estimated_fuel_liters ? 
                            ($ticket->estimated_fuel_liters * 88) : null,
                        'department_id' => $ticket->department_id,
                        'has_receipt' => $fuelReceipt && ($fuelReceipt->liters_availed > 0 || $fuelReceipt->amount_on_receipt > 0),
                        'receipt_status' => $ticket->gasSlip?->reconciliation_status ?? 'none',
                        'vehicle' => $ticket->vehicle ? [
                            'plate_number' => $ticket->vehicle->plate_number,
                            'vehicle_model' => $ticket->vehicle->vehicle_model,
                            'fuel_type' => $ticket->vehicle->fuel_type,
                        ] : null,
                        'driver' => $ticket->driver && $ticket->driver->user ? [
                            'full_name' => $ticket->driver->user->full_name,
                        ] : null,
                        'department_name' => $ticket->department ? $ticket->department->department_name : null,
                        'department_code' => $ticket->department ? $ticket->department->department_code : null,
                        'is_mo_funded' => $ticket->created_by_mo_user_id !== null,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $tickets
            ]);
        } catch (\Exception $e) {
            Log::error('Get pending tickets error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch tickets: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get approved/funds issued tickets
     */
    public function getApprovedTickets(Request $request)
{
    try {
        $user = $request->user();

        if (!$user->isMayorsOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $tickets = TripTicket::with(['vehicle', 'department', 'gasSlip', 'driver', 'driver.user'])
            ->whereIn('status', ['funds_issued', 'acknowledged', 'pending_reconciliation', 'in_transit', 'closed'])
            ->orderBy('submitted_at', 'desc')
            ->get()
            ->map(function ($ticket) {
                // ✅ Get driver name from the loaded relationship
                $driverName = null;
                if ($ticket->driver && $ticket->driver->user) {
                    $driverName = $ticket->driver->user->full_name;
                } elseif ($ticket->driver) {
                    $driverName = $ticket->driver->name ?? null;
                }

                return [
                    'id' => $ticket->trip_ticket_id,
                    'ticket_number' => $ticket->trip_ticket_number,
                    'trip_date' => $ticket->trip_date,
                    'destination' => $ticket->destination,
                    'status' => $ticket->status,
                    'vehicle' => $ticket->vehicle ? [
                        'plate_number' => $ticket->vehicle->plate_number,
                        'vehicle_model' => $ticket->vehicle->vehicle_model,
                        'fuel_type' => $ticket->vehicle->fuel_type,
                    ] : null,
                    'department_name' => $ticket->department ? $ticket->department->department_name : null,
                    'amount_released' => $ticket->gasSlip ? $ticket->gasSlip->amount_released : 0,
                    'is_mo_funded' => $ticket->created_by_mo_user_id !== null,
                    'charged_to_department' => $ticket->charge_to_department_id ?
                        Department::find($ticket->charge_to_department_id)?->department_name : null,
                    // ✅ ADD DRIVER DATA HERE
                    'driver_name' => $driverName,
                    'driver' => $ticket->driver ? [
                        'driver_id' => $ticket->driver->driver_id,
                        'name' => $driverName,
                        'user' => $ticket->driver->user ? [
                            'full_name' => $ticket->driver->user->full_name,
                        ] : null,
                    ] : null,
                    // ✅ ADD PURPOSE
                    'purpose' => $ticket->purpose,
                    // ✅ ADD CREATED_AT
                    'created_at' => $ticket->created_at,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $tickets
        ]);
    } catch (\Exception $e) {
        Log::error('Get approved tickets error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch approved tickets: ' . $e->getMessage()
        ], 500);
    }
}

    /**
     * Approve ticket and release funds
     */
    public function approveTicket(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'amount_released' => 'required|numeric|min:0.01',
                'charge_to_department_id' => 'nullable|exists:departments,department_id',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $user = $request->user();

            if (!$user->isMayorsOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('status', 'pending_mayors_office')
                ->first();

            if (!$ticket) {
                return response()->json(['message' => 'Ticket not found or not eligible for fund release'], 404);
            }

            $amountToRelease = $request->amount_released;
            $chargeDepartmentId = $request->charge_to_department_id ?? $ticket->department_id;
            $chargeDepartment = Department::find($chargeDepartmentId);

            $hasInsufficientBudget = $ticket->has_insufficient_budget ?? false;
            $budgetShortage = $ticket->budget_shortage ?? 0;
            $isMoFundedTicket = $ticket->created_by_mo_user_id !== null;

            $budgetBefore = 0;
            $budgetAfter = 0;
            $periodId = null;

            // Check budget if NOT MO-funded
            if (!$isMoFundedTicket) {
                $currentPeriod = DeptBudgetPeriod::where('department_id', $chargeDepartmentId)
                    ->where('status', 'active')
                    ->first();

                if (!$currentPeriod) {
                    return response()->json([
                        'success' => false,
                        'message' => "No active budget period found for {$chargeDepartment->department_name}",
                        'budget_info' => [
                            'has_period' => false,
                            'department_id' => $chargeDepartmentId,
                            'department_name' => $chargeDepartment->department_name,
                        ],
                        'available_departments' => Department::all(),
                        'has_insufficient_budget' => $hasInsufficientBudget,
                        'budget_shortage' => $budgetShortage,
                    ], 422);
                }

                $totalSpent = GasSlip::where('period_id', $currentPeriod->period_id)
                    ->whereNotNull('acknowledged_at')
                    ->sum('amount_released');

                $budgetBefore = $currentPeriod->allocated_amount - $totalSpent;
                $budgetAfter = $budgetBefore - $amountToRelease;
                $periodId = $currentPeriod->period_id;

                if ($budgetBefore < $amountToRelease) {
                    $shortage = $amountToRelease - $budgetBefore;

                    return response()->json([
                        'success' => false,
                        'message' => "Insufficient budget in {$chargeDepartment->department_name}",
                        'budget_info' => [
                            'allocated' => $currentPeriod->allocated_amount,
                            'spent' => $totalSpent,
                            'remaining' => $budgetBefore,
                            'requested' => $amountToRelease,
                            'shortage' => $shortage,
                            'department_id' => $chargeDepartmentId,
                            'department_name' => $chargeDepartment->department_name,
                            'is_negative' => $budgetBefore < 0,
                        ],
                        'available_departments' => Department::all(),
                        'has_insufficient_budget' => $hasInsufficientBudget,
                        'budget_shortage' => $budgetShortage,
                        'suggestions' => [
                            'select_other_department' => 'Select a different department to charge',
                            'reduce_amount' => "Reduce the amount to ₱" . number_format($budgetBefore, 2),
                            'use_mo_funded' => 'Or mark as MO-funded trip',
                        ]
                    ], 422);
                }
            }

            DB::beginTransaction();

            // Create gas slip
            $gasSlipData = [
                'trip_ticket_id' => $id,
                'created_by' => $user->user_id,
                'amount_released' => $amountToRelease,
                'reconciliation_status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (!$isMoFundedTicket && $periodId) {
                $gasSlipData['budget_before'] = $budgetBefore;
                $gasSlipData['budget_after'] = $budgetAfter;
                $gasSlipData['period_id'] = $periodId;
            } else {
                $gasSlipData['budget_before'] = 0;
                $gasSlipData['budget_after'] = 0;
                $gasSlipData['period_id'] = $this->getDefaultPeriodId($ticket->department_id);
            }

            $gasSlip = GasSlip::create($gasSlipData);

            // Update ticket
            $ticket->has_insufficient_budget = false;
            $ticket->status = TripTicket::STATUS_FUNDS_ISSUED;
            if (!$isMoFundedTicket && $chargeDepartmentId != $ticket->department_id) {
                $ticket->charge_to_department_id = $chargeDepartmentId;
            }
            $ticket->save();

            DB::commit();

            $fundingSource = $isMoFundedTicket ? 'MO Funded' : "Charged to: {$chargeDepartment->department_name}";
            $this->sendFundIssuedNotification($ticket, $amountToRelease, $fundingSource);

            return response()->json([
                'success' => true,
                'message' => $isMoFundedTicket 
                    ? "Funds released successfully (MO Funded - No department budget deduction)"
                    : "Funds released successfully from {$chargeDepartment->department_name} budget",
                'data' => [
                    'ticket_id' => $ticket->trip_ticket_id,
                    'ticket_number' => $ticket->trip_ticket_number,
                    'amount_released' => $amountToRelease,
                    'gas_slip_id' => $gasSlip->gas_slip_id,
                    'status' => $ticket->status,
                    'funding_source' => $fundingSource,
                    'charged_to_department' => $chargeDepartment->department_name,
                    'is_mo_funded' => $isMoFundedTicket,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Approve ticket error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to release funds: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get default period ID for a department
     */
    private function getDefaultPeriodId($departmentId)
    {
        $period = DeptBudgetPeriod::where('department_id', $departmentId)
            ->where('status', 'active')
            ->first();
        return $period ? $period->period_id : 1;
    }

    /**
     * Reject ticket
     */
    public function rejectTicket(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'review_note' => 'required|string|min:5'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $user = $request->user();

            if (!$user->isMayorsOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $ticket = TripTicket::where('trip_ticket_id', $id)
                ->where('status', 'pending_mayors_office')
                ->first();

            if (!$ticket) {
                return response()->json(['message' => 'Ticket not found'], 404);
            }

            DB::beginTransaction();

            $ticket->status = TripTicket::STATUS_RETURNED_FOR_REVISION;
            $ticket->save();

            DB::table('trip_ticket_return')->insert([
                'trip_ticket_id' => $id,
                'return_type' => 'rejected_by_mo',
                'return_note' => $request->review_note,
                'actioned_by' => $user->user_id,
                'actioned_at' => now(),
            ]);

            DB::commit();

            $this->sendRejectionNotification($ticket, $request->review_note);

            return response()->json([
                'success' => true,
                'message' => 'Ticket rejected and returned to department',
                'data' => [
                    'id' => $ticket->trip_ticket_id,
                    'number' => $ticket->trip_ticket_number,
                    'status' => $ticket->status,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Reject ticket error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to reject ticket: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get single ticket details
     */
    public function show(Request $request, $id)
    {
        try {
            $user = $request->user();

            if (!$user->isMayorsOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $ticket = TripTicket::with([
                'vehicle',
                'driver.user',
                'department',
                'submittedBy',
                'gasSlip',
                'gasSlip.fuelReceipt',
                'vehicleSnapshot'
            ])->findOrFail($id);

            $budgetInfo = $this->getDepartmentBudgetInfo($ticket->department_id);
            $fuelReceipt = $ticket->gasSlip?->fuelReceipt;

            return response()->json([
                'success' => true,
                'data' => [
                    'trip_ticket_id' => $ticket->trip_ticket_id,
                    'ticket_number' => $ticket->trip_ticket_number,
                    'trip_date' => $ticket->trip_date,
                    'destination' => $ticket->destination,
                    'purpose' => $ticket->purpose,
                    'charge_to' => $ticket->charge_to,
                    'passenger_name' => $ticket->passenger_name,
                    'status' => $ticket->status,
                    'submitted_at' => $ticket->submitted_at,
                    'submitted_by_staff' => $ticket->submitted_by_staff ?? false,
                    'is_mo_funded' => $ticket->created_by_mo_user_id !== null,
                    'has_insufficient_budget' => $ticket->has_insufficient_budget ?? false,
                    'budget_shortage' => $ticket->budget_shortage ?? 0,
                    'estimated_distance_km' => $ticket->estimated_distance_km,
                    'estimated_fuel_liters' => $ticket->estimated_fuel_liters,
                    'budget_info' => $budgetInfo,
                    'has_receipt' => $fuelReceipt && ($fuelReceipt->liters_availed > 0 || $fuelReceipt->amount_on_receipt > 0),
                    'receipt' => $fuelReceipt ? [
                        'fuel_receipt_id' => $fuelReceipt->fuel_receipt_id,
                        'invoice_number' => $fuelReceipt->invoice_number ?? null,
                        'liters_availed' => $fuelReceipt->liters_availed,
                        'amount_on_receipt' => $fuelReceipt->amount_on_receipt,
                        'receipt_photo_path' => $fuelReceipt->receipt_photo_path,
                        'receipt_url' => $fuelReceipt->receipt_photo_path ? asset('storage/' . $fuelReceipt->receipt_photo_path) : null,
                        'gps_distance_km' => $fuelReceipt->gps_distance_km,
                        'reconciliation_status' => $ticket->gasSlip?->reconciliation_status,
                    ] : null,
                    'vehicle' => $ticket->vehicle ? [
                        'plate_number' => $ticket->vehicle->plate_number,
                        'vehicle_model' => $ticket->vehicle->vehicle_model,
                        'fuel_type' => $ticket->vehicle->fuel_type,
                    ] : null,
                    'driver' => $ticket->driver && $ticket->driver->user ? [
                        'full_name' => $ticket->driver->user->full_name,
                    ] : null,
                    'department' => $ticket->department ? [
                        'name' => $ticket->department->department_name,
                        'code' => $ticket->department->department_code,
                    ] : null,
                    'gas_slip' => $ticket->gasSlip ? [
                        'gas_slip_id' => $ticket->gasSlip->gas_slip_id,
                        'amount_released' => $ticket->gasSlip->amount_released,
                        'reconciliation_status' => $ticket->gasSlip->reconciliation_status,
                        'budget_before' => $ticket->gasSlip->budget_before,
                        'budget_after' => $ticket->gasSlip->budget_after,
                    ] : null,
                    'all_departments' => Department::select('department_id', 'department_name', 'department_code')->get(),
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Show ticket error: ' . $e->getMessage());
            return response()->json(['message' => 'Ticket not found'], 404);
        }
    }

    /**
     * Get budget overview
     */
    public function getBudgetOverview(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isMayorsOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $budgetData = DeptBudgetPeriod::with('department')
                ->where('status', 'active')
                ->get()
                ->map(function ($period) {
                    $spent = GasSlip::where('period_id', $period->period_id)
                        ->whereNotNull('acknowledged_at')
                        ->sum('amount_released');
                    $remaining = $period->allocated_amount - $spent;
                    return [
                        'department_id' => $period->department_id,
                        'department_name' => $period->department->department_name,
                        'allocated_amount' => $period->allocated_amount,
                        'spent_amount' => $spent,
                        'remaining_amount' => $remaining,
                        'is_negative' => $remaining < 0,
                        'week_start' => $period->week_start,
                        'week_end' => $period->week_end,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $budgetData
            ]);
        } catch (\Exception $e) {
            Log::error('Get budget overview error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch budget overview'
            ], 500);
        }
    }

    // ============ BUDGET ASSISTANCE METHODS ============

    /**
     * Get all pending budget assistance requests
     */
    public function getBudgetAssistanceRequests(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isMayorsOffice()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. Only Mayor\'s Office can access this.'
                ], 403);
            }

            $requestIds = Cache::get('mo_requests_list', []);
            $requests = [];

            foreach ($requestIds as $requestId) {
                $requestData = Cache::get($requestId);
                if ($requestData) {
                    $department = Department::find($requestData['department_id']);
                    $requester = User::find($requestData['requested_by']);

                    $requests[] = [
                        'request_id' => $requestId,
                        'department_id' => $requestData['department_id'],
                        'department_name' => $department ? $department->department_name : 'Unknown',
                        'department_code' => $department ? $department->department_code : 'N/A',
                        'requester_name' => $requester ? $requester->full_name : 'Unknown',
                        'ticket_data' => $requestData['ticket_data'],
                        'budget_info' => $requestData['budget_info'],
                        'estimated_cost' => $requestData['estimated_cost'],
                        'shortage' => round($requestData['estimated_cost'] - $requestData['budget_info']['remaining'], 2),
                        'created_at' => $requestData['created_at'],
                    ];
                }
            }

            usort($requests, function ($a, $b) {
                return strtotime($b['created_at']) - strtotime($a['created_at']);
            });

            return response()->json([
                'success' => true,
                'data' => $requests,
                'total' => count($requests)
            ]);
        } catch (\Exception $e) {
            Log::error('Get budget assistance requests error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch requests: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get single budget assistance request details
     */
    public function getBudgetAssistanceRequest($requestId)
    {
        try {
            $user = auth()->user();

            if (!$user->isMayorsOffice()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }

            $requestData = Cache::get($requestId);

            if (!$requestData) {
                return response()->json([
                    'success' => false,
                    'message' => 'Request not found or expired'
                ], 404);
            }

            $department = Department::find($requestData['department_id']);
            $requester = User::find($requestData['requested_by']);

            $vehicles = Vehicle::where('department_id', $requestData['department_id'])
                ->where('status', 'active')
                ->get();

            $drivers = Driver::whereHas('user', function ($q) use ($requestData) {
                $q->where('department_id', $requestData['department_id'])
                    ->where('status', 'active');
            })->with('user')->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'request_id' => $requestId,
                    'department' => $department ? [
                        'id' => $department->department_id,
                        'name' => $department->department_name,
                        'code' => $department->department_code,
                    ] : null,
                    'requester' => $requester ? $requester->full_name : null,
                    'ticket_data' => $requestData['ticket_data'],
                    'budget_info' => $requestData['budget_info'],
                    'estimated_cost' => $requestData['estimated_cost'],
                    'shortage' => round($requestData['estimated_cost'] - $requestData['budget_info']['remaining'], 2),
                    'created_at' => $requestData['created_at'],
                    'available_vehicles' => $vehicles,
                    'available_drivers' => $drivers,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get budget assistance request error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get request details'
            ], 500);
        }
    }

    /**
     * Create MO-funded trip ticket from a budget assistance request
     */
    public function createMoFundedTicket(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isMayorsOffice()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'request_id' => 'required|string',
                'charge_to' => 'required|string|max:120',
                'mo_note' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $requestData = Cache::get($request->request_id);

            if (!$requestData) {
                return response()->json([
                    'success' => false,
                    'message' => 'Request not found or expired. Please ask the department to resubmit.'
                ], 404);
            }

            $ticketData = $requestData['ticket_data'];

            DB::beginTransaction();

            // Generate ticket number
            $yearMonth = date('Y-m');
            $lastTicket = TripTicket::where('trip_ticket_number', 'like', $yearMonth . '-%')
                ->orderBy('trip_ticket_id', 'desc')
                ->first();

            if ($lastTicket) {
                preg_match('/' . $yearMonth . '-(\d+)/', $lastTicket->trip_ticket_number, $matches);
                $seq = isset($matches[1]) ? intval($matches[1]) + 1 : 1;
            } else {
                $seq = 1;
            }

            $ticketNumber = $yearMonth . '-' . str_pad($seq, 3, '0', STR_PAD_LEFT);

            $tripTicket = TripTicket::create([
                'trip_ticket_number' => $ticketNumber,
                'department_id' => $requestData['department_id'],
                'driver_id' => $ticketData['driver_id'],
                'vehicle_id' => $ticketData['vehicle_id'],
                'submitted_by' => $user->user_id,
                'created_by_mo_user_id' => $user->user_id,
                'submitted_by_staff' => false,
                'trip_date' => $ticketData['trip_date'],
                'purpose' => $ticketData['purpose'],
                'destination' => $ticketData['destination'],
                'charge_to' => $request->charge_to,
                'passenger_name' => $ticketData['passenger_name'] ?? null,
                'status' => TripTicket::STATUS_FUNDS_ISSUED,
                'submitted_at' => now(),
                'has_insufficient_budget' => false,
            ]);

            $vehicle = Vehicle::find($ticketData['vehicle_id']);
            if ($vehicle) {
                TripTicketVehicleSnapshot::create([
                    'trip_ticket_id' => $tripTicket->trip_ticket_id,
                    'vehicle_status' => $vehicle->status,
                    'fuel_type' => $vehicle->fuel_type,
                    'snapshot_taken_at' => now(),
                ]);
            }

            $estimatedCost = $requestData['estimated_cost'];
            $gasSlip = GasSlip::create([
                'trip_ticket_id' => $tripTicket->trip_ticket_id,
                'created_by' => $user->user_id,
                'amount_released' => $estimatedCost,
                'reconciliation_status' => 'pending',
                'budget_before' => 0,
                'budget_after' => 0,
                'period_id' => $this->getDefaultPeriodId($requestData['department_id']),
                'created_at' => now(),
            ]);

            Cache::forget($request->request_id);

            $keys = Cache::get('mo_requests_list', []);
            $keys = array_diff($keys, [$request->request_id]);
            Cache::put('mo_requests_list', $keys, now()->addHours(24));

            DB::commit();

            $this->notifyDriverOfMOTrip($tripTicket, $estimatedCost, $request->charge_to);
            $this->notifyDepartmentOfMOTrip($tripTicket, $request->charge_to, $request->mo_note);

            return response()->json([
                'success' => true,
                'message' => 'MO-funded trip ticket created successfully! Driver can start the trip.',
                'data' => [
                    'trip_ticket_id' => $tripTicket->trip_ticket_id,
                    'trip_ticket_number' => $ticketNumber,
                    'gas_slip_id' => $gasSlip->gas_slip_id,
                    'amount_released' => $estimatedCost,
                    'charge_to' => $request->charge_to,
                    'status' => $tripTicket->status,
                    'is_mo_funded' => true,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('MO create ticket error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to create ticket: ' . $e->getMessage()
            ], 500);
        }
    }

    // ============ RECEIPT VERIFICATION METHODS ============

public function getReceiptsForVerification(Request $request)
{
    try {
        $user = $request->user();
        if (!$user->isMayorsOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $receipts = DB::table('fuel_receipt as fr')
            ->join('gas_slip as gs', 'fr.gas_slip_id', '=', 'gs.gas_slip_id')
            ->join('trip_ticket as tt', 'gs.trip_ticket_id', '=', 'tt.trip_ticket_id')
            ->join('vehicles as v', 'tt.vehicle_id', '=', 'v.vehicle_id')
            // ✅ FIX: Join drivers table first, then users
            ->join('drivers as d', 'tt.driver_id', '=', 'd.driver_id')
            ->join('users as u_driver', 'd.user_id', '=', 'u_driver.user_id')
            ->join('departments as dept', 'tt.department_id', '=', 'dept.department_id')
            ->select(
                'fr.fuel_receipt_id as id',
                'fr.invoice_number',
                'fr.unit_price',
                'tt.trip_ticket_number as ticket_number',
                'u_driver.first_name',
                'u_driver.last_name',
                DB::raw("CONCAT(u_driver.first_name, ' ', u_driver.last_name) as driver_name"),
                'v.plate_number',
                'dept.department_name',
                'fr.liters_availed as liters',
                'fr.amount_on_receipt as amount',
                'fr.receipt_photo_path as receipt_url',
                'fr.receipt_uploaded_at as uploaded_at',
                'fr.gps_distance_km',
                'gs.reconciliation_status as status',
                'tt.trip_date',
                'v.fuel_type'
            )
            ->where(function($query) {
                $query->where('fr.liters_availed', '>', 0)
                      ->orWhere('fr.amount_on_receipt', '>', 0);
            })
            ->orderBy('fr.created_at', 'desc')
            ->get()
            ->map(function ($receipt) {
                if ($receipt->receipt_url && !str_starts_with($receipt->receipt_url, 'http')) {
                    $receipt->receipt_url = asset('storage/' . $receipt->receipt_url);
                }
                return $receipt;
            });

        return response()->json([
            'success' => true,
            'data' => $receipts,
            'total' => $receipts->count()
        ]);

    } catch (\Exception $e) {
        Log::error('Get receipts for verification error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch receipts: ' . $e->getMessage()
        ], 500);
    }
}

 /**
 * Verify a receipt with editable fields
 */
public function verifyReceipt(Request $request, $id)
{
    try {
        $user = $request->user();
        if (!$user->isMayorsOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // ✅ Log incoming data for debugging
        Log::info('Verifying receipt', [
            'receipt_id' => $id,
            'data' => $request->all(),
        ]);

        // ✅ Validate the incoming data
        $validator = Validator::make($request->all(), [
            'invoice_number' => 'nullable|string|max:50',
            'liters_availed' => 'required|numeric|min:0.01',
            'unit_price' => 'required|numeric|min:0.01',
            'amount_on_receipt' => 'required|numeric|min:0.01',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // ✅ Find the fuel receipt
        $fuelReceipt = FuelReceipt::findOrFail($id);
        $gasSlip = GasSlip::findOrFail($fuelReceipt->gas_slip_id);

        if ($gasSlip->reconciliation_status === 'verified') {
            return response()->json([
                'success' => false,
                'message' => 'This receipt has already been verified'
            ], 400);
        }

        DB::beginTransaction();

        // ✅ Update fuel receipt with editable fields
        if ($request->has('invoice_number')) {
            $fuelReceipt->invoice_number = $request->invoice_number;
        }
        $fuelReceipt->liters_availed = $request->liters_availed;
        $fuelReceipt->unit_price = $request->unit_price;
        $fuelReceipt->amount_on_receipt = $request->amount_on_receipt;
        $fuelReceipt->save();

        // ✅ Update gas slip reconciliation status
        $gasSlip->reconciliation_status = 'verified';
        $gasSlip->reconciled_by = $user->user_id;
        $gasSlip->reconciled_at = now();
        $gasSlip->save();

        DB::commit();

        Log::info('Receipt verified with edits', [
            'receipt_id' => $id,
            'verified_by' => $user->user_id,
            'invoice_number' => $request->invoice_number,
            'liters_availed' => $request->liters_availed,
            'unit_price' => $request->unit_price,
            'amount_on_receipt' => $request->amount_on_receipt,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Receipt verified successfully',
            'data' => [
                'receipt_id' => $id,
                'gas_slip_id' => $gasSlip->gas_slip_id,
                'status' => $gasSlip->reconciliation_status,
                'invoice_number' => $fuelReceipt->invoice_number,
                'liters_availed' => $fuelReceipt->liters_availed,
                'unit_price' => $fuelReceipt->unit_price,
                'amount_on_receipt' => $fuelReceipt->amount_on_receipt,
            ]
        ]);

    } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
        return response()->json([
            'success' => false,
            'message' => 'Receipt not found'
        ], 404);
    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('Verify receipt error: ' . $e->getMessage());
        Log::error($e->getTraceAsString());
        return response()->json([
            'success' => false,
            'message' => 'Failed to verify receipt: ' . $e->getMessage()
        ], 500);
    }
}

    // ============ END RECEIPT VERIFICATION METHODS ============

    // ============ HELPER METHODS ============

    private function getDepartmentBudgetInfo($departmentId)
    {
        $currentPeriod = DeptBudgetPeriod::where('department_id', $departmentId)
            ->where('status', 'active')
            ->first();

        if (!$currentPeriod) {
            return [
                'allocated' => 0,
                'spent' => 0,
                'remaining' => 0,
                'has_period' => false,
            ];
        }

        $totalSpent = GasSlip::where('period_id', $currentPeriod->period_id)
            ->whereNotNull('acknowledged_at')
            ->sum('amount_released');

        return [
            'allocated' => $currentPeriod->allocated_amount,
            'spent' => $totalSpent,
            'remaining' => $currentPeriod->allocated_amount - $totalSpent,
            'has_period' => true,
            'period_id' => $currentPeriod->period_id,
        ];
    }

    private function notifyDriverOfMOTrip($tripTicket, $amount, $chargeTo)
    {
        $driver = $tripTicket->driver && $tripTicket->driver->user ? $tripTicket->driver->user : null;

        if ($driver) {
            Notification::create([
                'recipient_user_id' => $driver->user_id,
                'notification_type' => 'fund_released',
                'entity_type' => 'trip_ticket',
                'entity_id' => $tripTicket->trip_ticket_id,
                'message' => "Funds of ₱{$amount} have been released for trip ticket {$tripTicket->trip_ticket_number} (MO Funded)\n\n" .
                    "Charge To: {$chargeTo}\n" .
                    "You may start your trip.",
                'channel' => 'in_app',
                'created_at' => now(),
            ]);
        }
    }

    private function notifyDepartmentOfMOTrip($tripTicket, $chargeTo, $moNote)
    {
        $departmentStaff = User::where('department_id', $tripTicket->department_id)
            ->where('role', 'driver')
            ->where('status', 'active')
            ->get();

        $message = "✅ Mayor's Office has created a trip ticket for your department.\n\n" .
            "Ticket #: {$tripTicket->trip_ticket_number}\n" .
            "Charge To: {$chargeTo}\n" .
            "This trip is funded by Mayor's Office (no budget deduction from your department).";

        if ($moNote) {
            $message .= "\n\nMO Note: {$moNote}";
        }

        foreach ($departmentStaff as $staff) {
            Notification::create([
                'recipient_user_id' => $staff->user_id,
                'notification_type' => 'mo_created_ticket',
                'entity_type' => 'trip_ticket',
                'entity_id' => $tripTicket->trip_ticket_id,
                'message' => $message,
                'channel' => 'in_app',
                'created_at' => now(),
            ]);
        }
    }

    private function sendFundIssuedNotification($ticket, $amount, $fundingSource)
    {
        $driver = $ticket->driver && $ticket->driver->user ? $ticket->driver->user : null;

        if ($driver) {
            Notification::create([
                'recipient_user_id' => $driver->user_id,
                'notification_type' => 'fund_released',
                'entity_type' => 'trip_ticket',
                'entity_id' => $ticket->trip_ticket_id,
                'message' => "Funds of ₱{$amount} have been released for trip ticket {$ticket->trip_ticket_number} ({$fundingSource})",
                'channel' => 'in_app',
                'created_at' => now(),
            ]);
        }
    }

    private function sendRejectionNotification($ticket, $reason)
    {
        $deptOffice = User::find($ticket->submitted_by);

        if ($deptOffice) {
            Notification::create([
                'recipient_user_id' => $deptOffice->user_id,
                'notification_type' => 'mo_rejected',
                'entity_type' => 'trip_ticket',
                'entity_id' => $ticket->trip_ticket_id,
                'message' => "Trip ticket {$ticket->trip_ticket_number} was rejected by Mayor's Office: {$reason}",
                'channel' => 'in_app',
                'created_at' => now(),
            ]);
        }
    }

    public function removeMORequest($requestId)
    {
        try {
            $user = auth()->user();

            if (!$user->isMayorsOffice()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }

            Cache::forget($requestId);

            $keys = Cache::get('mo_requests_list', []);
            $keys = array_diff($keys, [$requestId]);
            Cache::put('mo_requests_list', $keys, now()->addHours(24));

            return response()->json([
                'success' => true,
                'message' => 'Request removed successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Remove MO request error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to remove request'
            ], 500);
        }
    }

    public function getDepartmentBudget(Request $request, $departmentId)
    {
        try {
            $user = $request->user();

            if (!$user->isMayorsOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $currentPeriod = DeptBudgetPeriod::where('department_id', $departmentId)
                ->where('status', 'active')
                ->first();

            if (!$currentPeriod) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'department_id' => $departmentId,
                        'allocated_amount' => 0,
                        'spent_amount' => 0,
                        'remaining_amount' => 0,
                        'has_period' => false
                    ]
                ]);
            }

            $totalSpent = GasSlip::where('period_id', $currentPeriod->period_id)
                ->whereNotNull('acknowledged_at')
                ->sum('amount_released');

            $department = Department::find($departmentId);

            return response()->json([
                'success' => true,
                'data' => [
                    'department_id' => $departmentId,
                    'department_name' => $department ? $department->department_name : null,
                    'allocated_amount' => (float) $currentPeriod->allocated_amount,
                    'spent_amount' => (float) $totalSpent,
                    'remaining_amount' => (float) ($currentPeriod->allocated_amount - $totalSpent),
                    'week_start' => $currentPeriod->week_start,
                    'week_end' => $currentPeriod->week_end,
                    'status' => $currentPeriod->status,
                    'has_period' => true
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get department budget error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch department budget: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getAllDepartmentsWithBudget(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isMayorsOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $departments = Department::select('department_id', 'department_name', 'department_code')
                ->orderBy('department_name')
                ->get();

            $departmentsWithBudget = $departments->map(function ($department) {
                $currentPeriod = DeptBudgetPeriod::where('department_id', $department->department_id)
                    ->where('status', 'active')
                    ->first();

                if ($currentPeriod) {
                    $totalSpent = GasSlip::where('period_id', $currentPeriod->period_id)
                        ->whereNotNull('acknowledged_at')
                        ->sum('amount_released');
                    $remaining = $currentPeriod->allocated_amount - $totalSpent;

                    return [
                        'department_id' => $department->department_id,
                        'department_name' => $department->department_name,
                        'department_code' => $department->department_code,
                        'allocated_amount' => (float) $currentPeriod->allocated_amount,
                        'spent_amount' => (float) $totalSpent,
                        'remaining_amount' => (float) $remaining,
                        'has_budget' => true,
                    ];
                } else {
                    return [
                        'department_id' => $department->department_id,
                        'department_name' => $department->department_name,
                        'department_code' => $department->department_code,
                        'allocated_amount' => 0,
                        'spent_amount' => 0,
                        'remaining_amount' => 0,
                        'has_budget' => false,
                    ];
                }
            });

            return response()->json([
                'success' => true,
                'data' => $departmentsWithBudget
            ]);
        } catch (\Exception $e) {
            Log::error('Get all departments with budget error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch departments: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getAllDepartmentsForSelector(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isMayorsOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $departments = Department::select('department_id', 'department_name', 'department_code')
                ->orderBy('department_name', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $departments
            ]);
        } catch (\Exception $e) {
            Log::error('Get departments selector error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch departments: ' . $e->getMessage()
            ], 500);
        }
    }
}
<?php

namespace App\Http\Controllers\API;

use Illuminate\Support\Facades\Cache;
use App\Http\Controllers\Controller;
use App\Models\TripTicket;
use App\Models\GasSlip;
use App\Models\FuelReceipt;
use App\Models\DeptBudgetPeriod;
use App\Models\AnnualBudget;
use App\Models\WeeklyBudgetUsage;
use App\Models\CrossDepartmentUsage;
use App\Models\Notification;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Driver;
use App\Models\Department;
use App\Models\TripTicketVehicleSnapshot;
use App\Models\DeptBudgetPolicy;
use App\Services\BudgetService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use App\Helpers\NotificationHelper;
use Carbon\Carbon;

class MayorsOfficeController extends Controller
{
    protected $budgetService;

    public function __construct(BudgetService $budgetService)
    {
        $this->budgetService = $budgetService;
    }

    /**
     * Get Mayor's Office dashboard statistics
     */
    public function getDashboard(Request $request)
    {
        $user = $request->user();

        if (!$user->isMayorsOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Get annual budget summary
        $annualBudgetSummary = $this->getAnnualBudgetSummary();

        $stats = [
            'pending_fund_release' => TripTicket::where('status', 'pending_mayors_office')->count(),
            'funds_issued' => TripTicket::where('status', TripTicket::STATUS_FUNDS_ISSUED)->count(),
            'total_amount_released' => GasSlip::sum('amount_released'),
            //'pending_reconciliation' => TripTicket::where('status', TripTicket::STATUS_PENDING_RECONCILIATION)->count(),
            'pending_budget_assistance' => $this->getPendingBudgetAssistanceCount(),
            'total_budget_allocated' => $annualBudgetSummary['total_allocated'],
            'total_budget_used' => $annualBudgetSummary['total_used'],
            'total_budget_remaining' => $annualBudgetSummary['total_remaining'],
            'pending_receipts' => FuelReceipt::whereHas('gasSlip', function ($q) {
                $q->where('reconciliation_status', 'pending');
            })->count(),
            'cross_department_usage' => CrossDepartmentUsage::whereDate('created_at', Carbon::today())->count(),
            'annual_budget_summary' => $annualBudgetSummary,
        ];

        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }

    /**
     * Get annual budget summary
     */
    private function getAnnualBudgetSummary()
    {
        $year = Carbon::now()->year;

        $budgets = AnnualBudget::where('fiscal_year', $year)
            ->where('status', 'active')
            ->get();

        $totalAllocated = $budgets->sum('annual_amount');
        $totalUsed = $budgets->sum('used_amount');

        return [
            'total_allocated' => $totalAllocated,
            'total_used' => $totalUsed,
            'total_remaining' => $totalAllocated - $totalUsed,
            'departments' => $budgets->map(function ($budget) {
                return [
                    'department_id' => $budget->department_id,
                    'department_name' => $budget->department->department_name ?? 'Unknown',
                    'allocated' => $budget->annual_amount,
                    'used' => $budget->used_amount,
                    'remaining' => $budget->remaining_amount,
                    'utilization' => $budget->utilization_percentage,
                    'is_over_budget' => $budget->is_over_budget,
                ];
            }),
        ];
    }

    /**
     * Get total remaining budget across all departments (Annual)
     */
    private function getTotalRemainingBudget()
    {
        $year = Carbon::now()->year;

        $budgets = AnnualBudget::where('fiscal_year', $year)
            ->where('status', 'active')
            ->get();

        return $budgets->sum('remaining_amount');
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

                // ✅ Get remaining budget for the department
                $remainingBudget = $this->budgetService->getRemainingBudget($ticket->department_id);
                
                // ✅ Get weekly remaining budget
                $weeklyRemaining = $this->getWeeklyRemainingBudget($ticket->department_id);

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
                    'has_insufficient_budget' => $remainingBudget < ($ticket->estimated_cost ?? 0),
                    'budget_shortage' => max(0, ($ticket->estimated_cost ?? 0) - $remainingBudget),
                    'estimated_cost' => $ticket->estimated_fuel_liters ?
                        ($ticket->estimated_fuel_liters * 88) : null,
                    'department_id' => $ticket->department_id,
                    'remaining_budget' => $remainingBudget,
                    'weekly_remaining' => $weeklyRemaining,  // ✅ NEW: Weekly remaining
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
                    'is_cross_department' => $ticket->gasSlip?->is_cross_department ?? false,
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
 * ✅ Get weekly remaining budget for a department
 */
private function getWeeklyRemainingBudget($departmentId)
{
    $currentWeek = date('W');
    $year = date('Y');
    
    $weeklyUsage = DB::table('weekly_budget_usage')
        ->where('department_id', $departmentId)
        ->where('week_number', $currentWeek)
        ->where('year', $year)
        ->first();
    
    if (!$weeklyUsage) {
        // If no weekly usage, get from policy
        $policy = DeptBudgetPolicy::where('department_id', $departmentId)->first();
        return $policy ? (float) $policy->default_weekly_allocation : 0;
    }
    
    $weeklyCeiling = (float) $weeklyUsage->weekly_allocation;
    $weeklyUsed = (float) $weeklyUsage->amount_used;
    
    return $weeklyCeiling - $weeklyUsed;
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
                        'driver_name' => $driverName,
                        'driver' => $ticket->driver ? [
                            'driver_id' => $ticket->driver->driver_id,
                            'name' => $driverName,
                            'user' => $ticket->driver->user ? [
                                'full_name' => $ticket->driver->user->full_name,
                            ] : null,
                        ] : null,
                        'purpose' => $ticket->purpose,
                        'created_at' => $ticket->created_at,
                        'is_cross_department' => $ticket->gasSlip?->is_cross_department ?? false,
                        'cross_department_reason' => $ticket->gasSlip?->cross_department_reason ?? null,
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
 * Approve ticket and release funds and gaslip generation
 */
public function approveTicket(Request $request, $id)
{
    try {
        $validator = Validator::make($request->all(), [
            'amount_released' => 'required|numeric|min:0.01',
            'charge_to_department_id' => 'nullable|exists:departments,department_id',
            'is_cross_department' => 'nullable|boolean',
            'cross_department_reason' => 'nullable|string|max:255',
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

        $isCrossDepartment = $request->is_cross_department ?? false;
        $crossDepartmentReason = $request->cross_department_reason ?? null;
        $isMoFundedTicket = $ticket->created_by_mo_user_id !== null;

        if ($isCrossDepartment && $chargeDepartmentId == $ticket->department_id) {
            return response()->json([
                'success' => false,
                'message' => '❌ Cross-Department usage selected but the same department is chosen. Please select a different department or uncheck the Cross-Department option.'
            ], 422);
        }

        if ($isCrossDepartment && empty($crossDepartmentReason)) {
            return response()->json([
                'success' => false,
                'message' => '❌ Please provide a reason for cross-department fuel usage.'
            ], 422);
        }

        $budgetBefore = 0;
        $budgetAfter = 0;
        $periodId = null;
        $weeklyRemaining = 0;
        $annualRemaining = 0;

        // CHECK AND DEDUCT BUDGET
        if (!$isMoFundedTicket) {
            $weeklyRemaining = $this->getWeeklyRemainingBudget($chargeDepartmentId);
            $annualRemaining = $this->budgetService->getRemainingBudget($chargeDepartmentId);

            if ($weeklyRemaining < $amountToRelease && !$isCrossDepartment) {
                $shortage = $amountToRelease - $weeklyRemaining;
                return response()->json([
                    'success' => false,
                    'message' => "⚠️ Insufficient Weekly Budget!\n\n" .
                                "Requested: ₱" . number_format($amountToRelease, 2) . "\n" .
                                "Weekly Remaining: ₱" . number_format($weeklyRemaining, 2) . "\n" .
                                "Shortage: ₱" . number_format($shortage, 2),
                    'budget_info' => [
                        'weekly_remaining' => (float) $weeklyRemaining,
                        'requested' => $amountToRelease,
                        'shortage' => $shortage,
                    ]
                ], 422);
            }

            if ($annualRemaining < $amountToRelease && !$isCrossDepartment) {
                $shortage = $amountToRelease - $annualRemaining;
                return response()->json([
                    'success' => false,
                    'message' => "⚠️ Insufficient Annual Budget!\n\n" .
                                "Requested: ₱" . number_format($amountToRelease, 2) . "\n" .
                                "Annual Remaining: ₱" . number_format($annualRemaining, 2) . "\n" .
                                "Shortage: ₱" . number_format($shortage, 2),
                    'budget_info' => [
                        'annual_remaining' => (float) $annualRemaining,
                        'requested' => $amountToRelease,
                        'shortage' => $shortage,
                    ]
                ], 422);
            }

            // ✅ FIXED: Capture USED_AMOUNT (not annual_amount) for audit trail
            $annualBudget = AnnualBudget::where('department_id', $chargeDepartmentId)
                ->where('fiscal_year', Carbon::now()->year)
                ->first();
            $budgetBefore = $annualBudget ? (float) $annualBudget->used_amount : 0;

            $this->budgetService->deductBudget(
                $chargeDepartmentId,
                $amountToRelease,
                $isCrossDepartment,
                $isCrossDepartment ? $ticket->department_id : null,
                $crossDepartmentReason
            );

            // ✅ FIXED: Capture USED_AMOUNT after deduction
            $annualBudget = AnnualBudget::where('department_id', $chargeDepartmentId)
                ->where('fiscal_year', Carbon::now()->year)
                ->first();
            $budgetAfter = $annualBudget ? (float) $annualBudget->used_amount : 0;

            $periodId = $this->getOrCreatePeriodId($chargeDepartmentId);
        }

        DB::beginTransaction();

        // Create GasSlip
        $gasSlipData = [
            'trip_ticket_id' => $id,
            'created_by' => $user->user_id,
            'amount_released' => $amountToRelease,
            'reconciliation_status' => 'pending',
            'is_cross_department' => $isCrossDepartment ? 1 : 0,
            'original_department_id' => $isCrossDepartment ? $ticket->department_id : null,
            'cross_department_reason' => $crossDepartmentReason,
            'period_id' => $periodId ?? $this->getOrCreatePeriodId($chargeDepartmentId),
            'budget_before' => $budgetBefore,
            'budget_after' => $budgetAfter,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        $gasSlipId = DB::table('gas_slip')->insertGetId($gasSlipData);

        if ($gasSlipId == 0) {
            $gasSlipId = DB::getPdo()->lastInsertId();
        }

        if ($gasSlipId == 0) {
            $record = DB::table('gas_slip')
                ->where('trip_ticket_id', $id)
                ->orderBy('gas_slip_id', 'desc')
                ->first();

            if ($record) {
                $gasSlipId = $record->gas_slip_id;
            }
        }

        if ($gasSlipId == 0) {
            Log::error('❌ GasSlip creation failed - ID is: ' . $gasSlipId);
            Log::error('❌ GasSlip Data:', $gasSlipData);
            throw new \Exception('GasSlip creation failed - no ID returned');
        }

        Log::info('✅ GasSlip created - ID: ' . $gasSlipId . ' for trip: ' . $id);

        if ($isCrossDepartment) {
            $crossData = [
                'from_department_id' => $ticket->department_id,
                'to_department_id' => $chargeDepartmentId,
                'gas_slip_id' => $gasSlipId,
                'amount' => $amountToRelease,
                'reason' => $crossDepartmentReason,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            DB::table('cross_department_usage')->insert($crossData);

            Log::info('✅ CrossDepartmentUsage created successfully');
        }

        // Update ticket
        $ticket->has_insufficient_budget = false;
        $ticket->status = TripTicket::STATUS_FUNDS_ISSUED;

        if ($isCrossDepartment && $chargeDepartment) {
            $ticket->charge_to = $chargeDepartment->department_code ?? $ticket->charge_to;
        }
        $ticket->save();

        DB::commit();

        $newWeeklyRemaining = $this->getWeeklyRemainingBudget($chargeDepartmentId);
        $newAnnualRemaining = $this->budgetService->getRemainingBudget($chargeDepartmentId);
        $usedAmount = $this->budgetService->getUsedAmount($chargeDepartmentId);

        $fundingSource = $isMoFundedTicket ? 'MO Funded' :
                        ($isCrossDepartment ? "Cross-Department: {$chargeDepartment->department_name}" :
                        "Charged to: {$chargeDepartment->department_name}");

        $this->sendFundIssuedNotification($ticket, $amountToRelease, $fundingSource, $isCrossDepartment);

        $responseMessage = $isMoFundedTicket
            ? "✅ Funds released successfully (MO Funded - No department budget deduction)"
            : ($isCrossDepartment
                ? "✅ Funds released successfully (Cross-Department Usage - For recording only)"
                : "✅ Funds released successfully from {$chargeDepartment->department_name} budget\n" .
                  "Weekly Remaining: ₱" . number_format($newWeeklyRemaining, 2) . "\n" .
                  "Annual Remaining: ₱" . number_format($newAnnualRemaining, 2) . "\n" .
                  "Total Used: ₱" . number_format($usedAmount, 2));

        return response()->json([
            'success' => true,
            'message' => $responseMessage,
            'data' => [
                'ticket_id' => $ticket->trip_ticket_id,
                'ticket_number' => $ticket->trip_ticket_number,
                'amount_released' => $amountToRelease,
                'gas_slip_id' => $gasSlipId,
                'status' => $ticket->status,
                'funding_source' => $fundingSource,
                'charged_to_department' => $chargeDepartment->department_name,
                'is_mo_funded' => $isMoFundedTicket,
                'is_cross_department' => $isCrossDepartment,
                'cross_department_reason' => $crossDepartmentReason,
                'budget_before' => $budgetBefore,
                'budget_after' => $budgetAfter,
                'weekly_remaining_before' => $weeklyRemaining,
                'weekly_remaining_after' => $newWeeklyRemaining,
                'annual_remaining_before' => $annualRemaining ?? 0,
                'annual_remaining_after' => $newAnnualRemaining,
                'total_used' => $usedAmount,
            ]
        ]);
    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('❌ Approve ticket error: ' . $e->getMessage());
        Log::error($e->getTraceAsString());
        return response()->json([
            'success' => false,
            'message' => 'Failed to release funds: ' . $e->getMessage()
        ], 500);
    }
}
/**
 * ✅ Deduct from weekly budget
 */
private function deductWeeklyBudget($departmentId, $amount)
{
    $currentWeek = date('W');
    $year = date('Y');
    
    $weeklyUsage = DB::table('weekly_budget_usage')
        ->where('department_id', $departmentId)
        ->where('week_number', $currentWeek)
        ->where('year', $year)
        ->first();
    
    if ($weeklyUsage) {
        DB::table('weekly_budget_usage')
            ->where('usage_id', $weeklyUsage->usage_id)
            ->update([
                'amount_used' => $weeklyUsage->amount_used + $amount,
                'updated_at' => now()
            ]);
    } else {
        // Create if not exists
        $policy = DeptBudgetPolicy::where('department_id', $departmentId)->first();
        $weeklyCeiling = $policy ? $policy->default_weekly_allocation : 0;
        
        DB::table('weekly_budget_usage')->insert([
            'department_id' => $departmentId,
            'week_number' => $currentWeek,
            'year' => $year,
            'week_start' => Carbon::now()->startOfWeek()->toDateString(),
            'week_end' => Carbon::now()->endOfWeek()->toDateString(),
            'weekly_allocation' => $weeklyCeiling,
            'amount_used' => $amount,
            'created_at' => now(),
            'updated_at' => now()
        ]);
    }
}


    /**
     * ✅ Create a new budget period for a department
     */
    private function createBudgetPeriod($departmentId)
{
    $policy = DeptBudgetPolicy::where('department_id', $departmentId)->first();
    $allocatedAmount = $policy ? $policy->default_weekly_allocation : 1000;
    $weekStart = Carbon::now()->startOfWeek()->toDateString();
    
    $period = DeptBudgetPeriod::create([
        'department_id' => $departmentId,
        'week_start' => $weekStart,
        'allocated_amount' => $allocatedAmount,
        'remaining_balance' => $allocatedAmount,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    
    Log::info('Created new budget period', [
        'department_id' => $departmentId,
        'period_id' => $period->period_id,
        'allocated_amount' => $allocatedAmount,
    ]);
    
    return $period;
}




    /**
     * Get default period ID for a department (backward compatibility)
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
            'department',  // ✅ Make sure department is loaded
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
'actual_distance_km' => $ticket->actual_distance_km,
'actual_fuel_used' => $ticket->actual_fuel_used,
                'budget_info' => $budgetInfo,
                'has_receipt' => $fuelReceipt && ($fuelReceipt->liters_availed > 0 || $fuelReceipt->amount_on_receipt > 0),
                'receipt' => $fuelReceipt ? [
                    'fuel_receipt_id' => $fuelReceipt->fuel_receipt_id,
                    'invoice_number' => $fuelReceipt->invoice_number ?? null,
                    'liters_availed' => $fuelReceipt->liters_availed,
                    'amount_on_receipt' => $fuelReceipt->amount_on_receipt,
                    'receipt_photo_path' => $fuelReceipt->receipt_photo_path,
                    'receipt_url' => $fuelReceipt->receipt_photo_path ? asset($fuelReceipt->receipt_photo_path) : null,
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
                // ✅ FIXED: Include full department data with head_of_office
                'department' => $ticket->department ? [
                    'department_id' => $ticket->department->department_id,
                    'name' => $ticket->department->department_name,
                    'department_name' => $ticket->department->department_name,
                    'code' => $ticket->department->department_code,
                    'department_code' => $ticket->department->department_code,
                    'head_of_office' => $ticket->department->head_of_office ?? null,  // ✅ ADD THIS
                    'is_active' => $ticket->department->is_active,
                ] : null,
                'gas_slip' => $ticket->gasSlip ? [
    'gas_slip_id' => $ticket->gasSlip->gas_slip_id,
    'amount_released' => $ticket->gasSlip->amount_released,
    'reconciliation_status' => $ticket->gasSlip->reconciliation_status,
    'is_cross_department' => $ticket->gasSlip->is_cross_department ?? false,
    'cross_department_reason' => $ticket->gasSlip->cross_department_reason ?? null,
] : null,
                'all_departments' => Department::select('department_id', 'department_name', 'department_code', 'head_of_office')->get(),
            ]
        ]);
    } catch (\Exception $e) {
        Log::error('Show ticket error: ' . $e->getMessage());
        return response()->json(['message' => 'Ticket not found'], 404);
    }
}

    /**
     * Get budget overview (Annual Budget)
     */
    public function getBudgetOverview(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isMayorsOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $year = Carbon::now()->year;

            $budgets = AnnualBudget::with('department')
                ->where('fiscal_year', $year)
                ->where('status', 'active')
                ->get();

            $budgetData = $budgets->map(function ($budget) {
                // Get weekly usage for visualization
                $weeklyUsage = WeeklyBudgetUsage::where('department_id', $budget->department_id)
                    ->where('year', Carbon::now()->year)
                    ->orderBy('week_number')
                    ->get();

                return [
                    'department_id' => $budget->department_id,
                    'department_name' => $budget->department->department_name ?? 'Unknown',
                    'allocated_amount' => $budget->annual_amount,
                    'spent_amount' => $budget->used_amount,
                    'remaining_amount' => $budget->remaining_amount,
                    'is_negative' => $budget->remaining_amount < 0,
                    'utilization_percentage' => $budget->utilization_percentage,
                    'weekly_usage' => $weeklyUsage->map(function ($week) {
                        return [
                            'week_number' => $week->week_number,
                            'week_start' => $week->week_start,
                            'week_end' => $week->week_end,
                            'amount_used' => $week->amount_used,
                        ];
                    }),
                    'fiscal_year' => $budget->fiscal_year,
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
                'gs.amount_released',      
                'fr.receipt_photo_path',
                'fr.receipt_uploaded_at as uploaded_at',
                'fr.gps_distance_km',
                'fr.verification_status as status',   
                'fr.verified_at',                       
                'tt.trip_date',
                'v.fuel_type'
            )
            ->whereNotNull('fr.receipt_photo_path')
            ->where('fr.verification_status', 'pending')  // ✅ NEW
            ->orderBy('fr.created_at', 'desc')
            ->get()
            ->map(function ($receipt) {
                $receipt->receipt_url = $receipt->receipt_photo_path
                    ? asset('receipts/' . basename($receipt->receipt_photo_path))
                    : null;
                return $receipt;
            });

        return response()->json([
            'success' => true,
            'data'    => $receipts,
            'total'   => $receipts->count(),
        ]);
    } catch (\Exception $e) {
        Log::error('Get receipts for verification error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch receipts: ' . $e->getMessage(),
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

        Log::info('Verifying receipt', [
            'receipt_id' => $id,
            'user_id'    => $user->user_id,
            'data'       => $request->all(),
        ]);

        $validator = Validator::make($request->all(), [
            'invoice_number'    => 'nullable|string|max:50',
            'amount_on_receipt' => 'required|numeric|min:0',
            // ✅ liters and unit_price are OPTIONAL — GSO can fill them in later via the
            // "edit liters" flow if needed. MO verification only cares about amount.
            'liters_availed'    => 'nullable|numeric|min:0',
            'unit_price'        => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $fuelReceipt = FuelReceipt::findOrFail($id);
        $gasSlip     = GasSlip::findOrFail($fuelReceipt->gas_slip_id);

        if ($fuelReceipt->verification_status === 'verified') {
            return response()->json([
                'success' => false,
                'message' => 'This receipt has already been verified',
            ], 400);
        }

        // ✅ Guard: amount must not exceed released amount
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

        // ✅ Update fuel_receipt — amount + invoice always; liters/unit_price only if sent
        if ($request->has('invoice_number')) {
            $fuelReceipt->invoice_number = $request->invoice_number;
        }

        $fuelReceipt->amount_on_receipt = $request->amount_on_receipt;

        // ✅ Only overwrite liters/unit_price if MO actually sent values
        if ($request->filled('liters_availed')) {
            $fuelReceipt->liters_availed = $request->liters_availed;
        }
        if ($request->filled('unit_price')) {
            $fuelReceipt->unit_price = $request->unit_price;
        }

        // ✅ If MO sent liters + amount but no unit_price, derive it
        if (
            $request->filled('liters_availed') &&
            !$request->filled('unit_price') &&
            (float) $request->liters_availed > 0
        ) {
            $fuelReceipt->unit_price = round(
                $request->amount_on_receipt / (float) $request->liters_availed,
                2
            );
        }

        $fuelReceipt->verification_status = 'verified';
        $fuelReceipt->verified_at         = now();
        $fuelReceipt->verified_by         = $user->user_id;
        $fuelReceipt->save();

        // ✅ Update gas_slip — kept here so MO dashboard's pending_receipts
        // count stays accurate. GSO's validateTrip() also sets this, so
        // the "last writer wins" race is benign and idempotent.
        $gasSlip->reconciliation_status = 'verified';
        $gasSlip->reconciled_by         = $user->user_id;
        $gasSlip->reconciled_at         = now();
        $gasSlip->save();

        // ✅ Sync parent trip ticket's actuals
        if ($gasSlip->tripTicket) {
            $gasSlip->tripTicket->syncActuals()->save();
        }

        DB::commit();

        Log::info('Receipt verified successfully', [
            'receipt_id'        => $id,
            'verified_by'       => $user->user_id,
            'amount_on_receipt' => $request->amount_on_receipt,
            'liters_availed'    => $fuelReceipt->liters_availed,
            'unit_price'        => $fuelReceipt->unit_price,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Receipt verified successfully',
            'data' => [
                'receipt_id'            => $id,
                'gas_slip_id'           => $gasSlip->gas_slip_id,
                'verification_status'   => $fuelReceipt->verification_status,
                'reconciliation_status' => $gasSlip->reconciliation_status,
                'invoice_number'        => $fuelReceipt->invoice_number,
                'liters_availed'        => $fuelReceipt->liters_availed,
                'unit_price'            => $fuelReceipt->unit_price,
                'amount_on_receipt'     => $fuelReceipt->amount_on_receipt,
                'amount_released'       => $gasSlip->amount_released,
                'verified_at'           => $fuelReceipt->verified_at,
                'verified_by'           => $fuelReceipt->verified_by,
            ],
        ]);
    } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
        return response()->json(['success' => false, 'message' => 'Receipt not found'], 404);
    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('Verify receipt error: ' . $e->getMessage());
        Log::error($e->getTraceAsString());
        return response()->json([
            'success' => false,
            'message' => 'Failed to verify receipt: ' . $e->getMessage(),
        ], 500);
    }
}

    // ============ HELPER METHODS ============

    private function getDepartmentBudgetInfo($departmentId)
    {
        $year = Carbon::now()->year;

        $budget = AnnualBudget::where('department_id', $departmentId)
            ->where('fiscal_year', $year)
            ->first();

        if (!$budget) {
            return [
                'allocated' => 0,
                'spent' => 0,
                'remaining' => 0,
                'has_period' => false,
                'budget_type' => 'annual',
            ];
        }

        return [
            'allocated' => $budget->annual_amount,
            'spent' => $budget->used_amount,
            'remaining' => $budget->remaining_amount,
            'has_period' => true,
            'budget_type' => 'annual',
            'fiscal_year' => $budget->fiscal_year,
            'utilization_percentage' => $budget->utilization_percentage,
        ];
    }

  

    private function sendFundIssuedNotification($ticket, $amount, $fundingSource, $isCrossDepartment = false)
    {
        $driver = $ticket->driver && $ticket->driver->user ? $ticket->driver->user : null;

        if ($driver) {
            $message = "Funds of ₱{$amount} have been released for trip ticket {$ticket->trip_ticket_number} ({$fundingSource})";

            if ($isCrossDepartment) {
                $message .= "\n\n⚠️ Note: This is a cross-department fuel usage.\n";
                $message .= "This is for recording purposes only. No budget transfer was made.";
            }

            Notification::create([
                'recipient_user_id' => $driver->user_id,
                'notification_type' => 'fund_released',
                'entity_type' => 'trip_ticket',
                'entity_id' => $ticket->trip_ticket_id,
                'message' => $message,
                'channel' => 'in_app',
                'created_at' => now(),
            ]);
        }

        // Also notify GSO and Mayor's Office about cross-department usage
        if ($isCrossDepartment) {
            $adminUsers = User::whereIn('role', ['gso_office', 'mayors_office'])->get();

            foreach ($adminUsers as $admin) {
                Notification::create([
                    'recipient_user_id' => $admin->user_id,
                    'notification_type' => 'cross_department_usage',
                    'entity_type' => 'gas_slip',
                    'entity_id' => $ticket->gasSlip?->gas_slip_id ?? 0,
                    'message' => "⚠️ Cross-Department Fuel Usage\n\n" .
                        "Ticket: {$ticket->trip_ticket_number}\n" .
                        "Amount: ₱" . number_format($amount, 2) . "\n" .
                        "Department: {$ticket->department?->department_name}\n" .
                        "This is for recording purposes only.",
                    'channel' => 'in_app',
                    'created_at' => now(),
                ]);
            }
        }
    }

  
    public function getDepartmentBudget(Request $request, $departmentId)
    {
        try {
            $user = $request->user();

            if (!$user->isMayorsOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $year = Carbon::now()->year;

            $budget = AnnualBudget::where('department_id', $departmentId)
                ->where('fiscal_year', $year)
                ->first();

            if (!$budget) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'department_id' => $departmentId,
                        'allocated_amount' => 0,
                        'spent_amount' => 0,
                        'remaining_amount' => 0,
                        'has_period' => false,
                        'budget_type' => 'annual',
                    ]
                ]);
            }

            $department = Department::find($departmentId);

            return response()->json([
                'success' => true,
                'data' => [
                    'department_id' => $departmentId,
                    'department_name' => $department ? $department->department_name : null,
                    'allocated_amount' => (float) $budget->annual_amount,
                    'spent_amount' => (float) $budget->used_amount,
                    'remaining_amount' => (float) $budget->remaining_amount,
                    'fiscal_year' => $budget->fiscal_year,
                    'status' => $budget->status,
                    'has_period' => true,
                    'budget_type' => 'annual',
                    'utilization_percentage' => $budget->utilization_percentage,
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

        $year = Carbon::now()->year;

        // ✅ Get ALL departments (active and inactive)
        $departments = Department::select('department_id', 'department_name', 'department_code')
            ->orderBy('department_name')
            ->get();

        $departmentsWithBudget = $departments->map(function ($department) use ($year) {
            // ✅ Get annual budget
            $budget = AnnualBudget::where('department_id', $department->department_id)
                ->where('fiscal_year', $year)
                ->first();

            // ✅ Get current week usage
            $currentWeek = WeeklyBudgetUsage::where('department_id', $department->department_id)
                ->where('week_number', date('W'))
                ->where('year', $year)
                ->first();

            // ✅ Get policy (fallback)
            $policy = DB::table('dept_budget_policy')
                ->where('department_id', $department->department_id)
                ->first();

            if ($budget) {
                // ✅ Weekly allocation from current week or policy
                $weeklyAllocation = 0;
                $weeklyUsed = 0;

                if ($currentWeek) {
                    $weeklyAllocation = (float) $currentWeek->weekly_allocation;
                    $weeklyUsed = (float) $currentWeek->amount_used;
                } elseif ($policy) {
                    $weeklyAllocation = (float) $policy->default_weekly_allocation;
                }

                return [
                    'department_id' => $department->department_id,
                    'department_name' => $department->department_name,
                    'department_code' => $department->department_code,
                    // ✅ ANNUAL BUDGET (Primary)
                    'annual_amount' => (float) $budget->annual_amount,
                    'allocated_amount' => (float) $budget->annual_amount,  // ✅ Alias for frontend
                    'used_amount' => (float) $budget->used_amount,
                    'spent_amount' => (float) $budget->used_amount,       // ✅ Alias for frontend
                    'remaining_amount' => (float) $budget->remaining_amount,
                    // ✅ WEEKLY ALLOCATION
                    'weekly_allocation' => $weeklyAllocation,
                    'weekly_used' => $weeklyUsed,
                    // ✅ Other fields
                    'has_budget' => true,
                    'budget_type' => 'annual',
                    'fiscal_year' => $budget->fiscal_year,
                    'utilization_percentage' => $budget->utilization_percentage,
                    'utilization' => $budget->utilization_percentage,     // ✅ Alias for frontend
                    'status' => $budget->status,
                    'allocated' => (float) $budget->annual_amount,        // ✅ Alias for frontend
                    'spent' => (float) $budget->used_amount,              // ✅ Alias for frontend
                ];
            } else {
                return [
                    'department_id' => $department->department_id,
                    'department_name' => $department->department_name,
                    'department_code' => $department->department_code,
                    'annual_amount' => 0,
                    'allocated_amount' => 0,   // ✅ Alias
                    'used_amount' => 0,
                    'spent_amount' => 0,       // ✅ Alias
                    'remaining_amount' => 0,
                    'weekly_allocation' => 0,
                    'weekly_used' => 0,
                    'has_budget' => false,
                    'budget_type' => 'annual',
                    'fiscal_year' => $year,
                    'utilization_percentage' => 0,
                    'utilization' => 0,        // ✅ Alias
                    'status' => 'inactive',
                    'allocated' => 0,          // ✅ Alias
                    'spent' => 0,              // ✅ Alias
                ];
            }
        });

        // ✅ Calculate summary
        $totalAllocated = $departmentsWithBudget->sum('allocated_amount');
        $totalUsed = $departmentsWithBudget->sum('used_amount');

        return response()->json([
            'success' => true,
            'data' => $departmentsWithBudget,
            'summary' => [
                'total_allocated' => $totalAllocated,
                'total_used' => $totalUsed,
                'total_remaining' => $totalAllocated - $totalUsed,
                'total_departments' => $departmentsWithBudget->count(),
                'departments_with_budget' => $departmentsWithBudget->filter(fn($d) => $d['has_budget'])->count(),
            ]
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

  private function getOrCreatePeriodId($departmentId)
{
    $period = DeptBudgetPeriod::where('department_id', $departmentId)
        ->where('status', 'active')
        ->first();
    
    if ($period) {
        return $period->period_id;  // ✅ Returns int
    }
    
    $period = $this->createBudgetPeriod($departmentId);
    return $period->period_id;  // ✅ Returns int
}


/**
 * ✅ Get cancelled trips for Mayor's Office
 */
public function getCancelledTrips(Request $request)
{
    try {
        $user = $request->user();

        if (!$user->isMayorsOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $trips = TripTicket::with(['vehicle', 'department', 'driver.user', 'gasSlip'])
            ->where('status', TripTicket::STATUS_CANCELLED)
            ->orderBy('cancelled_at', 'desc')
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
            'meta' => ['total' => $trips->count()]
        ]);
    } catch (\Exception $e) {
        Log::error('MO get cancelled trips error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch cancelled trips: ' . $e->getMessage()
        ], 500);
    }
}

/**
 * ✅ Cancel a trip ticket (Mayor's Office)
 * Only allows cancellation before funds are released
 */
public function cancelTrip(Request $request, $id)
{
    try {
        $user = $request->user();

        if (!$user->isMayorsOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|min:5|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // ✅ Only allow cancellation for cancellable statuses
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

        // ✅ Extra safety: block if gas slip already exists (funds already released)
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

        // ✅ Broadcast the cancellation event
        try {
            broadcast(new \App\Events\TripTicketCancelled($ticket, $request->reason, $user));
            Log::info('📡 MO Broadcasted TripTicketCancelled for trip: ' . $ticket->trip_ticket_number);
        } catch (\Exception $e) {
            Log::error('Failed to broadcast cancellation: ' . $e->getMessage());
        }

        // ✅ Notify the driver/requester
        if ($ticket->submitted_by) {
            NotificationHelper::send(
                $ticket->submitted_by,
                'trip_cancelled',
                'trip_ticket',
                $ticket->trip_ticket_id,
                "Trip {$ticket->trip_ticket_number} has been cancelled by Mayor's Office: {$request->reason}"
            );
        }

        // ✅ Notify GSO
        $gsoStaff = User::where('role', 'gso_office')->where('status', 'active')->get();
        foreach ($gsoStaff as $gso) {
            NotificationHelper::send(
                $gso->user_id,
                'trip_cancelled',
                'trip_ticket',
                $ticket->trip_ticket_id,
                "Trip {$ticket->trip_ticket_number} has been cancelled by Mayor's Office"
            );
        }

        Log::info('Trip cancelled by Mayor\'s Office', [
            'trip_id' => $ticket->trip_ticket_id,
            'cancelled_by' => $user->user_id,
            'reason' => $request->reason,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Trip ticket cancelled successfully.',
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
        Log::error('MO cancel trip error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to cancel trip: ' . $e->getMessage()
        ], 500);
    }
}

public function getVerifiedReceipts(Request $request)
{
    try {
        $user = $request->user();
        if (!$user->isMayorsOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = DB::table('fuel_receipt as fr')
            ->join('gas_slip as gs', 'fr.gas_slip_id', '=', 'gs.gas_slip_id')
            ->join('trip_ticket as tt', 'gs.trip_ticket_id', '=', 'tt.trip_ticket_id')
            ->join('vehicles as v', 'tt.vehicle_id', '=', 'v.vehicle_id')
            ->join('drivers as d', 'tt.driver_id', '=', 'd.driver_id')
            ->join('users as u_driver', 'd.user_id', '=', 'u_driver.user_id')
            ->join('departments as dept', 'tt.department_id', '=', 'dept.department_id')
            ->leftJoin('users as u_verifier', 'fr.verified_by', '=', 'u_verifier.user_id')
            ->select(
                'fr.fuel_receipt_id as id',
                'fr.invoice_number',
                'fr.unit_price',
                'gs.amount_released',                       // ✅ NEW
                'tt.trip_ticket_number as ticket_number',
                DB::raw("CONCAT(u_driver.first_name, ' ', u_driver.last_name) as driver_name"),
                'v.plate_number',
                'v.fuel_type',
                'dept.department_name',
                'fr.liters_availed as liters',
                'fr.amount_on_receipt as amount',
                'fr.receipt_photo_path',
                'fr.receipt_uploaded_at as uploaded_at',
                'fr.gps_distance_km',
                'fr.verification_status as status',
                'fr.verified_at',
                DB::raw("CONCAT(u_verifier.first_name, ' ', u_verifier.last_name) as verified_by_name"),
                'tt.trip_date'
            )
            ->whereNotNull('fr.receipt_photo_path')
            ->where('fr.verification_status', 'verified');

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('fr.verified_at', [
                Carbon::parse($request->start_date)->startOfDay(),
                Carbon::parse($request->end_date)->endOfDay(),
            ]);
        }

        if ($request->filled('department_id')) {
            $query->where('tt.department_id', $request->department_id);
        }

        $receipts = $query->orderBy('fr.verified_at', 'desc')
            ->get()
            ->map(function ($receipt) {
                $receipt->receipt_url = $receipt->receipt_photo_path
                    ? asset('receipts/' . basename($receipt->receipt_photo_path))
                    : null;
                return $receipt;
            });

        return response()->json([
            'success' => true,
            'data'    => $receipts,
            'total'   => $receipts->count(),
        ]);
    } catch (\Exception $e) {
        Log::error('MO get verified receipts error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch verified receipts: ' . $e->getMessage(),
        ], 500);
    }
}


}
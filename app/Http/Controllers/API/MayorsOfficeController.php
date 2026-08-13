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
            'pending_reconciliation' => TripTicket::where('status', TripTicket::STATUS_PENDING_RECONCILIATION)->count(),
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
 * Approve ticket and release funds (Updated with Annual Budget + Cross-Department)
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

        $budgetBefore = 0;
        $budgetAfter = 0;
        $periodId = null;
        $weeklyRemaining = 0;

        // ✅ CHECK AND DEDUCT BUDGET
        if (!$isMoFundedTicket) {
            // ✅ 1. GET WEEKLY REMAINING BUDGET
            $weeklyRemaining = $this->getWeeklyRemainingBudget($chargeDepartmentId);
            
            // ✅ 2. GET ANNUAL REMAINING BUDGET
            $annualRemaining = $this->budgetService->getRemainingBudget($chargeDepartmentId);

            // ✅ 3. CHECK WEEKLY BUDGET FIRST (Primary Check)
            if ($weeklyRemaining < $amountToRelease && !$isCrossDepartment) {
                $shortage = $amountToRelease - $weeklyRemaining;

                return response()->json([
                    'success' => false,
                    'message' => "⚠️ Insufficient Weekly Budget!\n\n" .
                                "Requested: ₱" . number_format($amountToRelease, 2) . "\n" .
                                "Weekly Remaining: ₱" . number_format($weeklyRemaining, 2) . "\n" .
                                "Shortage: ₱" . number_format($shortage, 2) . "\n\n" .
                                "💡 Suggestions:\n" .
                                "• Reduce the amount to ₱" . number_format($weeklyRemaining, 2) . "\n" .
                                "• Mark as cross-department usage (for recording only)\n" .
                                "• Wait for next week's allocation",
                    'budget_info' => [
                        'weekly_remaining' => (float) $weeklyRemaining,
                        'requested' => $amountToRelease,
                        'shortage' => $shortage,
                        'annual_remaining' => (float) $annualRemaining,
                        'department_id' => $chargeDepartmentId,
                        'department_name' => $chargeDepartment->department_name,
                    ],
                    'suggestions' => [
                        'reduce_amount' => "Reduce the amount to ₱" . number_format($weeklyRemaining, 2),
                        'mark_cross_department' => 'Or mark as cross-department usage (for recording only)',
                        'wait_next_week' => 'Wait for next week\'s allocation',
                    ]
                ], 422);
            }

            // ✅ 4. CHECK ANNUAL BUDGET (Secondary Check)
            if ($annualRemaining < $amountToRelease && !$isCrossDepartment) {
                $shortage = $amountToRelease - $annualRemaining;

                return response()->json([
                    'success' => false,
                    'message' => "⚠️ Insufficient Annual Budget!\n\n" .
                                "Requested: ₱" . number_format($amountToRelease, 2) . "\n" .
                                "Annual Remaining: ₱" . number_format($annualRemaining, 2) . "\n" .
                                "Shortage: ₱" . number_format($shortage, 2) . "\n\n" .
                                "💡 Suggestions:\n" .
                                "• Add more budget to annual allocation\n" .
                                "• Reduce the amount to ₱" . number_format($annualRemaining, 2),
                    'budget_info' => [
                        'annual_remaining' => (float) $annualRemaining,
                        'requested' => $amountToRelease,
                        'shortage' => $shortage,
                        'weekly_remaining' => (float) $weeklyRemaining,
                        'department_id' => $chargeDepartmentId,
                        'department_name' => $chargeDepartment->department_name,
                    ],
                    'suggestions' => [
                        'add_budget' => 'Add more budget to annual allocation',
                        'reduce_amount' => "Reduce the amount to ₱" . number_format($annualRemaining, 2),
                    ]
                ], 422);
            }

            // ✅ 5. PROCEED WITH DEDUCTION (Both checks passed)
            $annualBudget = AnnualBudget::where('department_id', $chargeDepartmentId)
                ->where('fiscal_year', Carbon::now()->year)
                ->first();
            $budgetBefore = $annualBudget ? (float) $annualBudget->annual_amount : 0;

            // ✅ FIX: REMOVE duplicate weekly deduction
            // Ang BudgetService::deductBudget() naay recordWeeklyUsage() sa sulod
            // So isa ra ka deduction ang kailangan - gikan sa BudgetService
            // $this->deductWeeklyBudget($chargeDepartmentId, $amountToRelease); // ← REMOVE THIS LINE

            // ✅ Deduct from annual budget (this also handles weekly usage)
            $deductionResult = $this->budgetService->deductBudget(
                $chargeDepartmentId,
                $amountToRelease,
                $isCrossDepartment,
                $isCrossDepartment ? $ticket->department_id : null,
                $crossDepartmentReason
            );

            $annualBudget = AnnualBudget::where('department_id', $chargeDepartmentId)
                ->where('fiscal_year', Carbon::now()->year)
                ->first();
            $budgetAfter = $annualBudget ? (float) $annualBudget->annual_amount : 0;

            $periodId = $this->getOrCreatePeriodId($chargeDepartmentId);
        }

        DB::beginTransaction();

        // ✅ Create gas slip
        $gasSlipData = [
            'trip_ticket_id' => $id,
            'created_by' => $user->user_id,
            'amount_released' => $amountToRelease,
            'reconciliation_status' => 'pending',
            'is_cross_department' => $isCrossDepartment,
            'original_department_id' => $isCrossDepartment ? $ticket->department_id : null,
            'cross_department_reason' => $crossDepartmentReason,
            'period_id' => $periodId ?? $this->getOrCreatePeriodId($chargeDepartmentId),
            'budget_before' => $budgetBefore,
            'budget_after' => $budgetAfter,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        $gasSlip = GasSlip::create($gasSlipData);

        // ✅ Log cross-department usage if applicable
        if ($isCrossDepartment) {
            CrossDepartmentUsage::create([
                'from_department_id' => $ticket->department_id,
                'to_department_id' => $chargeDepartmentId,
                'gas_slip_id' => $gasSlip->gas_slip_id,
                'amount' => $amountToRelease,
                'reason' => $crossDepartmentReason,
                'created_at' => now(),
            ]);
        }

        // ✅ Update ticket
        $ticket->has_insufficient_budget = false;
        $ticket->status = TripTicket::STATUS_FUNDS_ISSUED;
        if ($chargeDepartmentId != $ticket->department_id) {
            $ticket->charge_to_department_id = $chargeDepartmentId;
        }
        $ticket->save();

        DB::commit();

        // ✅ Get updated remaining budgets
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
                'gas_slip_id' => $gasSlip->gas_slip_id,
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
        Log::error('Approve ticket error: ' . $e->getMessage());
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
                    'budget_before' => $ticket->gasSlip->budget_before,
                    'budget_after' => $ticket->gasSlip->budget_after,
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

    // ============ BUDGET ASSISTANCE METHODS ============

    /**
     * Get all pending budget assistance requests
     */
    public function getBudgetAssistanceRequests(Request $request)
    {
        // ... (keep existing code) ...
    }

    /**
     * Get single budget assistance request details
     */
    public function getBudgetAssistanceRequest($requestId)
    {
        // ... (keep existing code) ...
    }

    /**
     * Create MO-funded trip ticket from a budget assistance request
     */
    public function createMoFundedTicket(Request $request)
    {
        // ... (keep existing code) ...
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
                'fr.receipt_photo_path',
                'fr.receipt_uploaded_at as uploaded_at',
                'fr.gps_distance_km',
                'gs.reconciliation_status as status',
                'tt.trip_date',
                'v.fuel_type'
            )
            ->where(function ($query) {
                $query->where('fr.liters_availed', '>', 0)
                      ->orWhere('fr.amount_on_receipt', '>', 0);
            })
            ->orderBy('fr.created_at', 'desc')
            ->get()
            ->map(function ($receipt) {
                if ($receipt->receipt_photo_path) {
                    // ✅ Get just the filename
                    $filename = basename($receipt->receipt_photo_path);
                    
                    // ✅ Use public/receipts path directly (no storage)
                    $receipt->receipt_url = asset('receipts/' . $filename);
                    
                    // ✅ Log for debugging
                    \Log::info('Receipt URL (public):', [
                        'path' => $receipt->receipt_photo_path,
                        'filename' => $filename,
                        'url' => $receipt->receipt_url,
                    ]);
                } else {
                    $receipt->receipt_url = null;
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

    private function notifyDriverOfMOTrip($tripTicket, $amount, $chargeTo)
    {
        // ... (keep existing code) ...
    }

    private function notifyDepartmentOfMOTrip($tripTicket, $chargeTo, $moNote)
    {
        // ... (keep existing code) ...
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

    private function sendRejectionNotification($ticket, $reason)
    {
        // ... (keep existing code) ...
    }

    public function removeMORequest($requestId)
    {
        // ... (keep existing code) ...
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

}
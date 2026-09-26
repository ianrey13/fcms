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

        $annualBudgetSummary = $this->getAnnualBudgetSummary();

        $stats = [
            // ✅ NEW — active fiscal year for the frontend
            'active_fiscal_year' => $this->budgetService->getActiveFiscalYear(),

            'pending_fund_release' => TripTicket::where('status', 'pending_mayors_office')->count(),
            'funds_issued' => TripTicket::where('status', TripTicket::STATUS_FUNDS_ISSUED)->count(),
            'total_amount_released' => GasSlip::sum('amount_released'),
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
        $year = $this->budgetService->getActiveFiscalYear();

        $budgets = AnnualBudget::where('fiscal_year', $year)
            ->where('status', 'active')
            ->get();

        $totalAllocated = $budgets->sum('annual_amount');
        $totalUsed = $budgets->sum('used_amount');

        return [
            'total_allocated' => $totalAllocated,
            'total_used' => $totalUsed,
            'total_remaining' => $totalAllocated - $totalUsed,
            'fiscal_year' => $year,
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
        $year = $this->budgetService->getActiveFiscalYear();

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

        // ✅ Active fiscal year — used for FY-scoped counts
        $activeYear = $this->budgetService->getActiveFiscalYear();

        // ── 1. FY-scoped query ─────────────────────────────────
        $fyTickets = TripTicket::with(['vehicle', 'department', 'driver.user', 'gasSlip.fuelReceipt'])
            ->where('status', 'pending_mayors_office')
            ->whereYear('trip_date', $activeYear)
            ->orderBy('submitted_at', 'asc')
            ->get();

        // ── 2. All-time count (lightweight) ────────────────────
        $allTimeCount = TripTicket::where('status', 'pending_mayors_office')->count();

        // ── 3. Map FY-scoped tickets ───────────────────────────
        $tickets = $fyTickets->map(function ($ticket) {
            $fuelReceipt = $ticket->gasSlip?->fuelReceipt;

            $remainingBudget = $this->budgetService->getRemainingBudget($ticket->department_id);

            $annualAmount = (float) $this->budgetService->getAnnualAmount($ticket->department_id);
            $weeklySuggested = $annualAmount > 0 ? round($annualAmount / 52, 2) : 0;

            $weeklyUsed = $this->getWeeklyUsedAmount($ticket->department_id);

            $weeklyRemaining = max(0, $weeklySuggested - $weeklyUsed);
            $weeklyExceeded = $weeklySuggested > 0 && $weeklyUsed > $weeklySuggested;

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
                'estimated_cost' => $ticket->estimated_fuel_liters
                    ? ($ticket->estimated_fuel_liters * 88)
                    : null,
                'department_id' => $ticket->department_id,
                'remaining_budget' => $remainingBudget,
                'weekly_suggested' => $weeklySuggested,
                'weekly_used' => $weeklyUsed,
                'weekly_remaining' => $weeklyRemaining,
                'weekly_exceeded' => $weeklyExceeded,
                'weekly_ceiling' => $weeklySuggested,
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
            'data' => $tickets,
            // ✅ NEW — meta for stat cards
            'meta' => [
                'fiscal_year'     => $activeYear,
                'fy_count'        => $tickets->count(),
                'all_time_count'  => $allTimeCount,
            ],
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
     * ✅ Get weekly suggested — always annual / 52
     */
    private function getWeeklySuggested($departmentId): float
    {
        $annual = (float) $this->budgetService->getAnnualAmount($departmentId);
        return $annual > 0 ? round($annual / 52, 2) : 0.0;
    }

    /**
     * ✅ Get weekly used amount (tracked only) — FY-aware
     */
    private function getWeeklyUsedAmount($departmentId): float
    {
        // ✅ Active fiscal year — NOT calendar year
        $year = $this->budgetService->getActiveFiscalYear();
        // Week number still uses the calendar week (weeks don't reset per FY)
        $currentWeek = date('W');

        $weeklyUsage = DB::table('weekly_budget_usage')
            ->where('department_id', $departmentId)
            ->where('week_number', $currentWeek)
            ->where('year', $year)
            ->first();

        return $weeklyUsage ? (float) $weeklyUsage->amount_used : 0.0;
    }

    /**
     * ✅ Get weekly remaining budget for a department (informational)
     */
    private function getWeeklyRemainingBudget($departmentId): float
    {
        return max(0, $this->getWeeklySuggested($departmentId) - $this->getWeeklyUsedAmount($departmentId));
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

        // ✅ Active fiscal year
        $activeYear = $this->budgetService->getActiveFiscalYear();

        // ✅ Period IDs in the active FY
        $validPeriodIds = DeptBudgetPeriod::where('fiscal_year', $activeYear)
            ->pluck('period_id')
            ->toArray();

        // ── 1. FY-scoped query ─────────────────────────────────
        $fyTickets = TripTicket::with(['vehicle', 'department', 'gasSlip', 'driver', 'driver.user'])
            ->whereIn('status', ['funds_issued', 'acknowledged', 'pending_reconciliation', 'in_transit', 'closed'])
            ->where(function ($q) use ($validPeriodIds) {
                // Tickets with a gas slip tied to a period in the active FY
                $q->whereHas('gasSlip', function ($q2) use ($validPeriodIds) {
                    $q2->whereIn('period_id', $validPeriodIds);
                })
                // OR tickets that have no gas slip at all (MO-funded edge case)
                ->orWhereDoesntHave('gasSlip');
            })
            ->orderBy('submitted_at', 'desc')
            ->get();

        // ── 2. All-time count + sum (lightweight) ──────────────
        $allTimeCount = TripTicket::whereIn('status', ['funds_issued', 'acknowledged', 'pending_reconciliation', 'in_transit', 'closed'])
            ->count();

        $allTimeAmount = (float) GasSlip::sum('amount_released');

        // ── 3. Map FY-scoped tickets ───────────────────────────
        $tickets = $fyTickets->map(function ($ticket) {
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

        $fyAmount = (float) $tickets->sum('amount_released');

        return response()->json([
            'success' => true,
            'data' => $tickets,
            // ✅ NEW — meta for stat cards
            'meta' => [
                'fiscal_year'      => $activeYear,
                'fy_count'         => $tickets->count(),
                'fy_amount'        => round($fyAmount, 2),
                'all_time_count'   => $allTimeCount,
                'all_time_amount'  => round($allTimeAmount, 2),
            ],
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
        $validator = Validator::make($request->all(), [
            'amount_released' => 'required|numeric|min:0.01',
            'charge_to_department_id' => 'nullable|exists:departments,department_id',
            'is_cross_department' => 'nullable|boolean',
            'cross_department_reason' => 'nullable|string|max:255',
            'is_weekly_override' => 'nullable|boolean',
            'weekly_override_reason' => 'nullable|string|max:255',
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

        $amountToRelease = (float) $request->amount_released;
        $chargeDepartmentId = $request->charge_to_department_id ?? $ticket->department_id;
        $chargeDepartment = Department::find($chargeDepartmentId);

        if (!$chargeDepartment) {
            return response()->json([
                'success' => false,
                'message' => 'Charge-to department not found.',
            ], 422);
        }

        $isCrossDepartment = (bool) ($request->is_cross_department ?? false);
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

        // ✅ Active fiscal year (resolved once, used throughout)
        $activeYear = $this->budgetService->getActiveFiscalYear();

        $budgetBefore = 0;
        $budgetAfter = 0;
        $weeklyRemaining = 0;
        $annualRemaining = 0;

        $annualAmountForWeekly = (float) $this->budgetService->getAnnualAmount($chargeDepartmentId);
        $weeklySuggested = $annualAmountForWeekly > 0 ? round($annualAmountForWeekly / 52, 2) : 0;
        $weeklyUsedBefore = $this->getWeeklyUsedAmount($chargeDepartmentId);
        $weeklyRemaining = max(0, $weeklySuggested - $weeklyUsedBefore);

        $isWeeklyOverride = (bool) ($request->is_weekly_override ?? false)
            && $weeklySuggested > 0
            && $amountToRelease > $weeklyRemaining;

        $weeklyOverrideReason = $isWeeklyOverride
            ? ($request->weekly_override_reason ?: 'User confirmed weekly override on release dialog')
            : null;

        // ✅ Pre-flight annual check
        if (!$isMoFundedTicket) {
            $annualRemaining = (float) $this->budgetService->getRemainingBudget($chargeDepartmentId);

            if ($annualRemaining < $amountToRelease && !$isCrossDepartment) {
                $shortage = $amountToRelease - $annualRemaining;
                return response()->json([
                    'success' => false,
                    'message' => "⚠️ Insufficient Annual Budget!\n\n" .
                                "Requested: ₱" . number_format($amountToRelease, 2) . "\n" .
                                "Annual Remaining: ₱" . number_format($annualRemaining, 2) . "\n" .
                                "Shortage: ₱" . number_format($shortage, 2),
                    'budget_info' => [
                        'annual_remaining' => $annualRemaining,
                        'requested' => $amountToRelease,
                        'shortage' => $shortage,
                    ]
                ], 422);
            }
        }

        DB::beginTransaction();

        try {
            $periodId = null;

            if (!$isMoFundedTicket) {
                // ✅ Capture used_amount BEFORE — FY-aware
                $annualBudget = AnnualBudget::where('department_id', $chargeDepartmentId)
                    ->where('fiscal_year', $activeYear)
                    ->first();
                $budgetBefore = $annualBudget ? (float) $annualBudget->used_amount : 0;

                // Deduct annual
                $this->budgetService->deductBudget(
                    $chargeDepartmentId,
                    $amountToRelease,
                    $isCrossDepartment,
                    $isCrossDepartment ? $ticket->department_id : null,
                    $crossDepartmentReason
                );

                // ✅ Capture used_amount AFTER — FY-aware
                $annualBudget = AnnualBudget::where('department_id', $chargeDepartmentId)
                    ->where('fiscal_year', $activeYear)
                    ->first();
                $budgetAfter = $annualBudget ? (float) $annualBudget->used_amount : 0;

                $periodId = $this->getOrCreatePeriodId($chargeDepartmentId);
            }

            // Insert gas slip
            $gasSlipData = [
                 'control_number' => $ticket->trip_ticket_number, 
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
                $record = DB::table('gas_slip')
                    ->where('trip_ticket_id', $id)
                    ->orderBy('gas_slip_id', 'desc')
                    ->first();

                if ($record) {
                    $gasSlipId = $record->gas_slip_id;
                }
            }

            if ($gasSlipId == 0) {
                Log::error('❌ GasSlip creation failed', $gasSlipData);
                throw new \Exception('GasSlip creation failed - no ID returned');
            }

            Log::info('✅ GasSlip created - ID: ' . $gasSlipId . ' for trip: ' . $id);

            if ($isCrossDepartment) {
                DB::table('cross_department_usage')->insert([
                    'from_department_id' => $ticket->department_id,
                    'to_department_id' => $chargeDepartmentId,
                    'gas_slip_id' => $gasSlipId,
                    'amount' => $amountToRelease,
                    'reason' => $crossDepartmentReason,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                Log::info('✅ CrossDepartmentUsage created for gas_slip_id: ' . $gasSlipId);
            }

            $ticket->has_insufficient_budget = false;
            $ticket->status = TripTicket::STATUS_FUNDS_ISSUED;

            if ($isCrossDepartment && $chargeDepartment) {
                $ticket->charge_to = $chargeDepartment->department_code ?? $ticket->charge_to;
            }
            $ticket->save();

            if ($isWeeklyOverride) {
                DB::table('audit_log')->insert([
                    'user_id' => $user->user_id,
                    'action' => 'weekly_override',
                    'table_name' => 'gas_slip',
                    'record_id' => $gasSlipId,
                    'old_values' => json_encode([
                        'weekly_suggested' => $weeklySuggested,
                        'weekly_remaining' => $weeklyRemaining,
                        'weekly_used_before' => $weeklyUsedBefore,
                    ]),
                    'new_values' => json_encode([
                        'amount_released' => $amountToRelease,
                        'weekly_used_after' => $weeklyUsedBefore + $amountToRelease,
                        'over_by' => round($amountToRelease - $weeklyRemaining, 2),
                        'reason' => $weeklyOverrideReason,
                    ]),
                    'ip_address' => $request->ip(),
                    'created_at' => now(),
                ]);

                Log::warning('⚠️ Weekly suggested exceeded — user confirmed override', [
                    'trip_ticket_id' => $id,
                    'amount' => $amountToRelease,
                    'weekly_suggested' => $weeklySuggested,
                    'weekly_remaining' => $weeklyRemaining,
                ]);
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('❌ Approve ticket error (rolled back): ' . $e->getMessage());
            Log::error($e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Failed to release funds: ' . $e->getMessage()
            ], 500);
        }

        // POST-COMMIT
        $weeklyUsedAfter = $this->getWeeklyUsedAmount($chargeDepartmentId);
        $newWeeklyRemaining = max(0, $weeklySuggested - $weeklyUsedAfter);
        $newAnnualRemaining = (float) $this->budgetService->getRemainingBudget($chargeDepartmentId);
        $usedAmount = (float) $this->budgetService->getUsedAmount($chargeDepartmentId);

        $fundingSource = $isMoFundedTicket
            ? 'MO Funded'
            : ($isCrossDepartment
                ? "Cross-Department: {$chargeDepartment->department_name}"
                : "Charged to: {$chargeDepartment->department_name}");

        try {
            $this->sendFundIssuedNotification($ticket, $amountToRelease, $fundingSource, $isCrossDepartment);
        } catch (\Exception $e) {
            Log::error('⚠️ Fund issued notification failed: ' . $e->getMessage());
        }

        $responseMessage = $isMoFundedTicket
            ? "✅ Funds released successfully (MO Funded - No department budget deduction)"
            : ($isCrossDepartment
                ? "✅ Funds released successfully (Cross-Department Usage - For recording only)"
                : "✅ Funds released successfully from {$chargeDepartment->department_name} budget\n" .
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
                'annual_remaining_before' => $annualRemaining,
                'annual_remaining_after' => $newAnnualRemaining,
                'total_used' => $usedAmount,

                'weekly_suggested' => $weeklySuggested,
                'weekly_used_before' => $weeklyUsedBefore,
                'weekly_used_after' => $weeklyUsedAfter,
                'weekly_remaining_before' => $weeklyRemaining,
                'weekly_remaining_after' => $newWeeklyRemaining,
                'weekly_override' => $isWeeklyOverride,
                'weekly_override_reason' => $weeklyOverrideReason,
                'fiscal_year' => $activeYear,     // ✅ NEW — tell the frontend which FY was affected
            ]
        ]);
    }

    /**
     * ✅ Deduct from weekly budget (legacy — kept for backward compat)
     */
    private function deductWeeklyBudget($departmentId, $amount)
    {
        $currentWeek = date('W');
        $year = $this->budgetService->getActiveFiscalYear();

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
            $policy = DeptBudgetPolicy::where('department_id', $departmentId)
                ->where('fiscal_year', $year)
                ->first();

            if (!$policy) {
                $policy = DeptBudgetPolicy::where('department_id', $departmentId)->first();
            }

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
     * ✅ Create a new budget period for a department — FY-aware
     */
    private function createBudgetPeriod($departmentId)
    {
        $activeYear = $this->budgetService->getActiveFiscalYear();

        $policy = DeptBudgetPolicy::where('department_id', $departmentId)
            ->where('fiscal_year', $activeYear)
            ->first();

        if (!$policy) {
            $policy = DeptBudgetPolicy::where('department_id', $departmentId)->first();
        }

        $allocatedAmount = $policy ? $policy->default_weekly_allocation : 1000;
        $weekStart = Carbon::now()->startOfWeek()->toDateString();

        $period = DeptBudgetPeriod::create([
            'department_id'     => $departmentId,
            'fiscal_year'       => $activeYear,   // ✅ NEW
            'week_start'        => $weekStart,
            'allocated_amount'  => $allocatedAmount,
            'remaining_balance' => $allocatedAmount,
            'status'            => 'active',
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        Log::info('Created new budget period', [
            'department_id' => $departmentId,
            'period_id'     => $period->period_id,
            'fiscal_year'   => $activeYear,
            'allocated_amount' => $allocatedAmount,
        ]);

        return $period;
    }

    /**
     * Get default period ID for a department (backward compatibility)
     */
    private function getDefaultPeriodId($departmentId)
    {
        $activeYear = $this->budgetService->getActiveFiscalYear();

        $period = DeptBudgetPeriod::where('department_id', $departmentId)
            ->where('fiscal_year', $activeYear)
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
                    'department' => $ticket->department ? [
                        'department_id' => $ticket->department->department_id,
                        'name' => $ticket->department->department_name,
                        'department_name' => $ticket->department->department_name,
                        'code' => $ticket->department->department_code,
                        'department_code' => $ticket->department->department_code,
                        'head_of_office' => $ticket->department->head_of_office ?? null,
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

            $year = $this->budgetService->getActiveFiscalYear();

            $budgets = AnnualBudget::with('department')
                ->where('fiscal_year', $year)
                ->where('status', 'active')
                ->get();

            $budgetData = $budgets->map(function ($budget) use ($year) {
                $weeklyUsage = WeeklyBudgetUsage::where('department_id', $budget->department_id)
                    ->where('year', $year)
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
                ->where('fr.verification_status', 'pending')
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

            if ($request->has('invoice_number')) {
                $fuelReceipt->invoice_number = $request->invoice_number;
            }

            $fuelReceipt->amount_on_receipt = $request->amount_on_receipt;

            if ($request->filled('liters_availed')) {
                $fuelReceipt->liters_availed = $request->liters_availed;
            }
            if ($request->filled('unit_price')) {
                $fuelReceipt->unit_price = $request->unit_price;
            }

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

            $gasSlip->reconciliation_status = 'verified';
            $gasSlip->reconciled_by         = $user->user_id;
            $gasSlip->reconciled_at         = now();
            $gasSlip->save();

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
        $year = $this->budgetService->getActiveFiscalYear();

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

            $year = $this->budgetService->getActiveFiscalYear();

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

            $year = $this->budgetService->getActiveFiscalYear();

            $departments = Department::select('department_id', 'department_name', 'department_code')
                ->orderBy('department_name')
                ->get();

            $departmentsWithBudget = $departments->map(function ($department) use ($year) {
                $budget = AnnualBudget::where('department_id', $department->department_id)
                    ->where('fiscal_year', $year)
                    ->first();

                $currentWeek = WeeklyBudgetUsage::where('department_id', $department->department_id)
                    ->where('week_number', date('W'))
                    ->where('year', $year)
                    ->first();

                $annualAmount = $budget ? (float) $budget->annual_amount : 0;
                $weeklySuggested = $annualAmount > 0 ? round($annualAmount / 52, 2) : 0;
                $weeklyUsed = $currentWeek ? (float) $currentWeek->amount_used : 0;
                $weeklyRemaining = $weeklySuggested - $weeklyUsed;
                $weeklyExceeded = $weeklySuggested > 0 && $weeklyUsed > $weeklySuggested;

                if ($budget) {
                    return [
                        'department_id' => $department->department_id,
                        'department_name' => $department->department_name,
                        'department_code' => $department->department_code,

                        'annual_amount' => $annualAmount,
                        'allocated_amount' => $annualAmount,
                        'used_amount' => (float) $budget->used_amount,
                        'spent_amount' => (float) $budget->used_amount,
                        'remaining_amount' => (float) $budget->remaining_amount,

                        'weekly_suggested' => $weeklySuggested,
                        'weekly_used' => $weeklyUsed,
                        'weekly_remaining' => $weeklyRemaining,
                        'weekly_exceeded' => $weeklyExceeded,
                        'weekly_allocation' => $weeklySuggested,
                        'weekly_ceiling' => $weeklySuggested,

                        'has_budget' => true,
                        'budget_type' => 'annual',
                        'fiscal_year' => $year,                     // ✅ active FY
                        'budget_fiscal_year' => $budget->fiscal_year, // ✅ row's actual FY
                        'utilization_percentage' => $budget->utilization_percentage,
                        'utilization' => $budget->utilization_percentage,
                        'status' => $budget->status,
                        'allocated' => $annualAmount,
                        'spent' => (float) $budget->used_amount,
                    ];
                }

                return [
                    'department_id' => $department->department_id,
                    'department_name' => $department->department_name,
                    'department_code' => $department->department_code,

                    'annual_amount' => 0,
                    'allocated_amount' => 0,
                    'used_amount' => 0,
                    'spent_amount' => 0,
                    'remaining_amount' => 0,

                    'weekly_suggested' => 0,
                    'weekly_used' => 0,
                    'weekly_remaining' => 0,
                    'weekly_exceeded' => false,
                    'weekly_allocation' => 0,
                    'weekly_ceiling' => 0,

                    'has_budget' => false,
                    'budget_type' => 'annual',
                    'fiscal_year' => $year,
                    'budget_fiscal_year' => null,
                    'utilization_percentage' => 0,
                    'utilization' => 0,
                    'status' => 'inactive',
                    'allocated' => 0,
                    'spent' => 0,
                ];
            });

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
                    'fiscal_year' => $year,   // ✅ NEW
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

    /**
     * ✅ Get or create active budget period for a department — FY-aware
     */
    private function getOrCreatePeriodId($departmentId)
{
    $activeYear = $this->budgetService->getActiveFiscalYear();
    $weekStart  = Carbon::now()->startOfWeek(Carbon::MONDAY)->toDateString();

    // 1. Try exact match: same dept, same FY, same week
    $period = DeptBudgetPeriod::where('department_id', $departmentId)
        ->where('fiscal_year', $activeYear)
        ->whereDate('week_start', $weekStart)
        ->where('status', 'active')
        ->first();

    if ($period) {
        return $period->period_id;
    }

    // 2. Reuse existing row for this (dept, week) if one exists — just update fiscal_year.
    //    Handles the case where a legacy row has fiscal_year = NULL or an old year.
    $existing = DeptBudgetPeriod::where('department_id', $departmentId)
        ->whereDate('week_start', $weekStart)
        ->first();

    if ($existing) {
        $existing->fiscal_year = $activeYear;
        if ($existing->status !== 'active') {
            $existing->status = 'active';
        }
        $existing->save();
        return $existing->period_id;
    }

    // 3. Otherwise create a fresh row
    $period = $this->createBudgetPeriod($departmentId);
    return $period->period_id;
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
                Log::info('📡 MO Broadcasted TripTicketCancelled for trip: ' . $ticket->trip_ticket_number);
            } catch (\Exception $e) {
                Log::error('Failed to broadcast cancellation: ' . $e->getMessage());
            }

            if ($ticket->submitted_by) {
                NotificationHelper::send(
                    $ticket->submitted_by,
                    'trip_cancelled',
                    'trip_ticket',
                    $ticket->trip_ticket_id,
                    "Trip {$ticket->trip_ticket_number} has been cancelled by Mayor's Office: {$request->reason}"
                );
            }

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
                    'gs.amount_released',
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



    /**
 * Weekly budget tracking — dedicated endpoint

 */
public function getWeeklyTracking(Request $request)
{
    try {
        $user = $request->user();
        if (!$user->isMayorsOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // ✅ Resolve fiscal year
        $activeFy = \App\Models\FiscalYear::where('is_active', true)->first();
        $fiscalYear = (int) $request->get('fiscal_year', $activeFy?->year ?? date('Y'));

        // ✅ Resolve target week
        $weekStart = $request->get('week_start');
        if (!$weekStart) {
            // Default to the current week's Monday
            $weekStart = Carbon::now()->startOfWeek(Carbon::MONDAY)->toDateString();
        }
        $weekStartDate = Carbon::parse($weekStart)->startOfWeek(Carbon::MONDAY)->toDateString();
        $weekEndDate   = Carbon::parse($weekStart)->endOfWeek(Carbon::SUNDAY)->toDateString();

        // ✅ Fetch periods for that week + fiscal year, plus each dept's used amount
        $periods = DB::table('dept_budget_period as p')
            ->leftJoin('departments as d', 'p.department_id', '=', 'd.department_id')
            ->where(function ($q) use ($fiscalYear) {
                $q->where('p.fiscal_year', $fiscalYear)
                  ->orWhere(function ($q2) use ($fiscalYear) {
                      // Legacy rows without fiscal_year — fall back to week_start year
                      $q2->whereNull('p.fiscal_year')
                         ->whereYear('p.week_start', $fiscalYear);
                  });
            })
            ->whereDate('p.week_start', $weekStartDate)
            ->orderBy('d.department_name')
            ->select([
                'p.period_id',
                'p.department_id',
                'p.fiscal_year',
                'p.week_start',
                'p.week_end',
                'p.allocated_amount',
                'p.remaining_balance',
                'p.status',
                'd.department_name',
                'd.department_code',
                DB::raw("(
                    SELECT COALESCE(SUM(gs.amount_released), 0)
                    FROM gas_slip gs
                    WHERE gs.period_id = p.period_id
                ) AS actual_used"),
            ])
            ->get();

        // ✅ Compute per-row utilization + status
        $rows = $periods->map(function ($row) {
            $allocated = (float) $row->allocated_amount;
            $used      = (float) $row->actual_used;
            $remaining = $allocated - $used;
            $utilization = $allocated > 0 ? round(($used / $allocated) * 100, 2) : 0;

            $status = 'on_track';
            if ($allocated === 0.0) {
                $status = 'no_budget';
            } elseif ($used >= $allocated && $allocated > 0) {
                $status = 'exhausted';
            } elseif ($utilization >= 80) {
                $status = 'near_limit';
            } elseif ($utilization >= 50) {
                $status = 'moderate';
            }

            return [
                'period_id'        => $row->period_id,
                'department_id'    => $row->department_id,
                'department_name'  => $row->department_name ?? 'Unknown',
                'department_code'  => $row->department_code ?? 'N/A',
                'fiscal_year'      => $row->fiscal_year,
                'week_start'       => $row->week_start,
                'week_end'         => $row->week_end,
                'allocated_amount' => round($allocated, 2),
                'actual_used'      => round($used, 2),
                'remaining_balance'=> round($remaining, 2),
                'utilization'      => $utilization,
                'status'           => $status,
            ];
        });

        // ✅ Totals
        $summary = [
            'fiscal_year'      => $fiscalYear,
            'week_start'       => $weekStartDate,
            'week_end'         => $weekEndDate,
            'week_number'      => (int) Carbon::parse($weekStartDate)->weekOfYear,
            'department_count' => $rows->count(),
            'total_allocated'  => round($rows->sum('allocated_amount'), 2),
            'total_used'       => round($rows->sum('actual_used'), 2),
            'total_remaining'  => round($rows->sum('remaining_balance'), 2),
        ];

        return response()->json([
            'success' => true,
            'data'    => $rows->values(),
            'summary' => $summary,
        ]);

    } catch (\Exception $e) {
        Log::error('Weekly tracking error: ' . $e->getMessage());
        Log::error($e->getTraceAsString());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch weekly tracking: ' . $e->getMessage(),
        ], 500);
    }
}

    // ============================================================
    //  GAS SLIP — MO-CREATED (placeholder trip ticket)
    // ============================================================

    /**
   
     */
    public function createGasSlip(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'control_number'   => 'required|string|max:30',
            'department_id'    => 'required|exists:departments,department_id',
            'driver_id'        => 'required|exists:drivers,driver_id',
            'vehicle_id'       => 'required|exists:vehicles,vehicle_id',
            'trip_date'        => 'required|date',
            'destination'      => 'required|string|max:255',
            'purpose'          => 'required|string',
            'charge_to'        => 'required|string|max:20',
            'passenger_name'   => 'nullable|string|max:120',
            'amount_released'  => 'required|numeric|min:0.01',
            'is_cross_department' => 'nullable|boolean',
            'cross_department_reason' => 'nullable|string|max:255',
            'charge_to_department_id' => 'nullable|exists:departments,department_id',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $user = $request->user();
        if (!$user->isMayorsOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // ✅ Collision check across both tables
        $collision = TripTicket::where('trip_ticket_number', $request->control_number)->exists()
            || GasSlip::where('control_number', $request->control_number)->exists();

        if ($collision) {
            return response()->json([
                'success' => false,
                'message' => "Control number {$request->control_number} already exists.",
            ], 422);
        }

        $activeYear = $this->budgetService->getActiveFiscalYear();
        $amountToRelease = (float) $request->amount_released;
        $chargeDepartmentId = $request->charge_to_department_id ?? $request->department_id;
        $chargeDepartment = Department::find($chargeDepartmentId);

        if (!$chargeDepartment) {
            return response()->json([
                'success' => false,
                'message' => 'Charge-to department not found.',
            ], 422);
        }

        $isCrossDepartment = (bool) ($request->is_cross_department ?? false);
        $crossDepartmentReason = $request->cross_department_reason ?? null;

        if ($isCrossDepartment && $chargeDepartmentId == $request->department_id) {
            return response()->json([
                'success' => false,
                'message' => '❌ Cross-Department selected but same department chosen.',
            ], 422);
        }

        if ($isCrossDepartment && empty($crossDepartmentReason)) {
            return response()->json([
                'success' => false,
                'message' => '❌ Please provide a reason for cross-department usage.',
            ], 422);
        }

        // Pre-flight budget check (non-cross-department only)
        if (!$isCrossDepartment) {
            $annualRemaining = (float) $this->budgetService->getRemainingBudget($chargeDepartmentId);
            if ($annualRemaining < $amountToRelease) {
                $shortage = $amountToRelease - $annualRemaining;
                return response()->json([
                    'success' => false,
                    'message' => "⚠️ Insufficient Annual Budget!\n\n" .
                                 "Requested: ₱" . number_format($amountToRelease, 2) . "\n" .
                                 "Annual Remaining: ₱" . number_format($annualRemaining, 2) . "\n" .
                                 "Shortage: ₱" . number_format($shortage, 2),
                    'budget_info' => [
                        'annual_remaining' => $annualRemaining,
                        'requested'        => $amountToRelease,
                        'shortage'         => $shortage,
                    ],
                ], 422);
            }
        }

        DB::beginTransaction();

        try {
            // ✅ 1. Create placeholder Trip Ticket
            $tripTicket = TripTicket::create([
                'trip_ticket_number'    => $request->control_number,
                'source'                => 'mo_gas_slip',
                'department_id'         => $request->department_id,
                'driver_id'             => $request->driver_id,
                'vehicle_id'            => $request->vehicle_id,
                'submitted_by'          => $user->user_id,
                'created_by_mo_user_id' => $user->user_id,
                'submitted_by_staff'    => false,
                'submitted_at'          => now(),
                'trip_date'             => $request->trip_date,
                'purpose'               => $request->purpose,
                'destination'           => $request->destination,
                'charge_to'             => $request->charge_to,
                'passenger_name'        => $request->passenger_name ?? null,
                'status' => TripTicket::STATUS_FUNDS_ISSUED,
                'original_department_id' => $request->department_id,
                'updated_at'            => now(),
            ]);

            // ✅ 2. Deduct budget
            $budgetBefore = 0;
            $budgetAfter = 0;
            $periodId = null;

            if (!$isCrossDepartment) {
                $annualBudget = AnnualBudget::where('department_id', $chargeDepartmentId)
                    ->where('fiscal_year', $activeYear)
                    ->first();
                $budgetBefore = $annualBudget ? (float) $annualBudget->used_amount : 0;

                $this->budgetService->deductBudget(
                    $chargeDepartmentId,
                    $amountToRelease,
                    false,
                    null,
                    null
                );

                $annualBudget = AnnualBudget::where('department_id', $chargeDepartmentId)
                    ->where('fiscal_year', $activeYear)
                    ->first();
                $budgetAfter = $annualBudget ? (float) $annualBudget->used_amount : 0;

                $periodId = $this->getOrCreatePeriodId($chargeDepartmentId);
            } else {
                $periodId = $this->getOrCreatePeriodId($chargeDepartmentId);
            }

            // ✅ 3. Create Gas Slip
            $gasSlip = GasSlip::create([
                'control_number'          => $request->control_number,
                'trip_ticket_id'          => $tripTicket->trip_ticket_id,
                'created_by'              => $user->user_id,
                'amount_released'         => $amountToRelease,
                'reconciliation_status'   => 'pending',
                'is_cross_department'     => $isCrossDepartment ? 1 : 0,
                'original_department_id'  => $isCrossDepartment ? $request->department_id : null,
                'cross_department_reason' => $crossDepartmentReason,
                'period_id'               => $periodId,
                'budget_before'           => $budgetBefore,
                'budget_after'            => $budgetAfter,
                'created_at'              => now(),
                'updated_at'              => now(),
            ]);

            // ✅ 4. Cross-department usage record
            if ($isCrossDepartment) {
                DB::table('cross_department_usage')->insert([
                    'from_department_id' => $request->department_id,
                    'to_department_id'   => $chargeDepartmentId,
                    'gas_slip_id'        => $gasSlip->gas_slip_id,
                    'amount'             => $amountToRelease,
                    'reason'             => $crossDepartmentReason,
                    'created_at'         => now(),
                    'updated_at'         => now(),
                ]);
            }

            // ✅ 5. Vehicle snapshot
            $vehicle = Vehicle::find($request->vehicle_id);
            if ($vehicle) {
                TripTicketVehicleSnapshot::create([
                    'trip_ticket_id'    => $tripTicket->trip_ticket_id,
                    'vehicle_status'    => $vehicle->status,
                    'fuel_type'         => is_string($vehicle->fuel_type) ? $vehicle->fuel_type : 'gasoline',
                    'snapshot_taken_at' => now(),
                ]);
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('❌ Create Gas Slip error: ' . $e->getMessage());
            Log::error($e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Failed to create Gas Slip: ' . $e->getMessage(),
            ], 500);
        }

        // ✅ Notify driver + GSO
        try {
            $driver = Driver::find($request->driver_id);
            if ($driver && $driver->user_id) {
                NotificationHelper::send(
                    $driver->user_id,
                    'gas_slip_created',
                    'gas_slip',
                    $gasSlip->gas_slip_id,
                    "Gas Slip {$gasSlip->control_number} issued: ₱" . number_format($amountToRelease, 2)
                );
            }

            $gsoStaff = User::where('role', 'gso_office')->where('status', 'active')->get();
            foreach ($gsoStaff as $gso) {
                NotificationHelper::send(
                    $gso->user_id,
                    'gas_slip_created',
                    'gas_slip',
                    $gasSlip->gas_slip_id,
                   "Trip Without Trip Ticket: Gas Slip {$gasSlip->control_number} issued — pending GSO Trip Ticket"
                );
            }
        } catch (\Exception $e) {
            Log::error('Gas Slip notifications failed: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Gas Slip created successfully',
            'data' => [
                'gas_slip_id'        => $gasSlip->gas_slip_id,
                'control_number'     => $gasSlip->control_number,
                'trip_ticket_id'     => $tripTicket->trip_ticket_id,
                'trip_ticket_number' => $tripTicket->trip_ticket_number,
                'amount_released'    => $amountToRelease,
                'fiscal_year'        => $activeYear,
                'status'             => $tripTicket->status,
            ],
        ]);
    }

    /**
     * List Gas Slips pending GSO completion.
     * GET /mayors-office/gas-slips/pending
     */
    public function getPendingGasSlips(Request $request)
    {
        $user = $request->user();
        if (!$user->isMayorsOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $gasSlips = GasSlip::with(['tripTicket.driver.user', 'tripTicket.vehicle', 'tripTicket.department', 'createdBy'])
            ->whereNotNull('control_number')
            ->whereHas('tripTicket', function ($q) {
                $q->where('status', TripTicket::STATUS_PENDING_GSO_TICKET);
            })
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($gs) {
                $tt = $gs->tripTicket;
                return [
                    'gas_slip_id'        => $gs->gas_slip_id,
                    'control_number'     => $gs->control_number,
                    'trip_ticket_id'     => $tt?->trip_ticket_id,
                    'trip_ticket_number' => $tt?->trip_ticket_number,
                    'amount_released'    => (float) $gs->amount_released,
                    'destination'        => $tt?->destination,
                    'purpose'            => $tt?->purpose,
                    'trip_date'          => $tt?->trip_date,
                    'driver_name'        => $tt?->driver?->user?->full_name,
                    'vehicle'            => $tt?->vehicle ? [
                        'plate_number'  => $tt->vehicle->plate_number,
                        'vehicle_model' => $tt->vehicle->vehicle_model,
                    ] : null,
                    'department_name'    => $tt?->department?->department_name,
                    'created_at'         => $gs->created_at,
                    'status'             => $tt?->status,
                ];
            });

        return response()->json([
            'success' => true,
            'data'    => $gasSlips,
        ]);
    }

    /**
     * MO cancels a Gas Slip (only before driver acknowledges).
     * POST /mayors-office/gas-slips/{id}/cancel
     */
    public function cancelGasSlip(Request $request, $id)
    {
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

        $gasSlip = GasSlip::find($id);
        if (!$gasSlip) {
            return response()->json(['success' => false, 'message' => 'Gas Slip not found'], 404);
        }

        if ($gasSlip->acknowledged_at) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot cancel — driver has already acknowledged funds.',
            ], 422);
        }

        DB::beginTransaction();
        try {
            if (!$gasSlip->is_cross_department && $gasSlip->amount_released > 0) {
                $chargeDeptId = $gasSlip->tripTicket?->department_id;
                if ($chargeDeptId) {
                    $activeYear = $this->budgetService->getActiveFiscalYear();
                    $annualBudget = AnnualBudget::where('department_id', $chargeDeptId)
                        ->where('fiscal_year', $activeYear)
                        ->first();
                    if ($annualBudget) {
                        $annualBudget->used_amount = max(
                            0,
                            (float) $annualBudget->used_amount - (float) $gasSlip->amount_released
                        );
                        $annualBudget->save();
                    }
                }
            }

            $tt = $gasSlip->tripTicket;
            if ($tt) {
                $tt->status = TripTicket::STATUS_CANCELLED;
                $tt->cancellation_reason = $request->reason;
                $tt->cancelled_at = now();
                $tt->cancelled_by = $user->user_id;
                $tt->save();
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Cancel Gas Slip error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }

        try {
            $driver = $gasSlip->tripTicket?->driver;
            if ($driver && $driver->user_id) {
                NotificationHelper::send(
                    $driver->user_id,
                    'trip_cancelled',
                    'gas_slip',
                    $gasSlip->gas_slip_id,
                    "Gas Slip {$gasSlip->control_number} cancelled: {$request->reason}"
                );
            }
        } catch (\Exception $e) {
            Log::error('Cancel notification failed: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Gas Slip cancelled successfully',
            'data' => [
                'gas_slip_id'    => $gasSlip->gas_slip_id,
                'control_number' => $gasSlip->control_number,
            ],
        ]);
    }


        // ============================================================
    // ✅ MO-SCOPED LOOKUPS (for Gas Slip form)
    // ============================================================

    /**
     * MO-scoped list of active drivers.
     * GET /mayors-office/drivers/active
     */
    public function getActiveDrivers(Request $request)
    {
        $user = $request->user();
        if (!$user->isMayorsOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $drivers = Driver::with('user')
            ->where('status', 'active')
            ->whereHas('user', fn($q) => $q->where('status', 'active'))
            ->get()
            ->map(function ($driver) {
                return [
                    'driver_id'     => $driver->driver_id,
                    'user_id'       => $driver->user_id,
                    'full_name'     => $driver->user?->full_name ?? 'Unknown',
                    'department_id' => $driver->user?->department_id,
                ];
            });

        return response()->json(['success' => true, 'data' => $drivers]);
    }

    /**
     * MO-scoped list of available vehicles.
     * GET /mayors-office/vehicles/available
     */
    public function getAvailableVehicles(Request $request)
    {
        $user = $request->user();
        if (!$user->isMayorsOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $departmentId = $request->get('department_id');

        $query = Vehicle::where('status', 'active')
            ->where('maintenance_flag', false);

        if ($departmentId) {
            $query->where('department_id', $departmentId);
        }

        $vehicles = $query->get()->map(fn($v) => [
            'vehicle_id'    => $v->vehicle_id,
            'plate_number'  => $v->plate_number,
            'vehicle_model' => $v->vehicle_model,
            'fuel_type'     => $v->fuel_type,
            'department_id' => $v->department_id,
        ]);

        return response()->json(['success' => true, 'data' => $vehicles]);
    }



        /**
     * Peek at the next control number without reserving it.
     * GET /mayors-office/gas-slips/next-control-number
     */
    public function getNextControlNumber(Request $request)
    {
        $user = $request->user();
        if (!$user->isMayorsOffice()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json([
            'success' => true,
            'data' => ['control_number' => $this->generateControlNumber()],
        ]);
    }

    /**
     * Generate the next available control number in YYYY-MM-NNN format.
     * Shared sequence across trip_ticket + gas_slip, scoped to current month.
     */
    private function generateControlNumber(): string
    {
        $prefix = date('Y-m');

        $lastTicketNum = TripTicket::where('trip_ticket_number', 'like', $prefix . '-%')
            ->orderBy('trip_ticket_id', 'desc')
            ->value('trip_ticket_number');

        $lastControlNum = GasSlip::where('control_number', 'like', $prefix . '-%')
            ->orderBy('gas_slip_id', 'desc')
            ->value('control_number');

        $lastSeq = 0;
        foreach ([$lastTicketNum, $lastControlNum] as $n) {
            if ($n && preg_match('/^' . preg_quote($prefix, '/') . '-(\d+)$/', $n, $m)) {
                $seq = (int) $m[1];
                if ($seq > $lastSeq) $lastSeq = $seq;
            }
        }

        return $prefix . '-' . str_pad($lastSeq + 1, 3, '0', STR_PAD_LEFT);
    }

}
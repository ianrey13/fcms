<?php

namespace App\Services;

use App\Models\AnnualBudget;
use App\Models\GasSlip;
use App\Models\WeeklyBudgetUsage;
use App\Models\CrossDepartmentUsage;
use App\Models\DeptBudgetPolicy;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BudgetService
{
    /**
     * Get or create annual budget for a department
     */
    public function getOrCreateAnnualBudget($departmentId, $year = null)
    {
$year = $year ?? $this->getActiveFiscalYear();
        $budget = AnnualBudget::where('department_id', $departmentId)
            ->where('fiscal_year', $year)
            ->first();

        if (!$budget) {
            // Create with default or use existing policy
            $annualAmount = $this->getDefaultAnnualBudget($departmentId);

            $budget = AnnualBudget::create([
                'department_id' => $departmentId,
                'fiscal_year' => $year,
                'annual_amount' => $annualAmount,
                'used_amount' => 0,
                'status' => 'active',
            ]);
        }

        return $budget;
    }

    /**
     * Get default annual budget for a department
     */
    private function getDefaultAnnualBudget($departmentId)
    {
        // You can set default values or get from existing weekly budget * 52
        $weeklyBudget = DB::table('dept_budget_policy')
            ->where('department_id', $departmentId)
            ->value('default_weekly_allocation');

        return $weeklyBudget ? $weeklyBudget * 52 : 100000; // Default ₱100,000 per year
    }

    /**
     * Get remaining budget for a department
     */
    public function getRemainingBudget($departmentId, $year = null)
    {
$year = $year ?? $this->getActiveFiscalYear();
        $budget = AnnualBudget::where('department_id', $departmentId)
            ->where('fiscal_year', $year)
            ->first();

        if (!$budget) {
            return 0;
        }

        return $budget->remaining_amount;
    }

    /**
     * Check if budget is sufficient
     */
    public function hasSufficientBudget($departmentId, $amount, $year = null)
    {
        $remaining = $this->getRemainingBudget($departmentId, $year);
        return $remaining >= $amount;
    }

    /**
     * Deduct from budget (when gas slip is created)
     *
     * ✅ NO transaction here — caller is responsible for wrapping this in a
     * DB::transaction() so that the whole fund-release flow is atomic.
     */
    public function deductBudget($departmentId, $amount, $isCrossDepartment = false, $originalDepartmentId = null, $reason = null)
    {
$year = $this->getActiveFiscalYear();
        $budget = AnnualBudget::where('department_id', $departmentId)
            ->where('fiscal_year', $year)
            ->first();

        if (!$budget) {
            throw new \Exception("No budget found for department ID: {$departmentId}");
        }

        // Check if sufficient budget
        if (!$this->hasSufficientBudget($departmentId, $amount, $year) && !$isCrossDepartment) {
            throw new \Exception("Insufficient budget for department ID: {$departmentId}");
        }

        // ✅ ALWAYS deduct from annual budget
        $budget->used_amount += $amount;
        $budget->save();

        // ✅ ALWAYS record weekly usage
        $this->recordWeeklyUsage($departmentId, $amount);

        return true;
    }

    /**
     * Log cross-department fuel usage
     */
    private function logCrossDepartmentUsage($fromDepartment, $toDepartment, $amount, $reason = null)
    {
        // Create cross-department usage record
        CrossDepartmentUsage::create([
            'from_department_id' => $fromDepartment,
            'to_department_id' => $toDepartment,
            'amount' => $amount,
            'reason' => $reason,
        ]);

        // Create notification
        $this->createCrossDepartmentNotification($fromDepartment, $toDepartment, $amount);
    }

    /**
     * Create notification for cross-department usage
     */
    private function createCrossDepartmentNotification($fromDepartment, $toDepartment, $amount)
    {
        $fromDept = \App\Models\Department::find($fromDepartment);
        $toDept = \App\Models\Department::find($toDepartment);

        $message = "⚠️ Cross-Department Fuel Usage\n\n";
        $message .= "{$fromDept->department_name} used fuel from {$toDept->department_name}'s budget.\n";
        $message .= "Amount: ₱" . number_format($amount, 2) . "\n";
        $message .= "This is for recording purposes only.\n";
        $message .= "No budget transfer was made.";

        // Send to GSO and Mayor's Office
        $gsoUsers = \App\Models\User::where('role', 'gso_office')->get();
        $mayorUsers = \App\Models\User::where('role', 'mayors_office')->get();

        foreach ($gsoUsers->merge($mayorUsers) as $user) {
            \App\Models\Notification::create([
                'recipient_user_id' => $user->user_id,
                'notification_type' => 'cross_department_usage',
                'entity_type' => 'budget',
                'entity_id' => 0,
                'message' => $message,
                'channel' => 'in_app',
                'created_at' => now(),
            ]);
        }
    }

    /**
     * ✅ Record weekly usage (with weekly allocation)
     *
     * Uses ->copy() so Carbon's startOfWeek()/endOfWeek() mutations don't
     * leak between the two calls.
     */
    private function recordWeeklyUsage($departmentId, $amount)
    {
        $year = $this->getActiveFiscalYear();
        $now = Carbon::now();
        $weekNumber = $now->weekOfYear;
        $year = $now->year;

        // ✅ Get weekly allocation from policy
        $policy = DeptBudgetPolicy::where('department_id', $departmentId)->first();
        $weeklyAllocation = $policy ? $policy->default_weekly_allocation : 0;

        // ✅ Compute week boundaries without mutating $now
        $weekStart = $now->copy()->startOfWeek()->toDateString();
        $weekEnd   = $now->copy()->endOfWeek()->toDateString();

        // ✅ Get or create weekly usage
        $usage = WeeklyBudgetUsage::firstOrCreate(
            [
                'department_id' => $departmentId,
                'week_number' => $weekNumber,
                'year' => $year,
            ],
            [
                'week_start' => $weekStart,
                'week_end' => $weekEnd,
                'weekly_allocation' => $weeklyAllocation,
                'amount_used' => 0,
            ]
        );

        // ✅ Update allocation if policy changed
        if ($usage->weekly_allocation != $weeklyAllocation && $weeklyAllocation > 0) {
            $usage->weekly_allocation = $weeklyAllocation;
        }

        // ✅ Add to amount used
        $usage->amount_used += $amount;
        $usage->save();

        Log::info('📝 Weekly usage recorded', [
            'department_id' => $departmentId,
            'week' => $weekNumber,
            'allocation' => $usage->weekly_allocation,
            'amount_added' => $amount,
            'total_used' => $usage->amount_used,
            'remaining' => $usage->weekly_allocation - $usage->amount_used,
            'utilization' => $usage->weekly_allocation > 0
                ? round(($usage->amount_used / $usage->weekly_allocation) * 100, 2)
                : 0,
        ]);
    }

    /**
     * Process weekly surplus - return to annual budget
     */
    public function processWeeklySurplus($departmentId, $weekNumber = null, $year = null)
    {
        $year = $year ?? Carbon::now()->year;
        $weekNumber = $weekNumber ?? Carbon::now()->weekOfYear;

        // Get weekly allocation and actual usage
        $weekly = DB::table('weekly_budget_usage')
            ->where('department_id', $departmentId)
            ->where('week_number', $weekNumber)
            ->where('year', $year)
            ->first();

        if (!$weekly) {
            return ['success' => false, 'message' => 'Weekly budget not found'];
        }

        $surplus = $weekly->weekly_allocation - $weekly->amount_used;

        if ($surplus <= 0) {
            return ['success' => true, 'surplus' => 0, 'action' => 'none', 'message' => 'No surplus to return'];
        }

        DB::beginTransaction();

        try {
            // ✅ 1. Ibalik ang sobra sa annual budget
            DB::table('annual_budgets')
                ->where('department_id', $departmentId)
                ->where('fiscal_year', $year)
                ->increment('annual_amount', $surplus);

            // ✅ 2. Log sa surplus table
            DB::table('weekly_budget_surplus')->insert([
                'department_id' => $departmentId,
                'week_number' => $weekNumber,
                'year' => $year,
                'allocated_amount' => $weekly->weekly_allocation,
                'actual_used' => $weekly->amount_used,
                'action' => 'returned_to_annual',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // ✅ 3. Log to budget history
            $department = DB::table('departments')
                ->where('department_id', $departmentId)
                ->first();

            DB::table('budget_history')->insert([
                'department_id' => $departmentId,
                'department_name' => $department->department_name ?? 'Unknown',
                'action' => 'surplus_returned',
                'previous_amount' => 0,
                'added_amount' => $surplus,
                'new_amount' => $surplus,
                'reason' => "Week {$weekNumber} surplus returned to annual budget (₱" . number_format($surplus, 2) . ")",
                'user_id' => auth()->id() ?? 1,
                'user_name' => auth()->user()->full_name ?? 'System',
                'created_at' => now(),
            ]);

            DB::commit();

            return [
                'success' => true,
                'surplus' => $surplus,
                'action' => 'returned_to_annual',
                'message' => "✅ ₱" . number_format($surplus, 2) . " surplus returned to annual budget"
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Process surplus error: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Failed to process surplus: ' . $e->getMessage()];
        }
    }

    /**
     * Process all departments weekly surplus (run every Monday)
     */
    public function processAllWeeklySurplus()
    {
        $year = Carbon::now()->year;
        $weekNumber = Carbon::now()->subWeek()->weekOfYear; // Previous week

        $departments = DB::table('departments')
            ->where('is_active', 1)
            ->get();

        $results = [];

        foreach ($departments as $dept) {
            $result = $this->processWeeklySurplus($dept->department_id, $weekNumber, $year);
            $results[] = [
                'department_id' => $dept->department_id,
                'department_name' => $dept->department_name,
                'result' => $result,
            ];
        }

        return $results;
    }

    /**
     * Get used amount for a department
     */
    public function getUsedAmount($departmentId, $year = null)
    {
$year = $year ?? $this->getActiveFiscalYear();
        $budget = AnnualBudget::where('department_id', $departmentId)
            ->where('fiscal_year', $year)
            ->first();

        if (!$budget) {
            return 0;
        }

        return $budget->used_amount;
    }

    /**
     * Get weekly allocation for a department (fiscal year aware)
     */
    public function getWeeklyAllocation($departmentId, $fiscalYear = null)
    {
$fiscalYear = $fiscalYear ?? $this->getActiveFiscalYear();
        // ✅ Get policy for specific fiscal year
        $policy = DeptBudgetPolicy::where('department_id', $departmentId)
            ->where('fiscal_year', $fiscalYear)
            ->first();

        if ($policy) {
            return $policy->default_weekly_allocation;
        }

        // Fallback to current policy
        $fallback = DeptBudgetPolicy::where('department_id', $departmentId)
            ->first();

        return $fallback ? $fallback->default_weekly_allocation : 0;
    }

    /**
     * ✅ Get weekly usage for current week
     */
    public function getCurrentWeekUsage($departmentId)
    {
        $year = $this->getActiveFiscalYear();
        $now = Carbon::now();
        $weekNumber = $now->weekOfYear;
        $year = $now->year;

        $usage = WeeklyBudgetUsage::where('department_id', $departmentId)
            ->where('week_number', $weekNumber)
            ->where('year', $year)
            ->first();

        return $usage;
    }

    /**
     * ✅ Get weekly remaining for current week
     */
    public function getWeeklyRemaining($departmentId)
    {
        $usage = $this->getCurrentWeekUsage($departmentId);

        if (!$usage) {
            return $this->getWeeklyAllocation($departmentId);
        }

        return $usage->weekly_allocation - $usage->amount_used;
    }

/**
 * ✅ Get the raw annual amount for a department (current fiscal year)
 */
public function getAnnualAmount($departmentId, $year = null)
{
$year = $year ?? $this->getActiveFiscalYear();
    $budget = AnnualBudget::where('department_id', $departmentId)
        ->where('fiscal_year', $year)
        ->first();

    return $budget ? (float) $budget->annual_amount : 0.0;
}

    /**
     * ✅ Resolve the currently active fiscal year.
     *    Prefers fiscal_years.is_active=1, falls back to calendar year.
     */
    public function getActiveFiscalYear(): int
    {
        $active = \App\Models\FiscalYear::where('is_active', true)->first();
        return (int) ($active?->year ?? Carbon::now()->year);
    }

}
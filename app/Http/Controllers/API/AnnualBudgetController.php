<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\AnnualBudget;
use App\Models\Department;
use App\Models\FiscalYear;
use App\Models\DeptBudgetPolicy;
use App\Models\BudgetHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;

class AnnualBudgetController extends Controller
{
    /**
     * ✅ Compute the auto weekly suggested amount for a given annual budget.
     * Formula: annual_amount / 52, rounded to 2 decimals.
     */
    private function computeWeeklySuggested($annualAmount): float
    {
        $amount = (float) $annualAmount;
        return $amount > 0 ? round($amount / 52, 2) : 0.0;
    }

    /**
     * Get all annual budgets with departments for a specific year
     */
    public function index(Request $request)
    {
        try {
            $year = $request->get('fiscal_year', date('Y'));
            $departmentId = $request->get('department_id');

            $fiscalYear = FiscalYear::where('year', $year)->first();

            if (!$fiscalYear) {
                return response()->json([
                    'success' => false,
                    'message' => "Fiscal year {$year} not found.",
                ], 404);
            }

            $query = AnnualBudget::with(['department'])->where('fiscal_year', $year);

            if ($departmentId) {
                $query->where('department_id', $departmentId);
            }

            $budgets = $query->get()->keyBy('department_id');

            $allDepartments = Department::where('is_active', true)->get();

            $result = $allDepartments->map(function ($dept) use ($budgets, $year) {
                $budget = $budgets->get($dept->department_id);

                // ✅ Get total weekly allocations for this department and year (tracked usage)
                $totalWeeklyAllocated = 0;
                if ($budget) {
                    $totalWeeklyAllocated = DB::table('weekly_budget_usage')
                        ->where('department_id', $dept->department_id)
                        ->where('year', $year)
                        ->sum('weekly_allocation') ?? 0;
                }

                // ✅ Weekly suggested is ALWAYS computed from annual
                $annualAmount = $budget ? (float) $budget->annual_amount : 0;
                $weeklySuggested = $this->computeWeeklySuggested($annualAmount);

                return [
                    'department_id' => $dept->department_id,
                    'department_name' => $dept->department_name,
                    'department_code' => $dept->department_code,
                    'fiscal_year' => $year,
                    'has_budget' => $budget ? true : false,
                    'budget_id' => $budget ? $budget->budget_id : null,
                    'annual_amount' => $annualAmount,
                    // ✅ Weekly suggested — auto-computed, never manual
                    'weekly_ceiling' => $weeklySuggested,       // legacy alias
                    'weekly_suggested' => $weeklySuggested,     // ✅ NEW canonical
                    'suggested_ceiling' => $weeklySuggested,    // legacy alias
                    'used_amount' => $budget ? (float) $budget->used_amount : 0,
                    'remaining_amount' => $budget ? (float) $budget->remaining_amount : 0,
                    'total_weekly_allocated' => $totalWeeklyAllocated,
                    'available_amount' => $budget ? (float) ($budget->remaining_amount - $totalWeeklyAllocated) : 0,
                    'status' => $budget ? $budget->status : 'not_set',
                    'utilization_percentage' => $budget && $budget->annual_amount > 0
                        ? round(($budget->used_amount / $budget->annual_amount) * 100, 2)
                        : 0,
                ];
            });

            $summary = [
                'total_allocated' => $result->sum('annual_amount'),
                'total_used' => $result->sum('used_amount'),
                'total_remaining' => $result->sum('remaining_amount'),
                'total_weekly_allocated' => $result->sum('total_weekly_allocated'),
                'total_available' => $result->sum('available_amount'),
                'total_departments' => $result->count(),
                'departments_with_budget' => $result->filter(fn($item) => $item['has_budget'])->count(),
                'departments_without_budget' => $result->filter(fn($item) => !$item['has_budget'])->count(),
            ];

            return response()->json([
                'success' => true,
                'data' => $result,
                'summary' => $summary,
                'fiscal_year' => [
                    'year' => $fiscalYear->year,
                    'is_active' => $fiscalYear->is_active,
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching annual budgets: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch annual budgets: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get annual budgets by fiscal year (for MO)
     */
    public function getByFiscalYear($year)
    {
        try {
            Log::info('🔍 Fetching budgets for year: ' . $year);

            $fiscalYear = FiscalYear::where('year', $year)->first();

            if (!$fiscalYear) {
                return response()->json([
                    'success' => false,
                    'message' => "Fiscal year {$year} not found.",
                ], 404);
            }

            $allDepartments = Department::where('is_active', true)
                ->orderBy('department_name')
                ->get();

            $budgets = AnnualBudget::where('fiscal_year', $year)
                ->get()
                ->keyBy('department_id');

            $result = $allDepartments->map(function ($department) use ($budgets, $year) {
                $budget = $budgets->get($department->department_id);

                // ✅ Get weekly usage for this department (current week)
                $currentWeek = date('W');
                $weeklyUsage = DB::table('weekly_budget_usage')
                    ->where('department_id', $department->department_id)
                    ->where('year', $year)
                    ->where('week_number', $currentWeek)
                    ->first();

                // ✅ Get total used this year (all weeks)
                $totalUsedThisYear = DB::table('weekly_budget_usage')
                    ->where('department_id', $department->department_id)
                    ->where('year', $year)
                    ->sum('amount_used') ?? 0;

                // ✅ Weekly suggested = annual / 52 — ALWAYS computed, no manual input
                $annualAmount = $budget ? (float) $budget->annual_amount : 0;
                $weeklySuggested = $this->computeWeeklySuggested($annualAmount);

                // ✅ Weekly used — tracked but not a gate
                $weeklyUsed = $weeklyUsage ? (float) $weeklyUsage->amount_used : 0;

                // ✅ Weekly remaining vs suggested (can be negative = exceeded)
                $weeklyRemaining = $weeklySuggested - $weeklyUsed;

                // ✅ Flag for reports / UI badges
                $weeklyExceeded = $weeklySuggested > 0 && $weeklyUsed > $weeklySuggested;

                return [
                    'department_id' => $department->department_id,
                    'department_name' => $department->department_name,
                    'department_code' => $department->department_code,
                    'fiscal_year' => $year,
                    'has_budget' => $budget ? true : false,
                    'budget_id' => $budget ? $budget->budget_id : null,

                    // ✅ ANNUAL BUDGET
                    'annual_amount' => $annualAmount,
                    'used_amount' => $budget ? (float) $budget->used_amount : 0,
                    'remaining_amount' => $budget ? (float) $budget->remaining_amount : 0,

                    // ✅ WEEKLY — all auto-derived from annual
                    'weekly_ceiling' => $weeklySuggested,       // legacy alias
                    'weekly_suggested' => $weeklySuggested,     // ✅ NEW canonical
                    'suggested_ceiling' => $weeklySuggested,    // legacy alias
                    'weekly_used' => $weeklyUsed,
                    'weekly_remaining' => $weeklyRemaining,
                    'weekly_exceeded' => $weeklyExceeded,       // ✅ NEW flag
                    'weekly_used_percentage' => $weeklySuggested > 0
                        ? round(($weeklyUsed / $weeklySuggested) * 100, 2)
                        : 0,

                    // ✅ TOTAL USED THIS YEAR
                    'total_used_this_year' => $totalUsedThisYear,
                    'status' => $budget ? $budget->status : 'not_set',
                    'utilization_percentage' => $annualAmount > 0
                        ? round(($totalUsedThisYear / $annualAmount) * 100, 2)
                        : 0,
                ];
            });

            $summary = [
                'total_allocated' => $result->sum('annual_amount'),
                'total_used' => $result->sum('total_used_this_year'),
                'total_remaining' => $result->sum('remaining_amount'),
                'total_weekly_used' => $result->sum('weekly_used'),
                'total_weekly_remaining' => $result->sum('weekly_remaining'),
                'total_weekly_suggested' => $result->sum('weekly_suggested'),  // ✅ NEW
                'total_departments' => $result->count(),
                'departments_with_budget' => $result->filter(fn($item) => $item['has_budget'])->count(),
                'departments_without_budget' => $result->filter(fn($item) => !$item['has_budget'])->count(),
            ];

            return response()->json([
                'success' => true,
                'data' => $result,
                'summary' => $summary,
                'fiscal_year' => [
                    'year' => $fiscalYear->year,
                    'is_active' => $fiscalYear->is_active,
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error fetching annual budgets: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch annual budgets: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * ✅ CREATE or UPDATE annual budget (MO only)
     * ✅ weekly_ceiling is no longer accepted from the client — always auto-derived.
     */
    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'department_id' => 'required|exists:departments,department_id',
                'fiscal_year' => 'required|integer|exists:fiscal_years,year',
                'annual_amount' => 'required|numeric|min:0',
                // ✅ weekly_ceiling removed from validation — not accepted
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            DB::beginTransaction();

            $annualAmount = (float) $request->annual_amount;
            // ✅ Auto-compute weekly suggested — never trust client input
            $weeklyCeiling = $this->computeWeeklySuggested($annualAmount);
            $departmentId = $request->department_id;
            $fiscalYear = $request->fiscal_year;

            $budget = AnnualBudget::where('department_id', $departmentId)
                ->where('fiscal_year', $fiscalYear)
                ->first();

            $oldAmount = $budget ? $budget->annual_amount : 0;

            if ($budget) {
                $budget->annual_amount = $annualAmount;
                $budget->weekly_ceiling = $weeklyCeiling;   // ✅ always overwritten with computed
                $budget->used_amount = $budget->used_amount ?? 0;
                $budget->status = 'active';
                $budget->save();
                $action = 'annual_updated';
                $message = 'Annual budget updated successfully';
            } else {
                $budget = AnnualBudget::create([
                    'department_id' => $departmentId,
                    'fiscal_year' => $fiscalYear,
                    'annual_amount' => $annualAmount,
                    'weekly_ceiling' => $weeklyCeiling,
                    'used_amount' => 0,
                    'status' => 'active',
                ]);
                $action = 'annual_created';
                $message = 'Annual budget created successfully';
            }

            // ✅ Update policy with fiscal_year
            DeptBudgetPolicy::updateOrCreate(
                [
                    'department_id' => $departmentId,
                    'fiscal_year' => $fiscalYear,
                ],
                [
                    'default_weekly_allocation' => $weeklyCeiling
                ]
            );

            // ✅ Also update the main policy (for backward compatibility)
            DeptBudgetPolicy::updateOrCreate(
                [
                    'department_id' => $departmentId,
                ],
                [
                    'default_weekly_allocation' => $weeklyCeiling,
                    'fiscal_year' => $fiscalYear,
                ]
            );

            // ✅ Update weekly_budget_usage table (tracking only)
            $currentWeek = date('W');
            $currentYear = date('Y');
            $weekStart = Carbon::now()->startOfWeek()->toDateString();
            $weekEnd = Carbon::now()->endOfWeek()->toDateString();

            $weeklyUsage = DB::table('weekly_budget_usage')
                ->where('department_id', $departmentId)
                ->where('week_number', $currentWeek)
                ->where('year', $currentYear)
                ->first();

            if ($weeklyUsage) {
                DB::table('weekly_budget_usage')
                    ->where('usage_id', $weeklyUsage->usage_id)
                    ->update([
                        'weekly_allocation' => $weeklyCeiling,
                        'updated_at' => now()
                    ]);
            } else {
                DB::table('weekly_budget_usage')->insert([
                    'department_id' => $departmentId,
                    'week_number' => $currentWeek,
                    'year' => $currentYear,
                    'week_start' => $weekStart,
                    'week_end' => $weekEnd,
                    'weekly_allocation' => $weeklyCeiling,
                    'amount_used' => 0,
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }

            // Log history
            $department = Department::find($departmentId);
            BudgetHistory::create([
                'department_id' => $departmentId,
                'department_name' => $department->department_name ?? 'Unknown',
                'action' => $action,
                'previous_amount' => $oldAmount,
                'added_amount' => $annualAmount - $oldAmount,
                'new_amount' => $annualAmount,
                'reason' => "Annual budget for FY {$fiscalYear}: ₱" . number_format($annualAmount, 2) . " (Weekly suggested: ₱" . number_format($weeklyCeiling, 2) . ")",
                'user_id' => auth()->id(),
                'user_name' => auth()->user()->full_name ?? 'System',
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => [
                    'budget_id' => $budget->budget_id,
                    'department_id' => $budget->department_id,
                    'fiscal_year' => $budget->fiscal_year,
                    'annual_amount' => (float) $budget->annual_amount,
                    'weekly_ceiling' => (float) $budget->weekly_ceiling,
                    'weekly_suggested' => $this->computeWeeklySuggested($budget->annual_amount),  // ✅ NEW
                    'suggested_ceiling' => $this->computeWeeklySuggested($budget->annual_amount),
                    'used_amount' => (float) $budget->used_amount,
                    'remaining_amount' => (float) $budget->remaining_amount,
                    'status' => $budget->status,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error saving annual budget: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to save annual budget: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * ✅ ADD additional budget to an existing annual budget (MO only)
     */
    public function addBudget(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'department_id' => 'required|exists:departments,department_id',
                'fiscal_year' => 'required|integer|exists:fiscal_years,year',
                'additional_amount' => 'required|numeric|min:0.01',
                'reason' => 'required|string|max:255',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            DB::beginTransaction();

            $budget = AnnualBudget::where('department_id', $request->department_id)
                ->where('fiscal_year', $request->fiscal_year)
                ->first();

            if (!$budget) {
                return response()->json([
                    'success' => false,
                    'message' => 'Budget not found for this department and year'
                ], 404);
            }

            $oldAmount = (float) $budget->annual_amount;
            $newAmount = $oldAmount + (float) $request->additional_amount;

            $budget->annual_amount = $newAmount;
            // ✅ Recompute weekly suggested from new annual
            $budget->weekly_ceiling = $this->computeWeeklySuggested($newAmount);
            $budget->save();

            // Update policy
            DeptBudgetPolicy::updateOrCreate(
                ['department_id' => $request->department_id],
                ['default_weekly_allocation' => $budget->weekly_ceiling]
            );

            // Log history
            $department = Department::find($request->department_id);
            BudgetHistory::create([
                'department_id' => $request->department_id,
                'department_name' => $department->department_name ?? 'Unknown',
                'action' => 'annual_added',
                'previous_amount' => $oldAmount,
                'added_amount' => $request->additional_amount,
                'new_amount' => $newAmount,
                'reason' => $request->reason . " (+₱" . number_format($request->additional_amount, 2) . ")",
                'user_id' => auth()->id(),
                'user_name' => auth()->user()->full_name ?? 'System',
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Additional budget added successfully',
                'data' => [
                    'department_id' => $budget->department_id,
                    'fiscal_year' => $budget->fiscal_year,
                    'previous_amount' => $oldAmount,
                    'added_amount' => $request->additional_amount,
                    'new_amount' => $newAmount,
                    'weekly_ceiling' => (float) $budget->weekly_ceiling,
                    'weekly_suggested' => $this->computeWeeklySuggested($newAmount),  // ✅ NEW
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Add budget error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to add budget: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * ✅ UPDATE annual budget (MO only)
     * ✅ weekly_ceiling is auto-derived from annual_amount, ignores any client input.
     */
    public function update(Request $request, $id)
    {
        try {
            $budget = AnnualBudget::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'annual_amount' => 'required|numeric|min:0',
                'status' => 'nullable|in:active,closed',
                // ✅ weekly_ceiling removed from validation
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            DB::beginTransaction();

            $oldAmount = (float) $budget->annual_amount;
            $budget->annual_amount = (float) $request->annual_amount;
            // ✅ Always recompute — never trust client input
            $budget->weekly_ceiling = $this->computeWeeklySuggested($request->annual_amount);

            if ($request->has('status')) {
                $budget->status = $request->status;
            }

            $budget->save();

            DeptBudgetPolicy::updateOrCreate(
                ['department_id' => $budget->department_id],
                ['default_weekly_allocation' => $budget->weekly_ceiling]
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Annual budget updated successfully',
                'data' => [
                    'budget_id' => $budget->budget_id,
                    'department_id' => $budget->department_id,
                    'fiscal_year' => $budget->fiscal_year,
                    'annual_amount' => (float) $budget->annual_amount,
                    'weekly_ceiling' => (float) $budget->weekly_ceiling,
                    'weekly_suggested' => $this->computeWeeklySuggested($budget->annual_amount),  // ✅ NEW
                    'used_amount' => (float) $budget->used_amount,
                    'remaining_amount' => (float) $budget->remaining_amount,
                    'status' => $budget->status,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error updating annual budget: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update annual budget: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * ✅ BULK UPDATE annual budgets (MO only)
     * ✅ weekly_ceiling is auto-derived per row.
     */
    public function bulkUpdate(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'fiscal_year' => 'required|integer|exists:fiscal_years,year',
                'budgets' => 'required|array',
                'budgets.*.department_id' => 'required|exists:departments,department_id',
                'budgets.*.annual_amount' => 'required|numeric|min:0',
                // ✅ weekly_ceiling removed from validation
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $year = $request->fiscal_year;
            $results = [];
            $totalBudget = 0;

            DB::beginTransaction();

            foreach ($request->budgets as $budgetData) {
                $annualAmount = (float) $budgetData['annual_amount'];
                // ✅ Always compute — ignore any client-sent weekly_ceiling
                $weeklyCeiling = $this->computeWeeklySuggested($annualAmount);
                $departmentId = $budgetData['department_id'];

                $budget = AnnualBudget::updateOrCreate(
                    [
                        'department_id' => $departmentId,
                        'fiscal_year' => $year,
                    ],
                    [
                        'annual_amount' => $annualAmount,
                        'weekly_ceiling' => $weeklyCeiling,
                        'status' => 'active',
                    ]
                );

                DeptBudgetPolicy::updateOrCreate(
                    ['department_id' => $departmentId],
                    ['default_weekly_allocation' => $weeklyCeiling]
                );

                $totalBudget += $annualAmount;

                $results[] = [
                    'department_id' => $budget->department_id,
                    'annual_amount' => (float) $budget->annual_amount,
                    'weekly_ceiling' => (float) $budget->weekly_ceiling,
                    'weekly_suggested' => $this->computeWeeklySuggested($budget->annual_amount),  // ✅ NEW
                    'suggested_ceiling' => $this->computeWeeklySuggested($budget->annual_amount),
                ];
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Annual budgets saved successfully',
                'data' => [
                    'fiscal_year' => $year,
                    'budgets' => $results,
                    'total_budget' => $totalBudget,
                    'total_departments' => count($results),
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error in bulk update: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to save budgets: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get available fiscal years
     */
    public function getYears(Request $request)
    {
        try {
            $fiscalYears = FiscalYear::where('is_active', true)
                ->orderBy('year', 'desc')
                ->pluck('year')
                ->toArray();

            $budgetYears = AnnualBudget::select('fiscal_year')
                ->distinct()
                ->pluck('fiscal_year')
                ->toArray();

            $years = array_unique(array_merge($fiscalYears, $budgetYears));
            sort($years);

            return response()->json([
                'success' => true,
                'data' => $years,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch years: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get budget summary for a specific year
     */
    public function getSummary(Request $request)
    {
        try {
            $year = $request->get('fiscal_year', date('Y'));

            $budgets = AnnualBudget::with(['department'])
                ->where('fiscal_year', $year)
                ->get();

            $summary = [
                'fiscal_year' => $year,
                'total_allocated' => $budgets->sum('annual_amount'),
                'total_used' => $budgets->sum('used_amount'),
                'total_remaining' => $budgets->sum('remaining_amount'),
                'total_departments' => $budgets->count(),
                // ✅ Weekly is now always annual / 52
                'avg_weekly_suggested' => $budgets->count() > 0
                    ? round($budgets->sum('annual_amount') / 52, 2)
                    : 0,
                'departments' => $budgets->map(function ($budget) {
                    return [
                        'department_id' => $budget->department_id,
                        'department_name' => $budget->department->department_name,
                        'annual_amount' => (float) $budget->annual_amount,
                        'weekly_suggested' => $this->computeWeeklySuggested($budget->annual_amount),  // ✅ NEW
                        'weekly_ceiling' => $this->computeWeeklySuggested($budget->annual_amount),   // legacy alias
                        'used_amount' => (float) $budget->used_amount,
                        'remaining_amount' => (float) $budget->remaining_amount,
                        'utilization' => $budget->annual_amount > 0
                            ? round(($budget->used_amount / $budget->annual_amount) * 100, 2)
                            : 0,
                    ];
                }),
            ];

            return response()->json([
                'success' => true,
                'data' => $summary,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get summary: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete annual budget (GSO only)
     */
    public function destroy($id)
    {
        try {
            $budget = AnnualBudget::findOrFail($id);
            $budget->delete();

            return response()->json([
                'success' => true,
                'message' => 'Annual budget deleted successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete budget: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get departments without budget for a specific year
     */
    public function getDepartmentsWithoutBudget(Request $request)
    {
        try {
            $year = $request->get('fiscal_year', date('Y'));

            $departmentsWithBudget = AnnualBudget::where('fiscal_year', $year)
                ->pluck('department_id')
                ->toArray();

            $departmentsWithoutBudget = Department::where('is_active', true)
                ->whereNotIn('department_id', $departmentsWithBudget)
                ->select('department_id', 'department_name', 'department_code')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $departmentsWithoutBudget,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch departments: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get budget for a specific department
     */
    public function show(Request $request, $departmentId)
    {
        try {
            $year = $request->get('fiscal_year', date('Y'));

            $budget = AnnualBudget::with(['department'])
                ->where('department_id', $departmentId)
                ->where('fiscal_year', $year)
                ->first();

            if (!$budget) {
                return response()->json([
                    'success' => false,
                    'message' => 'Budget not found for this department and year',
                ], 404);
            }

            $annualAmount = (float) $budget->annual_amount;

            return response()->json([
                'success' => true,
                'data' => [
                    'budget_id' => $budget->budget_id,
                    'department_id' => $budget->department_id,
                    'department_name' => $budget->department->department_name,
                    'fiscal_year' => $budget->fiscal_year,
                    'annual_amount' => $annualAmount,
                    'weekly_ceiling' => $this->computeWeeklySuggested($annualAmount),       // legacy alias
                    'weekly_suggested' => $this->computeWeeklySuggested($annualAmount),     // ✅ NEW canonical
                    'suggested_ceiling' => $this->computeWeeklySuggested($annualAmount),
                    'used_amount' => (float) $budget->used_amount,
                    'remaining_amount' => (float) $budget->remaining_amount,
                    'status' => $budget->status,
                    'utilization_percentage' => $annualAmount > 0
                        ? round(($budget->used_amount / $annualAmount) * 100, 2)
                        : 0,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch budget: ' . $e->getMessage()
            ], 500);
        }
    }
}
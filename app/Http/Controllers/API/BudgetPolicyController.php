<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
class BudgetPolicyController extends Controller
{
    /**
     * Get all budget policies
     */
    public function index()
    {
        try {
            $policies = DB::table('dept_budget_policy as dbp')
                ->join('departments as d', 'dbp.department_id', '=', 'd.department_id')
                ->select('dbp.*', 'd.department_name', 'd.department_code')
                ->get();
            
            return response()->json([
                'success' => true,
                'data' => $policies
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch budget policies: ' . $e->getMessage()
            ], 500);
        }
    }
    
    // /**
    //  * Create a new budget policy
    //  */
    // public function store(Request $request)
    // {
    //     Log::info('=== BudgetPolicyController::store called ===');
    //     Log::info('Request data:', $request->all());
        
    //     $validator = Validator::make($request->all(), [
    //         'department_id' => 'required|exists:departments,department_id',
    //         'default_weekly_allocation' => 'required|numeric|min:0'
    //     ]);
        
    //     if ($validator->fails()) {
    //         Log::error('Validation failed:', $validator->errors()->toArray());
    //         return response()->json(['errors' => $validator->errors()], 422);
    //     }
        
    //     $user = $request->user();
        
    //     if ($user->role !== 'mayors_office' && $user->role !== 'gso_office') {
    //         Log::warning('Unauthorized attempt', ['role' => $user->role]);
    //         return response()->json(['message' => 'Unauthorized'], 403);
    //     }
        
    //     DB::beginTransaction();
        
    //     try {
    //         $departmentId = $request->department_id;
    //         $allocation = $request->default_weekly_allocation;
            
    //         // Get existing policy
    //         $existingPolicy = DB::table('dept_budget_policy')
    //             ->where('department_id', $departmentId)
    //             ->first();
            
    //         $previousAmount = $existingPolicy ? $existingPolicy->default_weekly_allocation : 0;
            
    //         // Insert or Update Policy
    //         if ($existingPolicy) {
    //             DB::table('dept_budget_policy')
    //                 ->where('department_id', $departmentId)
    //                 ->update([
    //                     'default_weekly_allocation' => $allocation,
    //                     'updated_at' => now()
    //                 ]);
    //         } else {
    //             DB::table('dept_budget_policy')->insert([
    //                 'department_id' => $departmentId,
    //                 'default_weekly_allocation' => $allocation,
    //                 'created_at' => now(),
    //                 'updated_at' => now()
    //             ]);
    //         }
            
    //         // Get department name
    //         $department = DB::table('departments')
    //             ->where('department_id', $departmentId)
    //             ->first();
            
    //         // Log to budget history
    //         DB::table('budget_history')->insert([
    //             'department_id' => $departmentId,
    //             'department_name' => $department->department_name ?? 'Unknown',
    //             'action' => 'created',
    //             'previous_amount' => $previousAmount,
    //             'added_amount' => $allocation,
    //             'new_amount' => $allocation,
    //             'reason' => $request->reason ?? 'Initial budget allocation',
    //             'user_id' => $user->user_id,
    //             'user_name' => $user->full_name ?? $user->email,
    //             'created_at' => now(),
    //         ]);
            
    //         // Check if a budget period exists for this week
    //         $weekStart = now()->startOfWeek()->toDateString();
            
    //         $existingPeriod = DB::table('dept_budget_period')
    //             ->where('department_id', $departmentId)
    //             ->where('week_start', $weekStart)
    //             ->first();
            
    //         if ($existingPeriod) {
    //             DB::table('dept_budget_period')
    //                 ->where('period_id', $existingPeriod->period_id)
    //                 ->update([
    //                     'allocated_amount' => $allocation,
    //                     'status' => 'active',
    //                     'closed_at' => null,
    //                     'updated_at' => now()
    //                 ]);
    //         } else {
    //             DB::table('dept_budget_period')->insert([
    //                 'department_id' => $departmentId,
    //                 'week_start' => $weekStart,
    //                 'allocated_amount' => $allocation,
    //                 'status' => 'active',
    //                 'created_at' => now()
    //             ]);
    //         }
            
    //         DB::commit();
            
    //         return response()->json([
    //             'success' => true,
    //             'message' => 'Budget policy created successfully',
    //             'data' => [
    //                 'department_id' => $departmentId,
    //                 'allocated_amount' => $allocation,
    //                 'week_start' => $weekStart,
    //                 'previous_amount' => $previousAmount,
    //             ]
    //         ], 201);
            
    //     } catch (\Exception $e) {
    //         DB::rollBack();
    //         Log::error('❌ Failed to create policy: ' . $e->getMessage());
    //         return response()->json([
    //             'success' => false,
    //             'message' => 'Failed to create policy: ' . $e->getMessage()
    //         ], 500);
    //     }
    // }

    // ============================================================
    // ✅ ANNUAL BUDGET METHODS
    // ============================================================

   /**
 * Create an annual budget
 */
// public function createAnnualBudget(Request $request)
// {
//     Log::info('=== BudgetPolicyController::createAnnualBudget called ===');
//     Log::info('Request data:', $request->all());

//     $validator = Validator::make($request->all(), [
//         'department_id' => 'required|exists:departments,department_id',
//         'annual_budget' => 'required|numeric|min:0.01',
//         'fiscal_year' => 'nullable|integer|min:2000',
//         'reason' => 'nullable|string|max:255',
//     ]);

//     if ($validator->fails()) {
//         Log::error('Validation failed:', $validator->errors()->toArray());
//         return response()->json(['errors' => $validator->errors()], 422);
//     }

//     $user = $request->user();

//     if ($user->role !== 'mayors_office' && $user->role !== 'gso_office') {
//         Log::warning('Unauthorized attempt', ['role' => $user->role]);
//         return response()->json(['message' => 'Unauthorized'], 403);
//     }

//     DB::beginTransaction();

//     try {
//         $departmentId = $request->department_id;
//         $annualBudget = $request->annual_budget;
//         $fiscalYear = $request->fiscal_year ?? date('Y');
//         $weeklyAllocation = $annualBudget / 52;

//         // ✅ 1. Insert or Update Annual Budget
//         $existingAnnual = DB::table('annual_budgets')
//             ->where('department_id', $departmentId)
//             ->where('fiscal_year', $fiscalYear)
//             ->first();

//         if ($existingAnnual) {
//             DB::table('annual_budgets')
//                 ->where('budget_id', $existingAnnual->budget_id)
//                 ->update([
//                     'annual_amount' => $annualBudget,
//                     'used_amount' => 0,
//                     'status' => 'active',
//                     'updated_at' => now()
//                 ]);
//         } else {
//             DB::table('annual_budgets')->insert([
//                 'department_id' => $departmentId,
//                 'fiscal_year' => $fiscalYear,
//                 'annual_amount' => $annualBudget,
//                 'used_amount' => 0,
//                 'status' => 'active',
//                 'created_at' => now(),
//                 'updated_at' => now()
//             ]);
//         }

//         // ✅ 2. Get existing policy
//         $existingPolicy = DB::table('dept_budget_policy')
//             ->where('department_id', $departmentId)
//             ->first();

//         $previousAmount = $existingPolicy ? $existingPolicy->default_weekly_allocation : 0;

//         // ✅ 3. Insert or Update Policy (for backward compatibility)
//         if ($existingPolicy) {
//             DB::table('dept_budget_policy')
//                 ->where('department_id', $departmentId)
//                 ->update([
//                     'default_weekly_allocation' => $weeklyAllocation,
//                     'updated_at' => now()
//                 ]);
//         } else {
//             DB::table('dept_budget_policy')->insert([
//                 'department_id' => $departmentId,
//                 'default_weekly_allocation' => $weeklyAllocation,
//                 'created_at' => now(),
//                 'updated_at' => now()
//             ]);
//         }

//         // ✅ 4. Insert or Update Weekly Budget Usage (for current week)
//         $weekNumber = date('W');
//         $year = date('Y');
//         $weekStart = now()->startOfWeek()->toDateString();
//         $weekEnd = now()->endOfWeek()->toDateString();

//         $existingWeekly = DB::table('weekly_budget_usage')
//             ->where('department_id', $departmentId)
//             ->where('week_number', $weekNumber)
//             ->where('year', $year)
//             ->first();

//         if ($existingWeekly) {
//             DB::table('weekly_budget_usage')
//                 ->where('usage_id', $existingWeekly->usage_id)
//                 ->update([
//                     'weekly_allocation' => $weeklyAllocation,
//                     'updated_at' => now()
//                 ]);
//         } else {
//             DB::table('weekly_budget_usage')->insert([
//                 'department_id' => $departmentId,
//                 'week_number' => $weekNumber,
//                 'year' => $year,
//                 'week_start' => $weekStart,
//                 'week_end' => $weekEnd,
//                 'weekly_allocation' => $weeklyAllocation,
//                 'amount_used' => 0,
//                 'created_at' => now(),
//                 'updated_at' => now()
//             ]);
//         }

//         // ✅ 5. Update dept_budget_period (using UPDATE OR INSERT to avoid duplicate)
//         $existingPeriod = DB::table('dept_budget_period')
//             ->where('department_id', $departmentId)
//             ->where('week_start', $weekStart)
//             ->first();

//         if ($existingPeriod) {
//             // ✅ Update existing period
//             DB::table('dept_budget_period')
//                 ->where('period_id', $existingPeriod->period_id)
//                 ->update([
//                     'allocated_amount' => $weeklyAllocation,
//                     'status' => 'active',
//                     'closed_at' => null,
//                     'updated_at' => now()
//                 ]);
//         } else {
//             // ✅ Insert new period
//             DB::table('dept_budget_period')->insert([
//                 'department_id' => $departmentId,
//                 'week_start' => $weekStart,
//                 'allocated_amount' => $weeklyAllocation,
//                 'status' => 'active',
//                 'created_at' => now()
//             ]);
//         }

//         // ✅ 6. Log to history
//         $department = DB::table('departments')
//             ->where('department_id', $departmentId)
//             ->first();

//         DB::table('budget_history')->insert([
//             'department_id' => $departmentId,
//             'department_name' => $department->department_name ?? 'Unknown',
//             'action' => 'annual_created',
//             'previous_amount' => $previousAmount,
//             'added_amount' => $weeklyAllocation,
//             'new_amount' => $weeklyAllocation,
//             'reason' => $request->reason ?? 'Annual budget created: ₱' . number_format($annualBudget, 2) . ' (FY ' . $fiscalYear . ')',
//             'user_id' => $user->user_id,
//             'user_name' => $user->full_name ?? $user->email,
//             'created_at' => now(),
//         ]);

//         DB::commit();

//         return response()->json([
//             'success' => true,
//             'message' => 'Annual budget created successfully!',
//             'data' => [
//                 'department_id' => $departmentId,
//                 'annual_budget' => $annualBudget,
//                 'weekly_allocation' => $weeklyAllocation,
//                 'fiscal_year' => $fiscalYear,
//             ]
//         ], 201);

//     } catch (\Exception $e) {
//         DB::rollBack();
//         Log::error('❌ Failed to create annual budget: ' . $e->getMessage());
//         Log::error('❌ Stack trace: ' . $e->getTraceAsString());
//         return response()->json([
//             'success' => false,
//             'message' => 'Failed to create annual budget: ' . $e->getMessage()
//         ], 500);
//     }
// }


    /**
     * Ensure annual_budgets table exists
     */
    private function ensureAnnualBudgetsTableExists()
    {
        $tableExists = DB::select("SHOW TABLES LIKE 'annual_budgets'");
        
        if (empty($tableExists)) {
            DB::statement("
                CREATE TABLE annual_budgets (
                    annual_budget_id INT PRIMARY KEY AUTO_INCREMENT,
                    department_id INT NOT NULL,
                    fiscal_year YEAR NOT NULL,
                    annual_amount DECIMAL(12,2) NOT NULL,
                    used_amount DECIMAL(12,2) DEFAULT 0,
                    status ENUM('active', 'closed') DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NULL,
                    FOREIGN KEY (department_id) REFERENCES departments(department_id),
                    UNIQUE KEY unique_department_year (department_id, fiscal_year)
                )
            ");
        }
    }

    /**
     * Get annual budget for a department
     */
    public function getAnnualBudget($departmentId)
    {
        try {
            $annualBudget = DB::table('annual_budgets')
                ->where('department_id', $departmentId)
                ->where('fiscal_year', date('Y'))
                ->first();

            if (!$annualBudget) {
                return response()->json([
                    'success' => true,
                    'data' => null,
                    'message' => 'No annual budget found for this department'
                ]);
            }

            // Get weekly allocation from policy
            $policy = DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->first();

            return response()->json([
                'success' => true,
                'data' => [
                    'department_id' => $annualBudget->department_id,
                    'annual_budget' => $annualBudget->annual_amount,
                    'used_amount' => $annualBudget->used_amount,
                    'remaining_amount' => $annualBudget->annual_amount - $annualBudget->used_amount,
                    'fiscal_year' => $annualBudget->fiscal_year,
                    'weekly_allocation' => $policy ? $policy->default_weekly_allocation : 0,
                    'status' => $annualBudget->status,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Get annual budget error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get annual budget: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update annual budget
     */
    // public function updateAnnualBudget(Request $request, $departmentId)
    // {
    //     try {
    //         $validator = Validator::make($request->all(), [
    //             'annual_budget' => 'required|numeric|min:0.01',
    //             'fiscal_year' => 'nullable|integer|min:2000',
    //             'reason' => 'nullable|string|max:255',
    //         ]);

    //         if ($validator->fails()) {
    //             return response()->json(['errors' => $validator->errors()], 422);
    //         }

    //         $user = $request->user();

    //         if ($user->role !== 'mayors_office' && $user->role !== 'gso_office') {
    //             return response()->json(['message' => 'Unauthorized'], 403);
    //         }

    //         DB::beginTransaction();

    //         $annualBudget = $request->annual_budget;
    //         $fiscalYear = $request->fiscal_year ?? date('Y');
    //         $weeklyAllocation = $annualBudget / 52;

    //         // Update annual budget
    //         $existingAnnual = DB::table('annual_budgets')
    //             ->where('department_id', $departmentId)
    //             ->where('fiscal_year', $fiscalYear)
    //             ->first();

    //         $previousAmount = $existingAnnual ? $existingAnnual->annual_amount : 0;

    //         if ($existingAnnual) {
    //             DB::table('annual_budgets')
    //                 ->where('annual_budget_id', $existingAnnual->annual_budget_id)
    //                 ->update([
    //                     'annual_amount' => $annualBudget,
    //                     'updated_at' => now()
    //                 ]);
    //         } else {
    //             DB::table('annual_budgets')->insert([
    //                 'department_id' => $departmentId,
    //                 'fiscal_year' => $fiscalYear,
    //                 'annual_amount' => $annualBudget,
    //                 'used_amount' => 0,
    //                 'status' => 'active',
    //                 'created_at' => now(),
    //                 'updated_at' => now()
    //             ]);
    //         }

    //         // Update policy weekly allocation
    //         $policy = DB::table('dept_budget_policy')
    //             ->where('department_id', $departmentId)
    //             ->first();

    //         if ($policy) {
    //             DB::table('dept_budget_policy')
    //                 ->where('department_id', $departmentId)
    //                 ->update([
    //                     'default_weekly_allocation' => $weeklyAllocation,
    //                     'updated_at' => now()
    //                 ]);
    //         } else {
    //             DB::table('dept_budget_policy')->insert([
    //                 'department_id' => $departmentId,
    //                 'default_weekly_allocation' => $weeklyAllocation,
    //                 'created_at' => now(),
    //                 'updated_at' => now()
    //             ]);
    //         }

    //         // Get department name
    //         $department = DB::table('departments')
    //             ->where('department_id', $departmentId)
    //             ->first();

    //         // Log to budget history
    //         DB::table('budget_history')->insert([
    //             'department_id' => $departmentId,
    //             'department_name' => $department->department_name ?? 'Unknown',
    //             'action' => 'annual_updated',
    //             'previous_amount' => $previousAmount,
    //             'added_amount' => $annualBudget - $previousAmount,
    //             'new_amount' => $annualBudget,
    //             'reason' => $request->reason ?? 'Annual budget updated',
    //             'user_id' => $user->user_id,
    //             'user_name' => $user->full_name ?? $user->email,
    //             'created_at' => now(),
    //         ]);

    //         DB::commit();

    //         return response()->json([
    //             'success' => true,
    //             'message' => 'Annual budget updated successfully!',
    //             'data' => [
    //                 'department_id' => $departmentId,
    //                 'annual_budget' => $annualBudget,
    //                 'weekly_allocation' => $weeklyAllocation,
    //                 'fiscal_year' => $fiscalYear,
    //             ]
    //         ]);

    //     } catch (\Exception $e) {
    //         DB::rollBack();
    //         Log::error('Update annual budget error: ' . $e->getMessage());
    //         return response()->json([
    //             'success' => false,
    //             'message' => 'Failed to update annual budget: ' . $e->getMessage()
    //         ], 500);
    //     }
    // }

    /**
     * ✅ FIXED: Update budget - Adds to ANNUAL BUDGET (Primary)
     * When you add ₱200, it adds to annual budget, then recalculates weekly
     */
     public function update(Request $request, $departmentId)
    {
        try {
            $validator = Validator::make($request->all(), [
                'add_amount' => 'required|numeric|min:0.01',
                'reason' => 'nullable|string|max:255',
            ]);
            
            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            
            $user = $request->user();
            
            if ($user->role !== 'mayors_office' && $user->role !== 'gso_office') {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
            
            DB::beginTransaction();
            
            $currentYear = date('Y');
            $addAmount = $request->add_amount;
            
            // ✅ 1. Get annual budget
            $annualBudget = DB::table('annual_budgets')
                ->where('department_id', $departmentId)
                ->where('fiscal_year', $currentYear)
                ->first();
            
            if (!$annualBudget) {
                return response()->json([
                    'success' => false,
                    'message' => 'Annual budget not found for this department. Please create one first.'
                ], 404);
            }
            
            $previousAnnual = (float) $annualBudget->annual_amount;
            $newAnnual = $previousAnnual + $addAmount;
            
            // ✅ 2. Update annual budget
            DB::table('annual_budgets')
                ->where('budget_id', $annualBudget->budget_id)
                ->update([
                    'annual_amount' => $newAnnual,
                    'updated_at' => now()
                ]);
            
            // ✅ 3. Recalculate weekly allocation (Annual / 52)
            $newWeeklyAllocation = $newAnnual / 52;
            
            // ✅ 4. Update weekly policy
            $existingPolicy = DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->first();
            
            if ($existingPolicy) {
                DB::table('dept_budget_policy')
                    ->where('department_id', $departmentId)
                    ->update([
                        'default_weekly_allocation' => $newWeeklyAllocation,
                        'updated_at' => now()
                    ]);
            }
            
            // ✅ 5. Update current week allocation
            $weekNumber = date('W');
            $currentWeek = DB::table('weekly_budget_usage')
                ->where('department_id', $departmentId)
                ->where('week_number', $weekNumber)
                ->where('year', $currentYear)
                ->first();
            
            if ($currentWeek) {
                DB::table('weekly_budget_usage')
                    ->where('usage_id', $currentWeek->usage_id)
                    ->update([
                        'weekly_allocation' => $newWeeklyAllocation,
                        'updated_at' => now()
                    ]);
            }
            
            // ✅ 6. Update active period
            $weekStart = now()->startOfWeek()->toDateString();
            $existingPeriod = DB::table('dept_budget_period')
                ->where('department_id', $departmentId)
                ->where('week_start', $weekStart)
                ->first();
            
            if ($existingPeriod) {
                DB::table('dept_budget_period')
                    ->where('period_id', $existingPeriod->period_id)
                    ->update([
                        'allocated_amount' => $newWeeklyAllocation,
                        'updated_at' => now()
                    ]);
            }
            
            // ✅ 7. Log to budget history
            $department = DB::table('departments')
                ->where('department_id', $departmentId)
                ->first();
            
            DB::table('budget_history')->insert([
                'department_id' => $departmentId,
                'department_name' => $department->department_name ?? 'Unknown',
                'action' => 'annual_added',
                'previous_amount' => $previousAnnual,
                'added_amount' => $addAmount,
                'new_amount' => $newAnnual,
                'reason' => $request->reason ?? 'Annual budget addition',
                'user_id' => $user->user_id,
                'user_name' => $user->full_name ?? $user->email,
                'created_at' => now(),
            ]);
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => "✅ ₱" . number_format($addAmount, 2) . " added to annual budget!\nNew Annual: ₱" . number_format($newAnnual, 2) . "\nNew Weekly: ₱" . number_format($newWeeklyAllocation, 2),
                'data' => [
                    'department_id' => $departmentId,
                    'previous_annual' => $previousAnnual,
                    'added_amount' => $addAmount,
                    'new_annual' => $newAnnual,
                    'new_weekly' => $newWeeklyAllocation,
                ]
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Update budget error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update budget: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Delete a budget policy
     */
    public function destroy($departmentId)
    {
        try {
            $user = auth()->user();
            
            if ($user->role !== 'mayors_office' && $user->role !== 'gso_office') {
                return response()->json([
                    'message' => 'Unauthorized - Only Mayor\'s Office and GSO can manage budget policies'
                ], 403);
            }
            
            DB::beginTransaction();
            
            // Get policy before deleting
            $policy = DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->first();
            
            if (!$policy) {
                return response()->json([
                    'success' => false,
                    'message' => 'Budget policy not found'
                ], 404);
            }
            
            // Delete policy
            $deleted = DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->delete();
            
            // Log deletion
            $department = DB::table('departments')
                ->where('department_id', $departmentId)
                ->first();
            
            DB::table('budget_history')->insert([
                'department_id' => $departmentId,
                'department_name' => $department->department_name ?? 'Unknown',
                'action' => 'deleted',
                'previous_amount' => $policy->default_weekly_allocation,
                'added_amount' => 0,
                'new_amount' => 0,
                'reason' => 'Budget policy deleted',
                'user_id' => $user->user_id,
                'user_name' => $user->full_name ?? $user->email,
                'created_at' => now(),
            ]);
            
            // Close any active periods for this department
            DB::table('dept_budget_period')
                ->where('department_id', $departmentId)
                ->where('status', 'active')
                ->update([
                    'status' => 'closed',
                    'closed_at' => now()
                ]);
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'Budget policy deleted successfully'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Delete budget policy error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete budget policy: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Get budget history for a department or all
     */
    public function getBudgetHistory(Request $request)
    {
        try {
            $departmentId = $request->get('department_id');
            $limit = $request->get('limit', 100);
            
            $query = DB::table('budget_history')
                ->orderBy('created_at', 'desc');
            
            if ($departmentId) {
                $query->where('department_id', $departmentId);
            }
            
            $history = $query->limit($limit)->get();
            
            return response()->json([
                'success' => true,
                'data' => $history
            ]);
        } catch (\Exception $e) {
            Log::error('Get budget history error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch budget history: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Get budget summary with remaining amounts
     */
    public function getBudgetSummary()
    {
        try {
            $summary = DB::table('dept_budget_policy as dbp')
                ->join('departments as d', 'dbp.department_id', '=', 'd.department_id')
                ->select(
                    'dbp.department_id',
                    'd.department_name',
                    'd.department_code',
                    'dbp.default_weekly_allocation as allocated_amount'
                )
                ->get();
            
            foreach ($summary as $item) {
                // Calculate spent amount
                $spent = DB::table('gas_slip as gs')
                    ->join('dept_budget_period as dbp2', 'gs.period_id', '=', 'dbp2.period_id')
                    ->where('dbp2.department_id', $item->department_id)
                    ->where('dbp2.status', 'active')
                    ->sum('gs.amount_released');
                
                $item->spent_amount = $spent ?? 0;
                $item->remaining_amount = $item->allocated_amount - ($spent ?? 0);
                $item->utilization_percentage = $item->allocated_amount > 0 
                    ? round(($item->spent_amount / $item->allocated_amount) * 100, 2) 
                    : 0;
            }
            
            return response()->json([
                'success' => true,
                'data' => $summary
            ]);
        } catch (\Exception $e) {
            Log::error('Get budget summary error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch budget summary: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Force activate a budget period for a specific department
     */
    public function forceActivate(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'department_id' => 'required|exists:departments,department_id',
                'amount' => 'required|numeric|min:0'
            ]);
            
            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            
            $user = $request->user();
            
            if ($user->role !== 'mayors_office' && $user->role !== 'gso_office') {
                return response()->json([
                    'message' => 'Unauthorized - Only Mayor\'s Office and GSO can manage budget policies'
                ], 403);
            }
            
            $departmentId = $request->department_id;
            $amount = $request->amount;
            $weekStart = now()->startOfWeek()->toDateString();
            
            DB::beginTransaction();
            
            // Close all active periods for this department
            DB::table('dept_budget_period')
                ->where('department_id', $departmentId)
                ->where('status', 'active')
                ->update([
                    'status' => 'closed', 
                    'closed_at' => now()
                ]);
            
            // Check if period exists for this week
            $existingPeriod = DB::table('dept_budget_period')
                ->where('department_id', $departmentId)
                ->where('week_start', $weekStart)
                ->first();
            
            if ($existingPeriod) {
                DB::table('dept_budget_period')
                    ->where('period_id', $existingPeriod->period_id)
                    ->update([
                        'allocated_amount' => $amount,
                        'status' => 'active',
                        'closed_at' => null,
                        'updated_at' => now()
                    ]);
            } else {
                DB::table('dept_budget_period')->insert([
                    'department_id' => $departmentId,
                    'week_start' => $weekStart,
                    'allocated_amount' => $amount,
                    'status' => 'active',
                    'created_at' => now()
                ]);
            }
            
            // Get policy and log activation
            $policy = DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->first();
            
            $previousAmount = $policy ? $policy->default_weekly_allocation : 0;
            
            // Update or create policy
            if ($policy) {
                DB::table('dept_budget_policy')
                    ->where('department_id', $departmentId)
                    ->update([
                        'default_weekly_allocation' => $amount,
                        'updated_at' => now()
                    ]);
            } else {
                DB::table('dept_budget_policy')->insert([
                    'department_id' => $departmentId,
                    'default_weekly_allocation' => $amount,
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }
            
            // Log activation
            $department = DB::table('departments')
                ->where('department_id', $departmentId)
                ->first();
            
            DB::table('budget_history')->insert([
                'department_id' => $departmentId,
                'department_name' => $department->department_name ?? 'Unknown',
                'action' => 'activated',
                'previous_amount' => $previousAmount,
                'added_amount' => $amount - $previousAmount,
                'new_amount' => $amount,
                'reason' => 'Budget period activated',
                'user_id' => $user->user_id,
                'user_name' => $user->full_name ?? $user->email,
                'created_at' => now(),
            ]);
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'Budget period activated successfully',
                'data' => [
                    'department_id' => $departmentId,
                    'allocated_amount' => $amount,
                    'week_start' => $weekStart,
                ]
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Force activate error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to activate budget period: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Run weekly reset for all departments
     */
    public function runWeeklyReset(Request $request)
    {
        try {
            $user = $request->user();
            
            if ($user->role !== 'mayors_office' && $user->role !== 'gso_office') {
                return response()->json([
                    'message' => 'Unauthorized - Only Mayor\'s Office and GSO can manage budget policies'
                ], 403);
            }
            
            DB::beginTransaction();
            
            // Close all active periods
            $closedCount = DB::table('dept_budget_period')
                ->where('status', 'active')
                ->update([
                    'status' => 'closed', 
                    'closed_at' => now()
                ]);
            
            $policies = DB::table('dept_budget_policy')->get();
            $createdCount = 0;
            $weekStart = now()->startOfWeek()->toDateString();
            
            foreach ($policies as $policy) {
                $exists = DB::table('dept_budget_period')
                    ->where('department_id', $policy->department_id)
                    ->where('week_start', $weekStart)
                    ->exists();
                
                if (!$exists) {
                    DB::table('dept_budget_period')->insert([
                        'department_id' => $policy->department_id,
                        'week_start' => $weekStart,
                        'allocated_amount' => $policy->default_weekly_allocation,
                        'status' => 'active',
                        'created_at' => now()
                    ]);
                    $createdCount++;
                }
            }
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'Weekly budget reset completed successfully',
                'periods_closed' => $closedCount,
                'periods_created' => $createdCount
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Weekly reset error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to run weekly reset: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Get budget status for all departments
     */
    public function getBudgetStatus()
    {
        try {
            $status = DB::table('dept_budget_period as dbp')
                ->join('departments as d', 'dbp.department_id', '=', 'd.department_id')
                ->select(
                    'dbp.department_id',
                    'd.department_name',
                    'd.department_code',
                    'dbp.allocated_amount',
                    'dbp.week_start',
                    'dbp.week_end',
                    'dbp.status'
                )
                ->where('dbp.status', 'active')
                ->get();
            
            foreach ($status as $item) {
                $spent = DB::table('gas_slip as gs')
                    ->join('dept_budget_period as dbp2', 'gs.period_id', '=', 'dbp2.period_id')
                    ->where('dbp2.department_id', $item->department_id)
                    ->where('dbp2.status', 'active')
                    ->sum('gs.amount_released');
                
                $item->spent_amount = $spent ?? 0;
                $item->remaining_amount = $item->allocated_amount - ($spent ?? 0);
            }
            
            return response()->json([
                'success' => true,
                'data' => $status
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => true,
                'data' => []
            ]);
        }
    }
    
    /**
     * Get event run logs
     */
    public function getEventLogs()
    {
        try {
            $tableExists = DB::select("SHOW TABLES LIKE 'event_run_log'");
            
            if (empty($tableExists)) {
                return response()->json([
                    'success' => true,
                    'data' => []
                ]);
            }
            
            $logs = DB::table('event_run_log')
                ->orderBy('run_at', 'desc')
                ->limit(50)
                ->get();
            
            return response()->json([
                'success' => true,
                'data' => $logs
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => true,
                'data' => []
            ]);
        }
    }
    
   /**
    * Get all budget periods for reset history
    */
   public function getPeriods(Request $request)
{
    try {
        $periods = DB::table('dept_budget_period as dbp')
            ->join('departments as d', 'dbp.department_id', '=', 'd.department_id')
            ->leftJoin('weekly_budget_usage as wbu', function($join) {
                $join->on('dbp.department_id', '=', 'wbu.department_id')
                     ->on('dbp.week_start', '=', 'wbu.week_start');
            })
            ->select(
                'dbp.period_id',
                'dbp.department_id',
                'dbp.week_start',
                'dbp.week_end',
                'dbp.allocated_amount',
                'dbp.status',
                'dbp.closed_at',
                'dbp.created_at',
                'd.department_name',
                'd.department_code',
                DB::raw('COALESCE(wbu.amount_used, 0) as actual_used'),
                DB::raw('COALESCE(wbu.weekly_allocation, dbp.allocated_amount) as allocated_amount')
            )
            ->orderBy('dbp.week_start', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $periods
        ]);
    } catch (\Exception $e) {
        Log::error('Get periods error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch periods: ' . $e->getMessage(),
            'data' => []
        ], 500);
    }
}


    /**
    * Get all departments with their budget data (for the frontend)
    */
 public function getAllDepartmentsWithBudget()
{
    try {
        $result = [];
        
        $departments = DB::table('departments')
            ->where('is_active', 1)
            ->get();
        
        foreach ($departments as $dept) {
            // ✅ Kuhaon ang annual budget
            $annualBudget = DB::table('annual_budgets')
                ->where('department_id', $dept->department_id)
                ->where('fiscal_year', date('Y'))
                ->first();
            
            // ✅ Kuhaon ang current week usage
            $currentWeek = DB::table('weekly_budget_usage')
                ->where('department_id', $dept->department_id)
                ->where('week_number', date('W'))
                ->where('year', date('Y'))
                ->first();
            
            // ✅ Kuhaon ang policy (fallback)
            $policy = DB::table('dept_budget_policy')
                ->where('department_id', $dept->department_id)
                ->first();
            
            // ✅ Annual Budget Values
            $annualAmount = $annualBudget ? (float) $annualBudget->annual_amount : 0;
            $usedAmount = $annualBudget ? (float) $annualBudget->used_amount : 0;
            $remainingAmount = $annualBudget ? (float) $annualBudget->remaining_amount : 0;
            
            // ✅ Weekly Values
            $weeklyAllocation = 0;
            $weeklyUsed = 0;
            
            if ($currentWeek) {
                $weeklyAllocation = (float) $currentWeek->weekly_allocation;
                $weeklyUsed = (float) $currentWeek->amount_used;
            } elseif ($policy) {
                $weeklyAllocation = (float) $policy->default_weekly_allocation;
            }
            
            // ✅ Return sa frontend ang CORRECT field names
            $result[] = [
                'department_id' => $dept->department_id,
                'department_name' => $dept->department_name,
                'department_code' => $dept->department_code,
                // ✅ ANNUAL BUDGET (Primary)
                'annual_amount' => $annualAmount,           // ← IMPORTANTE!
                'used_amount' => $usedAmount,               // ← IMPORTANTE!
                'remaining_amount' => $remainingAmount,      // ← IMPORTANTE!
                // ✅ WEEKLY ALLOCATION
                'weekly_allocation' => $weeklyAllocation,
                'weekly_used' => $weeklyUsed,
                // ✅ Other fields
                'has_budget' => ($annualBudget || $policy) ? true : false,
                'status' => $annualBudget ? $annualBudget->status : 'inactive',
                'fiscal_year' => date('Y'),
            ];
        }
        
        return response()->json([
            'success' => true,
            'data' => $result
        ]);
        
    } catch (\Exception $e) {
        Log::error('getAllDepartmentsWithBudget error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => $e->getMessage(),
            'data' => []
        ], 500);
    }
}

/**
 * ✅ FIXED: Update Weekly Allocation - Log weekly amounts, not annual
 */
public function updateWeeklyAllocation(Request $request, $departmentId)
{
    try {
        $validator = Validator::make($request->all(), [
            'weekly_allocation' => 'required|numeric|min:0.01',
            'reason' => 'nullable|string|max:255',
        ]);
        
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }
        
        $user = $request->user();
        
        if ($user->role !== 'mayors_office' && $user->role !== 'gso_office') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        DB::beginTransaction();
        
        $currentYear = date('Y');
        $newWeeklyAmount = $request->weekly_allocation;
        $weekNumber = date('W');
        $weekStart = now()->startOfWeek()->toDateString();
        $weekEnd = now()->endOfWeek()->toDateString();
        
        // ✅ 1. Get annual budget
        $annualBudget = DB::table('annual_budgets')
            ->where('department_id', $departmentId)
            ->where('fiscal_year', $currentYear)
            ->first();
        
        if (!$annualBudget) {
            return response()->json([
                'success' => false,
                'message' => 'Annual budget not found. Please create one first.'
            ], 404);
        }
        
        $currentAnnual = (float) $annualBudget->annual_amount;
        $currentUsed = (float) $annualBudget->used_amount;
        
        // ✅ Get total weekly allocations for this year
        $totalWeeklyAllocated = DB::table('weekly_budget_usage')
            ->where('department_id', $departmentId)
            ->where('year', $currentYear)
            ->sum('weekly_allocation') ?? 0;
            
        $availableAmount = $currentAnnual - $currentUsed - $totalWeeklyAllocated;
        
        // ✅ 2. Check if weekly allocation exceeds available amount
        if ($newWeeklyAmount > $availableAmount) {
            return response()->json([
                'success' => false,
                'message' => 'Insufficient available budget! Required: ₱' . number_format($newWeeklyAmount, 2) . 
                            ', Available: ₱' . number_format($availableAmount, 2) . 
                            ' (Annual: ₱' . number_format($currentAnnual, 2) . 
                            ' - Used: ₱' . number_format($currentUsed, 2) . 
                            ' - Allocated: ₱' . number_format($totalWeeklyAllocated, 2) . ')'
            ], 422);
        }
        
        // ✅ 3. Get existing weekly allocation for this week
        $existingWeekly = DB::table('weekly_budget_usage')
            ->where('department_id', $departmentId)
            ->where('week_number', $weekNumber)
            ->where('year', $currentYear)
            ->first();
        
        $oldWeeklyAmount = $existingWeekly ? (float) $existingWeekly->weekly_allocation : 0;
        $annualDeduction = $newWeeklyAmount - $oldWeeklyAmount;
        
        // ✅ 4. Update or create weekly usage
        if ($existingWeekly) {
            DB::table('weekly_budget_usage')
                ->where('usage_id', $existingWeekly->usage_id)
                ->update([
                    'weekly_allocation' => $newWeeklyAmount,
                    'updated_at' => now()
                ]);
        } else {
            DB::table('weekly_budget_usage')->insert([
                'department_id' => $departmentId,
                'week_number' => $weekNumber,
                'year' => $currentYear,
                'week_start' => $weekStart,
                'week_end' => $weekEnd,
                'weekly_allocation' => $newWeeklyAmount,
                'amount_used' => 0,
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }
        
        // ✅ 5. Update annual budget (deduct difference)
        DB::table('annual_budgets')
            ->where('budget_id', $annualBudget->budget_id)
            ->decrement('annual_amount', $annualDeduction);
        
        // ✅ Get updated annual budget
        $updatedAnnual = DB::table('annual_budgets')
            ->where('budget_id', $annualBudget->budget_id)
            ->first();
        
        // ✅ 6. Update policy
        DB::table('dept_budget_policy')
            ->updateOrInsert(
                ['department_id' => $departmentId],
                [
                    'default_weekly_allocation' => $newWeeklyAmount,
                    'updated_at' => now()
                ]
            );
        
        // ✅ 7. Update budget period
        $existingPeriod = DB::table('dept_budget_period')
            ->where('department_id', $departmentId)
            ->where('week_start', $weekStart)
            ->first();
        
        if ($existingPeriod) {
            DB::table('dept_budget_period')
                ->where('period_id', $existingPeriod->period_id)
                ->update([
                    'allocated_amount' => $newWeeklyAmount,
                    'updated_at' => now()
                ]);
        } else {
            DB::table('dept_budget_period')->insert([
                'department_id' => $departmentId,
                'week_start' => $weekStart,
                'allocated_amount' => $newWeeklyAmount,
                'status' => 'active',
                'created_at' => now()
            ]);
        }
        
        // ✅ 8. ✅ FIXED: Log to history - Use WEEKLY amounts, NOT annual
        $department = DB::table('departments')
            ->where('department_id', $departmentId)
            ->first();
        
        DB::table('budget_history')->insert([
            'department_id' => $departmentId,
            'department_name' => $department->department_name ?? 'Unknown',
            'action' => 'weekly_allocated',
            'previous_amount' => $oldWeeklyAmount,          // ✅ FIXED: Weekly amount before
            'added_amount' => $newWeeklyAmount - $oldWeeklyAmount, // ✅ FIXED: Weekly difference
            'new_amount' => $newWeeklyAmount,               // ✅ FIXED: Weekly amount after
            'reason' => $request->reason ?? "Weekly allocation for Week {$weekNumber}: ₱" . number_format($newWeeklyAmount, 2),
            'user_id' => $user->user_id,
            'user_name' => $user->full_name ?? $user->email,
            'created_at' => now(),
        ]);
        
        DB::commit();
        
        return response()->json([
            'success' => true,
            'message' => "✅ Weekly allocation set for Week {$weekNumber}\n" .
                        "Amount: ₱" . number_format($newWeeklyAmount, 2) . "\n" .
                        "Annual budget adjustment: ₱" . number_format($annualDeduction, 2) . "\n" .
                        "Remaining Annual: ₱" . number_format($updatedAnnual->annual_amount, 2),
            'data' => [
                'department_id' => $departmentId,
                'week_number' => $weekNumber,
                'weekly_allocation' => $newWeeklyAmount,
                'old_weekly_allocation' => $oldWeeklyAmount,
                'annual_before' => $currentAnnual,
                'annual_after' => $updatedAnnual->annual_amount,
                'annual_deducted' => $annualDeduction,
            ]
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('Update weekly allocation error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to update weekly allocation: ' . $e->getMessage()
        ], 500);
    }
}

/**
 * ✅ NEW: Process weekly surplus for a department
 */
public function processSurplus(Request $request, $departmentId)
{
    try {
        $user = $request->user();
        
        if ($user->role !== 'mayors_office' && $user->role !== 'gso_office') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        $year = date('Y');
        $weekNumber = date('W') - 1; // Previous week
       // $weekNumber = date('W'); // Current week (testing)

        
        // Get weekly allocation and actual usage
        $weekly = DB::table('weekly_budget_usage')
            ->where('department_id', $departmentId)
            ->where('week_number', $weekNumber)
            ->where('year', $year)
            ->first();
        
        if (!$weekly) {
            return response()->json([
                'success' => false,
                'message' => 'Weekly budget not found for last week'
            ], 404);
        }
        
        $surplus = $weekly->weekly_allocation - $weekly->amount_used;
        
        if ($surplus <= 0) {
            return response()->json([
                'success' => true,
                'surplus' => 0,
                'action' => 'none',
                'message' => 'No surplus to return (used: ₱' . number_format($weekly->amount_used, 2) . ', allocated: ₱' . number_format($weekly->weekly_allocation, 2) . ')'
            ]);
        }
        
        DB::beginTransaction();
        
        try {
            // ✅ 1. Return surplus to annual budget
            DB::table('annual_budgets')
                ->where('department_id', $departmentId)
                ->where('fiscal_year', $year)
                ->increment('annual_amount', $surplus);
            
            // ✅ 2. Log to surplus table
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
                'user_id' => $user->user_id,
                'user_name' => $user->full_name ?? $user->email,
                'created_at' => now(),
            ]);
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'surplus' => $surplus,
                'action' => 'returned_to_annual',
                'message' => "✅ ₱" . number_format($surplus, 2) . " surplus returned to annual budget"
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Process surplus error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to process surplus: ' . $e->getMessage()
            ], 500);
        }
        
    } catch (\Exception $e) {
        Log::error('Process surplus error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to process surplus: ' . $e->getMessage()
        ], 500);
    }
}

/**
 * ✅ NEW: Get surplus history
 */
public function getSurplusHistory(Request $request)
{
    try {
        $departmentId = $request->get('department_id');
        
        $query = DB::table('weekly_budget_surplus')
            ->join('departments', 'weekly_budget_surplus.department_id', '=', 'departments.department_id')
            ->select('weekly_budget_surplus.*', 'departments.department_name', 'departments.department_code')
            ->orderBy('created_at', 'desc');
        
        if ($departmentId) {
            $query->where('weekly_budget_surplus.department_id', $departmentId);
        }
        
        $surplus = $query->get();
        
        return response()->json([
            'success' => true,
            'data' => $surplus
        ]);
        
    } catch (\Exception $e) {
        Log::error('Get surplus history error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to get surplus history: ' . $e->getMessage()
        ], 500);
    }
}
}
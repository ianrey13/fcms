<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BudgetPolicyController extends Controller
{
    /**
     * Get all budget policies with current allocation
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
    
    /**
     * Create a new budget policy
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'department_id' => 'required|exists:departments,department_id',
            'default_weekly_allocation' => 'required|numeric|min:0'
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
        
        DB::beginTransaction();
        
        try {
            $departmentId = $request->department_id;
            $allocation = $request->default_weekly_allocation;
            
            // ✅ Get existing allocation for history
            $existingPolicy = DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->first();
            
            $previousAmount = $existingPolicy ? $existingPolicy->default_weekly_allocation : 0;
            
            // ✅ Insert or Update Policy
            if ($existingPolicy) {
                DB::table('dept_budget_policy')
                    ->where('department_id', $departmentId)
                    ->update([
                        'default_weekly_allocation' => $allocation,
                        'updated_at' => now()
                    ]);
            } else {
                DB::table('dept_budget_policy')->insert([
                    'department_id' => $departmentId,
                    'default_weekly_allocation' => $allocation,
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }
            
            // ✅ Get department name for history
            $department = DB::table('departments')
                ->where('department_id', $departmentId)
                ->first();
            
            // ✅ Log to budget history
            DB::table('budget_history')->insert([
                'department_id' => $departmentId,
                'department_name' => $department->department_name ?? 'Unknown',
                'action' => 'created',
                'previous_amount' => $previousAmount,
                'added_amount' => $allocation,
                'new_amount' => $allocation,
                'reason' => $request->reason ?? 'Initial budget allocation',
                'user_id' => $user->user_id,
                'user_name' => $user->full_name ?? $user->email,
                'created_at' => now(),
            ]);
            
            // ✅ Check if a budget period exists for this week
            $weekStart = now()->startOfWeek()->toDateString();
            
            $existingPeriod = DB::table('dept_budget_period')
                ->where('department_id', $departmentId)
                ->where('week_start', $weekStart)
                ->first();
            
            if ($existingPeriod) {
                DB::table('dept_budget_period')
                    ->where('period_id', $existingPeriod->period_id)
                    ->update([
                        'allocated_amount' => $allocation,
                        'status' => 'active',
                        'closed_at' => null,
                        'updated_at' => now()
                    ]);
            } else {
                DB::table('dept_budget_period')->insert([
                    'department_id' => $departmentId,
                    'week_start' => $weekStart,
                    'allocated_amount' => $allocation,
                    'status' => 'active',
                    'created_at' => now()
                ]);
            }
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'Budget policy created successfully',
                'data' => [
                    'department_id' => $departmentId,
                    'allocated_amount' => $allocation,
                    'week_start' => $weekStart,
                    'previous_amount' => $previousAmount,
                ]
            ], 201);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Store budget policy error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to create policy: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Get a specific budget policy by department
     */
    public function show($departmentId)
    {
        try {
            $policy = DB::table('dept_budget_policy as dbp')
                ->join('departments as d', 'dbp.department_id', '=', 'd.department_id')
                ->where('dbp.department_id', $departmentId)
                ->select('dbp.*', 'd.department_name', 'd.department_code')
                ->first();
            
            if (!$policy) {
                return response()->json([
                    'success' => false,
                    'message' => 'Budget policy not found'
                ], 404);
            }
            
            return response()->json([
                'success' => true,
                'data' => $policy
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch budget policy: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * ✅ UPDATED: Add to existing budget (instead of replace)
     */
    public function update(Request $request, $departmentId)
    {
        try {
            $validator = Validator::make($request->all(), [
                'default_weekly_allocation' => 'sometimes|numeric|min:0',
                'add_amount' => 'sometimes|numeric|min:0',
                'reason' => 'nullable|string|max:255',
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
            
            DB::beginTransaction();
            
            // ✅ Get current policy
            $policy = DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->first();
            
            if (!$policy) {
                return response()->json([
                    'success' => false,
                    'message' => 'Budget policy not found'
                ], 404);
            }
            
            $previousAmount = $policy->default_weekly_allocation;
            
            // ✅ Calculate new amount
            $addAmount = $request->add_amount ?? 0;
            $newAllocation = $previousAmount + $addAmount;
            
            // If default_weekly_allocation is provided directly (for backward compatibility)
            if ($request->has('default_weekly_allocation')) {
                $newAllocation = $request->default_weekly_allocation;
                $addAmount = $newAllocation - $previousAmount;
            }
            
            // ✅ Update policy
            DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->update([
                    'default_weekly_allocation' => $newAllocation,
                    'updated_at' => now(),
                ]);
            
            // ✅ Get department name for history
            $department = DB::table('departments')
                ->where('department_id', $departmentId)
                ->first();
            
            // ✅ Log to budget history
            DB::table('budget_history')->insert([
                'department_id' => $departmentId,
                'department_name' => $department->department_name ?? 'Unknown',
                'action' => $addAmount > 0 ? 'added' : ($addAmount < 0 ? 'reduced' : 'updated'),
                'previous_amount' => $previousAmount,
                'added_amount' => $addAmount,
                'new_amount' => $newAllocation,
                'reason' => $request->reason ?? ($addAmount > 0 ? 'Budget addition' : 'Budget update'),
                'user_id' => $user->user_id,
                'user_name' => $user->full_name ?? $user->email,
                'created_at' => now(),
            ]);
            
            // ✅ Update active budget period for this week
            $weekStart = now()->startOfWeek()->toDateString();
            
            $existingPeriod = DB::table('dept_budget_period')
                ->where('department_id', $departmentId)
                ->where('week_start', $weekStart)
                ->first();
            
            if ($existingPeriod) {
                DB::table('dept_budget_period')
                    ->where('period_id', $existingPeriod->period_id)
                    ->update([
                        'allocated_amount' => $newAllocation,
                        'updated_at' => now()
                    ]);
            } else {
                DB::table('dept_budget_period')->insert([
                    'department_id' => $departmentId,
                    'week_start' => $weekStart,
                    'allocated_amount' => $newAllocation,
                    'status' => 'active',
                    'created_at' => now()
                ]);
            }
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => $addAmount > 0 
                    ? "₱" . number_format($addAmount, 2) . " added to budget successfully!"
                    : "Budget updated successfully!",
                'data' => [
                    'department_id' => $departmentId,
                    'previous_amount' => $previousAmount,
                    'added_amount' => $addAmount,
                    'new_amount' => $newAllocation,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Update budget policy error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update budget policy: ' . $e->getMessage()
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
            
            // Get policy before deleting for history
            $policy = DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->first();
            
            // Delete policy
            $deleted = DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->delete();
            
            if ($deleted === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Budget policy not found'
                ], 404);
            }
            
            // Log deletion
            if ($policy) {
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
            }
            
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
     * ✅ NEW: Get budget history for a department or all
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
     * ✅ NEW: Get budget summary with remaining amounts
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
            
            // Update or create policy
            $policy = DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->first();
            
            if ($policy) {
                $previousAmount = $policy->default_weekly_allocation;
                
                DB::table('dept_budget_policy')
                    ->where('department_id', $departmentId)
                    ->update([
                        'default_weekly_allocation' => $amount,
                        'updated_at' => now()
                    ]);
                
                // Log activation to history
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
                
            } else {
                DB::table('dept_budget_policy')->insert([
                    'department_id' => $departmentId,
                    'default_weekly_allocation' => $amount,
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }
            
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
     * Get all budget periods
     */
    public function getPeriods(Request $request)
    {
        try {
            $departmentId = $request->get('department_id');
            
            $query = DB::table('dept_budget_period as dbp')
                ->join('departments as d', 'dbp.department_id', '=', 'd.department_id')
                ->select('dbp.*', 'd.department_name', 'd.department_code');
            
            if ($departmentId) {
                $query->where('dbp.department_id', $departmentId);
            }
            
            $periods = $query->orderBy('dbp.week_start', 'desc')
                ->get();
            
            return response()->json([
                'success' => true,
                'data' => $periods
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch budget periods: ' . $e->getMessage()
            ], 500);
        }
    }
}
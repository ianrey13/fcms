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
    
    /**
     * Create a new budget policy
     */
  public function store(Request $request)
{
    //  Debug log
    Log::info('=== BudgetPolicyController::store called ===');
    Log::info('Request data:', $request->all());
    Log::info('User ID: ' . ($request->user()?->user_id ?? 'null'));
    Log::info('User Role: ' . ($request->user()?->role ?? 'null'));
    
    $validator = Validator::make($request->all(), [
        'department_id' => 'required|exists:departments,department_id',
        'default_weekly_allocation' => 'required|numeric|min:0'
    ]);
    
    if ($validator->fails()) {
        Log::error('Validation failed:', $validator->errors()->toArray());
        return response()->json(['errors' => $validator->errors()], 422);
    }
    
    $user = $request->user();
    
    if ($user->role !== 'mayors_office' && $user->role !== 'gso_office') {
        Log::warning('Unauthorized attempt', ['role' => $user->role]);
        return response()->json(['message' => 'Unauthorized'], 403);
    }
    
    DB::beginTransaction();
    
    try {
        $departmentId = $request->department_id;
        $allocation = $request->default_weekly_allocation;
        
        Log::info('Processing budget policy', [
            'department_id' => $departmentId,
            'allocation' => $allocation
        ]);
        
        // Insert or Update Policy
        $existingPolicy = DB::table('dept_budget_policy')
            ->where('department_id', $departmentId)
            ->first();
        
        Log::info('Existing policy:', ['policy' => $existingPolicy]);
        
        if ($existingPolicy) {
            DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->update([
                    'default_weekly_allocation' => $allocation,
                    'updated_at' => now()
                ]);
            Log::info('Updated existing policy');
        } else {
            DB::table('dept_budget_policy')->insert([
                'department_id' => $departmentId,
                'default_weekly_allocation' => $allocation,
                'created_at' => now(),
                'updated_at' => now()
            ]);
            Log::info('Created new policy');
        }
        
        // Check if a budget period exists for this week
        $weekStart = now()->startOfWeek()->toDateString();
        Log::info('Week start: ' . $weekStart);
        
        $existingPeriod = DB::table('dept_budget_period')
            ->where('department_id', $departmentId)
            ->where('week_start', $weekStart)
            ->first();
        
        Log::info('Existing period:', ['period' => $existingPeriod]);
        
        if ($existingPeriod) {
            // ✅ UPDATE existing period
            DB::table('dept_budget_period')
                ->where('period_id', $existingPeriod->period_id)
                ->update([
                    'allocated_amount' => $allocation,
                    'status' => 'active',
                    'closed_at' => null,
                    'updated_at' => now()
                ]);
            Log::info('Updated existing period');
        } else {
            // INSERT new period
            DB::table('dept_budget_period')->insert([
                'department_id' => $departmentId,
                'week_start' => $weekStart,
                'allocated_amount' => $allocation,
                'status' => 'active',
                'created_at' => now()
            ]);
            Log::info('Created new period');
        }
        
        // Verify the insert worked
        $verifyPolicy = DB::table('dept_budget_policy')
            ->where('department_id', $departmentId)
            ->first();
        
        $verifyPeriod = DB::table('dept_budget_period')
            ->where('department_id', $departmentId)
            ->where('week_start', $weekStart)
            ->first();
        
        Log::info('Verification after save:', [
            'policy' => $verifyPolicy,
            'period' => $verifyPeriod
        ]);
        
        DB::commit();
        
        Log::info('✅ Transaction committed successfully');
        
        return response()->json([
            'success' => true,
            'message' => 'Budget policy created successfully',
            'data' => [
                'department_id' => $departmentId,
                'allocated_amount' => $allocation,
                'week_start' => $weekStart,
            ]
        ], 201);
        
    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('❌ Failed to create policy: ' . $e->getMessage());
        Log::error('Stack trace: ' . $e->getTraceAsString());
        return response()->json([
            'success' => false,
            'message' => 'Failed to create policy: ' . $e->getMessage()
        ], 500);
    }
}
    
    /**
     * Update a budget policy
     */
    public function update(Request $request, $departmentId)
    {
        try {
            $validator = Validator::make($request->all(), [
                'default_weekly_allocation' => 'required|numeric|min:0'
            ]);
            
            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }
            
            $user = $request->user();
            
            // FIXED: Allow Mayor's Office and GSO Office
            if ($user->role !== 'mayors_office' && $user->role !== 'gso_office') {
                return response()->json([
                    'message' => 'Unauthorized - Only Mayor\'s Office and GSO can manage budget policies'
                ], 403);
            }
            
            $updated = DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->update([
                    'default_weekly_allocation' => $request->default_weekly_allocation,
                    'updated_at' => now(),
                ]);
            
            if ($updated === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Budget policy not found'
                ], 404);
            }
            
            return response()->json([
                'success' => true,
                'message' => 'Budget policy updated successfully'
            ]);
        } catch (\Exception $e) {
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
            
            //Allow Mayor's Office and GSO Office
            if ($user->role !== 'mayors_office' && $user->role !== 'gso_office') {
                return response()->json([
                    'message' => 'Unauthorized - Only Mayor\'s Office and GSO can manage budget policies'
                ], 403);
            }
            
            $deleted = DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->delete();
            
            if ($deleted === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Budget policy not found'
                ], 404);
            }
            
            return response()->json([
                'success' => true,
                'message' => 'Budget policy deleted successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete budget policy: ' . $e->getMessage()
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
            
            //  FIXED: Allow Mayor's Office and GSO Office
            if ($user->role !== 'mayors_office' && $user->role !== 'gso_office') {
                return response()->json([
                    'message' => 'Unauthorized - Only Mayor\'s Office and GSO can manage budget policies'
                ], 403);
            }
            
            $departmentId = $request->department_id;
            $amount = $request->amount;
            $weekStart = now()->startOfWeek();
            
            DB::beginTransaction();
            
            // Check if an active period already exists for this week
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
                        'updated_at' => now(),
                    ]);
                
                DB::table('dept_budget_period')
                    ->where('department_id', $departmentId)
                    ->where('period_id', '!=', $existingPeriod->period_id)
                    ->where('status', 'active')
                    ->update([
                        'status' => 'closed', 
                        'closed_at' => now()
                    ]);
            } else {
                DB::table('dept_budget_period')
                    ->where('department_id', $departmentId)
                    ->where('status', 'active')
                    ->update([
                        'status' => 'closed', 
                        'closed_at' => now()
                    ]);
                
                DB::table('dept_budget_period')->insert([
                    'department_id' => $departmentId,
                    'week_start' => $weekStart,
                    'allocated_amount' => $amount,
                    'status' => 'active',
                    'created_at' => now(),
                ]);
            }
            
            // Ensure policy exists with the correct amount
            $policy = DB::table('dept_budget_policy')
                ->where('department_id', $departmentId)
                ->first();
            
            if (!$policy) {
                DB::table('dept_budget_policy')->insert([
                    'department_id' => $departmentId,
                    'default_weekly_allocation' => $amount,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('dept_budget_policy')
                    ->where('department_id', $departmentId)
                    ->update([
                        'default_weekly_allocation' => $amount,
                        'updated_at' => now(),
                    ]);
            }
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'Budget period activated successfully',
                'data' => [
                    'department_id' => $departmentId,
                    'allocated_amount' => $amount,
                    'week_start' => $weekStart->toDateString(),
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
            
            //  FIXED: Allow Mayor's Office and GSO Office
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
            
            // Get all policies
            $policies = DB::table('dept_budget_policy')->get();
            $createdCount = 0;
            
            $weekStart = now()->startOfWeek();
            
            // Create new active periods for each policy
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
                        'created_at' => now(),
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
}
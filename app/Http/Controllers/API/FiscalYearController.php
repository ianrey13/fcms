<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\FiscalYear;
use App\Models\DeptBudgetPolicy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class FiscalYearController extends Controller
{
    /**
     * Get all fiscal years
     */
    public function index(Request $request)
    {
        try {
            $query = FiscalYear::with('creator');
            
            if ($request->has('is_active')) {
                $query->where('is_active', $request->is_active);
            }
            
            $years = $query->orderBy('year', 'desc')->get();
            
            return response()->json([
                'success' => true,
                'data' => $years,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch fiscal years: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Store a new fiscal year
     */
    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'year' => 'required|integer|min:2000|max:2100|unique:fiscal_years,year',
            ]);
            
            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }
            
            // ✅ Deactivate all other fiscal years
            FiscalYear::where('is_active', true)->update(['is_active' => false]);
            
            $fiscalYear = FiscalYear::create([
                'year' => $request->year,
                'is_active' => true,
                'created_by' => auth()->id(),
            ]);
            
            // ✅ Load weekly ceilings for this fiscal year
            $this->loadWeeklyCeilingsForFiscalYear($request->year);
            
            return response()->json([
                'success' => true,
                'message' => 'Fiscal year added and activated successfully',
                'data' => $fiscalYear,
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to add fiscal year: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Toggle fiscal year status
     * ✅ When activating, load the weekly ceilings for that fiscal year
     */
    public function toggleStatus($id)
    {
        try {
            $fiscalYear = FiscalYear::findOrFail($id);

            DB::beginTransaction();

            if ($fiscalYear->is_active) {
                // Deactivate
                $fiscalYear->is_active = false;
                $fiscalYear->save();
                $message = 'Fiscal year deactivated';
            } else {
                // ✅ Activate - deactivate all others first
                FiscalYear::where('is_active', true)->update(['is_active' => false]);

                $fiscalYear->is_active = true;
                $fiscalYear->save();

                // ✅ Load weekly ceilings for this fiscal year
                $this->loadWeeklyCeilingsForFiscalYear($fiscalYear->year);

                $message = 'Fiscal year activated and weekly ceilings loaded';
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => $fiscalYear
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Toggle fiscal year error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to toggle fiscal year: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * ✅ Load weekly ceilings for a specific fiscal year
     */
    private function loadWeeklyCeilingsForFiscalYear($year)
    {
        // Get all policies for this fiscal year
        $policies = DeptBudgetPolicy::where('fiscal_year', $year)->get();

        Log::info('📊 Loading weekly ceilings for fiscal year: ' . $year, [
            'departments_found' => $policies->count(),
        ]);

        foreach ($policies as $policy) {
            // ✅ Update the main policy (for backward compatibility)
            DeptBudgetPolicy::updateOrCreate(
                [
                    'department_id' => $policy->department_id,
                ],
                [
                    'default_weekly_allocation' => $policy->default_weekly_allocation,
                    'fiscal_year' => $year,  // ✅ Store with fiscal year
                    'updated_at' => now(),
                ]
            );

            Log::info('✅ Updated weekly ceiling for department: ' . $policy->department_id, [
                'weekly_allocation' => $policy->default_weekly_allocation,
            ]);
        }

        return $policies->count();
    }
    
    /**
     * Delete fiscal year
     */
    public function destroy($id)
    {
        try {
            $fiscalYear = FiscalYear::findOrFail($id);
            
            // Check if there are budgets associated
            if ($fiscalYear->annualBudgets()->count() > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete fiscal year with existing budgets'
                ], 400);
            }
            
            $fiscalYear->delete();
            
            return response()->json([
                'success' => true,
                'message' => 'Fiscal year deleted successfully',
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete fiscal year: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get active fiscal year
     */
    public function getActive(Request $request)
    {
        try {
            $active = FiscalYear::where('is_active', true)->first();
            
            return response()->json([
                'success' => true,
                'data' => $active,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get active fiscal year: ' . $e->getMessage()
            ], 500);
        }
    }
}
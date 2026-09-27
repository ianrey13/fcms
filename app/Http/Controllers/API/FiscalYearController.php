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

            // ★ REMOVED: loadWeeklyCeilingsForFiscalYear() call —
            //   toggling a fiscal year should never rewrite dept_budget_policy rows.

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

                // ★ REMOVED: loadWeeklyCeilingsForFiscalYear() call.

                $message = 'Fiscal year activated';
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
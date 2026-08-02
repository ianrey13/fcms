<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\FiscalYear;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

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
            
            $fiscalYear = FiscalYear::create([
                'year' => $request->year,
                'is_active' => true,
                'created_by' => auth()->id(),
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'Fiscal year added successfully',
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
            $fiscalYear->is_active = !$fiscalYear->is_active;
            $fiscalYear->save();
            
            return response()->json([
                'success' => true,
                'message' => 'Fiscal year status updated',
                'data' => $fiscalYear,
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update status: ' . $e->getMessage()
            ], 500);
        }
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
}
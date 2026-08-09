<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DepartmentController extends Controller
{
    /**
     * Display a listing of departments.
     */
    public function index()
    {
        try {
            $departments = Department::orderBy('department_name')->get();

            return response()->json([
                'success' => true,
                'data' => $departments
            ]);
        } catch (\Exception $e) {
            Log::error('Department index error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch departments: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created department.
     */
    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'department_name' => 'required|string|max:150|unique:departments,department_name',
                'department_code' => 'required|string|max:20|unique:departments,department_code',
                'head_of_office' => 'nullable|string|max:150',  // ✅ ADD THIS
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $department = Department::create([
                'department_name' => $request->department_name,
                'department_code' => strtoupper($request->department_code),
                'head_of_office' => $request->head_of_office,  // ✅ ADD THIS
                'is_active' => true,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Department created successfully',
                'data' => $department
            ], 201);
        } catch (\Exception $e) {
            Log::error('Department store error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to create department: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified department.
     */
    public function show($id)
    {
        try {
            $department = Department::findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $department
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Department not found'
            ], 404);
        }
    }

    /**
     * Update the specified department.
     */
    public function update(Request $request, $id)
    {
        try {
            $department = Department::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'department_name' => 'required|string|max:150|unique:departments,department_name,' . $id . ',department_id',
                'department_code' => 'required|string|max:20|unique:departments,department_code,' . $id . ',department_id',
                'head_of_office' => 'nullable|string|max:150',  // ✅ ADD THIS
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $department->update([
                'department_name' => $request->department_name,
                'department_code' => strtoupper($request->department_code),
                'head_of_office' => $request->head_of_office,  // ✅ ADD THIS
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Department updated successfully',
                'data' => $department
            ]);
        } catch (\Exception $e) {
            Log::error('Department update error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update department'
            ], 500);
        }
    }

    /**
     * Remove the specified department (soft delete).
     */
    public function destroy($id)
    {
        try {
            $department = Department::findOrFail($id);

            // Check if department has users
            if ($department->users()->count() > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete department with existing users'
                ], 400);
            }

            $department->delete(); // Soft delete

            return response()->json([
                'success' => true,
                'message' => 'Department deleted successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Department destroy error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete department'
            ], 500);
        }
    }

    /**
     * Toggle department status (active/inactive)
     */
    public function toggleStatus(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'is_active' => 'required|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $department = Department::find($id);

            if (!$department) {
                return response()->json([
                    'success' => false,
                    'message' => 'Department not found'
                ], 404);
            }

            $department->is_active = $request->is_active;
            $department->save();

            return response()->json([
                'success' => true,
                'message' => 'Department status updated successfully',
                'data' => $department
            ]);
        } catch (\Exception $e) {
            Log::error('Department toggleStatus error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update department status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all departments for Mayor's Office
     */
    public function getAllDepartmentsForMO(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user->isMayorsOffice()) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $departments = Department::select('department_id', 'department_name', 'department_code')
                ->where('is_active', true)
                ->orderBy('department_name')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $departments
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get active departments only (for dropdowns)
     */
    public function getActiveDepartments()
    {
        try {
            $departments = Department::where('is_active', true)
                ->orderBy('department_name')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $departments
            ]);
        } catch (\Exception $e) {
            Log::error('Get active departments error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch active departments: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get departments for selector (lightweight, only active)
     */
    public function getAllForSelector()
    {
        try {
            $departments = Department::select('department_id', 'department_name', 'department_code', 'head_of_office')  // ✅ ADD head_of_office
                ->where('is_active', true)
                ->orderBy('department_name')
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
}
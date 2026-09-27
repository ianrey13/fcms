<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Driver;
use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UserController extends Controller
{
    /**
     * Get all users
     */
    public function index(Request $request)
    {
        try {
            $query = User::with('department');

            if ($request->has('role')) {
                $query->where('role', $request->role);
            }

            if ($request->has('status')) {
                $query->where('status', $request->status);
            }

            if ($request->has('department_id')) {
                $query->where('department_id', $request->department_id);
            }

            if ($request->has('search')) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                      ->orWhere('last_name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%")
                      ->orWhere('employee_number', 'like', "%{$search}%");
                });
            }

            $users = $query->orderBy('created_at', 'desc')->get();

            $formattedUsers = $users->map(function($user) {
                // $hasSignature = !empty($user->esignature_path) && $user->esignature_path !== null;
                $canDrive = $user->can_drive ?? false;

                return [
                    'user_id' => $user->user_id,
                    'employee_number' => $user->employee_number,
                    'email' => $user->email,
                    'first_name' => $user->first_name,
                    'middle_name' => $user->middle_name,
                    'last_name' => $user->last_name,
                    'full_name' => $user->full_name,
                    'role' => $user->role,
                    'role_label' => $this->getRoleLabel($user->role),
                    'department_id' => $user->department_id,
                    'department_name' => $user->department?->department_name,
                    'department_code' => $user->department?->department_code,
                    'status' => $user->status,
                    'can_drive' => $canDrive,
                    'last_login_at' => $user->last_login_at,
                    'created_at' => $user->created_at,
                    'must_change_password' => (bool) $user->must_change_password,   // ★ NEW
                    // 'has_signature' => $hasSignature,
                    // 'signature_url' => $hasSignature ? Storage::url($user->esignature_path) : null,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $formattedUsers,
                'total' => $formattedUsers->count()
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch users: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * ✅ Get available roles based on department
     */
    private function getAvailableRoles($departmentId)
    {
        $department = Department::find($departmentId);

        if (!$department) {
            return ['driver'];
        }

        $code = strtoupper($department->department_code);

        // ✅ GSO Department → GSO Staff + Driver
        if ($code === 'GSO') {
            return ['gso_office', 'driver'];
        }

        // ✅ Mayor's Office → Disbursing Officer + Driver
        if ($code === 'MO') {
            return ['mayors_office', 'driver'];
        }

        // ✅ Other Departments → Driver only
        return ['driver'];
    }

    /**
     * ✅ Validate role based on department
     */
    private function validateRoleForDepartment($departmentId, $role)
    {
        $allowedRoles = $this->getAvailableRoles($departmentId);
        return in_array($role, $allowedRoles);
    }

    /**
     * Create a new user
     * ✅ Added role validation based on department
     * ✅ Sets must_change_password = true
     */
    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'email' => 'required|email|unique:users,email',
                'employee_number' => 'nullable|string|max:50|unique:users,employee_number',
                'first_name' => 'required|string|max:50',
                'last_name' => 'required|string|max:50',
                'middle_name' => 'nullable|string|max:50',
                'department_id' => 'required|exists:departments,department_id',
                'role' => 'required|in:gso_office,mayors_office,driver',
                'can_drive' => 'sometimes|boolean',
                'password' => 'required|string|min:8|confirmed',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // ✅ Validate role based on department
            if (!$this->validateRoleForDepartment($request->department_id, $request->role)) {
                $allowed = $this->getAvailableRoles($request->department_id);
                $allowedLabels = array_map(function($r) {
                    return $this->getRoleLabel($r);
                }, $allowed);

                return response()->json([
                    'success' => false,
                    'message' => 'Invalid role for selected department',
                    'errors' => [
                        'role' => [
                            "Only " . implode(' or ', $allowedLabels) . " roles are allowed for this department."
                        ]
                    ]
                ], 422);
            }

            DB::beginTransaction();

            // Create user
            $user = User::create([
                'department_id' => $request->department_id,
                'first_name' => $request->first_name,
                'middle_name' => $request->middle_name,
                'last_name' => $request->last_name,
                'email' => $request->email,
                'employee_number' => $request->employee_number,
                'password_hash' => Hash::make($request->password),
                'role' => $request->role,
                'can_drive' => $request->can_drive ?? false,
                'status' => 'active',
                'password_changed_at' => now(),
                'must_change_password' => true,   // ★ NEW — force change on first login
            ]);

            // Create driver record if role is driver
            if ($request->role === 'driver') {
                Driver::create([
                    'user_id' => $user->user_id,
                    'status' => 'active',
                    'created_at' => now(),
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'User created successfully',
                'data' => [
                    'user_id' => $user->user_id,
                    'employee_number' => $user->employee_number,
                    'email' => $user->email,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'role' => $user->role,
                    'department_id' => $user->department_id,
                    'can_drive' => $user->can_drive,
                ]
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get a specific user
     */
    public function show($id)
    {
        try {
            $user = User::with('department')->findOrFail($id);

            // $hasSignature = !empty($user->esignature_path) && $user->esignature_path !== null;
            $canDrive = $user->can_drive ?? false;

            return response()->json([
                'success' => true,
                'data' => [
                    'user_id' => $user->user_id,
                    'employee_number' => $user->employee_number,
                    'email' => $user->email,
                    'first_name' => $user->first_name,
                    'middle_name' => $user->middle_name,
                    'last_name' => $user->last_name,
                    'full_name' => $user->full_name,
                    'role' => $user->role,
                    'role_label' => $this->getRoleLabel($user->role),
                    'department_id' => $user->department_id,
                    'department_name' => $user->department?->department_name,
                    'department_code' => $user->department?->department_code,
                    'status' => $user->status,
                    'can_drive' => $canDrive,
                    'last_login_at' => $user->last_login_at,
                    'created_at' => $user->created_at,
                    'password_expires_at' => $user->password_expires_at,
                    'account_locked_until' => $user->account_locked_until,
                    'must_change_password' => (bool) $user->must_change_password,   // ★ NEW
                    // 'has_signature' => $hasSignature,
                    // 'signature_url' => $hasSignature ? Storage::url($user->esignature_path) : null,
                    // ✅ Add available roles for this user's department
                    'available_roles' => $this->getAvailableRoles($user->department_id),
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }
    }

    /**
     * Update a user
     * ✅ Added role validation based on department
     */
    public function update(Request $request, $id)
    {
        try {
            $user = User::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'email' => 'sometimes|required|email|unique:users,email,' . $id . ',user_id',
                'employee_number' => 'sometimes|nullable|string|max:50|unique:users,employee_number,' . $id . ',user_id',
                'first_name' => 'sometimes|required|string|max:50',
                'last_name' => 'sometimes|required|string|max:50',
                'middle_name' => 'nullable|string|max:50',
                'department_id' => 'sometimes|required|exists:departments,department_id',
                'role' => 'sometimes|required|in:gso_office,mayors_office,driver',
                'can_drive' => 'sometimes|boolean',
                'status' => 'sometimes|required|in:active,inactive',
                'password' => 'nullable|string|min:8|confirmed',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            DB::beginTransaction();

            $departmentId = $request->has('department_id') ? $request->department_id : $user->department_id;
            $role = $request->has('role') ? $request->role : $user->role;

            // ✅ Validate role based on department (if either changed)
            if (!$this->validateRoleForDepartment($departmentId, $role)) {
                $allowed = $this->getAvailableRoles($departmentId);
                $allowedLabels = array_map(function($r) {
                    return $this->getRoleLabel($r);
                }, $allowed);

                return response()->json([
                    'success' => false,
                    'message' => 'Invalid role for selected department',
                    'errors' => [
                        'role' => [
                            "Only " . implode(' or ', $allowedLabels) . " roles are allowed for this department."
                        ]
                    ]
                ], 422);
            }

            // Update user fields
            if ($request->has('email')) {
                $user->email = $request->email;
            }
            if ($request->has('employee_number')) {
                $user->employee_number = $request->employee_number;
            }
            if ($request->has('first_name')) {
                $user->first_name = $request->first_name;
            }
            if ($request->has('last_name')) {
                $user->last_name = $request->last_name;
            }
            if ($request->has('middle_name')) {
                $user->middle_name = $request->middle_name;
            }
            if ($request->has('department_id')) {
                $user->department_id = $request->department_id;
            }
            if ($request->has('role')) {
                $user->role = $request->role;

                // Handle driver record
                if ($request->role === 'driver') {
                    Driver::firstOrCreate(
                        ['user_id' => $user->user_id],
                        ['status' => 'active', 'created_at' => now()]
                    );
                }
            }
            if ($request->has('can_drive')) {
                $user->can_drive = $request->can_drive;
            }
            if ($request->has('status')) {
                $user->status = $request->status;
            }

            // Update password if provided
            if ($request->filled('password')) {
                $user->password_hash = Hash::make($request->password);
                $user->password_changed_at = now();
            }

            $user->save();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'User updated successfully',
                'data' => $user
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to update user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a user (soft delete)
     */
    public function destroy($id)
    {
        try {
            $user = User::findOrFail($id);

            if ($user->user_id == auth()->id()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete your own account'
                ], 400);
            }

            $user->status = 'inactive';
            $user->deactivated_at = now();
            $user->deactivated_by = auth()->id();
            $user->save();

            $user->tokens()->delete();

            return response()->json([
                'success' => true,
                'message' => 'User deactivated successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to deactivate user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update user status
     */
    public function updateStatus(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'status' => 'required|in:active,inactive'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = User::findOrFail($id);

            if ($user->user_id == auth()->id() && $request->status === 'inactive') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot deactivate your own account'
                ], 400);
            }

            $user->status = $request->status;

            if ($request->status === 'inactive') {
                $user->deactivated_at = now();
                $user->deactivated_by = auth()->id();
                $user->tokens()->delete();
            } else {
                $user->deactivated_at = null;
                $user->deactivated_by = null;
                $user->failed_login_attempts = 0;
                $user->account_locked_until = null;
            }

            $user->save();

            return response()->json([
                'success' => true,
                'message' => 'User status updated successfully',
                'data' => ['status' => $user->status]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update user status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reset user password
     * ✅ Sets must_change_password = true (force change on next login)
     */
    public function resetPassword($id)
    {
        try {
            $user = User::findOrFail($id);

            $tempPassword = Str::random(10);

            $user->password_hash = Hash::make($tempPassword);
            $user->password_changed_at = now();
            $user->must_change_password = true;   // ★ NEW — force change on next login
            $user->save();

            $user->tokens()->delete();

            return response()->json([
                'success' => true,
                'message' => 'Password reset successfully',
                'temporary_password' => $tempPassword
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to reset password: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update user's department only
     */
    public function updateDepartment(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'department_id' => 'nullable|exists:departments,department_id'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = User::findOrFail($id);
            $user->department_id = $request->department_id;
            $user->save();

            return response()->json([
                'success' => true,
                'message' => 'User department updated successfully',
                'data' => [
                    'user_id' => $user->user_id,
                    'department_id' => $user->department_id
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update user department: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get active drivers for department staff
     */
    public function getActiveDrivers(Request $request)
    {
        try {
            $user = auth()->user();
            $departmentId = $request->get('department_id', $user->department_id);

            $drivers = User::where('role', 'driver')
                ->where('department_id', $departmentId)
                ->where('status', 'active')
                ->where('can_drive', true)
                ->with('driver')
                ->orderBy('first_name')
                ->get()
                ->map(function($user) {
                    return [
                        'driver_id' => $user->driver->driver_id ?? null,
                        'user_id' => $user->user_id,
                        'full_name' => $user->full_name,
                        'email' => $user->email,
                        'first_name' => $user->first_name,
                        'last_name' => $user->last_name,
                        'status' => $user->status,
                        'can_drive' => $user->can_drive,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $drivers
            ]);
        } catch (\Exception $e) {
            Log::error('Get active drivers error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch drivers: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get role label
     * ✅ Updated for new roles
     */
    private function getRoleLabel($role)
    {
        $labels = [
            'gso_office' => 'GSO Office',
            'mayors_office' => "Disbursing Officer",
            'driver' => 'Driver',
        ];

        return $labels[$role] ?? ucfirst($role);
    }

    /**
     * ✅ Get available roles for a department (for frontend)
     */
    public function getAvailableRolesForDepartment($departmentId)
    {
        try {
            $roles = $this->getAvailableRoles($departmentId);

            $roleLabels = array_map(function($role) {
                return [
                    'value' => $role,
                    'label' => $this->getRoleLabel($role),
                ];
            }, $roles);

            return response()->json([
                'success' => true,
                'data' => $roleLabels,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get available roles: ' . $e->getMessage()
            ], 500);
        }
    }
}
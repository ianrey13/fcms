<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Helpers\AuditHelper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Carbon\Carbon;

class AuthController extends Controller
{
    /**
     * User login
     */
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string',
            'device_name' => 'nullable|string|max:100'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Find user by email
        $user = User::where('email', $request->email)->first();

        // Check if user exists
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        // Check if user is active
        if (!$user->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'Your account is inactive. Please contact administrator.'
            ], 401);
        }

        // Check if account is locked
        if ($user->account_locked_until && now()->lessThan($user->account_locked_until)) {
            $minutes = now()->diffInMinutes($user->account_locked_until);
            return response()->json([
                'success' => false,
                'message' => "Account is locked. Try again in {$minutes} minutes."
            ], 401);
        }

        // Check password
        if (!Hash::check($request->password, $user->password_hash)) {
            // Increment failed login attempts
            $user->failed_login_attempts = $user->failed_login_attempts + 1;
            
            // Lock account after 5 failed attempts
            if ($user->failed_login_attempts >= 5) {
                $user->account_locked_until = now()->addMinutes(30);
                $user->save();
                
                return response()->json([
                    'success' => false,
                    'message' => 'Too many failed attempts. Account locked for 30 minutes.'
                ], 401);
            }
            
            $user->save();

            Log::info('🔐 Attempting to log login for user: ' . $user->user_id);
            AuditHelper::logLogin($user);
            Log::info('✅ Login logged for user: ' . $user->user_id);
            
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        // Reset failed login attempts on successful login
        $user->failed_login_attempts = 0;
        $user->account_locked_until = null;
        $user->last_login_at = now();
        $user->save();

        //Log login activity 
        AuditHelper::logLogin($user);

        // ✅ ============================================================
        // ✅ NEW: Check and reset weekly budget if Mayor's Office user
        // ✅ ============================================================
        if ($user->role === 'mayors_office') {
            $this->checkAndResetWeeklyBudget($user);
        }

        // Create token
        $deviceName = $request->device_name ?? 'web';
        $token = $user->createToken($deviceName)->plainTextToken;

        // Get role label
        $roleLabel = $this->getRoleLabel($user->role);

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'user' => [
                    'user_id' => $user->user_id,
                    'first_name' => $user->first_name,
                    'middle_name' => $user->middle_name,
                    'last_name' => $user->last_name,
                    'full_name' => $user->full_name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'role_label' => $roleLabel,
                    'department_id' => $user->department_id,
                    'department_name' => $user->department ? $user->department->department_name : null,
                    'department_code' => $user->department?->department_code,
                    'status' => $user->status,
                    'head_active_status' => $user->head_active_status,
                    'last_login_at' => $user->last_login_at,
                ],
                'token' => $token,
                'token_type' => 'Bearer'
            ]
        ]);
    }

    /**
     * ✅ Check and reset weekly budget if needed
     */
    private function checkAndResetWeeklyBudget($user)
    {
        try {
            $today = Carbon::now();
            $currentWeek = $today->weekOfYear;
            $currentYear = $today->year;
            
            // ✅ Check if reset was already done this week
            $resetDone = DB::table('weekly_budget_usage')
                ->where('week_number', $currentWeek)
                ->where('year', $currentYear)
                ->exists();
            
            // ✅ If not reset yet, run the reset
            if (!$resetDone) {
                Log::info('🔄 Weekly budget reset triggered by Mayor\'s Office login', [
                    'user_id' => $user->user_id,
                    'user_email' => $user->email,
                    'week' => $currentWeek,
                    'year' => $currentYear,
                ]);
                
                // ✅ Call the stored procedure
                DB::statement('CALL proc_weekly_budget_reset();');
                
                // ✅ Log the reset in budget history
                DB::table('budget_history')->insert([
                    'department_id' => 0,
                    'department_name' => 'ALL DEPARTMENTS',
                    'action' => 'weekly_reset',
                    'previous_amount' => 0,
                    'added_amount' => 0,
                    'new_amount' => 0,
                    'reason' => 'Weekly budget reset triggered by Mayor\'s Office login (Week ' . $currentWeek . ')',
                    'user_id' => $user->user_id,
                    'user_name' => $user->full_name,
                    'created_at' => now(),
                ]);
                
                Log::info('✅ Weekly budget reset completed (login trigger)', [
                    'user_id' => $user->user_id,
                    'week' => $currentWeek,
                ]);
            } else {
                Log::info('ℹ️ Weekly budget already reset for this week', [
                    'user_id' => $user->user_id,
                    'week' => $currentWeek,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('❌ Weekly budget reset failed (login trigger): ' . $e->getMessage());
            // Don't block login if reset fails
        }
    }

    /**
     * Get authenticated user
     */
    public function me(Request $request)
    {
        $user = $request->user();
        
        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $user->user_id,
                'first_name' => $user->first_name,
                'middle_name' => $user->middle_name,
                'last_name' => $user->last_name,
                'full_name' => $user->full_name,
                'email' => $user->email,
                'role' => $user->role,
                'role_label' => $this->getRoleLabel($user->role),
                'department_id' => $user->department_id,
                'department_name' => $user->department ? $user->department->department_name : null,
                'department_code' => $user->department?->department_code,
                'status' => $user->status,
                'head_active_status' => $user->head_active_status,
                'last_login_at' => $user->last_login_at,
                'created_at' => $user->created_at,
            ]
        ]);
    }

    /**
     * User logout
     */
    public function logout(Request $request)
    {
        $user = $request->user();
        
        AuditHelper::logLogout($user);

        // Revoke current access token
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully'
        ]);
    }

    /**
     * Logout from all devices
     */
    public function logoutAllDevices(Request $request)
    {
        $user = $request->user();
        
        AuditHelper::log(
            'logout_all',
            'users',
            $user->user_id,
            ['email' => $user->email],
            ['devices' => 'all']
        );

        // Revoke all tokens
        $request->user()->tokens()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out from all devices successfully'
        ]);
    }

    /**
     * Change password
     */
    public function changePassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();

        // Verify current password
        if (!Hash::check($request->current_password, $user->password_hash)) {
            return response()->json([
                'success' => false,
                'message' => 'Current password is incorrect'
            ], 401);
        }

        // Prevent reusing last 5 passwords
        $recentPasswords = DB::table('password_history')
            ->where('user_id', $user->user_id)
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        foreach ($recentPasswords as $oldPassword) {
            if (Hash::check($request->new_password, $oldPassword->password_hash)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot reuse one of your last 5 passwords'
                ], 422);
            }
        }

        // Update password
        $oldHash = $user->password_hash;
        $user->password_hash = Hash::make($request->new_password);
        $user->password_changed_at = now();
        $user->save();

        // Save to password history
        DB::table('password_history')->insert([
            'user_id' => $user->user_id,
            'password_hash' => $oldHash,
            'created_at' => now()
        ]);

        // Delete old password history (keep last 10)
        $oldRecords = DB::table('password_history')
            ->where('user_id', $user->user_id)
            ->orderBy('created_at', 'desc')
            ->skip(10)
            ->take(100)
            ->get();

        foreach ($oldRecords as $record) {
            DB::table('password_history')->where('history_id', $record->history_id)->delete();
        }

        AuditHelper::log(
            'password_changed',
            'users',
            $user->user_id,
            null,
            ['email' => $user->email]
        );

        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully. Please login again.'
        ]);
    }

    /**
     * Update authenticated user's profile
     */
    public function updateProfile(Request $request)
    {
        try {
            $user = $request->user();
            
            $validator = Validator::make($request->all(), [
                'first_name' => 'sometimes|required|string|max:50',
                'last_name' => 'sometimes|required|string|max:50',
                'middle_name' => 'nullable|string|max:50',
                'email' => 'sometimes|required|email|unique:users,email,' . $user->user_id . ',user_id',
            ]);
            
            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }
            
            $oldValues = [
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'middle_name' => $user->middle_name,
                'email' => $user->email,
            ];
            
            if ($request->has('first_name')) {
                $user->first_name = $request->first_name;
            }
            if ($request->has('last_name')) {
                $user->last_name = $request->last_name;
            }
            if ($request->has('middle_name')) {
                $user->middle_name = $request->middle_name;
            }
            if ($request->has('email')) {
                $user->email = $request->email;
            }
            
            $user->save();
            
            AuditHelper::log(
                'profile_updated',
                'users',
                $user->user_id,
                $oldValues,
                [
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'middle_name' => $user->middle_name,
                    'email' => $user->email,
                ]
            );
            
            Log::info('Profile updated', ['user_id' => $user->user_id]);
            
            return response()->json([
                'success' => true,
                'message' => 'Profile updated successfully',
                'data' => [
                    'user_id' => $user->user_id,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'middle_name' => $user->middle_name,
                    'email' => $user->email,
                    'full_name' => $user->full_name,
                    'role' => $user->role,
                    'department_id' => $user->department_id,
                    'department_name' => $user->department?->department_name,
                ]
            ]);
            
        } catch (\Exception $e) {
            Log::error('Update profile error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update profile: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Forgot password - send reset link
     */
    public function forgotPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|exists:users,email'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Email not found',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::where('email', $request->email)->first();

        $token = Str::random(64);
        
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $request->email],
            ['token' => $token, 'created_at' => now()]
        );

        AuditHelper::log(
            'password_reset_requested',
            'users',
            $user->user_id,
            null,
            ['email' => $user->email]
        );

        return response()->json([
            'success' => true,
            'message' => 'Password reset link sent to your email',
            'reset_token' => $token
        ]);
    }

    /**
     * Reset password using token
     */
    public function resetPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|exists:users,email',
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $resetRecord = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->where('token', $request->token)
            ->first();

        if (!$resetRecord) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired reset token'
            ], 400);
        }

        if (now()->diffInMinutes($resetRecord->created_at) > 60) {
            DB::table('password_reset_tokens')->where('email', $request->email)->delete();
            return response()->json([
                'success' => false,
                'message' => 'Reset token has expired'
            ], 400);
        }

        $user = User::where('email', $request->email)->first();
        $user->password_hash = Hash::make($request->password);
        $user->password_changed_at = now();
        $user->save();

        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        AuditHelper::log(
            'password_reset_successful',
            'users',
            $user->user_id,
            null,
            ['email' => $user->email]
        );

        $user->tokens()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Password reset successfully. Please login with your new password.'
        ]);
    }

    /**
     * Refresh token
     */
    public function refreshToken(Request $request)
    {
        $user = $request->user();
        
        $request->user()->currentAccessToken()->delete();
        
        $deviceName = $request->device_name ?? 'web';
        $newToken = $user->createToken($deviceName)->plainTextToken;

        return response()->json([
            'success' => true,
            'token' => $newToken,
            'token_type' => 'Bearer'
        ]);
    }

    /**
     * Get role label
     */
    private function getRoleLabel($role)
    {
        $labels = [
            'superadmin' => 'Super Administrator',
            'mayors_office' => "Mayor's Office",
            'gso_staff' => 'GSO Staff',
            'driver' => 'Driver',
        ];
        
        return $labels[$role] ?? ucfirst($role);
    }
}
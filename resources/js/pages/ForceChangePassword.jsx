// src/pages/ForceChangePassword.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  Loader2,
  LogOut,
} from 'lucide-react';

const ForceChangePassword = () => {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const isValid = () => {
    if (!newPassword || !confirmPassword) return false;
    if (newPassword.length < 8) return false;
    if (newPassword !== confirmPassword) return false;
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both fields');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Uses apiClient baseURL + auto Authorization header
      await authAPI.changeFirstPassword(newPassword);

      // Update local user cache — clear the flag
      const storedUser = JSON.parse(localStorage.getItem('fcms_user') || '{}');
      storedUser.must_change_password = false;
      localStorage.setItem('fcms_user', JSON.stringify(storedUser));

      // Refresh the AuthContext user so protected routes stop redirecting
      if (refreshUser) {
        await refreshUser();
      }

      // Route to the dashboard
      const roleRoutes = {
        superadmin: '/admin/dashboard',
        gso_office: '/gso/dashboard',
        gso_staff: '/gso/dashboard',
        mayors_office: '/mo/dashboard',
        head_of_office: '/head/dashboard',
        dept_office: '/department/dashboard',
        driver: '/driver/dashboard',
      };
      const dashboardPath = roleRoutes[user?.role] || '/dashboard';
      navigate(dashboardPath, { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.errors?.new_password?.[0] ||
        'Failed to change password';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    setShowSignOutConfirm(true);
  };

  const confirmSignOut = async () => {
    setShowSignOutConfirm(false);
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-4 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-2xl border-0 overflow-hidden">
            {/* Top accent */}
            <div className="h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />

            {/* Header */}
            <div className="px-6 pt-8 pb-4 text-center">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl blur-xl opacity-50" />
                  <div className="relative bg-gradient-to-br from-amber-500 to-amber-600 p-4 rounded-2xl shadow-xl">
                    <Lock className="h-10 w-10 text-white" />
                  </div>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Change Your Password
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                For security, you must set a new password before using the system.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
              {error && (
                <Alert
                  variant="destructive"
                  className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 rounded-xl"
                >
                  <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                  <AlertDescription className="text-red-600 dark:text-red-400 text-sm font-medium">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* New Password */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="new_password"
                  className="text-slate-700 dark:text-slate-300 font-semibold text-sm flex items-center gap-2"
                >
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError('');
                    }}
                    className="h-11 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 dark:text-white text-sm pr-10"
                    disabled={loading}
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="confirm_password"
                  className="text-slate-700 dark:text-slate-300 font-semibold text-sm flex items-center gap-2"
                >
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError('');
                    }}
                    className="h-11 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-400 dark:text-white text-sm pr-10"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  {confirmPassword && newPassword === confirmPassword && (
                    <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                  )}
                </div>
              </div>

              {/* Password strength hint */}
              {newPassword && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        newPassword.length < 8
                          ? 'bg-red-500 w-1/3'
                          : newPassword.length < 12
                          ? 'bg-yellow-500 w-2/3'
                          : 'bg-emerald-500 w-full'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 min-w-[48px]">
                    {newPassword.length < 8 ? 'Too short' : newPassword.length < 12 ? 'Good' : 'Strong'}
                  </span>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading || !isValid()}
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Set New Password
                  </>
                )}
              </Button>

              {/* Sign out instead */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={loading}
                  className="w-full text-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out Instead
                </button>
              </div>
            </form>

            {/* Security badge footer */}
            <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-3 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/30 dark:to-slate-900/30">
              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                <span>Your new password must be at least 8 characters and cannot reuse your last 5 passwords</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sign Out confirmation dialog */}
      <AlertDialog open={showSignOutConfirm} onOpenChange={setShowSignOutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-slate-500" />
              Sign Out?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You will be asked to change your password again on next login.
              <br /><br />
              Are you sure you want to sign out?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSignOut}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ForceChangePassword;
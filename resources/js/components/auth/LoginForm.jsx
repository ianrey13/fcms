// src/components/auth/LoginForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, Mail, Lock, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  
  const { login } = useAuth();
  const navigate = useNavigate();

  // Load saved email from localStorage on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Validation
  const isEmailValid = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isPasswordValid = (password) => {
    return password.length >= 6;
  };

  const getEmailError = () => {
    if (!touched.email) return '';
    if (!email) return 'Email is required';
    if (!isEmailValid(email)) return 'Please enter a valid email address';
    return '';
  };

  const getPasswordError = () => {
    if (!touched.password) return '';
    if (!password) return 'Password is required';
    if (!isPasswordValid(password)) return 'Password must be at least 6 characters';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Mark all fields as touched
    setTouched({ email: true, password: true });
    
    // Validation
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    if (!isEmailValid(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    if (!isPasswordValid(password)) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const result = await login(email, password);
      
      if (result.success && result.user) {
        // Save email if remember me is checked
        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }
        
        // Role-based navigation
        const roleRoutes = {
          'superadmin': '/admin/dashboard',
          'gso_staff': '/gso/dashboard',
          'mayors_office': '/mo/dashboard',
          'head_of_office': '/head/dashboard',
          'dept_office': '/department/dashboard',
          'driver': '/driver/dashboard',
        };
        
        const dashboardPath = roleRoutes[result.user.role] || '/dashboard';
        navigate(dashboardPath);
      } else {
        setError(result.message || 'Invalid email or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Alert - Premium Style */}
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50 rounded-xl">
          <AlertDescription className="text-red-600 text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-semibold text-sm">
          Email Address
        </Label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <Mail className="h-4 w-4 text-slate-400" />
          </div>
          <Input
            id="email"
            type="email"
            placeholder="name@company.gov.ph"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => handleFieldBlur('email')}
            className={`pl-10 h-12 rounded-xl transition-all duration-200 bg-white dark:bg-slate-800 border ${
              getEmailError() && touched.email 
                ? 'border-red-400 focus:ring-red-400' 
                : 'border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-blue-400'
            } dark:text-white placeholder:text-slate-400`}
            disabled={loading}
            autoComplete="email"
            autoFocus
          />
        </div>
        {getEmailError() && touched.email && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {getEmailError()}
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-semibold text-sm">
            Password
          </Label>
          <a 
            href="/forgot-password" 
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors"
          >
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <Lock className="h-4 w-4 text-slate-400" />
          </div>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => handleFieldBlur('password')}
            className={`pl-10 pr-10 h-12 rounded-xl transition-all duration-200 bg-white dark:bg-slate-800 border ${
              getPasswordError() && touched.password 
                ? 'border-red-400 focus:ring-red-400' 
                : 'border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-blue-400'
            } dark:text-white`}
            disabled={loading}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {getPasswordError() && touched.password && (
          <p className="text-xs text-red-500 mt-1">{getPasswordError()}</p>
        )}
      </div>

      {/* Remember Me */}
      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
          </div>
          <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors select-none">
            Remember me
          </span>
        </label>
      </div>

      {/* Submit Button - Premium Gradient */}
      <Button 
        type="submit" 
        className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            <KeyRound className="mr-2 h-4 w-4" />
            Sign In
          </>
        )}
      </Button>

      {/* Security Note */}
      <div className="text-center pt-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          {/* <ShieldCheck className="h-3 w-3 text-emerald-500" /> */}
         {/* <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Secured by FCMS
          </ span> */}
        </div>
        {/* <p className="text-[11px] text-slate-400 dark:text-slate-500">
          This system is for authorized personnel only.
          <br />
          All access attempts are logged and monitored.
        </p> */}
      </div>
    </form>
  );
};

// Add AlertCircle import at the top
import { AlertCircle } from 'lucide-react';

export default LoginForm;
// src/components/auth/LoginForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Loader2, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  KeyRound, 
  ShieldCheck, 
  AlertCircle,
  CheckCircle,
  Fingerprint,
  User,
  Clock,
  Sparkles
} from 'lucide-react';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
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

  // Check for Caps Lock
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.getModifierState && e.getModifierState('CapsLock')) {
        setCapsLockOn(true);
      } else {
        setCapsLockOn(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    
    setTouched({ email: true, password: true });
    
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
        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }
        
        const roleRoutes = {
          'superadmin': '/admin/dashboard',
          'gso_office': '/gso/dashboard',
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

  const isFormValid = email && password && isEmailValid(email) && isPasswordValid(password);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 rounded-xl animate-shake">
          <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
          <AlertDescription className="text-red-600 dark:text-red-400 text-sm font-medium">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Welcome Text */}
      <div className="text-center mb-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Welcome back! Please enter your credentials.
        </p>
      </div>

      {/* Email Field */}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-semibold text-sm flex items-center gap-2">
          <Mail className="h-4 w-4 text-slate-400" />
          Email Address
        </Label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <User className="h-4 w-4 text-slate-400" />
          </div>
          <Input
            id="email"
            type="email"
            placeholder="name@company.gov.ph"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => handleFieldBlur('email')}
            onFocus={() => setIsFocused(true)}
            className={`pl-10 h-11 rounded-xl transition-all duration-200 bg-white dark:bg-slate-800 border-2 ${
              getEmailError() && touched.email 
                ? 'border-red-400 focus:ring-2 focus:ring-red-400' 
                : getEmailError() === '' && touched.email && email
                ? 'border-emerald-400 focus:ring-2 focus:ring-emerald-400'
                : 'border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-400'
            } dark:text-white placeholder:text-slate-400 text-sm`}
            disabled={loading}
            autoComplete="email"
            autoFocus
          />
          {touched.email && email && !getEmailError() && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
          )}
        </div>
        {getEmailError() && touched.email && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1 animate-fade-in">
            <AlertCircle className="h-3 w-3" />
            {getEmailError()}
          </p>
        )}
        {touched.email && email && !getEmailError() && (
          <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-1 flex items-center gap-1 animate-fade-in">
            <CheckCircle className="h-3 w-3" />
            Valid email address
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-semibold text-sm flex items-center gap-2">
            <Lock className="h-4 w-4 text-slate-400" />
            Password
          </Label>
          <a 
            href="/forgot-password" 
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors font-medium"
          >
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <KeyRound className="h-4 w-4 text-slate-400" />
          </div>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => handleFieldBlur('password')}
            onKeyDown={(e) => {
              if (e.getModifierState && e.getModifierState('CapsLock')) {
                setCapsLockOn(true);
              }
            }}
            className={`pl-10 pr-10 h-11 rounded-xl transition-all duration-200 bg-white dark:bg-slate-800 border-2 ${
              getPasswordError() && touched.password 
                ? 'border-red-400 focus:ring-2 focus:ring-red-400' 
                : getPasswordError() === '' && touched.password && password
                ? 'border-emerald-400 focus:ring-2 focus:ring-emerald-400'
                : 'border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-400'
            } dark:text-white text-sm`}
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
        
        {/* Caps Lock Warning */}
        {capsLockOn && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 animate-fade-in">
            <AlertCircle className="h-3 w-3" />
            Caps Lock is on
          </p>
        )}
        
        {getPasswordError() && touched.password && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1 animate-fade-in">
            <AlertCircle className="h-3 w-3" />
            {getPasswordError()}
          </p>
        )}
        {touched.password && password && !getPasswordError() && (
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  password.length < 4 ? 'bg-red-500 w-1/4' :
                  password.length < 8 ? 'bg-yellow-500 w-1/2' :
                  password.length < 12 ? 'bg-blue-500 w-3/4' :
                  'bg-emerald-500 w-full'
                }`}
              />
            </div>
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 min-w-[40px]">
              {password.length < 4 ? 'Weak' :
               password.length < 8 ? 'Fair' :
               password.length < 12 ? 'Good' :
               'Strong'}
            </span>
          </div>
        )}
      </div>

      {/* Remember Me */}
      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2.5 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-2 border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500 w-4 h-4 cursor-pointer transition-all duration-200"
            />
            {rememberMe && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <CheckCircle className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </div>
            )}
          </div>
          <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors select-none">
            Remember me
          </span>
        </label>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
          <ShieldCheck className="h-3 w-3" />
          <span>Secure</span>
        </div>
      </div>

      {/* Submit Button */}
      <Button 
        type="submit" 
        className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        disabled={loading || !isFormValid}
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

      

      {/* Security Footer */}
      <div className="flex items-center justify-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
          <ShieldCheck className="h-3 w-3 text-emerald-500" />
          <span>Encrypted Connection</span>
        </div>
        <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
          <Clock className="h-3 w-3" />
          <span>Session Timeout: 60min</span>
        </div>
      </div>
    </form>
  );
};

export default LoginForm;
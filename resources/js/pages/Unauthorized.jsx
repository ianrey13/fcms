// src/pages/Unauthorized.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { AlertTriangle, ShieldOff, Home, LogIn, Lock } from 'lucide-react';

const Unauthorized = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-red-900 p-4 relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden border border-white/20">
          {/* Top Accent Bar - Red for unauthorized */}
          <div className="h-1.5 bg-gradient-to-r from-red-500 via-orange-500 to-red-600" />
          
          {/* Content */}
          <div className="p-8 text-center">
            {/* Animated Icon */}
            <div className="flex justify-center mb-6 relative">
              <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse" />
              <div className="relative bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 rounded-full p-5">
                <AlertTriangle className="h-16 w-16 text-red-600 dark:text-red-400" />
              </div>
              <div className="absolute -top-2 -right-2">
                <ShieldOff className="h-6 w-6 text-red-500" />
              </div>
            </div>
            
            {/* Error Code */}
            <div className="mb-4">
              <h1 className="text-6xl font-bold text-red-600 dark:text-red-400">403</h1>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Lock className="h-3 w-3 text-red-400" />
                <span className="text-xs text-red-400 uppercase tracking-wider">Access Denied</span>
              </div>
            </div>
            
            {/* Message */}
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
              Unauthorized Access
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              You don't have permission to access this page. 
              Please contact your administrator if you believe this is a mistake.
            </p>
            
            {/* Separator */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-300" />
              <span className="text-xs text-slate-400">What would you like to do?</span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-slate-300" />
            </div>
            
            {/* Action Buttons */}
            <div className="space-y-3">
              <Link to="/login">
                <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]">
                  <LogIn className="mr-2 h-4 w-4" />
                  Go Back to Login
                </Button>
              </Link>
              
              <Link to="/">
                <Button variant="outline" className="w-full rounded-xl border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Home className="mr-2 h-4 w-4" />
                  Go to Dashboard
                </Button>
              </Link>
            </div>
            
            {/* Help Text */}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-6">
              Need help? Contact your system administrator or GSO support at{' '}
              <a href="mailto:gso@laguindingan.gov.ph" className="text-blue-600 hover:underline">
                gso@laguindingan.gov.ph
              </a>
            </p>
          </div>
          
          {/* Footer */}
          <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-3 bg-slate-50/50 dark:bg-slate-800/30">
            <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">
              Access attempt logged • {new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
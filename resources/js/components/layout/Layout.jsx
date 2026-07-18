// src/components/layout/Layout.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import NotificationBell from '../notifications/NotificationBell';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from 'react-hot-toast';  // ✅ ADD THIS

const Layout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load dark mode preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('fcms_theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('fcms_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('fcms_theme', 'light');
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const marginLeft = isMobile ? '0' : (isSidebarOpen ? '256px' : '64px');

  // Don't show notification bell for driver (mobile app)
  const showNotificationBell = user?.role !== 'driver';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 transition-colors duration-300">
      {/* ✅ Toast notifications at root level */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 4000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      {/* Header Bar with Premium Design */}
      <div 
        style={{ marginLeft: marginLeft }}
        className="fixed top-0 right-0 left-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm z-30 transition-all duration-300 ease-in-out border-b border-slate-200 dark:border-slate-700"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Menu className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </Button>
            )}
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                {user?.role_label || 'Dashboard'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
          
          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5 text-yellow-500" />
              ) : (
                <Moon className="h-5 w-5 text-slate-600" />
              )}
            </Button>
            
            {/* Notification Bell */}
            {showNotificationBell && (
              <NotificationBell />
            )}
            
            {/* User Avatar */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium shadow-md">
                {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content with top padding for header */}
      <main 
        style={{ marginLeft: marginLeft, paddingTop: '70px' }}
        className="transition-all duration-300 ease-in-out"
      >
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
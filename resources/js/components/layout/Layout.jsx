// resources/js/components/layout/Layout.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import NotificationBell from '../notifications/NotificationBell';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, Sun, Moon, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from 'react-hot-toast';
import { cn } from '@/lib/utils';

const Layout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, logout } = useAuth();

  // Check mobile screen
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load dark mode preference - default to dark
  useEffect(() => {
    const savedTheme = localStorage.getItem('fcms_theme');
    
    if (!savedTheme) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('fcms_theme', 'dark');
    } else {
      const shouldBeDark = savedTheme === 'dark';
      setIsDarkMode(shouldBeDark);
      if (shouldBeDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    }
  }, []);

  // Scroll detection for header shadow
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close profile dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isProfileOpen && !event.target.closest('.profile-dropdown')) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen]);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('fcms_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('fcms_theme', 'light');
    }
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleProfile = () => setIsProfileOpen(!isProfileOpen);

  const handleLogout = () => {
    setIsProfileOpen(false);
    logout();
  };

  const marginLeft = isMobile ? '0' : (isSidebarOpen ? '280px' : '72px');

  const showNotificationBell = user?.role !== 'driver';

  const getUserInitials = () => {
    const firstName = user?.first_name?.charAt(0) || '';
    const lastName = user?.last_name?.charAt(0) || '';
    return `${firstName}${lastName}`.toUpperCase() || 'U';
  };

  const getFullName = () => {
    if (user?.full_name) return user.full_name;
    if (user?.first_name || user?.last_name) {
      return `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
    }
    return user?.email?.split('@')[0] || 'User';
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 bg-grid-pattern dark:bg-grid-pattern-dark">
      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={10}
        toastOptions={{
          duration: 5000,
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            padding: '14px 18px',
            borderRadius: '14px',
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
            border: '1px solid hsl(var(--border))',
            fontSize: '13px',
            fontWeight: '500',
            maxWidth: '400px',
          },
          success: {
            duration: 4000,
            iconTheme: { primary: '#10b981', secondary: '#ffffff' },
            style: { borderLeft: '4px solid #10b981' },
          },
          error: {
            duration: 6000,
            iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
            style: { borderLeft: '4px solid #ef4444' },
          },
          loading: {
            style: { borderLeft: '4px solid #6366f1' },
          },
        }}
      />

      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Premium Header */}
      <header
        role="banner"
        aria-label="Main header"
        style={{ marginLeft }}
        className={cn(
          "fixed top-0 right-0 left-0 z-30 transition-all duration-300 ease-out",
          "bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl",
          scrolled
            ? "shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] border-b border-slate-200/60 dark:border-slate-800/60"
            : "border-b border-transparent"
        )}
      >
        <div className="flex items-center justify-between px-5 py-3 max-w-[1920px] mx-auto">
          {/* Left Section */}
          <div className="flex items-center gap-4 min-w-0">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl h-9 w-9 flex-shrink-0 transition-all duration-200"
                aria-label="Toggle sidebar"
              >
                <Menu className="h-[18px] w-[18px] text-slate-600 dark:text-slate-400" />
              </Button>
            )}
            
            <div className="hidden sm:block min-w-0">
              <h1 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent tracking-tight truncate">
                {user?.role_label || 'Dashboard'}
              </h1>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wide uppercase mt-0.5 flex items-center gap-2">
                <span>{formatDate()}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                <span className="text-blue-500 dark:text-blue-400">● Live</span>
              </p>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-1.5">
            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="rounded-xl h-9 w-9 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 hover:scale-105 active:scale-95"
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <Sun className="h-[18px] w-[18px] text-amber-500 transition-all duration-200" />
              ) : (
                <Moon className="h-[18px] w-[18px] text-slate-500 transition-all duration-200" />
              )}
            </Button>

            {/* Notification Bell */}
            {showNotificationBell && <NotificationBell />}

            {/* User Profile Dropdown */}
            <div className="relative profile-dropdown">
              <button
                onClick={toggleProfile}
                className={cn(
                  "flex items-center gap-3 pl-3 ml-1 border-l border-slate-200 dark:border-slate-800",
                  "hover:opacity-80 transition-all duration-200 group"
                )}
                aria-label="User menu"
                aria-expanded={isProfileOpen}
              >
                <div className="hidden md:block text-right">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                    {getFullName()}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    {user?.role_label || 'User'}
                  </p>
                </div>
                
                <div className="relative flex-shrink-0">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-blue-500/20 ring-2 ring-white dark:ring-slate-800 transition-all duration-200 group-hover:shadow-blue-500/30 group-hover:scale-105">
                    {getUserInitials()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950 shadow-sm shadow-emerald-500/30" />
                </div>

                {/* <ChevronDown className={cn(
                  "h-3.5 w-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200",
                  isProfileOpen && "rotate-180"
                )} /> */}
              </button>

              {/* Profile Dropdown
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/40 border border-slate-200/60 dark:border-slate-800/60 z-50 overflow-hidden animate-scale-in origin-top-right">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-white dark:from-slate-900/50 dark:to-slate-900">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {getFullName()}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {user?.email || 'No email'}
                    </p>
                    <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                      {user?.role_label || 'User'}
                    </span>
                  </div>

                  <div className="p-1">
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        // Navigate to profile
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 group"
                    >
                      <User className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                      <span>Profile Settings</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        // Navigate to settings
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 group"
                    >
                      <Settings className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                      <span>System Settings</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800/60 p-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-200 group"
                    >
                      <LogOut className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )} */}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        style={{ marginLeft }}
        className="transition-all duration-300 ease-out pt-[68px]"
      >
        <div className="p-5 md:p-8 max-w-[1920px] mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
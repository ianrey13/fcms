// src/components/notifications/NotificationBell.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, AlertCircle, DollarSign, Clock, ChevronRight } from 'lucide-react';
import { notificationAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await notificationAPI.getAll({ limit: 20 });
      const data = response.data?.data || [];
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      setIsLoading(true);
      await notificationAPI.markAllAsRead();
      await fetchNotifications();
      toast.success('All notifications marked as read', {
        icon: '✅',
        style: {
          borderRadius: '12px',
          background: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
          border: '1px solid hsl(var(--border))',
        },
      });
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.notification_id);
    
    // Route mapping for different notification types
    const routeMap = {
      budget_assistance_request: '/mo/budget-assistance',
      budget_low_warning: '/mo/budget-management',
      trip_approved: '/gso/all-trips',
      trip_rejected: '/gso/all-trips',
      fuel_receipt_uploaded: '/gso/fuel-receipts',
    };
    
    const targetRoute = routeMap[notification.notification_type];
    if (targetRoute) {
      navigate(targetRoute);
      setIsOpen(false);
    }
  };

  const getNotificationConfig = (type) => {
    switch (type) {
      case 'budget_assistance_request':
        return {
          icon: <DollarSign className="h-4 w-4" />,
          bg: 'bg-amber-50 dark:bg-amber-950/30',
          border: 'border-amber-200 dark:border-amber-800/50',
          iconBg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
          label: 'Budget Request',
        };
      case 'budget_low_warning':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          bg: 'bg-orange-50 dark:bg-orange-950/30',
          border: 'border-orange-200 dark:border-orange-800/50',
          iconBg: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400',
          label: 'Low Budget',
        };
      case 'trip_approved':
        return {
          icon: <Check className="h-4 w-4" />,
          bg: 'bg-emerald-50 dark:bg-emerald-950/30',
          border: 'border-emerald-200 dark:border-emerald-800/50',
          iconBg: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
          label: 'Trip Approved',
        };
      case 'trip_rejected':
        return {
          icon: <X className="h-4 w-4" />,
          bg: 'bg-red-50 dark:bg-red-950/30',
          border: 'border-red-200 dark:border-red-800/50',
          iconBg: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
          label: 'Trip Rejected',
        };
      default:
        return {
          icon: <Bell className="h-4 w-4" />,
          bg: 'bg-blue-50 dark:bg-blue-950/30',
          border: 'border-blue-200 dark:border-blue-800/50',
          iconBg: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
          label: 'Notification',
        };
    }
  };

  const formatMessage = (message) => {
    if (!message) return '';
    return message.length > 90 ? message.substring(0, 90) + '...' : message;
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2.5 rounded-xl transition-all duration-200",
          "hover:bg-slate-100 dark:hover:bg-slate-800",
          isOpen && "bg-slate-100 dark:bg-slate-800"
        )}
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px] text-slate-600 dark:text-slate-400 transition-transform duration-200" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-5 w-5 bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 ring-2 ring-white dark:ring-slate-950 animate-pulse-soft">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/40 border border-slate-200/60 dark:border-slate-800/60 z-50 overflow-hidden animate-scale-in origin-top-right">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/60 bg-gradient-to-r from-slate-50/50 to-white dark:from-slate-900/50 dark:to-slate-900">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-500" />
                Notifications
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up 🎉'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={isLoading}
                className={cn(
                  "text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                <Check className="h-3 w-3" />
                {isLoading ? 'Marking...' : 'Mark all read'}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[440px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mx-auto mb-4">
                  <Bell className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Quiet here</p>
                <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">New notifications will appear here</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const config = getNotificationConfig(notification.notification_type);
                return (
                  <div
                    key={notification.notification_id}
                    className={cn(
                      "group relative px-5 py-4 cursor-pointer transition-all duration-200",
                      "hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:scale-[1.01]",
                      !notification.is_read && "bg-slate-50/50 dark:bg-slate-800/20"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3.5">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200",
                        config.iconBg,
                        "group-hover:scale-110"
                      )}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className={cn(
                              "text-sm leading-relaxed",
                              !notification.is_read 
                                ? "font-semibold text-slate-800 dark:text-slate-200" 
                                : "text-slate-600 dark:text-slate-400"
                            )}>
                              {formatMessage(notification.message)}
                            </p>
                          </div>
                          {!notification.is_read && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/20 flex-shrink-0">
                              NEW
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span className="text-[11px] text-slate-400 font-medium">
                              {formatTime(notification.created_at)}
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                            {config.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                onClick={() => {
                  navigate('/notifications');
                  setIsOpen(false);
                }}
                className="w-full text-center text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center justify-center gap-1"
              >
                View all notifications
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
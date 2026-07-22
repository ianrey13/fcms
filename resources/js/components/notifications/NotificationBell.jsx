// src/components/notifications/NotificationBell.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, AlertCircle, DollarSign } from 'lucide-react';
import { notificationAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
// ✅ Import toast directly from react-hot-toast
import toast from 'react-hot-toast';
import echo from '../../services/echo';
import { useAuth } from '../../contexts/AuthContext';
import eventBus from '../../utils/eventBus';

// ✅ Also import the showToast helper
import { showToast } from '../../utils/toast';

const NotificationBell = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const channelRef = useRef(null);
  const isSubscribedRef = useRef(false);
  
  // ✅ Track notifications already shown to prevent duplicates
  const shownNotificationsRef = useRef(new Set());

  // // ✅ Debug: Test toast on mount
  // useEffect(() => {
  //   console.log('🔔 NotificationBell mounted - testing toast...');
  //   // Test toast after 2 seconds
  //   setTimeout(() => {
  //     toast.success('🔔 NotificationBell is ready!', {
  //       duration: 3000,
  //       position: 'top-right',
  //     });
  //     console.log('✅ Mount toast sent!');
  //   }, 2000);
  // }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  const subscribeToChannel = () => {
    if (!user?.user_id) {
      console.log('⚠️ No user ID, skipping subscription');
      return;
    }

    // ✅ Prevent duplicate subscriptions
    if (isSubscribedRef.current) {
      console.log('✅ Already subscribed to notifications channel');
      return;
    }

    try {
      console.log(`🔔 Subscribing to notifications.${user.user_id}`);
      
      const channel = echo.private(`notifications.${user.user_id}`);
      channelRef.current = channel;

      // ✅ SINGLE listener for notifications
      channel.listen('.notification.new', (data) => {
        console.log('🔔 Notification received in bell:', data);
        
        // ✅ Generate unique ID for this notification
        const notifId = data.notification_id || `${data.entity_type}_${data.entity_id}_${Date.now()}`;
        
        // ✅ Prevent duplicate processing
        if (shownNotificationsRef.current.has(notifId)) {
          console.log('⚠️ Duplicate notification skipped:', notifId);
          return;
        }
        shownNotificationsRef.current.add(notifId);
        
        // ✅ Clear from set after 5 seconds to allow future duplicates
        setTimeout(() => {
          shownNotificationsRef.current.delete(notifId);
        }, 5000);
        
        // ✅ Update notification list
        setNotifications(prev => [data, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        // ✅ Show TOAST using the helper
        showToastForNotification(data);
        
        // ✅ Emit event for dashboard refresh (NO TOAST)
        eventBus.emit('notification-received', data);
      });

      channel.subscribed(() => {
        console.log(`✅ Subscribed to notifications.${user.user_id}`);
        setIsConnected(true);
        isSubscribedRef.current = true;
      });

      channel.error((error) => {
        console.error('❌ Subscription error:', error);
        setIsConnected(false);
        isSubscribedRef.current = false;
      });

    } catch (error) {
      console.error('⚠️ Error subscribing to channel:', error);
    }
  };

  // ✅ Show toast based on notification type
  const showToastForNotification = (data) => {
    const type = data.notification_type;
    const message = data.message || 'New notification';
    
    console.log(`🔔 Showing toast for type: ${type}, message: ${message}`);
    
    // ✅ Different toast styles based on type
    const toastOptions = {
      duration: 5000,
      position: 'top-right',
    };

    // ✅ Map notification types to toast styles
    const toastMap = {
      'trip_created': () => toast.success(`🚗 ${message}`, toastOptions),
      'trip_submitted': () => toast.info(`📋 ${message}`, toastOptions),
      'fund_issued': () => toast.success(`💰 ${message}`, toastOptions),
      'fund_released': () => toast.success(`💵 ${message}`, toastOptions),
      'driver_acknowledged': () => toast.success(`✅ ${message}`, toastOptions),
      'trip_started': () => toast.success(`🚀 ${message}`, toastOptions),
      'trip_completed': () => toast.success(`🏁 ${message}`, toastOptions),
      'trip_reconciled': () => toast.success(`📄 ${message}`, toastOptions),
      'mo_rejected': () => toast.error(`❌ ${message}`, toastOptions),
      'budget_assistance_request': () => toast.warning(`📊 ${message}`, toastOptions),
      'budget_low_warning': () => toast.warning(`⚠️ ${message}`, toastOptions),
      'test': () => toast.success(`🔔 ${message}`, toastOptions),
    };

    // ✅ Default toast
    const showToast = toastMap[type] || (() => toast(message, toastOptions));
    
    try {
      showToast();
      console.log('✅ Toast displayed successfully!');
    } catch (error) {
      console.error('❌ Failed to show toast:', error);
      // ✅ Fallback: Try using showToast helper
      try {
        const { showToast: helperToast } = require('../../utils/toast');
        helperToast('success', message, toastOptions);
      } catch (e) {
        console.error('❌ Fallback toast also failed:', e);
      }
    }
  };

  useEffect(() => {
    if (!user) return;

    console.log('🔔 Setting up real-time notifications for user:', user.user_id);

    if (echo.connector && echo.connector.pusher) {
      const connection = echo.connector.pusher.connection;
      
      connection.bind('connected', () => {
        console.log('✅ WebSocket connected!');
        setIsConnected(true);
        isSubscribedRef.current = false;
        subscribeToChannel();
      });
      
      connection.bind('disconnected', () => {
        console.log('❌ WebSocket disconnected');
        setIsConnected(false);
        isSubscribedRef.current = false;
      });
      
      connection.bind('error', (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
        isSubscribedRef.current = false;
      });

      if (connection.state === 'connected') {
        console.log('✅ Already connected, subscribing...');
        setIsConnected(true);
        subscribeToChannel();
      } else if (connection.state === 'connecting') {
        console.log('⏳ Connecting...');
      } else {
        console.log('📊 Connection state:', connection.state);
        connection.connect();
      }
    }

    return () => {
      if (channelRef.current) {
        try {
          channelRef.current.stopListening('.notification.new');
          isSubscribedRef.current = false;
        } catch (e) {}
      }
      if (echo.connector && echo.connector.pusher) {
        echo.connector.pusher.connection.unbind('connected');
        echo.connector.pusher.connection.unbind('disconnected');
        echo.connector.pusher.connection.unbind('error');
      }
    };
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const response = await notificationAPI.getAll({ limit: 20 });
      const data = response.data?.data || [];
      setNotifications(data);
      const unread = data.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev => 
        prev.map(n => 
          n.notification_id === id ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.notification_id);
    if (notification.notification_type === 'budget_assistance_request') {
      navigate('/mo/budget-assistance');
      setIsOpen(false);
    } else if (notification.notification_type === 'trip_created' || notification.notification_type === 'fund_issued') {
      navigate(`/mo/tickets/${notification.entity_id}`);
      setIsOpen(false);
    } else if (notification.entity_type === 'trip_ticket') {
      navigate(`/mo/tickets/${notification.entity_id}`);
      setIsOpen(false);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      'budget_assistance_request': <DollarSign className="h-4 w-4 text-yellow-500" />,
      'budget_low_warning': <AlertCircle className="h-4 w-4 text-orange-500" />,
      'trip_created': <Bell className="h-4 w-4 text-green-500" />,
      'fund_issued': <DollarSign className="h-4 w-4 text-green-500" />,
      'fund_released': <DollarSign className="h-4 w-4 text-green-500" />,
      'driver_acknowledged': <Check className="h-4 w-4 text-blue-500" />,
      'trip_started': <Check className="h-4 w-4 text-blue-500" />,
      'trip_completed': <Check className="h-4 w-4 text-green-500" />,
      'trip_reconciled': <Check className="h-4 w-4 text-purple-500" />,
      'trip_submitted': <Bell className="h-4 w-4 text-blue-500" />,
      'mo_rejected': <X className="h-4 w-4 text-red-500" />,
      'mo_approved': <Check className="h-4 w-4 text-green-500" />,
    };
    return icons[type] || <Bell className="h-4 w-4 text-blue-500" />;
  };

  const getNotificationColor = (type) => {
    const colors = {
      'budget_assistance_request': 'bg-yellow-50 border-yellow-200',
      'budget_low_warning': 'bg-orange-50 border-orange-200',
      'trip_created': 'bg-green-50 border-green-200',
      'fund_issued': 'bg-green-50 border-green-200',
      'fund_released': 'bg-green-50 border-green-200',
      'driver_acknowledged': 'bg-blue-50 border-blue-200',
      'trip_started': 'bg-blue-50 border-blue-200',
      'trip_completed': 'bg-green-50 border-green-200',
      'trip_reconciled': 'bg-purple-50 border-purple-200',
      'mo_rejected': 'bg-red-50 border-red-200',
      'mo_approved': 'bg-green-50 border-green-200',
    };
    return colors[type] || 'bg-blue-50 border-blue-200';
  };

  const formatMessage = (message) => {
    if (message.length > 100) return message.substring(0, 100) + '...';
    return message;
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'Just now';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) {
      const remainingMins = diffMins % 60;
      if (remainingMins === 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      }
      return `${diffHours}h ${remainingMins}m ago`;
    }
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
      >
        <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        <div className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-800 rounded-lg shadow-lg border dark:border-slate-700 z-50 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              Notifications
              {!isConnected && <span className="ml-2 text-xs text-red-500">(Offline)</span>}
            </span>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead} 
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p>No notifications</p>
                {!isConnected && <p className="text-xs text-red-400 mt-1">⚠️ Real-time connection lost</p>}
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.notification_id}
                  className={`p-3 border-b cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${
                    !notification.is_read ? 'bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500' : ''
                  } ${getNotificationColor(notification.notification_type)}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    <div className="mt-1">{getNotificationIcon(notification.notification_type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.is_read ? 'font-semibold' : ''} dark:text-gray-200`}>
                        {formatMessage(notification.message)}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(notification.created_at)}
                        </p>
                        {!notification.is_read && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">New</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
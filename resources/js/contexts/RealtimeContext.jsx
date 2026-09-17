// src/contexts/RealtimeContext.jsx
// ============================================
// ✅ FIXED: Duplicate subscriptions (subscribeAll running 4+ times)
// ✅ ADDED: hasSubscribedRef + subscribedUserIdRef guards
// ✅ FIXED: Pusher "startTime" error from duplicate subscriptions
// ============================================

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import echo from '../services/echo';
import eventBus from '../utils/eventBus';
import { toast } from 'react-hot-toast';

const RealtimeContext = createContext();

export const useRealtime = () => {
    const context = useContext(RealtimeContext);
    if (!context) {
        throw new Error('useRealtime must be used within RealtimeProvider');
    }
    return context;
};

export const RealtimeProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [subscriptions, setSubscriptions] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [latestNotifications, setLatestNotifications] = useState([]);
    const subscriptionsRef = useRef({});
    const userRef = useRef(null);
    
    // ✅ Guards to prevent duplicate subscriptions
    const hasSubscribedRef = useRef(false);
    const subscribedUserIdRef = useRef(null);
    const subscribeAllRef = useRef(null);

    // ============================================
    // GET USER
    // ============================================

    const getUser = useCallback(() => {
        try {
            const userStr = localStorage.getItem('fcms_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                userRef.current = user;
                return user;
            }
        } catch (e) {}
        return null;
    }, []);

    // ============================================
    // SUBSCRIBE ALL
    // ============================================

    const subscribeAll = useCallback((user) => {
        if (!user) return;

        // ✅ Guard: Skip if already subscribed for this user
        if (subscribedUserIdRef.current === user.user_id) {
            console.log('⏭️ Already subscribed for user', user.user_id, '— skipping');
            return;
        }

        console.log('🔔 Subscribing to all real-time channels for user:', user.user_id);

        // Cleanup old subscriptions
        Object.values(subscriptionsRef.current).forEach(unsub => {
            if (typeof unsub === 'function') unsub();
        });
        subscriptionsRef.current = {};

        // ✅ Mark as subscribed BEFORE subscribing to prevent race conditions
        subscribedUserIdRef.current = user.user_id;
        hasSubscribedRef.current = true;

        // 1. Notifications
        subscribeToNotifications(user);

        // 2. Role-specific subscriptions
        if (user.role === 'gso_office') {
            subscribeToGSO(user);
        } else if (user.role === 'mayors_office') {
            subscribeToMayor(user);
        } else if (user.role === 'driver') {
            subscribeToDriver(user);
        } else {
            subscribeToDepartment(user);
        }

        // 3. System-wide
        subscribeToSystem(user);

        // 4. Fetch initial unread count
        fetchUnreadCount();

        // Emit event
        eventBus.emit('realtime-ready', { user });
    }, []);

    // Store in ref for access without re-creating effects
    subscribeAllRef.current = subscribeAll;

    // ============================================
    // CONNECTION MANAGEMENT
    // ============================================

    useEffect(() => {
        if (!echo?.connector?.pusher) return;

        const connection = echo.connector.pusher.connection;

        const handleConnected = () => {
            console.log('✅ Real-time connected');
            setIsConnected(true);

            // ✅ Only subscribe if we haven't already subscribed for this user
            const user = getUser();
            if (user && subscribedUserIdRef.current !== user.user_id) {
                subscribeAllRef.current(user);
            }
        };

        const handleDisconnected = () => {
            console.log('❌ Real-time disconnected');
            setIsConnected(false);
            // ✅ Reset flags so we can resubscribe on reconnect
            hasSubscribedRef.current = false;
            subscribedUserIdRef.current = null;
        };

        const handleError = (error) => {
            console.error('❌ Pusher error:', error);
        };

        connection.bind('connected', handleConnected);
        connection.bind('disconnected', handleDisconnected);
        connection.bind('error', handleError);

        // ✅ Initial subscription with guard
        const user = getUser();
        if (user && !hasSubscribedRef.current) {
            // Small delay to allow other initialization to complete
            setTimeout(() => {
                if (!hasSubscribedRef.current) {
                    subscribeAllRef.current(user);
                }
            }, 500);
        }

        // Listen for login/logout events
        const handleAuthChange = () => {
            const newUser = getUser();
            if (newUser && subscribedUserIdRef.current !== newUser.user_id) {
                hasSubscribedRef.current = false;
                subscribeAllRef.current(newUser);
            }
        };
        window.addEventListener('auth-change', handleAuthChange);

        return () => {
            connection.unbind('connected', handleConnected);
            connection.unbind('disconnected', handleDisconnected);
            connection.unbind('error', handleError);
            window.removeEventListener('auth-change', handleAuthChange);

            // Cleanup subscriptions
            Object.values(subscriptionsRef.current).forEach(unsub => {
                if (typeof unsub === 'function') unsub();
            });
            subscriptionsRef.current = {};
            hasSubscribedRef.current = false;
            subscribedUserIdRef.current = null;
        };
    }, [getUser]);

    // ============================================
    // NOTIFICATIONS
    // ============================================

    const subscribeToNotifications = useCallback((user) => {
        try {
            const channel = echo.private(`notifications.${user.user_id}`);

            channel.listen('.notification.new', (data) => {
                console.log('📨 Real-time notification:', data);

                setUnreadCount(prev => prev + 1);
                setLatestNotifications(prev => [data, ...prev].slice(0, 50));

                const message = data.message || 'New notification';
                const type = data.notification_type || 'info';

                if (type === 'success' || type === 'trip_approved') {
                    toast.success(message, { duration: 5000 });
                } else if (type === 'error' || type === 'trip_rejected') {
                    toast.error(message, { duration: 5000 });
                } else if (type === 'warning' || type === 'budget_low_warning') {
                    toast.warning(message, { duration: 5000 });
                } else {
                    toast.info(message, { duration: 5000 });
                }

                eventBus.emit('new-notification', data);
                eventBus.emit('refresh-notifications');
            });

            channel.subscribed(() => {
                console.log(`✅ Subscribed to notifications.${user.user_id}`);
            });

            subscriptionsRef.current.notifications = () => {
                channel.unsubscribe();
            };

        } catch (error) {
            console.error('❌ Failed to subscribe to notifications:', error);
        }
    }, []);

    // ============================================
    // GSO SUBSCRIPTIONS
    // ============================================
const subscribeToGSO = useCallback((user) => {
    try {
        // 1. GSO Dashboard
        const gsoChannel = echo.private('gso.dashboard');

        gsoChannel.listen('.trip.updated', (data) => {
            console.log('📋 GSO: Trip updated:', data);
            eventBus.emit('gso-trip-updated', data);
            eventBus.emit('refresh-gso-dashboard');
        });

        gsoChannel.listen('.trip.status_changed', (data) => {
            console.log('📋 GSO: Trip status changed:', data);
            toast.info(`Trip ${data.ticket_number} status: ${data.new_status}`);
            eventBus.emit('gso-trip-status-changed', data);
            eventBus.emit('refresh-gso-dashboard');
        });

        gsoChannel.listen('.trip.funds_released', (data) => {
            console.log('💰 GSO: Funds released:', data);
            toast.success(`Funds released for trip ${data.ticket_number}`);
            eventBus.emit('gso-funds-released', data);
            eventBus.emit('refresh-gso-dashboard');
        });

        gsoChannel.listen('.trip.cancelled', (data) => {
            console.log('❌ GSO: Trip cancelled:', data);
            toast.info(`Trip ${data.trip_ticket_number || data.ticket_number} was cancelled`);
            eventBus.emit('trip-cancelled', data);
            eventBus.emit('gso-trip-updated', data);
            eventBus.emit('refresh-gso-dashboard');
        });

        subscriptionsRef.current.gso = () => {
            gsoChannel.unsubscribe();
        };

        // ✅ Live tracking — THROTTLED event emission
        const trackingChannel = echo.channel('gso-live-tracking');

        // ✅ Throttle window (ms) — prevents render storms
        let lastLocationEmit = 0;
        const LOCATION_THROTTLE_MS = 1000;

        trackingChannel.listen('.location.updated', (data) => {
            const now = Date.now();
            if (now - lastLocationEmit < LOCATION_THROTTLE_MS) {
                return;  // Skip — too soon
            }
            lastLocationEmit = now;

            console.log('📍 GSO: Location updated (throttled):', data.trip_id);
            eventBus.emit('gps-location-updated', data);
            // ❌ Removed: refresh-gso-tracking — LiveTracking.jsx updates state directly
        });

        trackingChannel.listen('.trip.started', (data) => {
            console.log('🚗 GSO: Trip started:', data);
            toast.info(`Trip ${data.trip_id} has started`);
            eventBus.emit('trip-started', data);
            eventBus.emit('refresh-gso-tracking');
        });

        trackingChannel.listen('.trip.completed', (data) => {
            console.log('🏁 GSO: Trip completed:', data);
            toast.success(`Trip ${data.trip_id} completed!`);
            eventBus.emit('trip-completed', data);
            eventBus.emit('refresh-gso-tracking');
            eventBus.emit('refresh-gso-dashboard');
        });

        subscriptionsRef.current.tracking = () => {
            trackingChannel.unsubscribe();
        };

        console.log('✅ GSO real-time subscriptions active');

    } catch (error) {
        console.error('❌ Failed to subscribe to GSO:', error);
    }
}, []);
    // ============================================
    // MAYOR SUBSCRIPTIONS
    // ============================================

    const subscribeToMayor = useCallback((user) => {
        try {
            const channel = echo.private('mayor.dashboard');

            channel.listen('.trip.updated', (data) => {
                console.log('🏛️ Mayor: Trip updated:', data);
                eventBus.emit('mayor-trip-updated', data);
                eventBus.emit('refresh-mayor-dashboard');
            });

            channel.listen('.trip.pending', (data) => {
                console.log('🏛️ Mayor: New pending trip:', data);
                toast.info(`New trip ${data.ticket_number} pending approval`);
                eventBus.emit('mayor-new-pending', data);
                eventBus.emit('refresh-mayor-dashboard');
                eventBus.emit('refresh-mayor-pending');
            });

            channel.listen('.budget.updated', (data) => {
                console.log('💰 Mayor: Budget updated:', data);
                toast.info(`Budget updated for ${data.department_name}`);
                eventBus.emit('mayor-budget-updated', data);
                eventBus.emit('refresh-mayor-budget');
            });

            channel.listen('.budget.low_warning', (data) => {
                console.log('⚠️ Mayor: Budget low warning:', data);
                toast.warning(`⚠️ ${data.department_name} budget is running low!`);
                eventBus.emit('mayor-budget-warning', data);
                eventBus.emit('refresh-mayor-budget');
            });

            channel.listen('.trip.cancelled', (data) => {
                console.log('🏛️ Mayor: Trip cancelled:', data);
                toast.info(`Trip ${data.ticket_number} was cancelled by GSO`);
                eventBus.emit('mayor-trip-cancelled', data);
                eventBus.emit('refresh-mayor-dashboard');
                eventBus.emit('refresh-mayor-pending');
            });

            subscriptionsRef.current.mayor = () => {
                channel.unsubscribe();
            };

            console.log('✅ Mayor real-time subscriptions active');

        } catch (error) {
            console.error('❌ Failed to subscribe to Mayor:', error);
        }
    }, []);

    // ============================================
    // DRIVER SUBSCRIPTIONS
    // ============================================

    const subscribeToDriver = useCallback((user) => {
        try {
            const driverId = user.driver?.driver_id || user.driver_id;
            if (!driverId) {
                console.log('⚠️ No driver ID found for user:', user.user_id);
                return;
            }

            const channel = echo.private(`driver.${driverId}`);

            channel.listen('.trip.assigned', (data) => {
                console.log('🚗 Driver: New trip assigned:', data);
                toast.info(`🚗 New trip assigned: ${data.ticket_number}`);
                eventBus.emit('driver-trip-assigned', data);
                eventBus.emit('refresh-driver-trips');
            });

            channel.listen('.trip.funds_released', (data) => {
                console.log('💰 Driver: Funds released:', data);
                toast.success(`✅ Funds released for trip ${data.ticket_number}`);
                eventBus.emit('driver-funds-released', data);
                eventBus.emit('refresh-driver-trips');
            });

            channel.listen('.trip.updated', (data) => {
                console.log('🚗 Driver: Trip updated:', data);
                eventBus.emit('driver-trip-updated', data);
                eventBus.emit('refresh-driver-trips');
            });

            subscriptionsRef.current.driver = () => {
                channel.unsubscribe();
            };

            console.log('✅ Driver real-time subscriptions active');

        } catch (error) {
            console.error('❌ Failed to subscribe to Driver:', error);
        }
    }, []);

    // ============================================
    // DEPARTMENT SUBSCRIPTIONS
    // ============================================

    const subscribeToDepartment = useCallback((user) => {
        try {
            if (!user.department_id) return;

            const channel = echo.private(`department.${user.department_id}`);

            channel.listen('.trip.created', (data) => {
                console.log('🏢 Department: Trip created:', data);
                toast.info(`New trip created: ${data.ticket_number}`);
                eventBus.emit('dept-trip-created', data);
                eventBus.emit('refresh-dept-trips');
            });

            channel.listen('.trip.updated', (data) => {
                console.log('🏢 Department: Trip updated:', data);
                eventBus.emit('dept-trip-updated', data);
                eventBus.emit('refresh-dept-trips');
            });

            channel.listen('.trip.rejected', (data) => {
                console.log('🏢 Department: Trip rejected:', data);
                toast.error(`Trip ${data.ticket_number} was rejected`);
                eventBus.emit('dept-trip-rejected', data);
                eventBus.emit('refresh-dept-trips');
            });

            subscriptionsRef.current.department = () => {
                channel.unsubscribe();
            };

            console.log('✅ Department real-time subscriptions active');

        } catch (error) {
            console.error('❌ Failed to subscribe to Department:', error);
        }
    }, []);

    // ============================================
    // SYSTEM SUBSCRIPTIONS
    // ============================================

    const subscribeToSystem = useCallback((user) => {
        try {
            if (user.role !== 'gso_office') return;

            const channel = echo.channel('system');

            channel.listen('.system.announcement', (data) => {
                console.log('📢 System announcement:', data);
                toast.info(`📢 ${data.message}`);
                eventBus.emit('system-announcement', data);
            });

            subscriptionsRef.current.system = () => {
                channel.unsubscribe();
            };

        } catch (error) {
            console.error('❌ Failed to subscribe to System:', error);
        }
    }, []);

    // ============================================
    // FETCH UNREAD COUNT
    // ============================================

    const fetchUnreadCount = useCallback(async () => {
        try {
            const token = localStorage.getItem('fcms_token');
            if (!token) return;

            const response = await fetch('/api/notifications/unread-count', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                setUnreadCount(data.count || 0);
            }
        } catch (error) {
            console.error('Failed to fetch unread count:', error);
        }
    }, []);

    // ============================================
    // EMIT & ON HELPERS
    // ============================================

    const emit = useCallback((event, data) => {
        eventBus.emit(event, data);
    }, []);

    const on = useCallback((event, callback) => {
        return eventBus.on(event, callback);
    }, []);

    // ============================================
    // VALUE
    // ============================================

    const value = {
        isConnected,
        unreadCount,
        setUnreadCount,
        latestNotifications,
        subscriptions,
        emit,
        on,
        subscribeAll,
        refresh: fetchUnreadCount,
    };

    return (
        <RealtimeContext.Provider value={value}>
            {children}
        </RealtimeContext.Provider>
    );
};
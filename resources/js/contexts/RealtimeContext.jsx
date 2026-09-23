// src/contexts/RealtimeContext.jsx
// ============================================
// ✅ FIXED: Duplicate subscriptions (subscribeAll running 4+ times)
// ✅ ADDED: hasSubscribedRef + subscribedUserIdRef guards
// ✅ FIXED: Pusher "startTime" error from duplicate subscriptions
// ✅ FIXED: gso-live-tracking duplicate subscription removed
// ✅ FIXED: Retry loop for echo.connector.pusher (was bailing on mount race)
// ✅ FIXED: Per-channel guards (survive component remounts via module scope)
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

// ============================================
// ✅ MODULE-SCOPE GUARDS (survive component remounts)
// ============================================
// These live OUTSIDE the component so they persist across React StrictMode
// double-mounts and AuthContext re-renders.
const moduleGuards = {
    notifications: false,
    gso: false,
    mayor: false,
    driver: false,
    department: false,
    system: false,
    subscribedUserId: null,
};

export const RealtimeProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [subscriptions, setSubscriptions] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [latestNotifications, setLatestNotifications] = useState([]);
    const subscriptionsRef = useRef({});
    const userRef = useRef(null);

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
        } catch (e) {
            console.warn('getUser parse error:', e);
        }
        return null;
    }, []);

    // ============================================
    // NOTIFICATIONS
    // ============================================

    const subscribeToNotifications = useCallback((user) => {
        // ✅ Module-scope guard — survives remounts
        if (moduleGuards.notifications) {
            console.log('⏭️ Notifications already subscribed — skipping');
            return;
        }
        moduleGuards.notifications = true;

        try {
            const userId = user.user_id || user.id;
            const channel = echo.private(`notifications.${userId}`);

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
                console.log(`✅ Subscribed to notifications.${userId}`);
            });

            channel.error((error) => {
                console.error(`❌ Subscription error for notifications.${userId}:`, error);
            });

            subscriptionsRef.current.notifications = () => {
                channel.stopListening('.notification.new');
                channel.unsubscribe();
                moduleGuards.notifications = false;
            };

        } catch (error) {
            moduleGuards.notifications = false;
            console.error('❌ Failed to subscribe to notifications:', error);
        }
    }, []);

    // ============================================
    // GSO SUBSCRIPTIONS
    // ============================================

    const subscribeToGSO = useCallback((user) => {
        if (moduleGuards.gso) {
            console.log('⏭️ GSO already subscribed — skipping');
            return;
        }
        moduleGuards.gso = true;

        try {
            const gsoChannel = echo.private('gso.dashboard');

            gsoChannel.listen('.trip.updated', (data) => {
                console.log('📋 GSO: Trip updated:', data);
                eventBus.emit('gso-trip-updated', data);
                eventBus.emit('refresh-gso-dashboard');
            });

            gsoChannel.listen('.trip.status_changed', (data) => {
                console.log('📋 GSO: Trip status changed:', data);
                if (data.ticket_number && data.new_status) {
                    toast.info(`Trip ${data.ticket_number} status: ${data.new_status}`);
                }
                eventBus.emit('gso-trip-status-changed', data);
                eventBus.emit('refresh-gso-dashboard');
            });

            gsoChannel.listen('.trip.funds_released', (data) => {
                console.log('💰 GSO: Funds released:', data);
                if (data.ticket_number) {
                    toast.success(`Funds released for trip ${data.ticket_number}`);
                }
                eventBus.emit('gso-funds-released', data);
                eventBus.emit('refresh-gso-dashboard');
            });

            gsoChannel.listen('.trip.cancelled', (data) => {
                console.log('❌ GSO: Trip cancelled:', data);
                const num = data.trip_ticket_number || data.ticket_number;
                if (num) {
                    toast.info(`Trip ${num} was cancelled`);
                }
                eventBus.emit('trip-cancelled', data);
                eventBus.emit('gso-trip-updated', data);
                eventBus.emit('refresh-gso-dashboard');
            });

            gsoChannel.listen('.trip.created', (data) => {
                console.log('📋 GSO: Trip created:', data);
                if (data.ticket_number) {
                    toast.info(`New trip created: ${data.ticket_number}`);
                }
                eventBus.emit('gso-trip-created', data);
                eventBus.emit('refresh-gso-dashboard');
            });

            subscriptionsRef.current.gso = () => {
                gsoChannel.stopListening('.trip.updated');
                gsoChannel.stopListening('.trip.status_changed');
                gsoChannel.stopListening('.trip.funds_released');
                gsoChannel.stopListening('.trip.cancelled');
                gsoChannel.stopListening('.trip.created');
                gsoChannel.unsubscribe();
                moduleGuards.gso = false;
            };

            console.log('✅ GSO real-time subscriptions active');

        } catch (error) {
            moduleGuards.gso = false;
            console.error('❌ Failed to subscribe to GSO:', error);
        }
    }, []);

    // ============================================
    // MAYOR SUBSCRIPTIONS
    // ============================================

    const subscribeToMayor = useCallback((user) => {
        if (moduleGuards.mayor) return;
        moduleGuards.mayor = true;

        try {
            const channel = echo.private('mayor.dashboard');

            channel.listen('.trip.updated', (data) => {
                console.log('🏛️ Mayor: Trip updated:', data);
                eventBus.emit('mayor-trip-updated', data);
                eventBus.emit('refresh-mayor-dashboard');
            });

            channel.listen('.trip.pending', (data) => {
                console.log('🏛️ Mayor: New pending trip:', data);
                if (data.ticket_number) {
                    toast.info(`New trip ${data.ticket_number} pending approval`);
                }
                eventBus.emit('mayor-new-pending', data);
                eventBus.emit('refresh-mayor-dashboard');
                eventBus.emit('refresh-mayor-pending');
            });

            channel.listen('.budget.updated', (data) => {
                console.log('💰 Mayor: Budget updated:', data);
                if (data.department_name) {
                    toast.info(`Budget updated for ${data.department_name}`);
                }
                eventBus.emit('mayor-budget-updated', data);
                eventBus.emit('refresh-mayor-budget');
            });

            channel.listen('.budget.low_warning', (data) => {
                console.log('⚠️ Mayor: Budget low warning:', data);
                if (data.department_name) {
                    toast.warning(`${data.department_name} budget is running low!`);
                }
                eventBus.emit('mayor-budget-warning', data);
                eventBus.emit('refresh-mayor-budget');
            });

            channel.listen('.trip.cancelled', (data) => {
                console.log('🏛️ Mayor: Trip cancelled:', data);
                if (data.ticket_number) {
                    toast.info(`Trip ${data.ticket_number} was cancelled by GSO`);
                }
                eventBus.emit('mayor-trip-cancelled', data);
                eventBus.emit('refresh-mayor-dashboard');
                eventBus.emit('refresh-mayor-pending');
            });

            subscriptionsRef.current.mayor = () => {
                channel.unsubscribe();
                moduleGuards.mayor = false;
            };

            console.log('✅ Mayor real-time subscriptions active');

        } catch (error) {
            moduleGuards.mayor = false;
            console.error('❌ Failed to subscribe to Mayor:', error);
        }
    }, []);

    // ============================================
    // DRIVER SUBSCRIPTIONS
    // ============================================

    const subscribeToDriver = useCallback((user) => {
        if (moduleGuards.driver) return;
        moduleGuards.driver = true;

        try {
            const driverId = user.driver?.driver_id || user.driver_id;
            if (!driverId) {
                console.log('⚠️ No driver ID found for user:', user.user_id);
                moduleGuards.driver = false;
                return;
            }

            const channel = echo.private(`driver.${driverId}`);

            channel.listen('.trip.assigned', (data) => {
                console.log('🚗 Driver: New trip assigned:', data);
                if (data.ticket_number) {
                    toast.info(`New trip assigned: ${data.ticket_number}`);
                }
                eventBus.emit('driver-trip-assigned', data);
                eventBus.emit('refresh-driver-trips');
            });

            channel.listen('.trip.funds_released', (data) => {
                console.log('💰 Driver: Funds released:', data);
                if (data.ticket_number) {
                    toast.success(`Funds released for trip ${data.ticket_number}`);
                }
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
                moduleGuards.driver = false;
            };

            console.log('✅ Driver real-time subscriptions active');

        } catch (error) {
            moduleGuards.driver = false;
            console.error('❌ Failed to subscribe to Driver:', error);
        }
    }, []);

    // ============================================
    // DEPARTMENT SUBSCRIPTIONS
    // ============================================

    const subscribeToDepartment = useCallback((user) => {
        if (moduleGuards.department) return;
        moduleGuards.department = true;

        try {
            if (!user.department_id) {
                moduleGuards.department = false;
                return;
            }

            const channel = echo.private(`department.${user.department_id}`);

            channel.listen('.trip.created', (data) => {
                console.log('🏢 Department: Trip created:', data);
                if (data.ticket_number) {
                    toast.info(`New trip created: ${data.ticket_number}`);
                }
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
                if (data.ticket_number) {
                    toast.error(`Trip ${data.ticket_number} was rejected`);
                }
                eventBus.emit('dept-trip-rejected', data);
                eventBus.emit('refresh-dept-trips');
            });

            subscriptionsRef.current.department = () => {
                channel.unsubscribe();
                moduleGuards.department = false;
            };

            console.log('✅ Department real-time subscriptions active');

        } catch (error) {
            moduleGuards.department = false;
            console.error('❌ Failed to subscribe to Department:', error);
        }
    }, []);

    // ============================================
    // SYSTEM SUBSCRIPTIONS
    // ============================================

    const subscribeToSystem = useCallback((user) => {
        if (moduleGuards.system) return;
        moduleGuards.system = true;

        try {
            if (user.role !== 'gso_office') {
                moduleGuards.system = false;
                return;
            }

            const channel = echo.channel('system');

            channel.listen('.system.announcement', (data) => {
                console.log('📢 System announcement:', data);
                if (data.message) {
                    toast.info(`📢 ${data.message}`);
                }
                eventBus.emit('system-announcement', data);
            });

            subscriptionsRef.current.system = () => {
                channel.unsubscribe();
                moduleGuards.system = false;
            };

        } catch (error) {
            moduleGuards.system = false;
            console.error('❌ Failed to subscribe to System:', error);
        }
    }, []);

    // ============================================
    // SUBSCRIBE ALL
    // ============================================

    const subscribeAll = useCallback((user) => {
        if (!user) return;

        const userId = String(user.user_id || user.id || '');

        // ✅ Module-scope guard
        if (moduleGuards.subscribedUserId === userId) {
            console.log('⏭️ Already subscribed for user', userId, '— skipping');
            return;
        }

        console.log('🔔 Subscribing to all real-time channels for user:', userId);

        moduleGuards.subscribedUserId = userId;

        subscribeToNotifications(user);

        if (user.role === 'gso_office') {
            subscribeToGSO(user);
        } else if (user.role === 'mayors_office') {
            subscribeToMayor(user);
        } else if (user.role === 'driver') {
            subscribeToDriver(user);
        } else {
            subscribeToDepartment(user);
        }

        subscribeToSystem(user);

        fetchUnreadCount();

        eventBus.emit('realtime-ready', { user });
    }, [subscribeToNotifications, subscribeToGSO, subscribeToMayor, subscribeToDriver, subscribeToDepartment, subscribeToSystem]);

    // ============================================
    // CONNECTION MANAGEMENT
    // ============================================

    useEffect(() => {
        let cancelled = false;
        let attempt = 0;
        const MAX_ATTEMPTS = 60;

        const trySetup = () => {
            if (cancelled) return;
            if (attempt++ >= MAX_ATTEMPTS) {
                console.error('❌ RealtimeContext: gave up waiting for echo.connector.pusher');
                return;
            }

            if (!echo?.connector?.pusher) {
                if (attempt === 1) {
                    console.log('⏳ RealtimeContext: waiting for echo.connector.pusher...');
                }
                setTimeout(trySetup, 500);
                return;
            }

            console.log('🔌 RealtimeContext: echo is ready — setting up subscriptions');

            const connection = echo.connector.pusher.connection;

            const handleConnected = () => {
                if (cancelled) return;
                console.log('✅ Real-time connected');
                setIsConnected(true);

                const user = getUser();
                if (user) {
                    subscribeAll(user);
                }
            };

            const handleDisconnected = () => {
                if (cancelled) return;
                console.log('❌ Real-time disconnected');
                setIsConnected(false);
            };

            const handleError = (error) => {
                console.error('❌ Pusher error:', error);
            };

            connection.bind('connected', handleConnected);
            connection.bind('disconnected', handleDisconnected);
            connection.bind('error', handleError);

            if (connection.state === 'connected') {
                console.log('✅ Already connected — subscribing immediately');
                setIsConnected(true);
                const user = getUser();
                if (user) {
                    subscribeAll(user);
                }
            } else {
                const user = getUser();
                if (user) {
                    setTimeout(() => {
                        if (cancelled) return;
                        const u = getUser();
                        if (u) {
                            console.log('⏱️ Fallback: subscribing after timeout');
                            subscribeAll(u);
                        }
                    }, 1500);
                }
            }

            const handleAuthChange = () => {
                const newUser = getUser();
                const newUserId = newUser ? String(newUser.user_id || newUser.id) : null;

                if (newUser && moduleGuards.subscribedUserId !== newUserId) {
                    // Different user — force full resubscribe
                    Object.values(subscriptionsRef.current).forEach(unsub => {
                        if (typeof unsub === 'function') unsub();
                    });
                    subscriptionsRef.current = {};
                    moduleGuards.subscribedUserId = null;
                    subscribeAll(newUser);
                } else if (!newUser) {
                    // Logout — full cleanup
                    Object.values(subscriptionsRef.current).forEach(unsub => {
                        if (typeof unsub === 'function') unsub();
                    });
                    subscriptionsRef.current = {};
                    moduleGuards.notifications = false;
                    moduleGuards.gso = false;
                    moduleGuards.mayor = false;
                    moduleGuards.driver = false;
                    moduleGuards.department = false;
                    moduleGuards.system = false;
                    moduleGuards.subscribedUserId = null;
                }
            };
            window.addEventListener('auth-change', handleAuthChange);

            trySetup._cleanup = () => {
                connection.unbind('connected', handleConnected);
                connection.unbind('disconnected', handleDisconnected);
                connection.unbind('error', handleError);
                window.removeEventListener('auth-change', handleAuthChange);
            };
        };

        trySetup();

        return () => {
            cancelled = true;
            if (trySetup._cleanup) trySetup._cleanup();
            // ❌ DO NOT unsubscribe on cleanup — moduleGuards persists
            // Only unsubscribe on explicit logout (auth-change with null user)
        };
    }, [getUser, subscribeAll]);

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
                const count = data?.data?.unread_count ?? data?.count ?? 0;
                setUnreadCount(count);
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
// src/hooks/useNotifications.js
import { useState, useEffect, useCallback } from 'react';
import useRealtime from './useRealtime';
import { notificationAPI } from '../services/api';

export const useNotifications = (userId) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    
    const { subscribeToNotifications, on } = useRealtime();

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const response = await notificationAPI.getAll({ limit: 50 });
            const data = response.data?.data || [];
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (userId) {
            fetchNotifications();
            
            // ✅ Subscribe to real-time notifications
            const unsubscribe = subscribeToNotifications(userId, (data) => {
                setNotifications(prev => [data, ...prev]);
                setUnreadCount(prev => prev + 1);
            });
            
            // ✅ Listen for notification refresh events
            const refreshHandler = () => fetchNotifications();
            on('refresh-notifications', refreshHandler);
            
            return () => {
                if (unsubscribe) unsubscribe();
            };
        }
    }, [userId, subscribeToNotifications, fetchNotifications, on]);

    const markAsRead = useCallback(async (id) => {
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
    }, []);

    const markAllAsRead = useCallback(async () => {
        try {
            await notificationAPI.markAllAsRead();
            setNotifications(prev => 
                prev.map(n => ({ ...n, is_read: true }))
            );
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    }, []);

    return {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
    };
};
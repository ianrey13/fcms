// src/hooks/useRealtime.js
import { useEffect, useState, useCallback } from 'react';
import echo from '../services/echo';
import eventBus from '../utils/eventBus';
import { toast } from 'react-hot-toast';

export const useRealtime = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [channels, setChannels] = useState([]);

    useEffect(() => {
        if (echo?.connector?.pusher) {
            const connection = echo.connector.pusher.connection;
            
            connection.bind('connected', () => {
                console.log('✅ Pusher connected');
                setIsConnected(true);
            });
            
            connection.bind('disconnected', () => {
                console.log('❌ Pusher disconnected');
                setIsConnected(false);
            });
            
            connection.bind('error', (error) => {
                console.error('❌ Pusher error:', error);
            });
            
            return () => {
                connection.unbind('connected');
                connection.unbind('disconnected');
                connection.unbind('error');
            };
        }
    }, []);

    const subscribeToTrip = useCallback((tripId, onUpdate) => {
        if (!tripId) return null;
        
        try {
            const channel = echo.private(`trip.${tripId}`);
            
            channel.listen('.trip.updated', (data) => {
                console.log('📡 Trip updated:', data);
                if (onUpdate) onUpdate(data);
                eventBus.emit('trip-updated', data);
            });
            
            channel.listen('.trip.status_changed', (data) => {
                console.log('📡 Trip status changed:', data);
                toast.info(`Trip status changed to: ${data.new_status}`);
                if (onUpdate) onUpdate(data);
                eventBus.emit('trip-status-changed', data);
            });
            
            channel.subscribed(() => {
                console.log(`✅ Subscribed to trip.${tripId}`);
                setChannels(prev => [...prev, `trip.${tripId}`]);
            });
            
            return () => {
                channel.unsubscribe();
                setChannels(prev => prev.filter(c => c !== `trip.${tripId}`));
            };
        } catch (error) {
            console.error('❌ Failed to subscribe to trip:', error);
            return null;
        }
    }, []);

    const subscribeToNotifications = useCallback((userId, onNotification) => {
        if (!userId) return null;
        
        try {
            const channel = echo.private(`notifications.${userId}`);
            
            channel.listen('.notification.new', (data) => {
                console.log('📨 New notification:', data);
                
                // Show toast
                toast.info(data.message || 'New notification');
                
                // Call callback
                if (onNotification) onNotification(data);
                
                // Emit event
                eventBus.emit('new-notification', data);
            });
            
            channel.subscribed(() => {
                console.log(`✅ Subscribed to notifications.${userId}`);
            });
            
            return () => {
                channel.unsubscribe();
            };
        } catch (error) {
            console.error('❌ Failed to subscribe to notifications:', error);
            return null;
        }
    }, []);

    const subscribeToGSO = useCallback((onLocationUpdate) => {
        try {
            const channel = echo.channel('gso-live-tracking');
            
            channel.listen('.location.updated', (data) => {
                console.log('📍 Location updated:', data);
                if (onLocationUpdate) onLocationUpdate(data);
                eventBus.emit('gps-location-updated', data);
            });
            
            channel.listen('.trip.started', (data) => {
                console.log('🚗 Trip started:', data);
                toast.info(`Trip ${data.trip_id} has started`);
                eventBus.emit('trip-started', data);
            });
            
            channel.listen('.trip.completed', (data) => {
                console.log('🏁 Trip completed:', data);
                toast.success(`Trip ${data.trip_id} completed!`);
                eventBus.emit('trip-completed', data);
            });
            
            channel.subscribed(() => {
                console.log('✅ Subscribed to gso-live-tracking');
            });
            
            return () => {
                channel.unsubscribe();
            };
        } catch (error) {
            console.error('❌ Failed to subscribe to GSO:', error);
            return null;
        }
    }, []);

    const emit = useCallback((event, data) => {
        eventBus.emit(event, data);
    }, []);

    const on = useCallback((event, callback) => {
        return eventBus.on(event, callback);
    }, []);

    return {
        isConnected,
        channels,
        subscribeToTrip,
        subscribeToNotifications,
        subscribeToGSO,
        emit,
        on,
    };
};

export default useRealtime;
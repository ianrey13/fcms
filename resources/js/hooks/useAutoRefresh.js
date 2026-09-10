// src/hooks/useAutoRefresh.js
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRealtime } from '../contexts/RealtimeContext';

export const useAutoRefresh = (eventNames, refreshFn, debounceMs = 500) => {
    const { on } = useRealtime();
    const [lastUpdated, setLastUpdated] = useState(null);
    const timeoutRef = useRef(null);
    const isRefreshingRef = useRef(false);

    // ✅ Debounced refresh
    const debouncedRefresh = useCallback(() => {
        // Clear any pending timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new timeout
        timeoutRef.current = setTimeout(() => {
            if (!isRefreshingRef.current && refreshFn) {
                isRefreshingRef.current = true;
                refreshFn();
                setTimeout(() => {
                    isRefreshingRef.current = false;
                }, 1000);
            }
        }, debounceMs);
    }, [refreshFn, debounceMs]);

    useEffect(() => {
        if (!refreshFn) return;

        const events = Array.isArray(eventNames) ? eventNames : [eventNames];
        
        // ✅ Initial refresh with delay
        const initialTimeout = setTimeout(() => {
            refreshFn();
        }, 1000);

        // ✅ Subscribe to events
        const unsubscribers = events.map(eventName => {
            return on(eventName, (data) => {
                console.log(`🔄 Auto-refresh triggered by: ${eventName}`);
                setLastUpdated(new Date());
                debouncedRefresh();
            });
        });

        return () => {
            clearTimeout(initialTimeout);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            unsubscribers.forEach(unsub => {
                if (typeof unsub === 'function') unsub();
            });
        };
    }, [eventNames, refreshFn, on, debouncedRefresh]);

    return { lastUpdated };
};
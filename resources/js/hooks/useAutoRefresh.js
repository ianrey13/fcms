// src/hooks/useAutoRefresh.js
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRealtime } from '../contexts/RealtimeContext';

export const useAutoRefresh = (eventNames, refreshFn, debounceMs = 500) => {
    const { on } = useRealtime();
    const [lastUpdated, setLastUpdated] = useState(null);
    const timeoutRef = useRef(null);
    const isRefreshingRef = useRef(false);
    const isMountedRef = useRef(false);
    const safetyIntervalRef = useRef(null);
    const lastRefreshTimeRef = useRef(0);

    // ✅ Debounced refresh (event-triggered)
    // Cooldown reduced to 3s for real-time updates
    const debouncedRefresh = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (isRefreshingRef.current || !refreshFn) return;

            const now = Date.now();
            // ✅ 3s cooldown for event-triggered refreshes
            if (now - lastRefreshTimeRef.current < 3 * 1000) {
                return;
            }

            isRefreshingRef.current = true;
            lastRefreshTimeRef.current = now;
            refreshFn();
            setTimeout(() => { isRefreshingRef.current = false; }, 1000);
            setLastUpdated(new Date());
        }, debounceMs);
    }, [refreshFn, debounceMs]);

    // ✅ Safe refresh (safety net / tab visible)
    // Cooldown reduced to 5s
    const safeRefresh = useCallback((reason) => {
        if (isRefreshingRef.current || !refreshFn) return;

        const now = Date.now();
        const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

        // ✅ 5s cooldown
        if (timeSinceLastRefresh < 5 * 1000) {
            return;
        }

        isRefreshingRef.current = true;
        lastRefreshTimeRef.current = now;
        refreshFn();
        setTimeout(() => { isRefreshingRef.current = false; }, 1000);
        setLastUpdated(new Date());
    }, [refreshFn]);

    useEffect(() => {
        if (!refreshFn) return;

        const events = Array.isArray(eventNames) ? eventNames : [eventNames];
        isMountedRef.current = true;

        // Safety net: refresh every 5 minutes
        safetyIntervalRef.current = setInterval(() => {
            if (document.visibilityState === 'visible') {
                safeRefresh('safety net');
            }
        }, 5 * 60 * 1000);

        // Refresh when tab becomes visible again
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                safeRefresh('tab visible');
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Subscribe to real-time events
        const unsubscribers = events.map(eventName => {
            return on(eventName, (data) => {
                if (!isMountedRef.current) return;
                debouncedRefresh();
            });
        });

        return () => {
            isMountedRef.current = false;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (safetyIntervalRef.current) clearInterval(safetyIntervalRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            unsubscribers.forEach(unsub => {
                if (typeof unsub === 'function') unsub();
            });
        };
    }, [eventNames, refreshFn, on, debouncedRefresh, safeRefresh]);

    return { lastUpdated };
};
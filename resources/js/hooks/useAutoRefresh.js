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
    const lastRefreshTimeRef = useRef(0);   // ✅ Track last refresh for cooldown

    // Debounced refresh
    const debouncedRefresh = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (!isRefreshingRef.current && refreshFn) {
                isRefreshingRef.current = true;
                lastRefreshTimeRef.current = Date.now();   // ✅ Record time
                refreshFn();
                setTimeout(() => { isRefreshingRef.current = false; }, 1000);
            }
        }, debounceMs);
    }, [refreshFn, debounceMs]);

    // Shared refresh function with cooldown
    const safeRefresh = useCallback((reason) => {
        if (isRefreshingRef.current) return;

        // ✅ Cooldown: Don't refresh if less than 60 seconds since last refresh
        const now = Date.now();
        const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
        if (timeSinceLastRefresh < 60 * 1000) {
            console.log(`⏸️ Skipping refresh (${reason}) — refreshed ${Math.round(timeSinceLastRefresh / 1000)}s ago`);
            return;
        }

        console.log(`🔄 Refreshing (${reason})`);
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

        // ✅ SAFETY NET: Refresh every 5 minutes (only when tab is visible)
        safetyIntervalRef.current = setInterval(() => {
            if (document.visibilityState === 'visible') {
                safeRefresh('safety net');
            }
        }, 5 * 60 * 1000);

        // ✅ REFRESH when tab becomes visible again (with cooldown)
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
                console.log(`📡 Event received: ${eventName}`);
                setLastUpdated(new Date());
                debouncedRefresh();
            });
        });

        return () => {
            isMountedRef.current = false;
            // ✅ REMOVED: clearTimeout(initialTimeout) — variable no longer exists
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
// src/services/queryClient.js
// ============================================
// CENTRALIZED QUERY CLIENT WITH SMART CACHING
// Shared between main.jsx and prefetchService.js
// ============================================
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // ✅ Data is "fresh" for 5 minutes — won't refetch during this time
            staleTime: 5 * 60 * 1000, // 5 minutes

            // ✅ Keep unused cache for 10 minutes before garbage collection
            gcTime: 10 * 60 * 1000, // 10 minutes

            // ✅ DON'T refetch when tab regains focus (prevents 429)
            refetchOnWindowFocus: false,

            // ✅ DON'T refetch when component remounts if data is fresh
            refetchOnMount: false,

            // ✅ DON'T refetch on network reconnect
            refetchOnReconnect: false,

            // ✅ Retry once on failure with exponential backoff
            retry: 1,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

            // ✅ Keep previous data while fetching (smooth UX, no flashing)
            placeholderData: (previousData) => previousData,
        },
        mutations: {
            retry: 1,
        },
    },
});
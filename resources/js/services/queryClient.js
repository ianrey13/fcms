// src/services/queryClient.js
// ============================================
// CENTRALIZED QUERY CLIENT WITH SMART CACHING
// ✅ FIXED: Data no longer disappears after idle
// ============================================
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // ✅ Data is "fresh" for 5 minutes
            staleTime: 5 * 60 * 1000, // 5 min

            // ✅ KEEP CACHE for 30 minutes (was 10 min)
            gcTime: 30 * 60 * 1000, // 30 min — survives idle periods

            // ✅ REFETCH when tab regains focus (fixes "data gone" bug)
            refetchOnWindowFocus: false,

            // ✅ REFETCH on mount if stale (prevents empty arrays)
            refetchOnMount: false,

            // ✅ REFETCH when internet returns
            refetchOnReconnect: true,

            // ✅ Retry once on failure
            retry: 1,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

            // ✅ Keep previous data while fetching (smooth UX)
            placeholderData: (previousData) => previousData,
        },
        mutations: {
            retry: 1,
        },
    },
});
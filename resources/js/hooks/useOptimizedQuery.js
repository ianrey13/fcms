// src/hooks/useOptimizedQuery.js
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

export const useOptimizedQuery = ({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 0,                            // ✅ default to always-fresh
  gcTime = 30 * 60 * 1000,                  // ✅ v5 name (was cacheTime)
  refetchOnWindowFocus = false,
  refetchOnMount = true,                    // ✅ refetch on mount by default
  retry,
  retryDelay,
  placeholderData = (previousData) => previousData,
  onError,
}) => {
  return useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await queryFn();
      } catch (error) {
        const status = error?.response?.status;

        if (status === 429) {
          console.warn(`⏸️ Rate limited on [${queryKey.join('-')}] — will retry`);
        } else {
          console.error(`Query error [${queryKey.join('-')}]:`, error);
          if (onError) onError(error);
          // ✅ Component can show its own toast; only toast here if no onError
          if (!onError) {
            toast.error(error?.response?.data?.message || 'Failed to load data');
          }
        }
        throw error;
      }
    },
    enabled,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    refetchOnMount,
       retry: (failureCount, error) => {
      if (error?.response?.status === 401) return false;   
      if (error?.response?.status === 429) return failureCount < 3;
      return failureCount < 3;                              
    },
    retryDelay: (attemptIndex, error) => {
      if (error?.response?.status === 429) {
        return 2000 * (attemptIndex + 1);
      }
      return Math.min(1000 * 2 ** attemptIndex, 5000);
    },
    placeholderData,
  });
};
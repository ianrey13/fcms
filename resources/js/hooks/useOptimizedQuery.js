// src/hooks/useOptimizedQuery.js
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

export const useOptimizedQuery = ({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 5 * 60 * 1000, // 5 minutes
  cacheTime = 10 * 60 * 1000, // 10 minutes
  refetchOnWindowFocus = false,
  refetchOnMount = false,
  retry = 2,
  retryDelay = 1000,
  keepPreviousData = true,
  onError,
}) => {
  return useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const result = await queryFn();
        return result;
      } catch (error) {
        console.error(`Query error [${queryKey.join('-')}]:`, error);
        if (onError) onError(error);
        toast.error(error?.response?.data?.message || 'Failed to load data');
        throw error;
      }
    },
    enabled,
    staleTime,
    cacheTime,
    refetchOnWindowFocus,
    refetchOnMount,
    retry,
    retryDelay,
    keepPreviousData,
  });
};
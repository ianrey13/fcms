// src/hooks/useOptimizedQuery.js
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

export const useOptimizedQuery = ({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 5 * 60 * 1000,
  cacheTime = 10 * 60 * 1000,
  refetchOnWindowFocus = false,
  refetchOnMount = false,
  retry,               
  retryDelay,
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
        const status = error?.response?.status;
        
       
        if (status === 429) {
          console.warn(`⏸️ Rate limited on [${queryKey.join('-')}] — will retry`);
        } else {
          console.error(`Query error [${queryKey.join('-')}]:`, error);
          if (onError) onError(error);

          toast.error(error?.response?.data?.message || 'Failed to load data');
        }
        throw error;
      }
    },
    enabled,
    staleTime,
    cacheTime,
    refetchOnWindowFocus,
    refetchOnMount,
  
    retry: (failureCount, error) => {
      if (error?.response?.status === 429) {
        return failureCount < 3; 
      }
      return failureCount < 1;   
    },
    retryDelay: (attemptIndex, error) => {
      if (error?.response?.status === 429) {
       
        return 2000 * (attemptIndex + 1);
      }
      return Math.min(1000 * 2 ** attemptIndex, 5000);
    },
    keepPreviousData,
    
    placeholderData: (previousData) => previousData,
  });
};
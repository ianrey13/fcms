// src/hooks/useDepartmentDashboard.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripTicketAPI,staffAPI as departmentStaffAPI } from '../services/api';
import { toast } from 'react-hot-toast';

// ============ QUERIES ============

// Fetch department trip requests
const fetchTripRequests = async () => {
  const response = await tripTicketAPI.getMyRequests();
  let tickets = response.data?.data || response.data || [];
  return Array.isArray(tickets) ? tickets : [];
};

export const useTripRequests = () => {
  return useQuery({
    queryKey: ['trip-requests', 'department'],
    queryFn: fetchTripRequests,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });
};

// Fetch department budget
const fetchDepartmentBudget = async () => {
  const response = await departmentStaffAPI.getDepartmentBudget();
  const budgetData = response.data?.data || response.data;
  
  if (!budgetData) return null;
  
  const remaining = budgetData.remaining_amount || budgetData.remaining_budget || 0;
  const allocated = budgetData.allocated_amount || 0;
  const spent = budgetData.spent_amount || 0;
  const utilization = allocated > 0 ? (spent / allocated) * 100 : 0;
  
  return {
    remaining_budget: remaining,
    allocated_amount: allocated,
    spent_amount: spent,
    period_start: budgetData.week_start || budgetData.period_start,
    period_end: budgetData.week_end || budgetData.period_end,
    utilization_percentage: budgetData.utilization_percentage || utilization.toFixed(1),
    isLow: remaining < allocated * 0.2,
    isCritical: remaining < allocated * 0.1
  };
};

export const useDepartmentBudget = () => {
  return useQuery({
    queryKey: ['department-budget'],
    queryFn: fetchDepartmentBudget,
    staleTime: 60 * 1000, // 1 minute - budget changes frequently
    refetchOnWindowFocus: true,
  });
};

// ============ MUTATIONS ============

// Refresh dashboard data (invalidate all relevant queries)
export const useRefreshDashboard = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Just invalidate queries to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['trip-requests', 'department'] });
      await queryClient.invalidateQueries({ queryKey: ['department-budget'] });
      return true;
    },
    onSuccess: () => {
      toast.success('Dashboard refreshed');
    },
    onError: () => {
      toast.error('Failed to refresh dashboard');
    },
  });
};

// Helper to get status config
export const getStatusConfig = (status) => {
  const config = {
    draft: { color: 'bg-gray-500', label: 'Draft', icon: '📝' },
    pending_head_approval: { color: 'bg-yellow-500', label: 'Pending Head', icon: '⏳' },
    pending_gso_review: { color: 'bg-orange-500', label: 'Pending GSO', icon: '📋' },
    returned_for_revision: { color: 'bg-red-500', label: 'Returned', icon: '↩️' },
    with_mayors_office: { color: 'bg-purple-500', label: 'With Mayor', icon: '🏛️' },
    pending_mayors_office: { color: 'bg-purple-500', label: 'Pending Mayor', icon: '🏛️' },
    funds_issued: { color: 'bg-green-500', label: 'Funds Issued', icon: '💰' },
    acknowledged: { color: 'bg-blue-500', label: 'Acknowledged', icon: '✓' },
    in_transit: { color: 'bg-indigo-500', label: 'In Transit', icon: '🚗' },
    pending_reconciliation: { color: 'bg-cyan-500', label: 'Pending Recon', icon: '📊' },
    closed: { color: 'bg-emerald-600', label: 'Closed', icon: '✅' },
    rejected: { color: 'bg-red-600', label: 'Rejected', icon: '❌' },
    cancelled: { color: 'bg-gray-600', label: 'Cancelled', icon: '🚫' }
  };
  return config[status] || { color: 'bg-gray-500', label: status?.replace(/_/g, ' ') || 'Unknown', icon: '📄' };
};
// src/hooks/useBudgetManagement.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetPolicyAPI, departmentAPI } from '../services/api';
import { toast } from 'react-hot-toast';

// ============ QUERIES ============

// Fetch all budget policies
const fetchPolicies = async () => {
  const response = await budgetPolicyAPI.getAll();
  const policyData = response.data?.data || response.data || [];
  return Array.isArray(policyData) ? policyData : [];
};

export const useBudgetPolicies = () => {
  return useQuery({
    queryKey: ['budget-policies'],
    queryFn: fetchPolicies,
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
};

// Fetch all departments
const fetchDepartments = async () => {
  const response = await departmentAPI.getAll();
  const deptData = response.data?.data || response.data || [];
  return Array.isArray(deptData) ? deptData : [];
};

export const useBudgetDepartments = () => {
  return useQuery({
    queryKey: ['departments', 'budget'],
    queryFn: fetchDepartments,
    staleTime: 5 * 60 * 1000,
  });
};

// Fetch budget status
const fetchBudgetStatus = async () => {
  const response = await budgetPolicyAPI.getBudgetStatus();
  let statusData = response.data?.data || response.data || [];
  
  if (Array.isArray(statusData)) {
    statusData = statusData.map(item => ({
      department_id: item.department_id,
      allocated_amount: parseFloat(item.allocated_amount || item.total_budget || 0),
      spent_amount: parseFloat(item.spent_amount || item.total_spent || 0),
      remaining_amount: parseFloat(item.remaining_amount || (item.allocated_amount - item.spent_amount) || 0),
      week_start: item.week_start,
      week_end: item.week_end,
      status: item.status
    }));
  }
  return statusData;
};

export const useBudgetStatus = () => {
  return useQuery({
    queryKey: ['budget-status'],
    queryFn: fetchBudgetStatus,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Fetch event logs
const fetchEventLogs = async () => {
  const response = await budgetPolicyAPI.getEventLogs();
  const logsData = response.data?.data || response.data || [];
  return Array.isArray(logsData) ? logsData : [];
};

export const useEventLogs = () => {
  return useQuery({
    queryKey: ['event-logs'],
    queryFn: fetchEventLogs,
    staleTime: 60 * 1000, // 1 minute
  });
};

// ============ MUTATIONS ============

// Create budget policy
export const useCreateBudgetPolicy = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (policyData) => budgetPolicyAPI.create(policyData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-policies'] });
      queryClient.invalidateQueries({ queryKey: ['budget-status'] });
      toast.success('Budget policy created successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to create budget policy';
      toast.error(message);
    },
  });
};

// Update budget policy
export const useUpdateBudgetPolicy = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ departmentId, policyData }) => 
      budgetPolicyAPI.update(departmentId, policyData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-policies'] });
      queryClient.invalidateQueries({ queryKey: ['budget-status'] });
      toast.success('Budget policy updated successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to update budget policy';
      toast.error(message);
    },
  });
};

// Delete budget policy
export const useDeleteBudgetPolicy = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (departmentId) => budgetPolicyAPI.delete(departmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-policies'] });
      queryClient.invalidateQueries({ queryKey: ['budget-status'] });
      toast.success('Budget policy deleted successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to delete budget policy';
      toast.error(message);
    },
  });
};

// Force activate budget
export const useForceActivateBudget = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (activateData) => budgetPolicyAPI.forceActivate(activateData),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budget-policies'] });
      queryClient.invalidateQueries({ queryKey: ['budget-status'] });
      queryClient.invalidateQueries({ queryKey: ['event-logs'] });
      toast.success(response.data?.message || 'Budget activated successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to activate budget';
      toast.error(message);
    },
  });
};

// Force weekly reset
export const useForceWeeklyReset = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => budgetPolicyAPI.runWeeklyReset(),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['budget-policies'] });
      queryClient.invalidateQueries({ queryKey: ['budget-status'] });
      queryClient.invalidateQueries({ queryKey: ['event-logs'] });
      const message = response.data?.message || 'Weekly budget reset completed successfully';
      toast.success(message);
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to reset budget periods';
      toast.error(message);
    },
  });
};
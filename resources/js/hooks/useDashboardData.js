// frontend/src/hooks/useDashboardData.js
import { useQuery } from '@tanstack/react-query';
import { 
  departmentAPI, vehicleAPI, userAPI, 
  budgetPolicyAPI, reportsAPI 
} from '../services/api';

// Fetch all dashboard data in one query
const fetchDashboardData = async () => {
  const [
    departmentsRes, 
    vehiclesRes, 
    usersRes, 
    budgetStatusRes,
    tripReportRes,
    fuelReportRes
  ] = await Promise.allSettled([
    departmentAPI.getAll(),
    vehicleAPI.getAll(),
    userAPI.getAll(),
    budgetPolicyAPI.getBudgetStatus(),
    reportsAPI.getTripReport({ limit: 100 }),
    reportsAPI.getFuelReport({ limit: 100 })
  ]);

  return {
    departments: departmentsRes.status === 'fulfilled' 
      ? (departmentsRes.value.data?.data || departmentsRes.value.data || [])
      : [],
    vehicles: vehiclesRes.status === 'fulfilled'
      ? (vehiclesRes.value.data?.data || vehiclesRes.value.data || [])
      : [],
    users: usersRes.status === 'fulfilled'
      ? (usersRes.value.data?.data || usersRes.value.data || [])
      : [],
    budgetStatus: budgetStatusRes.status === 'fulfilled'
      ? (budgetStatusRes.value.data?.data || budgetStatusRes.value.data || [])
      : [],
    tripReport: tripReportRes.status === 'fulfilled'
      ? (tripReportRes.value.data?.data || tripReportRes.value.data || [])
      : [],
    fuelReport: fuelReportRes.status === 'fulfilled'
      ? (fuelReportRes.value.data?.data || fuelReportRes.value.data || [])
      : []
  };
};

// Custom hook for dashboard data
export const useDashboardData = () => {
  return useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: fetchDashboardData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Fetch recent activities
const fetchRecentActivities = async () => {
  try {
    const logsRes = await budgetPolicyAPI.getEventLogs();
    return logsRes.data?.data || logsRes.data || [];
  } catch (error) {
    console.error('Failed to fetch recent activities:', error);
    return [];
  }
};

// Custom hook for recent activities
export const useRecentActivities = () => {
  return useQuery({
    queryKey: ['recent-activities'],
    queryFn: fetchRecentActivities,
    staleTime: 60 * 1000, // 1 minute
  });
};
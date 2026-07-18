// src/hooks/useTripTicket.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripTicketAPI, staffAPI as departmentStaffAPI } from '../services/api';
import api from '../services/api';
import { toast } from 'react-hot-toast';

// ============ QUERIES ============

// Fetch drivers for department
const fetchDrivers = async (departmentId) => {
  if (!departmentId) return [];
  const response = await departmentStaffAPI.getActiveDrivers({ department_id: departmentId });
  const driversData = response.data?.data || response.data || [];
  return Array.isArray(driversData) ? driversData : [];
};

export const useDrivers = (departmentId) => {
  return useQuery({
    queryKey: ['drivers', departmentId],
    queryFn: () => fetchDrivers(departmentId),
    enabled: !!departmentId,
    staleTime: 5 * 60 * 1000,
  });
};

// Fetch available vehicles for department
const fetchVehicles = async (departmentId) => {
  if (!departmentId) return [];
  const response = await departmentStaffAPI.getAvailableVehicles({ department_id: departmentId });
  const vehiclesData = response.data?.data || response.data || [];
  return Array.isArray(vehiclesData) ? vehiclesData : [];
};

export const useAvailableVehicles = (departmentId) => {
  return useQuery({
    queryKey: ['available-vehicles', departmentId],
    queryFn: () => fetchVehicles(departmentId),
    enabled: !!departmentId,
    staleTime: 5 * 60 * 1000,
  });
};

// Fetch department budget
const fetchDepartmentBudget = async () => {
  const response = await departmentStaffAPI.getDepartmentBudget();
  const budgetData = response.data?.data || response.data;
  
  if (!budgetData) return null;
  
  return {
    remaining_budget: budgetData.remaining_amount || budgetData.remaining_budget || 0,
    allocated_amount: budgetData.allocated_amount || 0,
    spent_amount: budgetData.total_spent_amount || budgetData.spent_amount || 0,
    week_start: budgetData.week_start,
    week_end: budgetData.week_end,
  };
};

export const useDepartmentBudgetForForm = () => {
  return useQuery({
    queryKey: ['department-budget-form'],
    queryFn: fetchDepartmentBudget,
    staleTime: 60 * 1000,
  });
};

// Fetch fuel prices
const fetchFuelPrices = async () => {
  try {
    const response = await api.get('/public/fuel-prices');
    const data = response.data;
    return {
      diesel: parseFloat(data.diesel) || 50.0,
      premium: parseFloat(data.premium) || 65.0,
      regular: parseFloat(data.regular) || 55.0,
    };
  } catch (error) {
    console.log('Using default fuel prices');
    return { diesel: 50.0, premium: 65.0, regular: 55.0 };
  }
};

export const useFuelPrices = () => {
  return useQuery({
    queryKey: ['fuel-prices'],
    queryFn: fetchFuelPrices,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Search locations
const searchLocations = async (query) => {
  if (query.length < 2) return [];
  const response = await api.get('/location/search', { params: { query } });
  return response.data?.data || [];
};

export const useLocationSearch = (query) => {
  return useQuery({
    queryKey: ['location-search', query],
    queryFn: () => searchLocations(query),
    enabled: !!query && query.length >= 2,
    staleTime: 60 * 1000,
  });
};

// Calculate distance
const calculateDistanceAPI = async (params) => {
  const response = await api.get('/location/distance', { params });
  return response.data?.data;
};

export const useCalculateDistance = () => {
  return useMutation({
    mutationFn: calculateDistanceAPI,
    onError: (error) => {
      console.error('Error calculating distance:', error);
      toast.error('Unable to calculate distance. Please enter manually.');
    },
  });
};

// ============ MUTATIONS ============

// Submit trip ticket
export const useSubmitTripTicket = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload) => tripTicketAPI.submit(payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['department-budget-form'] });
      return response;
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        'Error submitting trip ticket. Please try again.';
      toast.error(errorMessage);
      throw error;
    },
  });
};

// Resubmit trip ticket
export const useResubmitTripTicket = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, payload }) => tripTicketAPI.resubmit(id, payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['department-budget-form'] });
      return response;
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        'Error resubmitting trip ticket. Please try again.';
      toast.error(errorMessage);
      throw error;
    },
  });
};

// Save draft
export const useSaveDraft = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload) => tripTicketAPI.saveDraft(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      toast.success('✓ Trip ticket saved as draft!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Error saving draft. Please try again.');
      throw error;
    },
  });
};

// Check budget and request MO assistance
export const useCheckBudgetAndRequestMO = () => {
  return useMutation({
    mutationFn: (payload) => departmentStaffAPI.checkBudgetAndRequestMO(payload),
    onError: (error) => {
      console.warn('Budget check failed:', error);
      return { can_proceed: true, error: error.message };
    },
  });
};

// ============ HELPERS ============

export const isWithinCurrentWeek = (date) => {
  const today = new Date();
  const currentDate = new Date(today);

  const startOfWeek = new Date(currentDate);
  const dayOfWeek = currentDate.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(currentDate.getDate() - daysToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const tripDate = new Date(date);
  tripDate.setHours(0, 0, 0, 0);

  return tripDate >= startOfWeek && tripDate <= endOfWeek;
};

export const isPastDate = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tripDate = new Date(date);
  tripDate.setHours(0, 0, 0, 0);
  return tripDate < today;
};

export const getFuelPriceByType = (fuelType, fuelPrices) => {
  if (!fuelPrices) return 55.0;
  switch (fuelType) {
    case 'diesel':
      return fuelPrices.diesel || 50.0;
    case 'premium':
      return fuelPrices.premium || 65.0;
    case 'regular':
      return fuelPrices.regular || 55.0;
    default:
      return 55.0;
  }
};
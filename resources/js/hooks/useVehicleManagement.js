// src/hooks/useVehicleManagement.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleAPI, adminDepartmentAPI } from '../services/api';  // ✅ Changed from departmentAPI to adminDepartmentAPI
import { toast } from 'react-hot-toast';

// ============ QUERIES ============

// Fetch all vehicles
const fetchVehicles = async () => {
  const response = await vehicleAPI.getAll();
  const vehicleData = response.data?.data || response.data || [];
  return Array.isArray(vehicleData) ? vehicleData : [];
};

export const useVehicles = () => {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: fetchVehicles,
    staleTime: 0, 
    refetchOnMount: 'always',
  });
};

// ✅ FIXED: Fetch all departments using adminDepartmentAPI
const fetchDepartments = async () => {
  try {
    const response = await adminDepartmentAPI.getSelector();
    const deptData = response.data?.data || response.data || [];
    return Array.isArray(deptData) ? deptData : [];
  } catch (error) {
    console.error('Error fetching departments:', error);
    return [];
  }
};

export const useDepartmentsForVehicles = () => {
  return useQuery({
    queryKey: ['departments', 'vehicles'],
    queryFn: fetchDepartments,
    staleTime: 5 * 60 * 1000,
  });
};

// ============ MUTATIONS ============

// Create vehicle mutation
export const useCreateVehicle = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (vehicleData) => vehicleAPI.create(vehicleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      // toast.success('Vehicle created successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to create vehicle';
      // toast.error(message);
    },
  });
};

// Update vehicle mutation
export const useUpdateVehicle = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ vehicleId, vehicleData }) => 
      vehicleAPI.update(vehicleId, vehicleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      // toast.success('Vehicle updated successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to update vehicle';
      toast.error(message);
    },
  });
};

// Delete vehicle mutation
export const useDeleteVehicle = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (vehicleId) => vehicleAPI.delete(vehicleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      // toast.success('Vehicle deleted successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to delete vehicle';
      // toast.error(message);
    },
  });
};

// Toggle vehicle status mutation
export const useToggleVehicleStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ vehicleId, status, maintenance_flag }) => 
      vehicleAPI.updateStatus(vehicleId, status, maintenance_flag),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      // ❌ Remove toast — component handles it with better messages
    },
    onError: () => {
      // ❌ Remove toast — component handles it
    },
  });
};

// Toggle maintenance flag mutation
export const useToggleMaintenance = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ vehicleId, maintenanceFlag }) => 
      vehicleAPI.updateMaintenance(vehicleId, maintenanceFlag),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success(`Maintenance flag ${variables.maintenanceFlag ? 'enabled' : 'disabled'}`);
    },
    onError: () => {
      toast.error('Failed to update maintenance flag');
    },
  });
};
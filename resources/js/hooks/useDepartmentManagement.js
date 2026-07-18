// src/hooks/useDepartmentManagement.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { departmentAPI, userAPI } from '../services/api';
import { toast } from 'react-hot-toast';

// ============ QUERIES ============

// Fetch all departments with leadership info
const fetchDepartments = async () => {
  const response = await departmentAPI.getAll();
  const deptData = response.data?.data || response.data || [];
  
  // Process departments to include leadership names
  return deptData.map((dept) => ({
    ...dept,
    head_of_office_id: dept.head_of_office?.id || dept.head_of_office_id || null,
    head_of_office_name: dept.head_of_office?.name || dept.head_of_office_name || null,
    oic_user_id: dept.current_oic?.id || dept.oic_user_id || null,
    oic_name: dept.current_oic?.name || dept.oic_name || null,
  }));
};

export const useDepartments = () => {
  return useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
};

// Fetch all users
const fetchAllUsers = async () => {
  const response = await userAPI.getAll();
  return response.data?.data || response.data || [];
};

export const useAllUsers = () => {
  return useQuery({
    queryKey: ['users', 'all'],
    queryFn: fetchAllUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Fetch leadership info for a specific department
const fetchLeadershipInfo = async (departmentId) => {
  if (!departmentId) return null;
  const response = await departmentAPI.getLeadershipInfo(departmentId);
  return response.data?.data || response.data;
};

export const useLeadershipInfo = (departmentId) => {
  return useQuery({
    queryKey: ['leadership', departmentId],
    queryFn: () => fetchLeadershipInfo(departmentId),
    enabled: !!departmentId,
    staleTime: 2 * 60 * 1000,
  });
};

// ============ MUTATIONS ============

// Create department mutation
export const useCreateDepartment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (departmentData) => departmentAPI.create(departmentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department created successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || error.response?.data?.errors || 'Failed to create department';
      toast.error(typeof message === 'string' ? message : 'Failed to create department');
    },
  });
};

// Update department mutation
export const useUpdateDepartment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ departmentId, departmentData }) => 
      departmentAPI.update(departmentId, departmentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department updated successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to update department';
      toast.error(message);
    },
  });
};

// Delete department mutation
export const useDeleteDepartment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (departmentId) => departmentAPI.delete(departmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department deleted successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to delete department';
      toast.error(message);
    },
  });
};

// ✅ ADD THIS: Toggle department status mutation
export const useToggleDepartmentStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }) => departmentAPI.toggleStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department status updated successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to update department status';
      toast.error(message);
    },
  });
};

// Assign Head of Office mutation
export const useAssignHeadOfOffice = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ departmentId, userId }) => 
      departmentAPI.assignHeadOfOffice(departmentId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['leadership', variables.departmentId] });
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      toast.success('Head of Office assigned successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to assign Head of Office';
      toast.error(message);
    },
  });
};

// Remove Head of Office mutation
export const useRemoveHeadOfOffice = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (departmentId) => departmentAPI.removeHeadOfOffice(departmentId),
    onSuccess: (_, departmentId) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['leadership', departmentId] });
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      toast.success('Head of Office removed successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to remove Head of Office';
      toast.error(message);
    },
  });
};

// Assign OIC mutation
export const useAssignOIC = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ departmentId, userId }) => 
      departmentAPI.assignOIC(departmentId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['leadership', variables.departmentId] });
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      toast.success('OIC assigned successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to assign OIC';
      toast.error(message);
    },
  });
};

// Remove OIC mutation
export const useRemoveOIC = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (departmentId) => departmentAPI.removeOIC(departmentId),
    onSuccess: (_, departmentId) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['leadership', departmentId] });
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      toast.success('OIC removed successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to remove OIC';
      toast.error(message);
    },
  });
};
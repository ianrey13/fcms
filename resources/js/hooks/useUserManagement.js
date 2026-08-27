// src/hooks/useUserManagement.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userAPI, adminDepartmentAPI } from '../services/api';  // ✅ Changed from departmentAPI to adminDepartmentAPI
import { toast } from 'react-hot-toast';

// ============ QUERIES ============

// Fetch all users
const fetchUsers = async () => {
  const response = await userAPI.getAll();
  return response.data.data || response.data || [];
};

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// ✅ FIXED: Fetch all departments using adminDepartmentAPI
const fetchDepartments = async () => {
  try {
    const response = await adminDepartmentAPI.getSelector();
    return response.data.data || response.data || [];
  } catch (error) {
    console.error('Error fetching departments:', error);
    // ✅ Return empty array on error instead of throwing
    return [];
  }
};

export const useDepartments = () => {
  return useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // ✅ Add error handling
    onError: (error) => {
      console.error('Failed to fetch departments:', error);
      toast.error('Failed to load departments');
    },
  });
};

// ============ MUTATIONS ============

// Create user mutation
export const useCreateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userData) => userAPI.create(userData),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      //toast.success('User created successfully');
      // Return the created user data for signature modal
      return response.data?.data;
    },
    onError: (error) => {
     // toast.error(error.response?.data?.message || 'Failed to create user');
    },
  });
};

// Update user mutation
export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, userData }) => userAPI.update(userId, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    //  toast.success('User updated successfully');
    },
    onError: (error) => {
    //  toast.error(error.response?.data?.message || 'Failed to update user');
    },
  });
};

// Delete/Deactivate user mutation
export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId) => userAPI.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      //toast.success('User deactivated successfully');
    },
    onError: (error) => {
      //toast.error(error.response?.data?.message || 'Failed to deactivate user');
    },
  });
};

// Toggle user status mutation
export const useToggleUserStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, status }) => userAPI.updateStatus(userId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    //  toast.success(`User ${variables.status === 'active' ? 'activated' : 'deactivated'} successfully`);
    },
    onError: (error) => {
      //toast.error(error.response?.data?.message || 'Failed to update user status');
    },
  });
};

// Reset password mutation
export const useResetPassword = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId) => userAPI.resetPassword(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
     // toast.success('Password reset successfully');
    },
    onError: (error) => {
    //  toast.error(error.response?.data?.message || 'Failed to reset password');
    },
  });
};

// Upload signature mutation
export const useUploadSignature = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, formData }) => userAPI.uploadSignature(userId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      //toast.success('E-signature uploaded successfully');
    },
    onError: (error) => {
   //   toast.error(error.response?.data?.message || 'Failed to upload signature');
    },
  });
};

// ============ EXPORT ============
export default {
  useUsers,
  useDepartments,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useToggleUserStatus,
  useResetPassword,
  useUploadSignature,
};
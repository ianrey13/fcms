// src/hooks/useGsoDashboard.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gsoAPI } from '../services/api';
import { toast } from 'react-hot-toast';

// ============ QUERIES ============

// ✅ UPDATED: Fetch pending MO tickets (trips waiting for Mayor's Office)
const fetchPendingMOTickets = async () => {
  const response = await gsoAPI.getPendingMO();
  const ticketsData = response.data?.data || response.data?.tickets || [];
  return Array.isArray(ticketsData) ? ticketsData : [];
};

export const useGsoPendingMOTickets = () => {
  return useQuery({
    queryKey: ['gso', 'pending-mo'],
    queryFn: fetchPendingMOTickets,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

// ✅ UPDATED: Fetch all trips (GSO superadmin view)
const fetchAllTrips = async () => {
  const response = await gsoAPI.getAllTrips();
  const ticketsData = response.data?.data || response.data?.tickets || [];
  return Array.isArray(ticketsData) ? ticketsData : [];
};

export const useGsoAllTrips = () => {
  return useQuery({
    queryKey: ['gso', 'all-trips'],
    queryFn: fetchAllTrips,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

// ✅ UPDATED: Fetch returned tickets
const fetchReturnedTickets = async () => {
  const response = await gsoAPI.getReturnedTickets();
  const ticketsData = response.data?.data || response.data?.tickets || [];
  return Array.isArray(ticketsData) ? ticketsData : [];
};

export const useGsoReturnedTickets = () => {
  return useQuery({
    queryKey: ['gso', 'returned'],
    queryFn: fetchReturnedTickets,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

// ✅ UPDATED: Fetch pending reconciliation (trips ready to close)
const fetchPendingReconciliation = async () => {
  const response = await gsoAPI.getPendingReconciliation();
  const ticketsData = response.data?.data || response.data?.tickets || [];
  return Array.isArray(ticketsData) ? ticketsData : [];
};

export const useGsoReconciliation = () => {
  return useQuery({
    queryKey: ['gso', 'reconciliation'],
    queryFn: fetchPendingReconciliation,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

// Fetch dashboard stats
const fetchDashboardStats = async () => {
  const response = await gsoAPI.getDashboard();
  const statsData = response.data?.data || response.data?.stats || {};
  return {
    pending_mayors_office: statsData.pending_mayors_office || 0,
    pending_reconciliation: statsData.pending_reconciliation || 0,
    returned: statsData.returned || 0,
    total_trips: statsData.total_trips || 0,
    funds_issued: statsData.funds_issued || 0,
    in_transit: statsData.in_transit || 0,
    closed: statsData.closed || 0,
  };
};

export const useGsoStats = () => {
  return useQuery({
    queryKey: ['gso', 'stats'],
    queryFn: fetchDashboardStats,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

// ============ MUTATIONS ============

// ✅ NEW: Create trip (GSO creates directly)
export const useGsoCreateTrip = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (tripData) => gsoAPI.createTrip(tripData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gso'] });
      queryClient.invalidateQueries({ queryKey: ['gso', 'pending-mo'] });
      queryClient.invalidateQueries({ queryKey: ['gso', 'all-trips'] });
      toast.success(data?.message || 'Trip created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create trip');
    },
  });
};

// ✅ UPDATED: Reject a ticket (from pending MO)
export const useGsoRejectTicket = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ ticketId, note }) => 
      gsoAPI.rejectTicket(ticketId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gso', 'pending-mo'] });
      queryClient.invalidateQueries({ queryKey: ['gso', 'all-trips'] });
      queryClient.invalidateQueries({ queryKey: ['gso', 'stats'] });
      toast.success('Ticket rejected successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to reject ticket');
    },
  });
};

// ✅ NEW: Reconcile/Close a trip
export const useGsoReconcileTrip = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ ticketId, data }) => 
      gsoAPI.reconcileTrip(ticketId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gso', 'reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['gso', 'all-trips'] });
      queryClient.invalidateQueries({ queryKey: ['gso', 'stats'] });
      toast.success('Trip reconciled and closed successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to reconcile trip');
    },
  });
};

// ❌ REMOVED: useApproveTicket, useRejectTicket (old GSO verification), useForwardToMO, useBulkForwardToMO

// Refresh all GSO data
export const useRefreshGsoDashboard = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: ['gso'] });
      return true;
    },
    onSuccess: () => {
      toast.success('Dashboard refreshed successfully');
    },
    onError: () => {
      toast.error('Failed to refresh dashboard');
    },
  });
};

// ============ HELPERS ============

export const getGsoStatusConfig = (status) => {
  const config = {
    // ✅ New statuses for simplified workflow
    pending_mayors_office: { color: 'bg-yellow-500', label: 'Pending MO', icon: 'Clock' },
    funds_issued: { color: 'bg-blue-500', label: 'Funds Issued', icon: 'DollarSign' },
    acknowledged: { color: 'bg-cyan-500', label: 'Acknowledged', icon: 'CheckCircle' },
    in_transit: { color: 'bg-indigo-500', label: 'In Transit', icon: 'Truck' },
    pending_reconciliation: { color: 'bg-orange-500', label: 'Pending Reconciliation', icon: 'FileCheck' },
    closed: { color: 'bg-green-600', label: 'Closed', icon: 'CheckCircle' },
    rejected: { color: 'bg-red-500', label: 'Rejected', icon: 'XCircle' },
    cancelled: { color: 'bg-slate-500', label: 'Cancelled', icon: 'XCircle' },
    returned_for_revision: { color: 'bg-purple-500', label: 'Returned', icon: 'AlertCircle' },
    // ❌ REMOVED: pending_gso_review (no longer exists), with_mayors_office (no longer exists)
  };
  return config[status] || { color: 'bg-slate-500', label: status?.replace(/_/g, ' ') || 'Unknown', icon: 'AlertCircle' };
};

export const formatDateShort = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// ============ BACKWARD COMPATIBILITY ============
// ✅ Keep old names for compatibility with existing code
export const useGsoPendingTickets = useGsoPendingMOTickets;
export const useGsoVerifiedTickets = useGsoAllTrips;
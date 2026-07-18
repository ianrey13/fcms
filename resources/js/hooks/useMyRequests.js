// src/hooks/useMyRequests.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripTicketAPI } from '../services/api';
import { toast } from 'react-hot-toast';

// ============ QUERIES ============

// Fetch my trip requests
const fetchMyRequests = async () => {
  const response = await tripTicketAPI.getMyRequests();
  let ticketsData = response.data?.data || response.data || [];
  return Array.isArray(ticketsData) ? ticketsData : [];
};

export const useMyRequests = () => {
  return useQuery({
    queryKey: ['my-requests'],
    queryFn: fetchMyRequests,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });
};

// ============ MUTATIONS ============

// Refresh requests (invalidate query)
export const useRefreshRequests = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      return true;
    },
    onSuccess: () => {
      toast.success('Tickets refreshed');
    },
    onError: () => {
      toast.error('Failed to refresh tickets');
    },
  });
};

// Helper: Check if ticket can be edited
export const canEditTicket = (status) => {
  return ["returned_for_revision", "rejected", "draft"].includes(status);
};

// Helper: Get status badge config
export const getStatusConfig = (status) => {
  const statusConfig = {
    draft: { color: "bg-slate-500", icon: "Clock", label: "Draft" },
    pending_head_approval: { color: "bg-purple-500", icon: "Clock", label: "Pending Head" },
    pending_gso_review: { color: "bg-amber-500", icon: "Clock", label: "Pending GSO" },
    returned_for_revision: { color: "bg-red-500", icon: "AlertCircle", label: "Returned for Revision" },
    rejected: { color: "bg-red-600", icon: "XCircle", label: "Rejected" },
    with_mayors_office: { color: "bg-purple-500", icon: "Clock", label: "With Mayor" },
    pending_mayors_office: { color: "bg-purple-500", icon: "Clock", label: "Pending Mayor" },
    funds_issued: { color: "bg-emerald-500", icon: "CheckCircle", label: "Funds Issued" },
    acknowledged: { color: "bg-blue-500", icon: "CheckCircle", label: "Acknowledged" },
    in_transit: { color: "bg-indigo-500", icon: "Truck", label: "In Transit" },
    pending_reconciliation: { color: "bg-orange-500", icon: "Clock", label: "Reconciling" },
    closed: { color: "bg-emerald-600", icon: "CheckCircle", label: "Closed" },
    cancelled: { color: "bg-red-700", icon: "XCircle", label: "Cancelled" },
  };
  return statusConfig[status] || {
    color: "bg-slate-500",
    icon: "Clock",
    label: status?.replace(/_/g, " ") || "Unknown",
  };
};

// Helper: Status categories
export const getStatusCategories = () => ({
  pendingStatuses: ["pending_head_approval", "pending_gso_review", "pending_mayors_office", "with_mayors_office", "pending_reconciliation"],
  approvedStatuses: ["funds_issued", "acknowledged"],
  inTransitStatuses: ["in_transit"],
  completedStatuses: ["closed"],
  draftStatuses: ["draft"],
  returnedStatuses: ["returned_for_revision", "rejected", "cancelled"],
});
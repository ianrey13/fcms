// src/hooks/useTripTicketDetail.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripTicketAPI } from '../services/api';
import { toast } from 'react-hot-toast';

// ============ QUERIES ============

// Fetch single trip ticket by ID
const fetchTripTicketById = async (id) => {
  if (!id) return null;
  const response = await tripTicketAPI.getById(id);
  return response.data?.data || response.data;
};

export const useTripTicketDetail = (id) => {
  return useQuery({
    queryKey: ['trip-ticket', id],
    queryFn: () => fetchTripTicketById(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
    retry: 1,
  });
};

// ============ MUTATIONS ============

// Refresh ticket detail (invalidate query)
export const useRefreshTicketDetail = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ticketId) => {
      await queryClient.invalidateQueries({ queryKey: ['trip-ticket', ticketId] });
      return true;
    },
    onError: () => {
      toast.error('Failed to refresh ticket details');
    },
  });
};

// ============ HELPERS ============

export const getStatusConfig = (status) => {
  const configs = {
    draft: { color: 'bg-slate-500', label: 'Draft', icon: 'Clock', textColor: 'text-white' },
    pending_head_approval: { color: 'bg-purple-500', label: 'Pending Head Approval', icon: 'Clock', textColor: 'text-white' },
    pending_gso_review: { color: 'bg-amber-500', label: 'Pending GSO Review', icon: 'Clock', textColor: 'text-white' },
    returned_for_revision: { color: 'bg-red-500', label: 'Returned for Revision', icon: 'AlertCircle', textColor: 'text-white' },
    with_mayors_office: { color: 'bg-violet-500', label: "With Mayor's Office", icon: 'Building2', textColor: 'text-white' },
    pending_mayors_office: { color: 'bg-violet-500', label: "Pending Mayor's Office", icon: 'Clock', textColor: 'text-white' },
    funds_issued: { color: 'bg-emerald-500', label: 'Funds Issued', icon: 'DollarSign', textColor: 'text-white' },
    acknowledged: { color: 'bg-blue-500', label: 'Acknowledged', icon: 'CheckCircle', textColor: 'text-white' },
    in_transit: { color: 'bg-indigo-500', label: 'In Transit', icon: 'Truck', textColor: 'text-white' },
    pending_reconciliation: { color: 'bg-orange-500', label: 'Pending Reconciliation', icon: 'Clock', textColor: 'text-white' },
    closed: { color: 'bg-emerald-600', label: 'Closed', icon: 'CheckCircle', textColor: 'text-white' },
    cancelled: { color: 'bg-red-700', label: 'Cancelled', icon: 'XCircle', textColor: 'text-white' },
    rejected: { color: 'bg-red-600', label: 'Rejected', icon: 'XCircle', textColor: 'text-white' }
  };
  return configs[status] || { color: 'bg-slate-500', label: status?.replace(/_/g, ' ') || 'Unknown', icon: 'Clock', textColor: 'text-white' };
};

export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '₱0.00';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(amount);
};

export const getProgressPercentage = (status) => {
  const statusOrder = [
    'draft',
    'pending_head_approval',
    'pending_gso_review',
    'pending_mayors_office',
    'with_mayors_office',
    'funds_issued',
    'acknowledged',
    'in_transit',
    'pending_reconciliation',
    'closed'
  ];
  const currentIndex = statusOrder.indexOf(status);
  if (currentIndex === -1) return 0;
  return ((currentIndex + 1) / statusOrder.length) * 100;
};
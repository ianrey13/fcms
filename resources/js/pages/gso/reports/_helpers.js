// src/pages/gso/reports/_helpers.js
// ============================================
// ✅ SHARED HELPERS FOR ALL REPORT COMPONENTS
// ============================================

export const CACHE_5MIN = 5 * 60 * 1000;
export const CACHE_10MIN = 10 * 60 * 1000;

export const COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
    '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1',
];

export const STATUS_OPTIONS = [
    { value: 'all', label: 'All Status' },
    { value: 'pending_mayors_office', label: 'Pending MO' },
    { value: 'funds_issued', label: 'Funds Issued' },
    { value: 'acknowledged', label: 'Acknowledged' },
    { value: 'in_transit', label: 'In Transit' },
    { value: 'pending_gso_validation', label: 'Pending Validation' },
    { value: 'completed', label: 'Completed' },
    { value: 'closed', label: 'Closed' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' },
];

export const DISTANCE_MATCH_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'Match', label: 'Match' },
    { value: 'Discrepancy', label: 'Discrepancy' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'No GPS Data', label: 'No GPS Data' },
];

export const RECEIPT_STATUS_OPTIONS = [
    { value: 'all', label: 'All Status' },
    { value: 'Verified', label: 'Verified' },
    { value: 'For Review', label: 'For Review' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Rejected', label: 'Rejected' },
];

export const AUDIT_RESULT_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'Success', label: 'Success' },
    { value: 'Failed', label: 'Failed' },
];

export const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '₱0.00';
    return new Intl.NumberFormat('en-PH', {
        style: 'currency', currency: 'PHP', minimumFractionDigits: 2,
    }).format(amount);
};

export const formatNumber = (num) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return new Intl.NumberFormat('en-PH').format(num);
};

export const getStatusBadge = (status) => {
    const map = {
        'pending_mayors_office': { label: 'Pending MO', color: 'bg-yellow-500' },
        'funds_issued': { label: 'Funds Issued', color: 'bg-blue-500' },
        'acknowledged': { label: 'Acknowledged', color: 'bg-cyan-500' },
        'in_transit': { label: 'In Transit', color: 'bg-purple-500' },
        'pending_gso_validation': { label: 'Pending Validation', color: 'bg-indigo-500' },
        'completed': { label: 'Completed', color: 'bg-green-500' },
        'closed': { label: 'Closed', color: 'bg-green-600' },
        'rejected': { label: 'Rejected', color: 'bg-red-500' },
        'cancelled': { label: 'Cancelled', color: 'bg-slate-500' },
        'pending_reconciliation': { label: 'Pending Recon', color: 'bg-orange-500' },
        'returned_for_revision': { label: 'Returned', color: 'bg-purple-500' },
        'draft': { label: 'Draft', color: 'bg-slate-400' },
    };
    return map[status?.toLowerCase()] || { label: status || 'N/A', color: 'bg-slate-400' };
};

export const getEfficiencyBadge = (kmPerLiter) => {
    if (!kmPerLiter || kmPerLiter === 0) return { label: 'No Data', color: 'bg-slate-400' };
    if (kmPerLiter >= 10) return { label: 'Excellent', color: 'bg-green-500' };
    if (kmPerLiter >= 7) return { label: 'Good', color: 'bg-blue-500' };
    if (kmPerLiter >= 5) return { label: 'Average', color: 'bg-yellow-500' };
    if (kmPerLiter >= 3) return { label: 'Poor', color: 'bg-orange-500' };
    return { label: 'Critical', color: 'bg-red-500' };
};
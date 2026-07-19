// src/pages/mayor/BudgetPolicies.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  Search,
  RefreshCw,
  TrendingUp,
  Building2,
  RotateCcw,
  AlertTriangle,
  Loader2,
  History,
  ArrowUpCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { mayorsOfficeAPI } from '../../services/api';
import { toast } from 'react-hot-toast';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';

const BudgetPolicies = () => {
  const [budgetData, setBudgetData] = useState([]);
  const [budgetHistory, setBudgetHistory] = useState([]);
  const [resetHistory, setResetHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [deletingPolicy, setDeletingPolicy] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState({});
  
  // Form state
  const [formData, setFormData] = useState({
    department_id: '',
    default_weekly_allocation: '',
    add_amount: '',
    reason: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UI state
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBudgetData();
    fetchBudgetHistory();
    fetchResetHistory();
  }, []);

  const fetchBudgetData = async () => {
    setLoading(true);
    try {
        // ✅ Uses your endpoint: /mayors-office/departments/all-with-budget
        const response = await mayorsOfficeAPI.getAllDepartmentsWithBudget();
        console.log('📊 Budget Data Response:', response);
        
        let data = response.data?.data || response.data || [];
        if (data.data) {
            data = data.data;
        }
        
        const formattedData = (Array.isArray(data) ? data : []).map(item => ({
            ...item,
            department_id: item.department_id,
            department_name: item.department_name || 'Unknown',
            department_code: item.department_code || '',
            allocated_amount: parseFloat(item.allocated_amount || item.default_weekly_allocation || 0),
            remaining_balance: parseFloat(item.remaining_balance || item.allocated_amount || 0),
            spent_amount: parseFloat(item.spent_amount || 0),
            has_budget: item.has_budget !== false,
            period_id: item.period_id || null,
            week_start: item.week_start || null,
            status: item.status || 'inactive',
        }));
        
        setBudgetData(formattedData);
    } catch (error) {
        console.error('Failed to fetch budget data:', error);
        toast.error('Failed to load budget data');
        setBudgetData([]);
    } finally {
        setLoading(false);
    }
};

 const fetchBudgetHistory = async () => {
    try {
        // ✅ Uses your endpoint: /mayors-office/budget-history
        const response = await mayorsOfficeAPI.getBudgetHistory();
        console.log('📊 Budget History Response:', response);
        
        let data = response.data?.data || response.data || [];
        
        // Ensure we have an array
        if (!Array.isArray(data)) {
            data = [];
        }
        
        setBudgetHistory(data);
    } catch (error) {
        console.error('Failed to fetch budget history:', error);
        // Fallback: create history from current budget data
        const fallbackHistory = budgetData
            .filter(item => item.allocated_amount > 0)
            .map(item => ({
                id: item.department_id,
                department_id: item.department_id,
                department_name: item.department_name,
                action: 'created',
                previous_amount: 0,
                added_amount: item.allocated_amount,
                new_amount: item.allocated_amount,
                reason: 'Initial budget',
                user_name: 'System',
                created_at: new Date().toISOString()
            }));
        setBudgetHistory(fallbackHistory);
    }
};

 // ✅ Fetch budget reset history from dept_budget_period
const fetchResetHistory = async () => {
    try {
        // Try to fetch from API
        const response = await mayorsOfficeAPI.getBudgetPeriods?.();
        const data = response?.data?.data || response?.data || [];
        
        if (Array.isArray(data) && data.length > 0) {
            const formattedResetHistory = data
                .filter(item => item.status === 'closed' || item.status === 'active')
                .map(item => ({
                    ...item,
                    period_id: item.period_id,
                    department_id: item.department_id,
                    week_start: item.week_start,
                    week_end: item.week_end || addDays(new Date(item.week_start), 6),
                    allocated_amount: parseFloat(item.allocated_amount || 0),
                    status: item.status,
                    closed_at: item.closed_at,
                    created_at: item.created_at,
                    is_current: item.status === 'active',
                    department_name: item.department_name || `Department ${item.department_id}`,
                }))
                .sort((a, b) => new Date(b.week_start) - new Date(a.week_start));
            
            setResetHistory(formattedResetHistory);
        } else {
            // ✅ Fallback: Use budgetData to create reset history
            createFallbackResetHistory();
        }
    } catch (error) {
        console.error('Failed to fetch reset history:', error);
        // ✅ Fallback: Use budgetData to create reset history
        createFallbackResetHistory();
    }
};

// ✅ Helper to create fallback reset history from budgetData
const createFallbackResetHistory = () => {
    // Group budget data by week_start
    const groupedByWeek = {};
    
    budgetData.forEach(item => {
        if (item.week_start) {
            const weekKey = item.week_start;
            if (!groupedByWeek[weekKey]) {
                groupedByWeek[weekKey] = {
                    week_start: item.week_start,
                    departments: [],
                    total_allocated: 0,
                    status: item.status || 'active',
                };
            }
            groupedByWeek[weekKey].departments.push(item);
            groupedByWeek[weekKey].total_allocated += (item.allocated_amount || 0);
        }
    });
    
    const fallbackHistory = Object.values(groupedByWeek)
        .map(week => ({
            ...week,
            week_end: addDays(new Date(week.week_start), 6),
            is_current: week.status === 'active',
        }))
        .sort((a, b) => new Date(b.week_start) - new Date(a.week_start));
    
    setResetHistory(fallbackHistory);
    
    if (fallbackHistory.length === 0) {
        // ✅ If no data, create a default entry from current budget
        const currentWeekStart = new Date();
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1); // Monday
        
        const defaultEntry = {
            week_start: currentWeekStart.toISOString().split('T')[0],
            week_end: addDays(currentWeekStart, 6).toISOString().split('T')[0],
            departments: budgetData.map(dept => ({
                ...dept,
                department_name: dept.department_name || `Department ${dept.department_id}`,
            })),
            total_allocated: budgetData.reduce((sum, d) => sum + (d.allocated_amount || 0), 0),
            status: 'active',
            is_current: true,
        };
        
        setResetHistory([defaultEntry]);
    }
};

  // Helper to add days
  const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchBudgetData(), fetchBudgetHistory(), fetchResetHistory()]);
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  // ✅ CREATE
  const handleCreate = async (e) => {
    e.preventDefault();
    
    const errors = {};
    if (!formData.department_id) errors.department_id = 'Please select a department';
    if (!formData.default_weekly_allocation || parseFloat(formData.default_weekly_allocation) <= 0) {
      errors.default_weekly_allocation = 'Please enter a valid allocation amount';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setIsSubmitting(true);
    try {
      await mayorsOfficeAPI.createBudgetPolicy({
        department_id: parseInt(formData.department_id),
        default_weekly_allocation: parseFloat(formData.default_weekly_allocation),
        reason: formData.reason || 'Initial budget allocation',
      });
      
      toast.success('Budget policy created successfully!');
      setShowCreateModal(false);
      resetForm();
      await Promise.all([fetchBudgetData(), fetchBudgetHistory(), fetchResetHistory()]);
    } catch (error) {
      console.error('Create error:', error);
      toast.error(error.response?.data?.message || 'Failed to create budget policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ UPDATE - ADD to Budget
  const handleUpdate = async (e) => {
    e.preventDefault();
    
    const errors = {};
    if (!formData.add_amount || parseFloat(formData.add_amount) <= 0) {
      errors.add_amount = 'Please enter a valid amount to add';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const addAmount = parseFloat(formData.add_amount);
      const currentAllocation = parseFloat(editingPolicy?.allocated_amount || 0);
      const newTotal = currentAllocation + addAmount;
      
      await mayorsOfficeAPI.updateBudgetPolicy(
        editingPolicy.department_id,
        {
          default_weekly_allocation: newTotal,
          added_amount: addAmount,
          reason: formData.reason || 'Budget addition',
        }
      );
      
      toast.success(`✅ ₱${addAmount.toFixed(2)} added! New total: ₱${newTotal.toFixed(2)}`);
      setShowEditModal(false);
      resetForm();
      await Promise.all([fetchBudgetData(), fetchBudgetHistory(), fetchResetHistory()]);
    } catch (error) {
      console.error('Update error:', error);
      toast.error(error.response?.data?.message || 'Failed to update budget');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ DELETE
  const handleDelete = async () => {
    if (!deletingPolicy) return;
    
    setIsSubmitting(true);
    try {
      await mayorsOfficeAPI.deleteBudgetPolicy(deletingPolicy.department_id);
      toast.success('Budget policy deleted successfully!');
      setShowDeleteModal(false);
      setDeletingPolicy(null);
      await Promise.all([fetchBudgetData(), fetchBudgetHistory(), fetchResetHistory()]);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete budget policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ ACTIVATE
  const handleActivate = async () => {
    if (!showActivateModal) return;
    
    setIsSubmitting(true);
    try {
      await mayorsOfficeAPI.forceActivateBudget({
        department_id: showActivateModal.department_id,
        amount: showActivateModal.allocated_amount || 0,
      });
      
      toast.success(`Budget activated for ${showActivateModal.department_name}!`);
      setShowActivateModal(null);
      await Promise.all([fetchBudgetData(), fetchBudgetHistory(), fetchResetHistory()]);
    } catch (error) {
      console.error('Activate error:', error);
      toast.error(error.response?.data?.message || 'Failed to activate budget');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ department_id: '', default_weekly_allocation: '', add_amount: '', reason: '' });
    setFormErrors({});
    setEditingPolicy(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (policy) => {
    setEditingPolicy(policy);
    setFormData({
      department_id: policy.department_id,
      default_weekly_allocation: policy.allocated_amount || 0,
      add_amount: '',
      reason: '',
    });
    setShowEditModal(true);
  };

  const openHistoryModal = (policy) => {
    setSelectedDepartment(policy);
    const deptHistory = budgetHistory.filter(
      h => h.department_id === policy.department_id
    );
    setBudgetHistory(deptHistory);
    setShowHistoryModal(true);
  };

  const openDeleteModal = (policy) => {
    setDeletingPolicy(policy);
    setShowDeleteModal(true);
  };

  const openActivateModal = (policy) => {
    setShowActivateModal({
      department_id: policy.department_id,
      department_name: policy.department_name,
      allocated_amount: policy.allocated_amount || 0,
    });
  };

  const toggleHistoryExpand = (index) => {
    setExpandedHistory(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy hh:mm a');
    } catch {
      return dateString;
    }
  };

  const getWeekNumber = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      const diff = date - startOfYear;
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return Math.ceil((days + startOfYear.getDay() + 1) / 7);
    } catch {
      return 'N/A';
    }
  };

  const getWeekRange = (weekStart) => {
    if (!weekStart) return 'N/A';
    try {
      const start = new Date(weekStart);
      const end = addDays(start, 6);
      return `${formatDate(start)} - ${formatDate(end)}`;
    } catch {
      return 'N/A';
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'active') {
      return <Badge className="bg-green-100 text-green-700">Active</Badge>;
    } else if (status === 'closed') {
      return <Badge className="bg-gray-100 text-gray-700">Closed</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return budgetData;
    const search = searchTerm.toLowerCase();
    return budgetData.filter(item =>
      item.department_name?.toLowerCase().includes(search) ||
      item.department_code?.toLowerCase().includes(search)
    );
  }, [budgetData, searchTerm]);

  const summaryStats = useMemo(() => {
    const totalAllocation = budgetData.reduce((sum, p) => sum + (p.allocated_amount || 0), 0);
    const totalSpent = budgetData.reduce((sum, p) => sum + (p.spent_amount || 0), 0);
    const totalRemaining = budgetData.reduce((sum, p) => sum + (p.remaining_balance || 0), 0);
    return { totalAllocation, totalSpent, totalRemaining };
  }, [budgetData]);

  // Group reset history by week
  const groupedResetHistory = useMemo(() => {
    const groups = {};
    resetHistory.forEach(item => {
      const weekKey = item.week_start;
      if (!groups[weekKey]) {
        groups[weekKey] = {
          week_start: item.week_start,
          week_end: item.week_end,
          departments: [],
          total_allocated: 0,
          status: item.status,
          closed_at: item.closed_at,
        };
      }
      groups[weekKey].departments.push(item);
      groups[weekKey].total_allocated += parseFloat(item.allocated_amount || 0);
    });
    return Object.values(groups).sort((a, b) => new Date(b.week_start) - new Date(a.week_start));
  }, [resetHistory]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Budget Allocation</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage department weekly fuel budget allocations with history tracking
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Budget Policy
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Allocation</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(summaryStats.totalAllocation)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Spent</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(summaryStats.totalSpent)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Remaining</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summaryStats.totalRemaining)}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Reset History Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-purple-500" />
            Budget Reset History
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({groupedResetHistory.length} weeks)
            </span>
          </CardTitle>
          <CardDescription>
            Track weekly budget resets across all departments. Each week shows the total allocated budget.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groupedResetHistory.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No budget reset history found</p>
              <p className="text-sm text-slate-400">Budgets will appear here after the first weekly reset</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedResetHistory.map((week, index) => {
                const isCurrentWeek = week.status === 'active';
                const daysAgo = week.closed_at ? differenceInDays(new Date(), new Date(week.closed_at)) : 0;
                
                return (
                  <div key={index} className={`border rounded-lg p-4 ${
                    isCurrentWeek ? 'bg-green-50 border-green-200' : 'bg-white'
                  }`}>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${
                          isCurrentWeek ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          <Calendar className={`h-5 w-5 ${
                            isCurrentWeek ? 'text-green-600' : 'text-gray-500'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-lg">
                              Week {getWeekNumber(week.week_start)}
                            </h4>
                            {getStatusBadge(week.status)}
                            {isCurrentWeek && (
                              <Badge className="bg-green-100 text-green-700 animate-pulse">
                                <Clock className="h-3 w-3 mr-1" />
                                Current Week
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-600">
                            {getWeekRange(week.week_start)}
                          </p>
                          <div className="flex flex-wrap gap-3 mt-1 text-sm">
                            <span className="text-slate-500">
                              <strong>{week.departments.length}</strong> departments
                            </span>
                            <span className="text-slate-500">
                              Total: <strong className="text-blue-600">{formatCurrency(week.total_allocated)}</strong>
                            </span>
                            {week.closed_at && (
                              <span className="text-slate-400">
                                Closed: {formatDateTime(week.closed_at)}
                              </span>
                            )}
                            {daysAgo > 0 && week.status === 'closed' && (
                              <span className="text-slate-400">
                                ({daysAgo} day{daysAgo > 1 ? 's' : ''} ago)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Filter to show only this week's departments
                          const weekDepts = week.departments.map(d => d.department_id);
                          const filtered = budgetData.filter(d => weekDepts.includes(d.department_id));
                          setBudgetData(filtered);
                          setTimeout(() => setBudgetData(prev => prev), 100);
                        }}
                        className="text-xs"
                      >
                        View Details
                      </Button>
                    </div>
                    
                    {/* Department breakdown for this week */}
                    {week.departments.length > 0 && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-4 gap-2">
                        {week.departments.slice(0, 4).map((dept, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="text-slate-500">{dept.department_name || `Dept ${dept.department_id}`}</span>
                            <span className="ml-2 font-medium">{formatCurrency(dept.allocated_amount)}</span>
                          </div>
                        ))}
                        {week.departments.length > 4 && (
                          <div className="text-sm text-slate-400">
                            +{week.departments.length - 4} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <div className="p-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {/* Budget Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Department Budgets
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({filteredData.length} departments)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredData.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No budget data found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Allocated</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Spent</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Remaining</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Utilization</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredData.map((policy) => {
                    const utilization = policy.allocated_amount > 0
                      ? ((policy.spent_amount || 0) / policy.allocated_amount) * 100
                      : 0;
                    const isLow = utilization > 80;
                    const isCritical = utilization > 95;
                    const hasActivePeriod = policy.status === 'active';

                    return (
                      <tr key={policy.department_id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold">{policy.department_name}</p>
                            <p className="text-xs text-slate-500">{policy.department_code}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold">{formatCurrency(policy.allocated_amount)}</td>
                        <td className="px-4 py-3 text-red-600">{formatCurrency(policy.spent_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${
                            isCritical ? 'text-red-600' :
                            isLow ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {formatCurrency(policy.remaining_balance)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-slate-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  isCritical ? 'bg-red-500' :
                                  isLow ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(utilization, 100)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${
                              isCritical ? 'text-red-600' :
                              isLow ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {utilization.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openHistoryModal(policy)}
                              className="text-purple-600 hover:bg-purple-50 h-8 w-8 p-0"
                              title="View History"
                            >
                              <History className="h-4 w-4" />
                            </Button>

                            {!hasActivePeriod && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openActivateModal(policy)}
                                className="text-green-600 border-green-300 hover:bg-green-50 h-8 px-2"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Activate
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(policy)}
                              className="text-green-600 hover:bg-green-50 h-8 w-8 p-0"
                              title="Add to Budget"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteModal(policy)}
                              className="text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE MODAL */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Add Budget Policy
            </DialogTitle>
            <DialogDescription>
              Set weekly fuel budget allocation for a department
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-4">
              <div>
                <Label>Department *</Label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full mt-1.5 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Department</option>
                  {budgetData.map((dept) => (
                    <option key={dept.department_id} value={dept.department_id}>
                      {dept.department_name} ({dept.department_code})
                    </option>
                  ))}
                </select>
                {formErrors.department_id && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.department_id}</p>
                )}
              </div>

              <div>
                <Label>Weekly Allocation (₱) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.default_weekly_allocation}
                  onChange={(e) => setFormData({ ...formData, default_weekly_allocation: e.target.value })}
                  placeholder="e.g., 5000.00"
                />
                {formErrors.default_weekly_allocation && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.default_weekly_allocation}</p>
                )}
              </div>

              <div>
                <Label>Reason (Optional)</Label>
                <Input
                  type="text"
                  value={formData.reason || ''}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., Initial budget allocation"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-700">
                  Estimated monthly: <strong>{formatCurrency(parseFloat(formData.default_weekly_allocation || 0) * 4)}</strong>
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Policy
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL - ADD to Budget */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <ArrowUpCircle className="h-5 w-5" />
              Add to Budget
            </DialogTitle>
            <DialogDescription>
              Add additional funds to <strong>{editingPolicy?.department_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate}>
            <div className="space-y-4 py-4">
              <div>
                <Label>Department</Label>
                <Input
                  value={editingPolicy?.department_name || ''}
                  disabled
                  className="mt-1.5 bg-slate-100"
                />
              </div>

              <div>
                <Label>Current Allocation</Label>
                <Input
                  value={formatCurrency(editingPolicy?.allocated_amount || 0)}
                  disabled
                  className="mt-1.5 bg-slate-100 text-blue-600 font-semibold"
                />
              </div>

              <div>
                <Label>Amount to Add (₱) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.add_amount}
                  onChange={(e) => setFormData({ ...formData, add_amount: e.target.value })}
                  placeholder="e.g., 5000.00"
                  className="border-green-300 focus:border-green-500"
                />
                {formErrors.add_amount && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.add_amount}</p>
                )}
              </div>

              <div>
                <Label>Reason (Optional)</Label>
                <Input
                  type="text"
                  value={formData.reason || ''}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., Additional budget for project"
                />
              </div>

              {formData.add_amount && parseFloat(formData.add_amount) > 0 && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700">
                    New total will be: <strong>
                      {formatCurrency((parseFloat(editingPolicy?.allocated_amount || 0) + parseFloat(formData.add_amount)))}
                    </strong>
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add to Budget
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE MODAL */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Budget Policy
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the budget policy for{' '}
              <strong>{deletingPolicy?.department_name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-red-50 p-3 rounded-lg">
              <p className="text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                This action cannot be undone.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleDelete} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HISTORY MODAL */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-purple-600" />
              Budget History: {selectedDepartment?.department_name}
            </DialogTitle>
            <DialogDescription>
              All budget changes for this department
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {budgetHistory.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No history found for this department</p>
              </div>
            ) : (
              <div className="space-y-3">
                {budgetHistory.map((entry, index) => (
                  <div key={entry.id || index} className="border rounded-lg p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`${
                            entry.action === 'added' || entry.action === 'add' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-blue-100 text-blue-700'
                          } text-xs`}>
                            {entry.action || 'Added'}
                          </Badge>
                          <span className="text-xs text-slate-400">{formatDateTime(entry.created_at)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-slate-500">Before:</span>
                            <span className="font-medium ml-1">{formatCurrency(entry.previous_amount || 0)}</span>
                          </div>
                          <div>
                            <span className="text-green-600">+ Added:</span>
                            <span className="font-medium text-green-600 ml-1">
                              {formatCurrency(entry.added_amount || entry.amount || 0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-blue-600">After:</span>
                            <span className="font-medium text-blue-600 ml-1">
                              {formatCurrency(entry.new_amount || 0)}
                            </span>
                          </div>
                        </div>
                        {entry.reason && (
                          <p className="text-xs text-slate-500 mt-1">
                            <span className="text-slate-400">Reason:</span> {entry.reason}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          By: {entry.user_name || 'System'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHistoryModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ACTIVATE MODAL */}
      {showActivateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                  <RotateCcw className="h-7 w-7 text-green-600" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-center mb-2">Activate Budget Period</h2>
              <p className="text-slate-600 text-center mb-4">
                Are you sure you want to activate the budget for <strong>{showActivateModal.department_name}</strong>?
              </p>
              <div className="bg-blue-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Allocation:</strong> {formatCurrency(showActivateModal.allocated_amount)}
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleActivate}
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Yes, Activate
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowActivateModal(null)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetPolicies;
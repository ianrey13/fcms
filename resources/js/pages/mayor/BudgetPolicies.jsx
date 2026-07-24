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
  Calendar,
  TrendingDown,
  CalendarDays,
  Edit,
  CalendarRange,
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
import { format, differenceInDays } from 'date-fns';

const BudgetPolicies = () => {
  const [budgetData, setBudgetData] = useState([]);
  const [budgetHistory, setBudgetHistory] = useState([]);
  const [resetHistory, setResetHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('budgets');
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [weeklyPolicy, setWeeklyPolicy] = useState(null);
  const [deletingPolicy, setDeletingPolicy] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    department_id: '',
    annual_budget: '',
    add_amount: '',
    weekly_allocation: '',
    reason: '',
    fiscal_year: new Date().getFullYear(),
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UI state
  const [searchTerm, setSearchTerm] = useState('');

  // ============================================================
  // ✅ HELPER FUNCTIONS
  // ============================================================
  
  const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  // ============================================================
  // ✅ INITIAL LOAD
  // ============================================================
  useEffect(() => {
    fetchBudgetData();
    fetchBudgetHistory();
    fetchResetHistory();
  }, []);

  // ============================================================
  // ✅ FETCH FUNCTIONS
  // ============================================================

  const fetchBudgetData = async () => {
    setLoading(true);
    try {
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
        // ✅ Annual budget (Primary)
        annual_amount: parseFloat(item.annual_amount || 0),
        used_amount: parseFloat(item.used_amount || 0),
        remaining_amount: parseFloat(item.remaining_amount || 0),
        // ✅ Weekly allocation
        weekly_allocation: parseFloat(item.weekly_allocation || 0),
        weekly_used: parseFloat(item.weekly_used || 0),
        has_budget: item.has_budget !== false,
        fiscal_year: item.fiscal_year || new Date().getFullYear(),
        status: item.status || 'active',
      }));
      
      console.log('✅ Formatted Annual Budget Data:', formattedData);
      setBudgetData(formattedData);
      
    } catch (error) {
      console.error('Failed to fetch budget data:', error);
      // Use fallback data
      const fallbackData = [
        { department_id: 11, department_name: 'Engineering Office', department_code: 'ENGR', annual_amount: 1000000, fiscal_year: 2026, weekly_allocation: 19230.77 },
        { department_id: 2, department_name: 'General Services Office', department_code: 'GSO', annual_amount: 500000, fiscal_year: 2026, weekly_allocation: 9615.38 },
        { department_id: 6, department_name: "Mayor's Office", department_code: 'MO', annual_amount: 500000, fiscal_year: 2026, weekly_allocation: 9615.38 },
      ];
      
      const formattedData = fallbackData.map(item => ({
        ...item,
        used_amount: 0,
        remaining_amount: item.annual_amount,
        weekly_used: 0,
        has_budget: true,
        status: 'active',
      }));
      setBudgetData(formattedData);
      toast.error('Failed to load budget data, using fallback data');
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgetHistory = async () => {
    try {
      const response = await mayorsOfficeAPI.getBudgetHistory();
      console.log('📊 Budget History Response:', response);
      
      let data = response.data?.data || response.data || [];
      if (!Array.isArray(data)) {
        data = [];
      }
      setBudgetHistory(data);
    } catch (error) {
      console.error('Failed to fetch budget history:', error);
      setBudgetHistory([]);
    }
  };

  useEffect(() => {
    if (resetHistory.length === 0 && budgetData.length > 0) {
      console.log('🔄 Force creating reset history from budget data');
      createFallbackResetHistory();
    }
  }, [budgetData, resetHistory]);

  const fetchResetHistory = async () => {
    try {
      console.log('🔄 FETCHING RESET HISTORY...');
      const response = await mayorsOfficeAPI.getBudgetPeriods?.();
      console.log('📊 Reset History Response:', response);
      
      const data = response?.data?.data || response?.data || [];
      
      if (Array.isArray(data) && data.length > 0) {
        const formattedResetHistory = data.map(item => ({
          period_id: item.period_id,
          department_id: item.department_id,
          department_name: item.department_name || `Department ${item.department_id}`,
          department_code: item.department_code || '',
          week_start: item.week_start,
          week_end: item.week_end || addDays(new Date(item.week_start), 6).toISOString().split('T')[0],
          allocated_amount: parseFloat(item.allocated_amount || 0),
          remaining_balance: parseFloat(item.remaining_balance || 0),
          status: item.status || 'inactive',
          closed_at: item.closed_at,
          created_at: item.created_at,
          is_current: item.status === 'active',
        }));
        
        const groupedByWeek = {};
        formattedResetHistory.forEach(item => {
          const weekKey = item.week_start;
          if (!groupedByWeek[weekKey]) {
            groupedByWeek[weekKey] = {
              week_start: item.week_start,
              week_end: item.week_end,
              departments: [],
              total_allocated: 0,
              status: item.status,
              closed_at: item.closed_at,
            };
          }
          groupedByWeek[weekKey].departments.push(item);
          groupedByWeek[weekKey].total_allocated += item.allocated_amount;
        });
        
        const groupedHistory = Object.values(groupedByWeek)
          .sort((a, b) => new Date(b.week_start) - new Date(a.week_start));
        
        console.log('✅ Grouped History:', groupedHistory);
        setResetHistory(groupedHistory);
      } else {
        console.log('⚠️ No data found, using fallback');
        createFallbackResetHistory();
      }
    } catch (error) {
      console.error('❌ Failed to fetch reset history:', error);
      createFallbackResetHistory();
    }
  };

  const createFallbackResetHistory = () => {
    if (!budgetData || budgetData.length === 0) {
      setResetHistory([]);
      return;
    }
    
    const groupedByWeek = {};
    const currentWeekStart = new Date();
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1);
    const weekKey = currentWeekStart.toISOString().split('T')[0];
    
    groupedByWeek[weekKey] = {
      week_start: weekKey,
      week_end: addDays(currentWeekStart, 6).toISOString().split('T')[0],
      departments: budgetData.map(dept => ({
        department_id: dept.department_id,
        department_name: dept.department_name || `Department ${dept.department_id}`,
        allocated_amount: dept.weekly_allocation || 0,
      })),
      total_allocated: budgetData.reduce((sum, d) => sum + (d.weekly_allocation || 0), 0),
      status: 'active',
      closed_at: null,
    };
    
    setResetHistory(Object.values(groupedByWeek));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchBudgetData(), fetchBudgetHistory(), fetchResetHistory()]);
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  // ============================================================
  // ✅ CRUD OPERATIONS
  // ============================================================

  const handleCreate = async (e) => {
    e.preventDefault();
    
    const errors = {};
    if (!formData.department_id) errors.department_id = 'Please select a department';
    if (!formData.annual_budget || parseFloat(formData.annual_budget) <= 0) {
      errors.annual_budget = 'Please enter a valid annual budget amount';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload = {
        department_id: parseInt(formData.department_id),
        annual_budget: parseFloat(formData.annual_budget),
        fiscal_year: formData.fiscal_year || new Date().getFullYear(),
        reason: formData.reason || 'Initial annual budget allocation',
      };
      
      console.log('📤 Creating budget with payload:', payload);
      
      await mayorsOfficeAPI.createAnnualBudget(payload);
      
      toast.success(`✅ Annual budget created! (FY ${formData.fiscal_year})`);
      setShowCreateModal(false);
      resetForm();
      await Promise.all([fetchBudgetData(), fetchBudgetHistory(), fetchResetHistory()]);
      setForceUpdate(prev => prev + 1);
    } catch (error) {
      console.error('Create error:', error);
      console.error('Error response:', error.response?.data);
      
      const errorData = error.response?.data;
      let errorMessage = 'Failed to create budget';
      
      if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (errorData?.errors) {
        const errors = Object.values(errorData.errors).flat();
        errorMessage = errors.join(', ');
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddToBudget = async (e) => {
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
      const currentAnnual = parseFloat(editingPolicy?.annual_amount || 0);
      const newTotal = currentAnnual + addAmount;
      
      console.log('📤 Updating budget:', {
        department_id: editingPolicy?.department_id,
        currentAnnual,
        addAmount,
        newTotal,
      });
      
      const payload = {
        add_amount: addAmount,
        reason: formData.reason || 'Budget addition',
      };
      
      await mayorsOfficeAPI.updateBudgetPolicy(
        editingPolicy.department_id,
        payload
      );
      
      toast.success(`✅ ₱${addAmount.toFixed(2)} added!\nNew Annual: ₱${newTotal.toFixed(2)}\nNew Weekly: ₱${(newTotal / 52).toFixed(2)}`);
      setShowEditModal(false);
      resetForm();
      
      await Promise.all([fetchBudgetData(), fetchBudgetHistory(), fetchResetHistory()]);
      setForceUpdate(prev => prev + 1);
    } catch (error) {
      console.error('Update error:', error);
      console.error('Error response:', error.response?.data);
      
      const errorData = error.response?.data;
      let errorMessage = 'Failed to add to budget';
      
      if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (errorData?.errors) {
        const errors = Object.values(errorData.errors).flat();
        errorMessage = errors.join(', ');
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ NEW: Update Weekly Allocation
  const handleUpdateWeekly = async (e) => {
    e.preventDefault();
    
    const errors = {};
    if (!formData.weekly_allocation || parseFloat(formData.weekly_allocation) <= 0) {
      errors.weekly_allocation = 'Please enter a valid weekly allocation amount';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const weeklyAmount = parseFloat(formData.weekly_allocation);
      const newAnnual = weeklyAmount * 52;
      
      console.log('📤 Updating weekly allocation:', {
        department_id: weeklyPolicy?.department_id,
        weeklyAmount,
        newAnnual,
      });
      
      // ✅ Update the weekly allocation (this updates both weekly and annual)
      const payload = {
        weekly_allocation: weeklyAmount,
        reason: formData.reason || 'Weekly allocation update',
      };
      
      await mayorsOfficeAPI.updateWeeklyAllocation(
        weeklyPolicy.department_id,
        payload
      );
      
      toast.success(`✅ Weekly allocation updated to ₱${weeklyAmount.toFixed(2)}!\nNew Annual: ₱${newAnnual.toFixed(2)}`);
      setShowWeeklyModal(false);
      resetForm();
      
      await Promise.all([fetchBudgetData(), fetchBudgetHistory(), fetchResetHistory()]);
      setForceUpdate(prev => prev + 1);
    } catch (error) {
      console.error('Update weekly error:', error);
      console.error('Error response:', error.response?.data);
      
      const errorData = error.response?.data;
      let errorMessage = 'Failed to update weekly allocation';
      
      if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (errorData?.errors) {
        const errors = Object.values(errorData.errors).flat();
        errorMessage = errors.join(', ');
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPolicy) return;
    
    setIsSubmitting(true);
    try {
      await mayorsOfficeAPI.deleteBudgetPolicy(deletingPolicy.department_id);
      toast.success('Budget policy deleted successfully!');
      setShowDeleteModal(false);
      setDeletingPolicy(null);
      await Promise.all([fetchBudgetData(), fetchBudgetHistory(), fetchResetHistory()]);
      setForceUpdate(prev => prev + 1);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete budget policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ 
      department_id: '', 
      annual_budget: '', 
      add_amount: '', 
      weekly_allocation: '',
      reason: '',
      fiscal_year: new Date().getFullYear(),
    });
    setFormErrors({});
    setEditingPolicy(null);
    setWeeklyPolicy(null);
  };

  // ============================================================
  // ✅ MODAL HANDLERS
  // ============================================================

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (policy) => {
    setEditingPolicy(policy);
    setFormData({
      department_id: policy.department_id,
      annual_budget: policy.annual_amount || 0,
      add_amount: '',
      reason: '',
      fiscal_year: policy.fiscal_year || new Date().getFullYear(),
    });
    setShowEditModal(true);
  };

  // ✅ NEW: Open Weekly Allocation Modal
  const openWeeklyModal = (policy) => {
    setWeeklyPolicy(policy);
    setFormData({
      department_id: policy.department_id,
      weekly_allocation: policy.weekly_allocation || 0,
      reason: '',
      fiscal_year: policy.fiscal_year || new Date().getFullYear(),
    });
    setShowWeeklyModal(true);
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

  // ============================================================
  // ✅ UTILITY FUNCTIONS
  // ============================================================

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

  // ============================================================
  // ✅ MEMOIZED DATA
  // ============================================================

  const filteredData = useMemo(() => {
    if (!searchTerm) return budgetData;
    const search = searchTerm.toLowerCase();
    return budgetData.filter(item =>
      item.department_name?.toLowerCase().includes(search) ||
      item.department_code?.toLowerCase().includes(search)
    );
  }, [budgetData, searchTerm]);

  const summaryStats = useMemo(() => {
    const totalAnnual = budgetData.reduce((sum, p) => sum + (p.annual_amount || 0), 0);
    const totalUsed = budgetData.reduce((sum, p) => sum + (p.used_amount || 0), 0);
    const totalRemaining = budgetData.reduce((sum, p) => sum + (p.remaining_amount || 0), 0);
    const totalWeekly = budgetData.reduce((sum, p) => sum + (p.weekly_allocation || 0), 0);
    return { totalAnnual, totalUsed, totalRemaining, totalWeekly };
  }, [budgetData]);

  // ============================================================
  // ✅ RENDER
  // ============================================================

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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Annual Budget Allocation
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage department annual fuel budgets for FY {new Date().getFullYear()}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Set Annual Budget
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Annual Budget</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(summaryStats.totalAnnual)}</p>
                <p className="text-xs text-slate-400">FY {new Date().getFullYear()}</p>
              </div>
              <CalendarDays className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Weekly Allocation</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(summaryStats.totalWeekly)}</p>
                <p className="text-xs text-slate-400">All departments combined</p>
              </div>
              <CalendarRange className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Used</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(summaryStats.totalUsed)}</p>
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
                <p className="text-xs text-slate-400">
                  {summaryStats.totalAnnual > 0 
                    ? `${((summaryStats.totalRemaining / summaryStats.totalAnnual) * 100).toFixed(1)}% remaining`
                    : 'No budget set'}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('budgets')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'budgets'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Department Budgets
            <Badge variant="secondary" className="ml-1">
              {filteredData.length}
            </Badge>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Budget History
            <Badge variant="secondary" className="ml-1">
              {budgetHistory.length}
            </Badge>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('resets')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'resets'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Weekly Tracking
            <Badge variant="secondary" className="ml-1">
              {resetHistory.length}
            </Badge>
          </div>
        </button>
      </div>

      {/* TAB 1: DEPARTMENT BUDGETS */}
      {activeTab === 'budgets' && (
        <>
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

          <Card key={`budget-table-${forceUpdate}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Annual Budgets
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({filteredData.length} departments) • FY {new Date().getFullYear()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredData.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No annual budget data found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Department</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Annual Budget</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Weekly Allocation</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Used</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Remaining</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Utilization</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredData.map((policy) => {
                        const utilization = policy.annual_amount > 0
                          ? ((policy.used_amount || 0) / policy.annual_amount) * 100
                          : 0;
                        const isLow = utilization > 80;
                        const isCritical = utilization > 95;

                        return (
                          <tr key={policy.department_id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-semibold">{policy.department_name}</p>
                                <p className="text-xs text-slate-500">{policy.department_code}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-semibold text-blue-600">{formatCurrency(policy.annual_amount)}</p>
                                <p className="text-xs text-slate-400">FY {policy.fiscal_year || new Date().getFullYear()}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-semibold text-purple-600">{formatCurrency(policy.weekly_allocation)}</p>
                                <p className="text-xs text-slate-400">per week</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-red-600">{formatCurrency(policy.used_amount)}</td>
                            <td className="px-4 py-3">
                              <span className={`font-semibold ${
                                isCritical ? 'text-red-600' :
                                isLow ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                {formatCurrency(policy.remaining_amount)}
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
                                
                                {/* ✅ NEW: Edit Weekly Allocation */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openWeeklyModal(policy)}
                                  className="text-orange-600 hover:bg-orange-50 h-8 w-8 p-0"
                                  title="Set Weekly Allocation"
                                >
                                  <CalendarRange className="h-4 w-4" />
                                </Button>
                                
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
        </>
      )}

      {/* TAB 2: BUDGET HISTORY */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-purple-500" />
              Budget Change History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {budgetHistory.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No budget history found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {budgetHistory.map((entry, index) => (
                  <div key={entry.id || index} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className="bg-green-100 text-green-700">
                            {entry.action || 'Added'}
                          </Badge>
                          <h4 className="font-semibold">{entry.department_name}</h4>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
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
                          <div>
                            <span className="text-slate-500">By:</span>
                            <span className="font-medium ml-1">{entry.user_name || 'System'}</span>
                          </div>
                        </div>
                        {entry.reason && (
                          <p className="text-sm text-slate-500 mt-2">
                            <span className="text-slate-400">Reason:</span> {entry.reason}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-2">
                          {formatDateTime(entry.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: WEEKLY TRACKING */}
      {activeTab === 'resets' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-purple-500" />
              Weekly Budget Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resetHistory.length === 0 ? (
              <div className="text-center py-12">
                <RotateCcw className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No weekly tracking data found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {resetHistory.map((week, index) => {
                  const departments = week.departments || [];
                  const isCurrentWeek = week.status === 'active';
                  const totalAllocated = week.total_allocated || departments.reduce((sum, d) => sum + (d.allocated_amount || 0), 0);
                  
                  return (
                    <div key={index} className={`border rounded-lg p-4 ${
                      isCurrentWeek ? 'bg-green-50 border-green-200' : 'bg-white'
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${
                          isCurrentWeek ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          <Calendar className={`h-5 w-5 ${
                            isCurrentWeek ? 'text-green-600' : 'text-gray-500'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-lg">
                              Week {getWeekNumber(week.week_start)}
                            </h4>
                            {isCurrentWeek ? (
                              <Badge className="bg-green-100 text-green-700">Current Week</Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-700">Past</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-600">
                            {getWeekRange(week.week_start)}
                          </p>
                          <div className="flex flex-wrap gap-3 mt-1 text-sm">
                            <span className="text-slate-500">
                              <strong>{departments.length}</strong> departments
                            </span>
                            <span className="text-slate-500">
                              Total Weekly: <strong className="text-purple-600">{formatCurrency(totalAllocated)}</strong>
                            </span>
                            <span className="text-slate-400">
                              Based on weekly allocations
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================================
      CREATE MODAL - Annual Budget
      ============================================================ */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Set Annual Budget
            </DialogTitle>
            <DialogDescription>
              Set annual fuel budget for a department
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
                <Label>Annual Budget (₱) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.annual_budget}
                  onChange={(e) => setFormData({ ...formData, annual_budget: e.target.value })}
                  placeholder="e.g., 500000.00"
                />
                {formErrors.annual_budget && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.annual_budget}</p>
                )}
              </div>

              <div>
                <Label>Fiscal Year</Label>
                <select
                  value={formData.fiscal_year}
                  onChange={(e) => setFormData({ ...formData, fiscal_year: parseInt(e.target.value) })}
                  className="w-full mt-1.5 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>

              <div>
                <Label>Reason (Optional)</Label>
                <Input
                  type="text"
                  value={formData.reason || ''}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., Initial annual budget allocation"
                />
              </div>

              {formData.annual_budget && parseFloat(formData.annual_budget) > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-700">
                    Weekly allocation: <strong>{formatCurrency(parseFloat(formData.annual_budget) / 52)}</strong>
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    (Annual budget divided by 52 weeks)
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Set Annual Budget
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================
      EDIT MODAL - Add to Annual Budget
      ============================================================ */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <ArrowUpCircle className="h-5 w-5" />
              Add to Annual Budget
            </DialogTitle>
            <DialogDescription>
              Add additional funds to <strong>{editingPolicy?.department_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddToBudget}>
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
                <Label>Current Annual Budget</Label>
                <Input
                  value={formatCurrency(editingPolicy?.annual_amount || 0)}
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
                  placeholder="e.g., 50000.00"
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
                  placeholder="e.g., Additional budget for projects"
                />
              </div>

              {formData.add_amount && parseFloat(formData.add_amount) > 0 && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700">
                    New annual total: <strong>
                      {formatCurrency((parseFloat(editingPolicy?.annual_amount || 0) + parseFloat(formData.add_amount)))}
                    </strong>
                  </p>
                  <p className="text-xs text-green-500 mt-1">
                    New weekly allocation: <strong>
                      {formatCurrency((parseFloat(editingPolicy?.annual_amount || 0) + parseFloat(formData.add_amount)) / 52)}
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

      {/* ============================================================
      ✅ NEW: WEEKLY ALLOCATION MODAL
      ============================================================ */}
      <Dialog open={showWeeklyModal} onOpenChange={setShowWeeklyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <CalendarRange className="h-5 w-5" />
              Set Weekly Allocation
            </DialogTitle>
            <DialogDescription>
              Set the weekly budget allocation for <strong>{weeklyPolicy?.department_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateWeekly}>
            <div className="space-y-4 py-4">
              <div>
                <Label>Department</Label>
                <Input
                  value={weeklyPolicy?.department_name || ''}
                  disabled
                  className="mt-1.5 bg-slate-100"
                />
              </div>

              <div>
                <Label>Current Annual Budget</Label>
                <Input
                  value={formatCurrency(weeklyPolicy?.annual_amount || 0)}
                  disabled
                  className="mt-1.5 bg-slate-100 text-blue-600 font-semibold"
                />
              </div>

              <div>
                <Label>Current Weekly Allocation</Label>
                <Input
                  value={formatCurrency(weeklyPolicy?.weekly_allocation || 0)}
                  disabled
                  className="mt-1.5 bg-slate-100 text-purple-600 font-semibold"
                />
              </div>

              <div>
                <Label>New Weekly Allocation (₱) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.weekly_allocation}
                  onChange={(e) => setFormData({ ...formData, weekly_allocation: e.target.value })}
                  placeholder="e.g., 25000.00"
                  className="border-orange-300 focus:border-orange-500"
                />
                {formErrors.weekly_allocation && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.weekly_allocation}</p>
                )}
              </div>

              <div>
                <Label>Reason (Optional)</Label>
                <Input
                  type="text"
                  value={formData.reason || ''}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., New weekly allocation"
                />
              </div>

              {formData.weekly_allocation && parseFloat(formData.weekly_allocation) > 0 && (
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <p className="text-sm text-orange-700">
                    New annual total: <strong>
                      {formatCurrency(parseFloat(formData.weekly_allocation) * 52)}
                    </strong>
                  </p>
                  <p className="text-xs text-orange-500 mt-1">
                    (Weekly allocation × 52 weeks)
                  </p>
                  {weeklyPolicy?.annual_amount && (
                    <p className="text-xs text-red-500 mt-1">
                      Change: {parseFloat(formData.weekly_allocation) * 52 - parseFloat(weeklyPolicy.annual_amount) > 0 ? '+' : ''}
                      {formatCurrency((parseFloat(formData.weekly_allocation) * 52) - parseFloat(weeklyPolicy.annual_amount))}
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowWeeklyModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Update Weekly Allocation
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
              Are you sure you want to delete the annual budget for{' '}
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
              Delete
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
          </DialogHeader>
          <div className="py-4">
            {budgetHistory.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No history found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {budgetHistory.map((entry, index) => (
                  <div key={entry.id || index} className="border rounded-lg p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-green-100 text-green-700 text-xs">
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
    </div>
  );
};

export default BudgetPolicies;
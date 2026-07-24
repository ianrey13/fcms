// src/pages/mayor/budget/BudgetAllocation.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  AlertTriangle,
  Loader2,
  History,
  ArrowUpCircle,
  CalendarRange,
  Edit,
  CalendarDays,
  TrendingDown,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { mayorsOfficeAPI } from '../../../services/api';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

const BudgetAllocation = () => {
  const [budgetData, setBudgetData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
      // ✅ ANNUAL BUDGET (from response)
      annual_amount: parseFloat(item.annual_amount || 0),
      used_amount: parseFloat(item.used_amount || 0),
      remaining_amount: parseFloat(item.remaining_amount || 0),
      // ✅ WEEKLY ALLOCATION
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
    toast.error('Failed to load budget data');
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchBudgetData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBudgetData();
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

      await mayorsOfficeAPI.createAnnualBudget(payload);

      toast.success(`✅ Annual budget created! (FY ${formData.fiscal_year})`);
      setShowCreateModal(false);
      resetForm();
      await fetchBudgetData();
      setForceUpdate(prev => prev + 1);
    } catch (error) {
      console.error('Create error:', error);
      const errorData = error.response?.data;
      let errorMessage = 'Failed to create budget';
      if (errorData?.message) errorMessage = errorData.message;
      else if (errorData?.errors) {
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

      const payload = {
        add_amount: addAmount,
        reason: formData.reason || 'Budget addition',
      };

      await mayorsOfficeAPI.updateBudgetPolicy(editingPolicy.department_id, payload);

      toast.success(`✅ ₱${addAmount.toFixed(2)} added!\nNew Annual: ₱${newTotal.toFixed(2)}`);
      setShowEditModal(false);
      resetForm();
      await fetchBudgetData();
      setForceUpdate(prev => prev + 1);
    } catch (error) {
      console.error('Update error:', error);
      const errorData = error.response?.data;
      let errorMessage = 'Failed to add to budget';
      if (errorData?.message) errorMessage = errorData.message;
      else if (errorData?.errors) {
        const errors = Object.values(errorData.errors).flat();
        errorMessage = errors.join(', ');
      }
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

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
    const currentAnnual = parseFloat(weeklyPolicy?.annual_amount || 0);
    
    // ✅ Check if annual budget has enough
    if (currentAnnual < weeklyAmount) {
      toast.error(`Insufficient annual budget! Available: ₱${currentAnnual.toFixed(2)}`);
      setIsSubmitting(false);
      return;
    }

    const payload = {
      weekly_allocation: weeklyAmount,
      reason: formData.reason || 'Weekly allocation update',
    };

    const response = await mayorsOfficeAPI.updateWeeklyAllocation(
      weeklyPolicy.department_id,
      payload
    );

    // ✅ Show success message with week info
    const data = response.data?.data || {};
    const weekInfo = data.week_number ? `Week ${data.week_number}` : '';
    const weekRange = data.week_start && data.week_end ? 
      `(${format(new Date(data.week_start), 'MMM dd')} - ${format(new Date(data.week_end), 'MMM dd')})` : '';

    toast.success(
      `✅ Weekly allocation set to ₱${weeklyAmount.toFixed(2)}!\n` +
      `${weekInfo} ${weekRange}\n` +
      `Annual deducted: ₱${(data.deducted || weeklyAmount).toFixed(2)}`
    );
    
    setShowWeeklyModal(false);
    resetForm();
    await fetchBudgetData();
    setForceUpdate(prev => prev + 1);
  } catch (error) {
    console.error('Update weekly error:', error);
    const errorData = error.response?.data;
    let errorMessage = 'Failed to update weekly allocation';
    if (errorData?.message) errorMessage = errorData.message;
    else if (errorData?.errors) {
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
      await fetchBudgetData();
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
            Budget Allocation
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage department annual and weekly fuel budgets for FY {new Date().getFullYear()}
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
                <p className="text-sm text-slate-500">Total Weekly</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(summaryStats.totalWeekly)}</p>
                <p className="text-xs text-slate-400">All departments</p>
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

      {/* Search */}
      <Card>
        <div className="p-4">
          <div className="relative">
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

      {/* Table */}
      <Card key={`budget-table-${forceUpdate}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Department Budgets
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({filteredData.length} departments) • FY {new Date().getFullYear()}
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Annual Budget</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Weekly</th>
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
                          <p className="font-semibold text-blue-600">{formatCurrency(policy.annual_amount)}</p>
                          <p className="text-xs text-slate-400">FY {policy.fiscal_year}</p>
                        </td>
                        <td className="px-4 py-3 text-purple-600 font-medium">
                          {formatCurrency(policy.weekly_allocation)}
                          <p className="text-xs text-slate-400">per week</p>
                        </td>
                        <td className="px-4 py-3 text-red-600">{formatCurrency(policy.used_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${isCritical ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-green-600'}`}>
                            {formatCurrency(policy.remaining_amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-slate-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${isCritical ? 'bg-red-500' : isLow ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(utilization, 100)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${isCritical ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-green-600'}`}>
                              {utilization.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
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

      {/* ============================================================
      MODALS (same as before - kept for functionality)
      ============================================================ */}

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Set Annual Budget
            </DialogTitle>
            <DialogDescription>Set annual fuel budget for a department</DialogDescription>
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
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Set Annual Budget
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal - Add to Annual Budget */}
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
                <Input value={editingPolicy?.department_name || ''} disabled className="mt-1.5 bg-slate-100" />
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
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add to Budget
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Weekly Allocation Modal - Compact Version */}
<Dialog open={showWeeklyModal} onOpenChange={setShowWeeklyModal}>
  <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
    <DialogHeader className="pb-2">
      <DialogTitle className="flex items-center gap-2 text-orange-600 text-base">
        <CalendarRange className="h-4 w-4" />
        Set Weekly Allocation
      </DialogTitle>
      <DialogDescription className="text-xs">
        Set weekly budget for <strong>{weeklyPolicy?.department_name}</strong>
      </DialogDescription>
    </DialogHeader>

    <form onSubmit={handleUpdateWeekly}>
      <div className="space-y-3 py-2">
        {/* Current Budget Info - Compact */}
        <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg">
          <div>
            <p className="text-[10px] text-slate-500">Annual Budget</p>
            <p className="text-sm font-bold text-blue-600">{formatCurrency(weeklyPolicy?.annual_amount || 0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500">Current Weekly</p>
            <p className="text-sm font-bold text-purple-600">{formatCurrency(weeklyPolicy?.weekly_allocation || 0)}</p>
          </div>
        </div>

        {/* Week Info - Compact */}
        <div className={`p-2 rounded-lg text-xs ${new Date().getDay() >= 5 ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' : 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'}`}>
          <div className="flex items-center gap-1.5">
            <CalendarRange className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-700 dark:text-amber-300">
              {new Date().getDay() >= 5 ? (
                <>⏳ Next Week (starts Mon)</>
              ) : (
                <>📅 Current Week</>
              )}
            </span>
          </div>
        </div>

        {/* New Weekly Allocation Input */}
        <div>
          <Label className="text-xs">New Weekly Allocation (₱) *</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={formData.weekly_allocation}
            onChange={(e) => setFormData({ ...formData, weekly_allocation: e.target.value })}
            placeholder="Enter amount"
            className="mt-1 h-9 text-sm border-orange-300 focus:border-orange-500"
          />
          {formErrors.weekly_allocation && (
            <p className="text-red-500 text-xs mt-0.5">{formErrors.weekly_allocation}</p>
          )}
        </div>

        {/* Reason Input - Optional */}
        <div>
          <Label className="text-xs">Reason (Optional)</Label>
          <Input
            type="text"
            value={formData.reason || ''}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="e.g., Weekly allocation"
            className="mt-1 h-9 text-sm"
          />
        </div>

        {/* Preview - Compact */}
        {formData.weekly_allocation && parseFloat(formData.weekly_allocation) > 0 && (
          <div className="bg-orange-50 dark:bg-orange-950/30 p-2 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-orange-700 dark:text-orange-300">New Annual:</span>
              <span className="font-bold text-orange-700 dark:text-orange-300">
                {formatCurrency((parseFloat(weeklyPolicy?.annual_amount || 0) - parseFloat(formData.weekly_allocation)))}
              </span>
            </div>
            <p className="text-[10px] text-orange-500 mt-0.5">
              ⚠️ Deduct ₱{parseFloat(formData.weekly_allocation).toFixed(2)} from annual
            </p>
          </div>
        )}
      </div>

      <DialogFooter className="gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => setShowWeeklyModal(false)} className="h-8 text-sm">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700 h-8 text-sm">
          {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Set Weekly
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Budget Policy
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the budget for{' '}
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
            <Button type="button" variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button type="button" onClick={handleDelete} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BudgetAllocation;
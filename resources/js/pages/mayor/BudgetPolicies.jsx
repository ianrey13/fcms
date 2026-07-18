// src/pages/mayor/BudgetPolicies.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DollarSign,
  Plus,
  Edit,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Search,
  RefreshCw,
  TrendingUp,
  Building2,
  RotateCcw,
  AlertTriangle,
  Loader2,
  Filter,
  Eye,
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

const BudgetPolicies = () => {
  const [budgetData, setBudgetData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(null);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [deletingPolicy, setDeletingPolicy] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    department_id: '',
    default_weekly_allocation: '',
  });
  const [formErrors, setFormErrors] = useState({});
  
  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchBudgetData();
  }, []);

  const fetchBudgetData = async () => {
    setLoading(true);
    try {
      const response = await mayorsOfficeAPI.getAllDepartmentsWithBudget();
      let data = response.data?.data || response.data || [];
      if (data.data) {
        data = data.data;
      }
      setBudgetData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch budget data:', error);
      toast.error('Failed to load budget data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBudgetData();
    setRefreshing(false);
  };

  // ✅ CREATE
  const handleCreate = async (e) => {
    e.preventDefault();
    
    const errors = {};
    if (!formData.department_id) errors.department_id = 'Please select a department';
    if (!formData.default_weekly_allocation) errors.default_weekly_allocation = 'Weekly allocation is required';
    if (parseFloat(formData.default_weekly_allocation) < 0) {
      errors.default_weekly_allocation = 'Allocation must be a positive number';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await mayorsOfficeAPI.createBudgetPolicy({
        department_id: parseInt(formData.department_id),
        default_weekly_allocation: parseFloat(formData.default_weekly_allocation),
      });
      
      console.log('✅ Create response:', response);
      toast.success('Budget policy created successfully!');
      setShowCreateModal(false);
      resetForm();
      fetchBudgetData();
    } catch (error) {
      console.error('❌ Create error:', error);
      console.error('Error response:', error.response);
      const message = error.response?.data?.message || 'Failed to create budget policy';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ UPDATE
  const handleUpdate = async (e) => {
    e.preventDefault();
    
    const errors = {};
    if (!formData.default_weekly_allocation) errors.default_weekly_allocation = 'Weekly allocation is required';
    if (parseFloat(formData.default_weekly_allocation) < 0) {
      errors.default_weekly_allocation = 'Allocation must be a positive number';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await mayorsOfficeAPI.updateBudgetPolicy(
        editingPolicy.department_id,
        {
          default_weekly_allocation: parseFloat(formData.default_weekly_allocation),
        }
      );
      
      console.log('✅ Update response:', response);
      toast.success('Budget policy updated successfully!');
      setShowEditModal(false);
      resetForm();
      fetchBudgetData();
    } catch (error) {
      console.error('❌ Update error:', error);
      console.error('Error response:', error.response);
      const message = error.response?.data?.message || 'Failed to update budget policy';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ DELETE
  const handleDelete = async () => {
    if (!deletingPolicy) return;
    
    setIsSubmitting(true);
    try {
      const response = await mayorsOfficeAPI.deleteBudgetPolicy(deletingPolicy.department_id);
      console.log('✅ Delete response:', response);
      toast.success('Budget policy deleted successfully!');
      setShowDeleteModal(false);
      setDeletingPolicy(null);
      fetchBudgetData();
    } catch (error) {
      console.error('❌ Delete error:', error);
      console.error('Error response:', error.response);
      const message = error.response?.data?.message || 'Failed to delete budget policy';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ ACTIVATE
  const handleActivate = async () => {
    if (!showActivateModal) return;
    
    setIsSubmitting(true);
    try {
      const response = await mayorsOfficeAPI.forceActivateBudget({
        department_id: showActivateModal.department_id,
        amount: showActivateModal.allocated_amount || 0,
      });
      
      console.log('✅ Activate response:', response);
      toast.success(`Budget activated for ${showActivateModal.department_name}!`);
      setShowActivateModal(null);
      fetchBudgetData();
    } catch (error) {
      console.error('❌ Activate error:', error);
      console.error('Error response:', error.response);
      const message = error.response?.data?.message || 'Failed to activate budget';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ department_id: '', default_weekly_allocation: '' });
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
    });
    setShowEditModal(true);
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount || 0);
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
    const totalAllocation = budgetData.reduce((sum, p) => sum + parseFloat(p.allocated_amount || 0), 0);
    const totalSpent = budgetData.reduce((sum, p) => sum + parseFloat(p.spent_amount || 0), 0);
    const totalRemaining = budgetData.reduce((sum, p) => sum + parseFloat(p.remaining_amount || 0), 0);
    return { totalAllocation, totalSpent, totalRemaining };
  }, [budgetData]);

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
            Manage department weekly fuel budget allocations
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
                      ? (policy.spent_amount / policy.allocated_amount) * 100
                      : 0;
                    const isLow = utilization > 80;
                    const isCritical = utilization > 95;
                    const hasActivePeriod = policy.has_budget !== false;

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
                              className="text-blue-600 hover:bg-blue-50 h-8 w-8 p-0"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
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
                  value={formData.default_weekly_allocation}
                  onChange={(e) => setFormData({ ...formData, default_weekly_allocation: e.target.value })}
                  placeholder="e.g., 5000.00"
                />
                {formErrors.default_weekly_allocation && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.default_weekly_allocation}</p>
                )}
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

      {/* EDIT MODAL */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-amber-600" />
              Edit Budget Policy
            </DialogTitle>
            <DialogDescription>
              Update weekly budget allocation for {editingPolicy?.department_name}
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
                <Label>Weekly Allocation (₱) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.default_weekly_allocation}
                  onChange={(e) => setFormData({ ...formData, default_weekly_allocation: e.target.value })}
                />
                {formErrors.default_weekly_allocation && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.default_weekly_allocation}</p>
                )}
              </div>

              <div className="bg-amber-50 p-3 rounded-lg">
                <p className="text-sm text-amber-700">
                  Estimated monthly: <strong>{formatCurrency(parseFloat(formData.default_weekly_allocation || 0) * 4)}</strong>
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Update Policy
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
// src/pages/mayor/MayorBudget.jsx
import React, { useState, useEffect } from 'react';
import { mayorsOfficeAPI, budgetPolicyAPI } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  Plus,
  Edit,
  Trash2,
  X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const MayorBudget = () => {
  const [loading, setLoading] = useState(true);
  const [budgetData, setBudgetData] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [allocationAmount, setAllocationAmount] = useState('');
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [summary, setSummary] = useState({
    total_allocated: 0,
    total_spent: 0,
    total_remaining: 0,
    departments_with_budget: 0,
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchBudgetData(),
        fetchDepartments(),
      ]);
    } catch (error) {
      console.error('Error fetching budget data:', error);
      toast.error('Failed to load budget data');
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgetData = async () => {
    try {
      const response = await mayorsOfficeAPI.getAllDepartmentsWithBudget();
      const data = response.data?.data || [];
      setBudgetData(data);
      
      // Calculate summary
      const totalAllocated = data.reduce((sum, d) => sum + (d.allocated_amount || 0), 0);
      const totalSpent = data.reduce((sum, d) => sum + (d.spent_amount || 0), 0);
      const totalRemaining = data.reduce((sum, d) => sum + (d.remaining_amount || 0), 0);
      const deptsWithBudget = data.filter(d => d.has_budget).length;
      
      setSummary({
        total_allocated: totalAllocated,
        total_spent: totalSpent,
        total_remaining: totalRemaining,
        departments_with_budget: deptsWithBudget,
      });
    } catch (error) {
      console.error('Failed to fetch budget data:', error);
      setBudgetData([]);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await mayorsOfficeAPI.getAllDepartmentsForSelector();
      const data = response.data?.data || [];
      setDepartments(data);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const handleAllocateBudget = async () => {
    if (!selectedDepartment || !allocationAmount || parseFloat(allocationAmount) <= 0) {
      toast.error('Please select a department and enter a valid amount');
      return;
    }

    try {
      await budgetPolicyAPI.forceActivate({
        department_id: selectedDepartment,
        amount: parseFloat(allocationAmount),
      });
      
      toast.success(`Budget allocated successfully!`);
      setShowAllocateModal(false);
      setSelectedDepartment(null);
      setAllocationAmount('');
      fetchAllData();
    } catch (error) {
      console.error('Failed to allocate budget:', error);
      toast.error(error.response?.data?.message || 'Failed to allocate budget');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const getStatusColor = (remaining, allocated) => {
    if (allocated === 0) return 'text-gray-400';
    const percentage = (remaining / allocated) * 100;
    if (percentage < 10) return 'text-red-600';
    if (percentage < 25) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusBadge = (remaining, allocated) => {
    if (allocated === 0) return { color: 'bg-gray-300', label: 'No Budget' };
    const percentage = (remaining / allocated) * 100;
    if (percentage < 10) return { color: 'bg-red-500', label: 'Critical' };
    if (percentage < 25) return { color: 'bg-yellow-500', label: 'Low' };
    return { color: 'bg-green-500', label: 'Healthy' };
  };

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Budget Monitoring
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Monitor department budget allocations and utilization
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchAllData} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button 
            onClick={() => setShowAllocateModal(true)} 
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Plus className="h-4 w-4" />
            Allocate Budget
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Allocated</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.total_allocated)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Spent</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.total_spent)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Remaining</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.total_remaining)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Departments with Budget</p>
                <p className="text-2xl font-bold text-purple-600">{summary.departments_with_budget}</p>
              </div>
              <Building2 className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Table */}
      <Card>
        <CardHeader>
          <CardTitle>Department Budget Allocations</CardTitle>
        </CardHeader>
        <CardContent>
          {budgetData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p>No budget allocations found</p>
              <p className="text-sm mt-1">Allocate budget to departments to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Allocated</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Spent</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Remaining</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Utilization</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {budgetData.map((dept) => {
                    const utilization = dept.allocated_amount > 0 
                      ? (dept.spent_amount / dept.allocated_amount) * 100 
                      : 0;
                    const status = getStatusBadge(dept.remaining_amount, dept.allocated_amount);
                    
                    return (
                      <tr key={dept.department_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{dept.department_name}</p>
                            <p className="text-xs text-gray-500">{dept.department_code}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(dept.allocated_amount)}</td>
                        <td className="px-4 py-3 text-red-600">{formatCurrency(dept.spent_amount)}</td>
                        <td className={`px-4 py-3 font-medium ${getStatusColor(dept.remaining_amount, dept.allocated_amount)}`}>
                          {formatCurrency(dept.remaining_amount)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${utilization > 90 ? 'bg-red-500' : utilization > 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(utilization, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs">{utilization.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {dept.has_budget ? (
                            <Badge className={`${status.color} text-white`}>{status.label}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500">No Budget</Badge>
                          )}
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

      {/* Allocate Budget Modal */}
      <Dialog open={showAllocateModal} onOpenChange={setShowAllocateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Allocate Department Budget
            </DialogTitle>
            <DialogDescription>
              Set a weekly budget allocation for a department
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Department *</Label>
              <select
                className="w-full mt-1.5 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                value={selectedDepartment || ''}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.department_id} value={dept.department_id}>
                    {dept.department_name} ({dept.department_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Weekly Allocation (₱) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Enter amount"
                value={allocationAmount}
                onChange={(e) => setAllocationAmount(e.target.value)}
                className="mt-1.5"
              />
              <p className="text-xs text-gray-500 mt-1">
                This amount will be allocated for the current week
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAllocateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAllocateBudget} className="bg-blue-600 hover:bg-blue-700">
              Allocate Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MayorBudget;
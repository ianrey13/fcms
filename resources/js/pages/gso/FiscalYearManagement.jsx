// src/pages/gso/FiscalYearManagement.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  RefreshCw,
  Loader2,
  Calendar,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';

const FiscalYearManagement = () => {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newYear, setNewYear] = useState('');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Fetch fiscal years
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['fiscal-years'],
    queryFn: async () => {
      const response = await api.get('/admin/fiscal-years');
      return response.data.data || [];
    },
  });

  // Add fiscal year mutation
  const addMutation = useMutation({
    mutationFn: async (year) => {
      const response = await api.post('/admin/fiscal-years', { year });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Calendar year added successfully');
      setShowAddDialog(false);
      setNewYear('');
      queryClient.invalidateQueries(['fiscal-years']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to add fiscal year');
    },
  });

  // Toggle status mutation
  const toggleMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.patch(`/admin/fiscal-years/${id}/toggle`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries(['fiscal-years']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update status');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/admin/fiscal-years/${id}`);
    },
    onSuccess: () => {
      toast.success('Calendar year deleted');
      queryClient.invalidateQueries(['fiscal-years']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete fiscal year');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const year = parseInt(newYear);
    if (!newYear || year < 2000 || year > 2100) {
      toast.error('Please enter a valid year (2000-2100)');
      return;
    }
    addMutation.mutate(year);
  };

  const handleDelete = (year) => {
    if (window.confirm(`Delete fiscal year ${year.year}?`)) {
      deleteMutation.mutate(year.fiscal_year_id);
    }
  };

  // Count departments without budget for each year
  const getDepartmentCount = (year) => {
    // This would come from API, but for now just show placeholder
    return '—';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Calendar Year Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage fiscal years for annual budget allocation
          </p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Calendar Year
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium">How it works:</p>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>GSO adds fiscal years (e.g., 2026, 2027)</li>
                <li>Mayor's Office will set the annual budget and weekly ceiling for each department</li>
                <li>Only active fiscal years are available for budget setting</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fiscal Years Table */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700 overflow-hidden">
        <CardHeader className="border-b dark:border-slate-700">
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Calendar className="h-5 w-5 text-blue-500" />
            Calendar Years
            <Badge variant="secondary" className="ml-2">
              {data?.length || 0} years
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : data?.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No fiscal years added yet</p>
              <Button
                variant="link"
                onClick={() => setShowAddDialog(true)}
                className="mt-2"
              >
                Add your first fiscal year
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                    <TableHead className="font-semibold">Year</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Departments</TableHead>
                    <TableHead className="font-semibold">Created By</TableHead>
                    <TableHead className="font-semibold">Created At</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.map((year) => (
                    <TableRow
                      key={year.fiscal_year_id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <TableCell className="font-semibold text-lg text-slate-900 dark:text-white">
                        {year.year}
                      </TableCell>
                      <TableCell>
                        <Badge className={year.is_active ? 'bg-green-500' : 'bg-slate-400'}>
                          {year.is_active ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              Inactive
                            </span>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          <span className="text-slate-600 dark:text-slate-400">
                            {getDepartmentCount(year)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {year.creator?.full_name || 'System'}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {year.created_at ? new Date(year.created_at).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMutation.mutate(year.fiscal_year_id)}
                            className={`h-8 px-3 ${
                              year.is_active 
                                ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:text-yellow-400' 
                                : 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400'
                            }`}
                            disabled={toggleMutation.isPending}
                          >
                            {year.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(year)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30 h-8 w-8 p-0"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="dark:bg-slate-800 dark:border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Plus className="h-5 w-5 text-blue-600" />
              Add Calendar Year
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              Add a new calendar year for budget allocation. Once added, the Mayor's Office can set budgets for this year.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Calendar Year <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="2000"
                  max="2100"
                  placeholder="e.g., 2026"
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  className="mt-1.5 dark:bg-slate-900 dark:border-slate-700 text-lg font-semibold"
                  required
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enter a year between 2000 and 2100
                </p>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  setNewYear('');
                }}
                className="dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Year
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FiscalYearManagement;
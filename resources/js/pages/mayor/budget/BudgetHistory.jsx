// src/pages/mayor/budget/BudgetHistory.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2, History, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { mayorsOfficeAPI } from '../../../services/api';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

const BudgetHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('');
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    fetchHistory();
    fetchDepartments();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await mayorsOfficeAPI.getBudgetHistory();
      let data = response.data?.data || response.data || [];
      if (!Array.isArray(data)) data = [];
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch budget history:', error);
      toast.error('Failed to load budget history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await mayorsOfficeAPI.getAllDepartmentsForSelector();
      const data = response.data?.data || response.data || [];
      setDepartments(data);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHistory();
    toast.success('History refreshed');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy hh:mm a');
    } catch {
      return dateString;
    }
  };

  const getActionBadge = (action) => {
  const styles = {
    // ✅ Budget allocation actions
    'weekly_allocated': 'bg-purple-100 text-purple-700',
    'weekly_updated': 'bg-blue-100 text-blue-700',
    'annual_created': 'bg-emerald-100 text-emerald-700',
    'annual_added': 'bg-green-100 text-green-700',
    'annual_updated': 'bg-amber-100 text-amber-700',
    'surplus_returned': 'bg-indigo-100 text-indigo-700',
    'activated': 'bg-purple-100 text-purple-700',
    'created': 'bg-green-100 text-green-700',
    'added': 'bg-blue-100 text-blue-700',
    'updated': 'bg-yellow-100 text-yellow-700',
    'deleted': 'bg-red-100 text-red-700',
    'default': 'bg-gray-100 text-gray-700',
  };
  return styles[action] || styles.default;
};
  const filteredHistory = filter
    ? history.filter(item =>
        item.department_name?.toLowerCase().includes(filter.toLowerCase()) ||
        item.action?.toLowerCase().includes(filter.toLowerCase()) ||
        item.reason?.toLowerCase().includes(filter.toLowerCase())
      )
    : history;

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
            Budget History
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Track all budget changes across departments
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total Entries</p>
            <p className="text-2xl font-bold">{history.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Creates</p>
            <p className="text-2xl font-bold text-emerald-600">
              {history.filter(h => h.action === 'created' || h.action === 'annual_created').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Additions</p>
            <p className="text-2xl font-bold text-blue-600">
              {history.filter(h => h.action === 'added' || h.action === 'annual_added').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Updates</p>
            <p className="text-2xl font-bold text-amber-600">
              {history.filter(h => h.action === 'updated' || h.action === 'annual_updated').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <div className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by department, action, or reason..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-10"
              />
            </div>
            {filter && (
              <Button variant="outline" onClick={() => setFilter('')} className="text-red-600">
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* History List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-purple-500" />
            All Budget Changes
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({filteredHistory.length} entries)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No budget history found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((entry, index) => (
                <div key={entry.id || index} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={getActionBadge(entry.action)}>
                          {entry.action?.replace('_', ' ') || 'Updated'}
                        </Badge>
                        <h4 className="font-semibold">{entry.department_name || 'Unknown'}</h4>
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
    </div>
  );
};

export default BudgetHistory;
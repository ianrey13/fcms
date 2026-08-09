// src/pages/mayor/budget/BudgetHistory.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2, History, Filter, X, Calendar, TrendingUp, TrendingDown, DollarSign, Clock, RotateCcw } from 'lucide-react';
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
  const [actionFilter, setActionFilter] = useState('all');

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

  // ✅ UPDATED: Better action badges with icons and colors
  const getActionBadge = (action) => {
    const styles = {
      // Weekly actions
      'weekly_allocated': 'bg-purple-100 text-purple-700 border-purple-200',
      'weekly_updated': 'bg-blue-100 text-blue-700 border-blue-200',
      'weekly_reset': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      'weekly_used': 'bg-orange-100 text-orange-700 border-orange-200',
      // Annual actions
      'annual_created': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'annual_added': 'bg-green-100 text-green-700 border-green-200',
      'annual_updated': 'bg-amber-100 text-amber-700 border-amber-200',
      // Other
      'surplus_returned': 'bg-teal-100 text-teal-700 border-teal-200',
      'activated': 'bg-purple-100 text-purple-700 border-purple-200',
      'created': 'bg-green-100 text-green-700 border-green-200',
      'added': 'bg-blue-100 text-blue-700 border-blue-200',
      'updated': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'deleted': 'bg-red-100 text-red-700 border-red-200',
      'default': 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return styles[action] || styles.default;
  };

  // ✅ UPDATED: Better icons for each action
  const getActionIcon = (action) => {
    const icons = {
      'weekly_allocated': <Clock className="h-3 w-3" />,
      'weekly_updated': <Clock className="h-3 w-3" />,
      'weekly_reset': <RotateCcw className="h-3 w-3" />,
      'weekly_used': <TrendingDown className="h-3 w-3" />,
      'annual_created': <DollarSign className="h-3 w-3" />,
      'annual_added': <TrendingUp className="h-3 w-3" />,
      'annual_updated': <DollarSign className="h-3 w-3" />,
      'surplus_returned': <TrendingUp className="h-3 w-3" />,
      'default': null,
    };
    return icons[action] || icons.default;
  };

  // ✅ UPDATED: Better labels with category indicator
  const getActionLabel = (action) => {
    const labels = {
      'weekly_allocated': '📊 Weekly Allocated',
      'weekly_updated': '📊 Weekly Updated',
      'weekly_reset': '🔄 Weekly Reset',
      'weekly_used': '📉 Weekly Used',
      'annual_created': '💰 Annual Created',
      'annual_added': '💰 Annual Added',
      'annual_updated': '💰 Annual Updated',
      'surplus_returned': '↩️ Surplus Returned',
      'activated': '✅ Activated',
      'created': '📝 Created',
      'added': '➕ Added',
      'updated': '✏️ Updated',
      'deleted': '🗑️ Deleted',
    };
    return labels[action] || action?.replace('_', ' ') || 'Updated';
  };

  // ✅ Check if action is weekly-related
  const isWeeklyAction = (action) => {
    return action === 'weekly_allocated' || 
           action === 'weekly_updated' || 
           action === 'weekly_reset' || 
           action === 'weekly_used';
  };

  // ✅ Check if action is annual-related
  const isAnnualAction = (action) => {
    return action === 'annual_created' || 
           action === 'annual_added' || 
           action === 'annual_updated';
  };

  // ✅ Get action category
  const getActionCategory = (action) => {
    if (isWeeklyAction(action)) return 'weekly';
    if (isAnnualAction(action)) return 'annual';
    return 'other';
  };

  // ✅ Filter by action
  const filteredHistory = history.filter(item => {
    const matchesSearch = filter === '' ||
      item.department_name?.toLowerCase().includes(filter.toLowerCase()) ||
      item.action?.toLowerCase().includes(filter.toLowerCase()) ||
      item.reason?.toLowerCase().includes(filter.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || item.action === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  // ✅ Get unique actions for filter
  const uniqueActions = [...new Set(history.map(item => item.action))].filter(Boolean);

  // ✅ Calculate stats
  const totalEntries = history.length;
  const weeklyAllocations = history.filter(h => isWeeklyAction(h.action)).length;
  const annualChanges = history.filter(h => isAnnualAction(h.action)).length;
  const otherActions = history.filter(h => !isWeeklyAction(h.action) && !isAnnualAction(h.action)).length;

  // ✅ Group by action type for stats
  const weeklyCount = history.filter(h => h.action === 'weekly_allocated' || h.action === 'weekly_updated').length;
  const weeklyResetCount = history.filter(h => h.action === 'weekly_reset').length;
  const annualCreateCount = history.filter(h => h.action === 'annual_created').length;
  const annualAddCount = history.filter(h => h.action === 'annual_added').length;

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
            <p className="text-2xl font-bold">{totalEntries}</p>
          </CardContent>
        </Card>
        <Card className="border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <Clock className="h-3 w-3 text-purple-500" />
              Weekly Changes
            </p>
            <p className="text-2xl font-bold text-purple-600">
              {weeklyAllocations}
            </p>
            <p className="text-xs text-slate-400">
              {weeklyResetCount} resets
            </p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-emerald-500" />
              Annual Changes
            </p>
            <p className="text-2xl font-bold text-emerald-600">
              {annualChanges}
            </p>
            <p className="text-xs text-slate-400">
              {annualCreateCount} created, {annualAddCount} added
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-700">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Other Actions</p>
            <p className="text-2xl font-bold text-slate-600">
              {otherActions}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-4">
            {/* Search Filter */}
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by department, action, or reason..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Action Filter */}
            <div className="min-w-[180px]">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white"
              >
                <option value="all">All Actions</option>
                <option value="weekly_allocated">📊 Weekly Allocated</option>
                <option value="weekly_updated">📊 Weekly Updated</option>
                <option value="weekly_reset">🔄 Weekly Reset</option>
                <option value="weekly_used">📉 Weekly Used</option>
                <option value="annual_created">💰 Annual Created</option>
                <option value="annual_added">💰 Annual Added</option>
                <option value="annual_updated">💰 Annual Updated</option>
                <option value="surplus_returned">↩️ Surplus Returned</option>
              </select>
            </div>

            {/* Clear Filters */}
            {(filter || actionFilter !== 'all') && (
              <Button variant="outline" onClick={() => {
                setFilter('');
                setActionFilter('all');
              }} className="text-red-600">
                <X className="h-4 w-4 mr-2" />
                Clear Filters
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
              {filteredHistory.map((entry, index) => {
                const isWeekly = isWeeklyAction(entry.action);
                const isAnnual = isAnnualAction(entry.action);
                const diffAmount = (entry.added_amount || entry.amount || 0) - (entry.previous_amount || 0);
                const isIncrease = diffAmount > 0;
                
                return (
                  <div 
                    key={entry.id || index} 
                    className={`border rounded-lg p-4 hover:bg-slate-50 transition-colors ${
                      isWeekly ? 'border-l-4 border-l-purple-400' : 
                      isAnnual ? 'border-l-4 border-l-emerald-400' : 
                      'border-l-4 border-l-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <Badge className={getActionBadge(entry.action)}>
                            <span className="flex items-center gap-1">
                              {getActionIcon(entry.action)}
                              {getActionLabel(entry.action)}
                            </span>
                          </Badge>
                          <h4 className="font-semibold">{entry.department_name || 'Unknown'}</h4>
                          {isWeekly && (
                            <Badge variant="outline" className="text-purple-600 border-purple-300 text-xs">
                              Weekly
                            </Badge>
                          )}
                          {isAnnual && (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">
                              Annual
                            </Badge>
                          )}
                        </div>
                        
                        {/* ✅ Weekly Actions - Clear display */}
                        {isWeekly && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                            <div>
                              <span className="text-slate-500">Weekly Allocation:</span>
                              <span className="font-medium ml-1 text-purple-600">
                                {formatCurrency(entry.new_amount || entry.amount || 0)}
                              </span>
                            </div>
                            {entry.previous_amount > 0 && (
                              <div>
                                <span className="text-slate-500">Previous:</span>
                                <span className="font-medium ml-1 text-slate-600">
                                  {formatCurrency(entry.previous_amount)}
                                </span>
                              </div>
                            )}
                            <div>
                              <span className="text-slate-500">By:</span>
                              <span className="font-medium ml-1">{entry.user_name || 'System'}</span>
                            </div>
                            {entry.reason && (
                              <div className="col-span-2 md:col-span-3">
                                <span className="text-slate-400">Reason:</span>
                                <span className="text-sm text-slate-600 ml-1">{entry.reason}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* ✅ Annual Actions - Clear display */}
                        {isAnnual && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            <div>
                              <span className="text-slate-500">Before:</span>
                              <span className="font-medium ml-1">{formatCurrency(entry.previous_amount || 0)}</span>
                            </div>
                            <div>
                              <span className={`${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                                {isIncrease ? '+ Added:' : 'Change:'}
                              </span>
                              <span className={`font-medium ml-1 ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(entry.added_amount || entry.amount || 0)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">After:</span>
                              <span className="font-medium text-blue-600 ml-1">
                                {formatCurrency(entry.new_amount || 0)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">By:</span>
                              <span className="font-medium ml-1">{entry.user_name || 'System'}</span>
                            </div>
                          </div>
                        )}
                        
                        {entry.reason && !isWeekly && !isAnnual && (
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetHistory;
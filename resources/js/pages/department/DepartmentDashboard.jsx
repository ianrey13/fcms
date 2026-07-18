// src/pages/department/DepartmentDashboard.jsx - TanStack Query Version
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  useTripRequests, 
  useDepartmentBudget, 
  useRefreshDashboard,
  getStatusConfig 
} from '../../hooks/useDepartmentDashboard';
import { toast } from 'react-hot-toast';
import {
  FileText,
  Plus,
  Eye,
  Truck,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Calendar,
  Loader2,
  Wallet,
  Zap,
  ArrowRight,
  Building2,
  Fuel,
  ChevronRight,
  RefreshCw,
  TrendingDown,
  PieChart
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const DepartmentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // ✅ TanStack Query hooks
  const { 
    data: tickets = [], 
    isLoading: ticketsLoading,
    isFetching: isRefreshingTickets,
    refetch: refetchTickets
  } = useTripRequests();
  
  const { 
    data: budget, 
    isLoading: budgetLoading,
    isFetching: isRefreshingBudget,
    refetch: refetchBudget
  } = useDepartmentBudget();
  
  const refreshDashboard = useRefreshDashboard();
  
  // Calculate stats from tickets data
  const stats = useMemo(() => {
    const pendingStatuses = ['pending_head_approval', 'pending_gso_review', 'pending_mayors_office', 'with_mayors_office'];
    const approvedStatuses = ['funds_issued'];
    const inTransitStatuses = ['in_transit'];
    const completedStatuses = ['closed'];
    const returnedStatuses = ["returned_for_revision", "rejected", "cancelled", "returned"];
    
    return {
      total: tickets.length,
      pending: tickets.filter(t => pendingStatuses.includes(t.status)).length,
      approved: tickets.filter(t => approvedStatuses.includes(t.status)).length,
      inTransit: tickets.filter(t => inTransitStatuses.includes(t.status)).length,
      completed: tickets.filter(t => completedStatuses.includes(t.status)).length,
      returned: tickets.filter(t => returnedStatuses.includes(t.status)).length
    };
  }, [tickets]);
  
  // Get recent tickets (last 5)
  const recentTickets = useMemo(() => {
    return tickets.slice(0, 5);
  }, [tickets]);
  
  const isLoading = ticketsLoading || budgetLoading;
  const isRefreshing = isRefreshingTickets || isRefreshingBudget;
  
  const handleRefresh = () => {
    refreshDashboard.mutate();
  };
  
  const getStatusBadge = (status) => {
    const config = getStatusConfig(status);
    return (
      <Badge className={`${config.color} text-white flex items-center gap-1 w-fit px-2 py-1 rounded-lg text-xs font-medium`}>
        <span>{config.icon}</span>
        {config.label}
      </Badge>
    );
  };
  
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₱0.00';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount);
  };
  
  const getBudgetStatusColor = () => {
    if (!budget) return 'text-emerald-600 dark:text-emerald-400';
    if (budget.isCritical) return 'text-red-600 dark:text-red-400';
    if (budget.isLow) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };
  
  const getBudgetProgressColor = () => {
    if (!budget) return 'bg-emerald-500';
    if (budget.utilization_percentage >= 90) return 'bg-red-500';
    if (budget.utilization_percentage >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8 animate-fade-in-up">
      <div className="max-w-7xl mx-auto">
        {/* Header - Premium Gradient */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 mb-8 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                  {user?.department_name || 'Department'}
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                  <Building2 className="h-3 w-3 mr-1" />
                  Staff Portal
                </Badge>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Welcome back, {user?.first_name}!
              </h1>
              <p className="text-slate-300 mt-1">Manage your trip requests and track budget utilization</p>
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={handleRefresh} 
                variant="outline" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                disabled={refreshDashboard.isPending || isRefreshing}
              >
                {refreshDashboard.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
              <Button 
                onClick={() => navigate('/department/create')}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Trip Ticket
              </Button>
            </div>
          </div>
        </div>
        
        {/* Stats Grid - Premium Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5 mb-8">
          <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-blue-500/10">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs text-slate-400">{stats.total}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total Requests</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-800/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs text-amber-600 dark:text-amber-400">{stats.pending}</span>
              </div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Pending Approval</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-800/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs text-emerald-600 dark:text-emerald-400">{stats.approved}</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.approved}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Approved / Funded</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-800/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-indigo-500/10">
                  <Truck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-xs text-indigo-600 dark:text-indigo-400">{stats.inTransit}</span>
              </div>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.inTransit}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">In Transit</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-800/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs text-emerald-600 dark:text-emerald-400">{stats.completed}</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Completed</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-slate-800/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-red-500/10">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <span className="text-xs text-red-600 dark:text-red-400">{stats.returned}</span>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.returned}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Returned</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Budget Card - Premium Design */}
        {budget && (
          <Card className="mb-8 overflow-hidden border-0 shadow-xl bg-gradient-to-r from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/90">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-amber-500/5 to-purple-500/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <CardContent className="p-6 relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${budget.isCritical ? 'bg-red-100 dark:bg-red-900/30' : budget.isLow ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'} transition-all duration-300`}>
                    <Wallet className={`h-6 w-6 ${getBudgetStatusColor()}`} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Weekly Budget Remaining</p>
                    <p className={`text-3xl font-bold ${getBudgetStatusColor()}`}>
                      {formatCurrency(budget.remaining_budget)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Allocated: {formatCurrency(budget.allocated_amount)}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Spent: {formatCurrency(budget.spent_amount)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 max-w-md">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500 dark:text-slate-400">Budget Utilization</span>
                    <span className={`font-semibold ${budget.utilization_percentage >= 90 ? 'text-red-600 dark:text-red-400' : budget.utilization_percentage >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {budget.utilization_percentage}%
                    </span>
                  </div>
                  <div className="relative">
                    <Progress 
                      value={budget.utilization_percentage} 
                      className={`h-3 rounded-full bg-slate-200 dark:bg-slate-700`}
                    />
                    <div 
                      className={`absolute top-0 left-0 h-3 rounded-full transition-all duration-500 ${getBudgetProgressColor()}`}
                      style={{ width: `${Math.min(budget.utilization_percentage, 100)}%` }}
                    />
                  </div>
                  {budget.isLow && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Low budget warning: Less than 20% remaining
                    </p>
                  )}
                  {budget.isCritical && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Critical: Budget almost exhausted. Consider requesting MO assistance.
                    </p>
                  )}
                </div>
                
                {budget.period_start && (
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 justify-end">
                      <Calendar className="h-4 w-4" />
                      <span>Period</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {new Date(budget.period_start).toLocaleDateString()} - {new Date(budget.period_end).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Recent Tickets Table */}
        <Card className="border-0 shadow-xl bg-white dark:bg-slate-800/90 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Recent Trip Tickets
            </CardTitle>
            {recentTickets.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/department/requests')}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {recentTickets.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">No trip tickets yet</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Create your first trip ticket to get started</p>
                <Button 
                  onClick={() => navigate('/department/create')}
                  className="mt-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Trip Ticket
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ticket #</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Destination</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {recentTickets.map((ticket, idx) => (
                      <tr key={ticket.trip_ticket_id || ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {new Date(ticket.trip_date).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-mono font-medium text-slate-800 dark:text-slate-200">
                            {ticket.ticket_number || ticket.trip_ticket_number}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-700 dark:text-slate-300 max-w-[200px] truncate block">
                            {ticket.destination}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(ticket.status)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(ticket.amount_released || ticket.estimated_cost || 0)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/department/requests/${ticket.trip_ticket_id || ticket.id}`)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Quick Tips */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/20">
                  <Fuel className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-blue-800 dark:text-blue-300">Fuel Management</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Use estimated fuel liters for better budget planning</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30 border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20">
                  <Clock className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">Submit Early</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Submit requests at least 3 days before travel</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20">
                  <Zap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-semibold text-purple-800 dark:text-purple-300">Budget Assistance</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400">Contact MO if budget is insufficient</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DepartmentDashboard;
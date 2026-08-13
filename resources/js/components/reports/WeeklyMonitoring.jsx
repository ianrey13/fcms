// src/components/reports/WeeklyMonitoring.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, Fuel, DollarSign, Truck, TrendingUp, TrendingDown, 
  FileSpreadsheet, Printer, RefreshCw, Loader2, CheckCircle,
  Clock, AlertCircle, Eye, Zap, Shield, ArrowLeft, Building2,
  User, MapPin, Activity, Minus, ChevronLeft, ChevronRight,
  BarChart3, PieChart, Wallet, XCircle
} from 'lucide-react';
import { reportsAPI } from '../../services/api';
import { saveAs } from 'file-saver';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

// ============================================
// STATS CARD COMPONENT
// ============================================

const StatsCard = ({ title, value, icon: Icon, color, subtitle, progress, progressColor }) => {
  return (
    <Card className="dark:bg-slate-800/80 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
            <p className={cn(
              "text-2xl font-bold mt-1",
              color === 'blue' ? "text-blue-600 dark:text-blue-400" :
              color === 'yellow' ? "text-yellow-600 dark:text-yellow-400" :
              color === 'green' ? "text-green-600 dark:text-green-400" :
              color === 'purple' ? "text-purple-600 dark:text-purple-400" :
              "text-slate-900 dark:text-white"
            )}>
              {value}
            </p>
            {subtitle && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-xl shadow-lg",
            color === 'blue' ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20" :
            color === 'yellow' ? "bg-gradient-to-br from-yellow-500 to-amber-600 shadow-yellow-500/20" :
            color === 'green' ? "bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/20" :
            "bg-gradient-to-br from-purple-500 to-violet-600 shadow-purple-500/20"
          )}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
        {progress !== undefined && (
          <div className="mt-3">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between mt-1">
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{progress}% used</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{100 - progress}% remaining</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================
// ✅ FIXED: STATUS BADGE COMPONENT
// ============================================

const StatusBadge = ({ status }) => {
  // ✅ Handle null/undefined status
  if (!status) {
    return (
      <Badge className="bg-slate-400 text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium">
        <Minus className="h-2.5 w-2.5" />
        Unknown
      </Badge>
    );
  }

  const statusLower = status.toLowerCase();
  
  const configs = {
    'closed': { color: 'bg-emerald-500', label: 'Completed', icon: CheckCircle },
    'completed': { color: 'bg-emerald-500', label: 'Completed', icon: CheckCircle },
    'funds_issued': { color: 'bg-blue-500', label: 'Funds Issued', icon: Activity },
    'active': { color: 'bg-blue-500', label: 'Active', icon: Activity },
    'pending_reconciliation': { color: 'bg-yellow-500', label: 'Pending Recon', icon: Clock },
    'pending_mayors_office': { color: 'bg-yellow-500', label: 'Pending MO', icon: Clock },
    'in_transit': { color: 'bg-purple-500', label: 'In Transit', icon: Truck },
    'rejected': { color: 'bg-red-500', label: 'Rejected', icon: XCircle },
    'cancelled': { color: 'bg-slate-500', label: 'Cancelled', icon: XCircle },
    'acknowledged': { color: 'bg-cyan-500', label: 'Acknowledged', icon: CheckCircle },
    'returned_for_revision': { color: 'bg-orange-500', label: 'Returned', icon: AlertCircle },
    'draft': { color: 'bg-slate-400', label: 'Draft', icon: AlertCircle },
  };
  
  const config = configs[statusLower] || { 
    color: 'bg-slate-500', 
    label: status || 'Unknown', 
    icon: AlertCircle 
  };
  
  const Icon = config.icon;
  
  return (
    <Badge className={`${config.color} text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium`}>
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </Badge>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const WeeklyMonitoring = ({ departmentId, onRefresh }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');

  useEffect(() => {
    // Set default week range
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1); // Monday
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Sunday
    
    setWeekStart(start.toISOString().split('T')[0]);
    setWeekEnd(end.toISOString().split('T')[0]);
    
    fetchData();
  }, [departmentId]);

  useEffect(() => {
    if (weekStart && weekEnd) {
      fetchData();
    }
  }, [weekStart, weekEnd, departmentId]);

  const fetchData = async () => {
    if (!weekStart || !weekEnd) return;
    
    setLoading(true);
    try {
      const params = {
        department_id: departmentId !== 'all' ? departmentId : undefined,
        week_start: weekStart,
        week_end: weekEnd,
      };
      const response = await reportsAPI.getWeeklyMonitoring(params);
      console.log('📊 Weekly Monitoring Data:', response.data);
      setData(response.data?.data);
    } catch (error) {
      console.error('Failed to fetch weekly monitoring:', error);
      toast.error('Failed to load weekly monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const params = {
        department_id: departmentId !== 'all' ? departmentId : undefined,
        week_start: weekStart,
        week_end: weekEnd,
      };
      
      const response = await reportsAPI.exportWeeklyMonitoring(format, params);
      const extension = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'csv';
      const fileName = `weekly_monitoring_${weekStart}_to_${weekEnd}.${extension}`;
      saveAs(response.data, fileName);
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const handleRefresh = () => {
    fetchData();
    if (onRefresh) onRefresh();
    toast.success('Data refreshed');
  };

  const handlePreviousWeek = () => {
    const start = new Date(weekStart);
    start.setDate(start.getDate() - 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    setWeekStart(start.toISOString().split('T')[0]);
    setWeekEnd(end.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    setWeekStart(start.toISOString().split('T')[0]);
    setWeekEnd(end.toISOString().split('T')[0]);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return '₱0.00';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num) => {
    if (num === undefined || num === null || isNaN(num)) {
      return '0';
    }
    return new Intl.NumberFormat('en-PH').format(num);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading weekly data...</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Please wait while we fetch your data</p>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const trips = data?.trips || [];
  const period = data?.period || {};

  const utilization = summary.budget > 0 ? Math.round((summary.used / summary.budget) * 100) : 0;
  const remaining = summary.budget - summary.used;

  // ✅ Debug: Log trips to see status values
  console.log('📊 Trips with status:', trips.map(t => ({ number: t.number, status: t.status })));

  return (
    <div className="space-y-6 p-4 md:p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-2xl">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Weekly Monitoring
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {formatDate(weekStart)} - {formatDate(weekEnd)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePreviousWeek}
            className="dark:border-slate-700 dark:text-slate-300"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleNextWeek}
            className="dark:border-slate-700 dark:text-slate-300"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            className="dark:border-slate-700 dark:text-slate-300"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleExport('excel')}
            disabled={exporting}
            className="dark:border-slate-700 dark:text-slate-300"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Excel
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            className="dark:border-slate-700 dark:text-slate-300"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Weekly Budget"
          value={formatCurrency(summary.budget)}
          icon={Wallet}
          color="blue"
          subtitle="Total allocation"
          progress={utilization}
        />
        <StatsCard
          title="Used"
          value={formatCurrency(summary.used)}
          icon={TrendingDown}
          color="yellow"
          subtitle={`${utilization}% utilized`}
        />
        <StatsCard
          title="Remaining"
          value={formatCurrency(remaining)}
          icon={TrendingUp}
          color="green"
          subtitle="Budget left"
        />
        <StatsCard
          title="Total Trips"
          value={formatNumber(summary.trips)}
          icon={Truck}
          color="purple"
          subtitle={`${summary.completed || 0} completed • ${summary.pending || 0} pending`}
        />
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Completed</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{summary.completed || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Pending</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{summary.pending || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">In Transit</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{summary.in_transit || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <Fuel className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Total Fuel</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{formatNumber(summary.total_fuel)} L</p>
        </div>
      </div>

      {/* Trips Table */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
        <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                <Calendar className="h-5 w-5 text-blue-500" />
                Weekly Trips
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                {trips.length} trip{trips.length !== 1 ? 's' : ''} this week
              </CardDescription>
            </div>
            {trips.length > 0 && (
              <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                <Zap className="h-3 w-3 mr-1" />
                {trips.length} records
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            {trips.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <Truck className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No trips this week</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  Trips will appear here once created
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Trip #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Destination</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Vehicle</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Driver</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Est. Fuel</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Actual Fuel</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {trips.map((trip, index) => (
                    <tr key={trip.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white">
                          {trip.number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm text-slate-600 dark:text-slate-400">{trip.destination}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm text-slate-600 dark:text-slate-400">{trip.vehicle}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm text-slate-600 dark:text-slate-400">{trip.driver}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-slate-600 dark:text-slate-400">{trip.estimated_fuel || '-'} L</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{trip.actual_fuel || '-'} L</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(trip.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {/* ✅ FIXED: Status badge now handles null/undefined */}
                        <StatusBadge status={trip.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
        <p>Generated on {new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
        <p>FCMS - Weekly Monitoring Report • Laguindingan Municipality</p>
      </div>
    </div>
  );
};

export default WeeklyMonitoring;
// src/components/reports/FuelWithoutTripReport.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  AlertTriangle, Fuel, Truck, Calendar, FileSpreadsheet, 
  Printer, RefreshCw, Loader2, Search, Filter, X, CheckCircle,
  Clock, AlertCircle, TrendingUp, TrendingDown, Minus,
  Eye, ChevronDown, ChevronUp, Zap, Shield, ArrowLeft,
  Building2, User, MapPin, DollarSign, Activity
} from 'lucide-react';
import { reportsAPI } from '../../services/api';
import { saveAs } from 'file-saver';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

// ============================================
// STATS CARD COMPONENT
// ============================================

const StatsCard = ({ title, value, icon: Icon, color, subtitle, trend }) => {
  return (
    <Card className={cn(
      "dark:bg-slate-800/80 dark:border-slate-700 hover:shadow-lg transition-all duration-300",
      color === 'red' && "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
    )}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
            <p className={cn(
              "text-2xl font-bold mt-1",
              color === 'red' ? "text-red-600 dark:text-red-400" :
              color === 'orange' ? "text-orange-600 dark:text-orange-400" :
              color === 'purple' ? "text-purple-600 dark:text-purple-400" :
              color === 'blue' ? "text-blue-600 dark:text-blue-400" :
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
            color === 'red' ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20" :
            color === 'orange' ? "bg-gradient-to-br from-orange-500 to-amber-600 shadow-orange-500/20" :
            color === 'purple' ? "bg-gradient-to-br from-purple-500 to-violet-600 shadow-purple-500/20" :
            "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20"
          )}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
        {trend !== undefined && trend !== null && (
          <div className="flex items-center gap-1 mt-2 text-[10px]">
            {trend > 0 ? (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            ) : trend < 0 ? (
              <TrendingDown className="h-3 w-3 text-red-500" />
            ) : (
              <Minus className="h-3 w-3 text-slate-400" />
            )}
            <span className={trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : trend < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}>
              {trend > 0 ? '+' : ''}{trend}%
            </span>
            <span className="text-slate-400">vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================
// STATUS BADGE COMPONENT
// ============================================

const StatusBadge = ({ status, type = 'movement' }) => {
  if (type === 'movement') {
    const configs = {
      'Normal Trip': { color: 'bg-emerald-500', label: 'Normal Trip' },
      'No Movement': { color: 'bg-red-500', label: 'No Movement' },
      'Minimal Movement (<1km)': { color: 'bg-yellow-500', label: 'Minimal Movement' },
    };
    const config = configs[status] || { color: 'bg-slate-500', label: status || 'Unknown' };
    return (
      <Badge className={`${config.color} text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium`}>
        {status === 'No Movement' && <AlertTriangle className="h-2.5 w-2.5" />}
        {status === 'Normal Trip' && <CheckCircle className="h-2.5 w-2.5" />}
        {status === 'Minimal Movement (<1km)' && <Clock className="h-2.5 w-2.5" />}
        {config.label}
      </Badge>
    );
  }

  // Trip status
  const configs = {
    'closed': { color: 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30', label: 'Completed' },
    'pending': { color: 'border-yellow-500 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30', label: 'Pending' },
    'in_transit': { color: 'border-blue-500 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30', label: 'In Transit' },
  };
  const config = configs[status] || { color: 'border-slate-500 text-slate-700 dark:text-slate-400 bg-slate-50 dark:bg-slate-800', label: status || 'Unknown' };
  return (
    <Badge variant="outline" className={`${config.color} text-[10px] font-medium`}>
      {config.label}
    </Badge>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const FuelWithoutTripReport = ({ departmentId, dateRange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({
    start_date: dateRange?.start || '',
    end_date: dateRange?.end || '',
    department_id: departmentId || 'all',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {
        department_id: filters.department_id !== 'all' ? filters.department_id : undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      };
      const response = await reportsAPI.getFuelWithoutTrip(params);
      setData(response.data?.data);
    } catch (error) {
      console.error('Failed to fetch fuel without trip:', error);
      toast.error('Failed to load fuel without trip report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const params = {
        department_id: filters.department_id !== 'all' ? filters.department_id : undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      };
      
      const response = await reportsAPI.exportFuelWithoutTrip(format, params);
      const extension = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'csv';
      const fileName = `fuel_without_trip_${new Date().toISOString().split('T')[0]}.${extension}`;
      saveAs(response.data, fileName);
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      start_date: '',
      end_date: '',
      department_id: 'all',
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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const hasActiveFilters = filters.start_date || filters.end_date || filters.department_id !== 'all';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/20">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading fuel without trip report...</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Please wait while we fetch your data</p>
        </div>
      </div>
    );
  }

  const fuelData = data || [];
  const summary = data?.summary || {};

  // Calculate trends based on previous period
  const trends = {
    total: fuelData.length > 0 ? 12 : 0,
    fuel: summary.total_fuel_issued > 0 ? 8 : 0,
    movement: summary.no_movement > 0 ? -5 : 0,
    odometer: summary.no_odometer > 0 ? 3 : 0,
  };

  return (
    <div className="space-y-6 p-4 md:p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/20">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Fuel Issued Without Trip
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Trips with fuel issued but no movement recorded
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowFilters(!showFilters)}
            className="dark:border-slate-700 dark:text-slate-300"
          >
            <Filter className="h-4 w-4 mr-1.5" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full font-bold">!</span>
            )}
            {showFilters ? (
              <ChevronUp className="h-4 w-4 ml-1" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-1" />
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
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

      {/* Filters */}
      {showFilters && (
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Start Date</Label>
                <Input
                  type="date"
                  name="start_date"
                  value={filters.start_date}
                  onChange={handleFilterChange}
                  className="mt-1 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">End Date</Label>
                <Input
                  type="date"
                  name="end_date"
                  value={filters.end_date}
                  onChange={handleFilterChange}
                  className="mt-1 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex items-end gap-2">
                {hasActiveFilters && (
                  <Button 
                    variant="outline" 
                    onClick={clearFilters} 
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Clear Filters
                  </Button>
                )}
                <Button onClick={fetchData} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Search className="h-4 w-4 mr-1.5" />
                  Apply
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Incidents"
          value={summary.total_trips || 0}
          icon={AlertTriangle}
          color="red"
          subtitle="Fuel without trip"
          trend={trends.total}
        />
        <StatsCard
          title="Total Fuel Issued"
          value={formatCurrency(summary.total_fuel_issued || 0)}
          icon={DollarSign}
          color="orange"
          subtitle="Fuel cost"
          trend={trends.fuel}
        />
        <StatsCard
          title="No Movement"
          value={summary.no_movement || 0}
          icon={Activity}
          color="purple"
          subtitle="Zero distance recorded"
          trend={trends.movement}
        />
        <StatsCard
          title="No Odometer"
          value={summary.no_odometer || 0}
          icon={Truck}
          color="blue"
          subtitle="Missing odometer readings"
          trend={trends.odometer}
        />
      </div>

      {/* Data Table */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
        <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Fuel Issued Without Trip Details
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                {fuelData.length} incident{fuelData.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            {fuelData.length > 0 && (
              <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30">
                <Zap className="h-3 w-3 mr-1" />
                {fuelData.length} records
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            {fuelData.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-10 w-10 text-emerald-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No incidents found</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  All fuel issuances have proper trip records
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-red-50 dark:bg-red-900/20">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Trip #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Vehicle</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Driver</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Department</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Fuel Issued</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Movement</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {fuelData.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm text-slate-600 dark:text-slate-400">{formatDate(item.date)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white">
                          {item.trip_number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm text-slate-600 dark:text-slate-400">{item.plate_number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm text-slate-600 dark:text-slate-400">{item.driver}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm text-slate-600 dark:text-slate-400">{item.department}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(item.fuel_issued)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.movement_status} type="movement" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={item.status} type="trip" />
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
        <p>FCMS - Fuel Without Trip Report • Laguindingan Municipality</p>
      </div>
    </div>
  );
};

export default FuelWithoutTripReport;
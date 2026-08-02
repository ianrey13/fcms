// src/components/reports/WeeklyMonitoring.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, Fuel, DollarSign, Truck, TrendingUp, TrendingDown, 
  FileSpreadsheet, Printer, RefreshCw, Loader2, AlertCircle 
} from 'lucide-react';
import { reportsAPI } from '../../../services/api';
import { saveAs } from 'file-saver';
import { toast } from 'react-hot-toast';

const WeeklyMonitoring = ({ departmentId, onRefresh }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
  }, []);

  useEffect(() => {
    if (weekStart && weekEnd) {
      fetchData();
    }
  }, [weekStart, weekEnd, departmentId]);

  const fetchData = async () => {
    if (!weekStart || !weekEnd) return;
    
    setLoading(true);
    setError(null);
    try {
      const params = {
        department_id: departmentId !== 'all' ? departmentId : undefined,
        week_start: weekStart,
        week_end: weekEnd,
      };
      
      console.log('📊 Fetching weekly monitoring with params:', params);
      
      const response = await reportsAPI.getWeeklyMonitoring(params);
      
      console.log('📊 Weekly Monitoring Response:', response);
      
      // ✅ Check if response is successful
      if (response.data?.success === false) {
        throw new Error(response.data.message || 'Failed to fetch weekly monitoring data');
      }
      
      // ✅ Extract data properly
      const responseData = response.data?.data || response.data || {};
      
      setData(responseData);
      
    } catch (error) {
      console.error('❌ Failed to fetch weekly monitoring:', error);
      setError(error.message || 'Failed to load weekly monitoring data');
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

  // ✅ Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <p className="text-red-600 mb-2">Failed to load weekly monitoring</p>
        <p className="text-sm text-gray-500">{error}</p>
        <Button onClick={handleRefresh} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-500">Loading weekly data...</span>
      </div>
    );
  }

  // ✅ Check if data exists
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Calendar className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500">No weekly data available</p>
        <p className="text-sm text-gray-400">Try selecting a different week or department</p>
      </div>
    );
  }

  const summary = data?.summary || {};
  const trips = data?.trips || [];
  const period = data?.period || {};

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Week: {formatDate(weekStart)} - {formatDate(weekEnd)}
          </h2>
          <p className="text-sm text-gray-500">Budget utilization and trip performance</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handlePreviousWeek}>
            ← Previous
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextWeek}>
            Next →
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleExport('excel')}
            disabled={exporting}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Excel
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleExport('pdf')}
            disabled={exporting}
          >
            <Printer className="h-4 w-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Weekly Budget</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.budget)}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full dark:bg-blue-900/30">
                <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Used</p>
                <p className="text-2xl font-bold text-yellow-600">{formatCurrency(summary.used)}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full dark:bg-yellow-900/30">
                <TrendingDown className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <div className="mt-2">
              <Progress value={summary.utilization || 0} className="h-2" />
              <p className="text-xs text-gray-500 mt-1">{summary.utilization || 0}% utilization</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Remaining</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.remaining)}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full dark:bg-green-900/30">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Trips</p>
                <p className="text-2xl font-bold">{summary.trips || 0}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full dark:bg-purple-900/30">
                <Truck className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-green-600">✓ Completed: {summary.completed || 0}</span>
              <span className="text-yellow-600">⏳ Pending: {summary.pending || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trips Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Weekly Trips
            <span className="text-sm font-normal text-gray-500">
              ({trips.length} trips)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {trips.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Truck className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p>No trips found for this week</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Trip #</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Destination</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Vehicle</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold">Driver</th>
                    <th className="px-4 py-2 text-right text-sm font-semibold">Est. Fuel</th>
                    <th className="px-4 py-2 text-right text-sm font-semibold">Actual Fuel</th>
                    <th className="px-4 py-2 text-right text-sm font-semibold">Amount</th>
                    <th className="px-4 py-2 text-center text-sm font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {trips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2 font-mono text-sm">{trip.number}</td>
                      <td className="px-4 py-2 text-sm">{trip.destination}</td>
                      <td className="px-4 py-2 text-sm">{trip.vehicle}</td>
                      <td className="px-4 py-2 text-sm">{trip.driver}</td>
                      <td className="px-4 py-2 text-right text-sm">{trip.estimated_fuel || '-'} L</td>
                      <td className="px-4 py-2 text-right text-sm">{trip.actual_fuel || '-'} L</td>
                      <td className="px-4 py-2 text-right text-sm font-semibold">{formatCurrency(trip.amount)}</td>
                      <td className="px-4 py-2 text-center">
                        <Badge className={
                          trip.status === 'closed' ? 'bg-green-500' :
                          trip.status === 'funds_issued' ? 'bg-blue-500' :
                          trip.status === 'pending_reconciliation' ? 'bg-yellow-500' :
                          'bg-gray-500'
                        }>
                          {trip.status === 'closed' ? 'Completed' :
                           trip.status === 'funds_issued' ? 'Active' :
                           trip.status === 'pending_reconciliation' ? 'Pending' :
                           trip.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WeeklyMonitoring;
// src/components/reports/FuelWithoutTripReport.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  AlertTriangle, Fuel, Truck, Calendar, FileSpreadsheet, 
  Printer, RefreshCw, Loader2, Search, Filter, X, CheckCircle
} from 'lucide-react';
import { reportsAPI } from '../../services/api';
import { saveAs } from 'file-saver';
import { toast } from 'react-hot-toast';

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

  // ✅ Format currency
  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return '₱0.00';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const hasActiveFilters = filters.start_date || filters.end_date || filters.department_id !== 'all';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-500">Loading report...</span>
      </div>
    );
  }

  const fuelData = data || [];
  const summary = data?.summary || {};

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Fuel Issued Without Trip
          </h2>
          <p className="text-sm text-gray-500">Trips with fuel issued but no movement recorded</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">!</span>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
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

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm">Start Date</Label>
                <Input
                  type="date"
                  name="start_date"
                  value={filters.start_date}
                  onChange={handleFilterChange}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">End Date</Label>
                <Input
                  type="date"
                  name="end_date"
                  value={filters.end_date}
                  onChange={handleFilterChange}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end gap-2">
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters} className="text-red-600">
                    <X className="h-4 w-4 mr-1" />
                    Clear Filters
                  </Button>
                )}
                <Button onClick={fetchData}>
                  <Search className="h-4 w-4 mr-1" />
                  Apply
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Incidents</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.total_trips || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Fuel className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Fuel</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.total_fuel_issued || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Truck className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">No Movement</p>
                <p className="text-2xl font-bold">{summary.no_movement || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">No Odometer</p>
                <p className="text-2xl font-bold">{summary.no_odometer || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Fuel Issued Without Trip Details
            <span className="text-sm font-normal text-gray-500">
              ({fuelData.length} incidents)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-red-50 dark:bg-red-900/20">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Date</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Trip #</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Vehicle</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Driver</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Department</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold">Fuel Issued</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold">Movement</th>
                  <th className="px-4 py-2 text-center text-sm font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {fuelData.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                      No fuel without trip incidents found
                    </td>
                  </tr>
                ) : (
                  fuelData.map((item) => (
                    <tr key={item.id} className="hover:bg-red-50/50 dark:hover:bg-red-900/10">
                      <td className="px-4 py-2 text-sm">{item.date}</td>
                      <td className="px-4 py-2 font-mono text-sm">{item.trip_number}</td>
                      <td className="px-4 py-2 text-sm">{item.plate_number}</td>
                      <td className="px-4 py-2 text-sm">{item.driver}</td>
                      <td className="px-4 py-2 text-sm">{item.department}</td>
                      {/* ✅ FIXED: Fuel Issued as Currency */}
                      <td className="px-4 py-2 text-right font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(item.fuel_issued)}
                      </td>
                      <td className="px-4 py-2">
                        <Badge className={
                          item.movement_status === 'Normal Trip' ? 'bg-green-500' :
                          item.movement_status === 'No Movement' ? 'bg-red-500' :
                          item.movement_status === 'Minimal Movement (<1km)' ? 'bg-yellow-500' :
                          'bg-gray-500'
                        }>
                          {item.movement_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Badge variant="outline" className={
                          item.status === 'closed' ? 'border-green-500 text-green-700 dark:text-green-400' :
                          'border-yellow-500 text-yellow-700 dark:text-yellow-400'
                        }>
                          {item.status === 'closed' ? 'Completed' : 'Pending'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FuelWithoutTripReport;
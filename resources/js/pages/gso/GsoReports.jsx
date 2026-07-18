// src/pages/gso/GsoReports.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI, departmentAPI, vehicleAPI } from '../../services/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { saveAs } from 'file-saver';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
} from 'recharts';
import {
  Loader2,
  RefreshCw,
  FileText,
  Calendar,
  TrendingUp,
  TrendingDown,
  Fuel,
  DollarSign,
  Truck,
  Building2,
  Clock,
  CheckCircle,
  Printer,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info,
  Award,
  LineChart as LineChartIcon,
  CalendarRange,
  Receipt,
  Eye,
  EyeOff,
  BarChart3,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

// ============================================
// CONSTANTS & HELPERS
// ============================================

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1'];

const PERIOD_TYPES = [
  { value: 'weekly', label: 'Weekly', icon: Calendar },
  { value: 'monthly', label: 'Monthly', icon: CalendarRange },
  { value: 'yearly', label: 'Yearly', icon: CalendarRange },
];

const formatCurrency = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₱0.00';
  }
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

const getEfficiencyBadge = (kmPerLiter) => {
  if (!kmPerLiter || kmPerLiter === 0) {
    return { label: 'No Data', color: 'bg-slate-400' };
  }
  if (kmPerLiter >= 10) return { label: 'Excellent', color: 'bg-green-500' };
  if (kmPerLiter >= 7) return { label: 'Good', color: 'bg-blue-500' };
  if (kmPerLiter >= 5) return { label: 'Average', color: 'bg-yellow-500' };
  if (kmPerLiter >= 3) return { label: 'Poor', color: 'bg-orange-500' };
  return { label: 'Critical', color: 'bg-red-500' };
};

const getStatusBadge = (status) => {
  const statusMap = {
    'closed': { label: 'Completed', color: 'bg-green-500' },
    'completed': { label: 'Completed', color: 'bg-green-500' },
    'pending_reconciliation': { label: 'Pending', color: 'bg-yellow-500' },
    'pending_mayors_office': { label: 'Pending', color: 'bg-yellow-500' },
    'funds_issued': { label: 'Active', color: 'bg-blue-500' },
    'in_transit': { label: 'In Transit', color: 'bg-purple-500' },
    'active': { label: 'Active', color: 'bg-blue-500' },
    'rejected': { label: 'Rejected', color: 'bg-red-500' },
  };
  return statusMap[status?.toLowerCase()] || { label: status || 'N/A', color: 'bg-slate-400' };
};

// ============================================
// DATE RANGE HELPER
// ============================================

const getDateRange = (periodType, customStart, customEnd) => {
  const today = new Date();
  
  if (customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }

  switch (periodType) {
    case 'weekly':
      return {
        startDate: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        endDate: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    case 'monthly':
      return {
        startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(today), 'yyyy-MM-dd'),
      };
    case 'yearly':
      return {
        startDate: format(startOfYear(today), 'yyyy-MM-dd'),
        endDate: format(endOfYear(today), 'yyyy-MM-dd'),
      };
    default:
      return {
        startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      };
  }
};

// ============================================
// MAIN COMPONENT
// ============================================

const GsoReports = () => {
  // ============ STATE ============
  const [activeTab, setActiveTab] = useState('fuel-receipt');
  const [periodType, setPeriodType] = useState('weekly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [showBudgetChart, setShowBudgetChart] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    vehicleBreakdown: true,
    departmentBreakdown: true,
    trends: true,
    recommendations: true,
  });
  const [exportLoading, setExportLoading] = useState(false);

  // ============ FETCH DEPARTMENTS & VEHICLES ============
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await departmentAPI.getAll();
        setDepartments(response.data?.data || []);
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    };
    fetchDepartments();
  }, []);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const params = departmentFilter !== 'all' ? { department_id: departmentFilter } : {};
        const response = await vehicleAPI.getAll(params);
        setVehicles(response.data?.data || []);
      } catch (error) {
        console.error('Error fetching vehicles:', error);
      }
    };
    fetchVehicles();
  }, [departmentFilter]);

  // ============ COMPUTED DATE RANGE ============
  const dateRange = useMemo(() => {
    if (customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate };
    }
    return getDateRange(periodType);
  }, [periodType, customStartDate, customEndDate]);

  // ============ QUERIES ============

  // 1. Trip Summary Report
  const {
    data: tripData,
    isLoading: tripLoading,
    refetch: refetchTrips,
  } = useQuery({
    queryKey: ['trip-report', dateRange, departmentFilter],
    queryFn: async () => {
      try {
        const params = {
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
          department_id: departmentFilter !== 'all' ? departmentFilter : undefined,
        };
        const response = await reportsAPI.getTripReport(params);
        console.log('🚗 Trip Data:', response.data);
        return response.data?.data || response.data || {};
      } catch (error) {
        console.error('Error fetching trip report:', error);
        toast.error('Failed to load trip report');
        return {};
      }
    },
    enabled: true,
  });

  // 2. Vehicle Efficiency Report
  const {
    data: vehicleData,
    isLoading: vehicleLoading,
    refetch: refetchVehicles,
  } = useQuery({
    queryKey: ['vehicle-report', dateRange, departmentFilter],
    queryFn: async () => {
      try {
        const params = {
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
          department_id: departmentFilter !== 'all' ? departmentFilter : undefined,
        };
        const response = await reportsAPI.getVehicleReport(params);
        console.log('🚛 Vehicle Efficiency Data:', response.data);
        return response.data?.data || response.data || [];
      } catch (error) {
        console.error('Error fetching vehicle report:', error);
        toast.error('Failed to load vehicle efficiency report');
        return [];
      }
    },
    enabled: true,
  });

  // 3. Budget Report
  const {
    data: budgetData,
    isLoading: budgetLoading,
    refetch: refetchBudget,
    isFetching: budgetFetching,
  } = useQuery({
    queryKey: ['budget-report', dateRange, departmentFilter],
    queryFn: async () => {
      try {
        const params = {
          department_id: departmentFilter !== 'all' ? departmentFilter : undefined,
        };
        const response = await reportsAPI.getBudgetReport(params);
        console.log('💰 Budget Data:', response.data);
        return response.data?.data || response.data || {};
      } catch (error) {
        console.error('Error fetching budget report:', error);
        toast.error('Failed to load budget report');
        return {};
      }
    },
    enabled: true,
  });

  // 4. Fuel Receipt Report
  const {
    data: receiptData,
    isLoading: receiptLoading,
    refetch: refetchReceipts,
    isFetching: receiptFetching,
  } = useQuery({
    queryKey: ['fuel-receipt-report', dateRange, departmentFilter, vehicleFilter],
    queryFn: async () => {
      try {
        const params = {
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
          department_id: departmentFilter !== 'all' ? departmentFilter : undefined,
          vehicle_id: vehicleFilter !== 'all' ? vehicleFilter : undefined,
        };
        const response = await reportsAPI.getFuelReceiptReport(params);
        console.log('🧾 Fuel Receipt Data:', response.data);
        return response.data?.data || response.data || {};
      } catch (error) {
        console.error('Error fetching fuel receipt report:', error);
        toast.error('Failed to load fuel receipt report');
        return {};
      }
    },
    enabled: activeTab === 'fuel-receipt',
  });

  // ============ HANDLERS ============

  const handleRefresh = () => {
    refetchTrips();
    refetchReceipts();
    refetchVehicles();
    refetchBudget();
    toast.success('Reports refreshed');
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleExport = async (format) => {
    try {
      setExportLoading(true);
      toast.loading(`Exporting ${format.toUpperCase()} report...`);

      let exportFunction;
      let reportName;

      if (activeTab === 'fuel-receipt') {
        exportFunction = reportsAPI.exportFuelReceiptReport;
        reportName = 'fuel_receipt_report';
      } else {
        exportFunction = reportsAPI.exportFuelConsumptionReport;
        reportName = 'fuel_consumption_report';
      }

      const params = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        department_id: departmentFilter !== 'all' ? departmentFilter : undefined,
        vehicle_id: vehicleFilter !== 'all' ? vehicleFilter : undefined,
        period_type: periodType,
      };

      const response = await exportFunction(format, params);
      
      const extension = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'csv';
      const fileName = `${reportName}_${dateRange.startDate}_to_${dateRange.endDate}.${extension}`;
      
      saveAs(response.data, fileName);

      toast.dismiss();
      toast.success(`Report exported as ${format.toUpperCase()}`);
      
    } catch (error) {
      toast.dismiss();
      console.error('❌ Export error:', error);
      
      const message = error.response?.data?.message || 
                     error.message || 
                     'Failed to export report';
      toast.error(message);
    } finally {
      setExportLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderSummaryCards = (data, type = 'consumption') => {
    const summary = data?.summary || {};
    
    if (type === 'consumption') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Trips</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(summary.total_trips)}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <Truck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Fuel (Liters)</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(summary.total_fuel_liters)}</p>
                </div>
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                  <Fuel className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Cost</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(summary.total_fuel_cost)}</p>
                </div>
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                  <DollarSign className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Avg. Km/L</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.average_km_per_liter || 0}</p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Receipt summary
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Receipts</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(summary.total_receipts)}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Receipt className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Fuel (Liters)</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatNumber(summary.total_liters)}</p>
              </div>
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                <Fuel className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Cost</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(summary.total_cost)}</p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                <DollarSign className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Avg. Unit Price</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {summary.total_liters > 0 ? formatCurrency(summary.total_cost / summary.total_liters) : '₱0.00'}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ============================================
  // RENDER FUEL RECEIPT TABLE
  // ============================================

const renderFuelReceiptTable = () => {
  const receipts = receiptData?.receipts || [];

  if (receipts.length === 0) {
    return (
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardContent className="py-12 text-center">
          <Receipt className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">No fuel receipt records found</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Try adjusting your filters or date range
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dark:bg-slate-800/80 dark:border-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-blue-500" />
          Fuel Receipt Details
        </CardTitle>
        <CardDescription>
          Showing {receipts.length} receipt{receipts.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold text-blue-600">Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Plate No.</TableHead>
                <TableHead>Fuel</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Qty (L)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((receipt, index) => {
                const status = getStatusBadge(receipt.status);
                // ✅ Use invoice_number from backend
                const invoiceNumber = receipt.invoice_number || receipt.charge_invoice_no || 'N/A';
                const unitPrice = receipt.unit_price || 0;
                const key = receipt.fuel_receipt_id || receipt.gas_slip_id || `receipt-${index}`;
                
                return (
                  <TableRow key={key} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <TableCell className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                      {invoiceNumber}
                    </TableCell>
                    <TableCell>{receipt.date || 'N/A'}</TableCell>
                    <TableCell>{receipt.driver || 'N/A'}</TableCell>
                    <TableCell>{receipt.vehicle || 'N/A'}</TableCell>
                    <TableCell className="font-mono text-sm">{receipt.plate_no || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {receipt.lubricant || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(unitPrice)}
                    </TableCell>
                    <TableCell className="text-right font-medium font-mono">
                      {formatCurrency(receipt.amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(receipt.quantity)}
                    </TableCell>
                  
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
  // ============================================
  // RENDER TRIP SUMMARY TAB
  // ============================================

  const renderTripSummary = () => {
    const totalTrips = tripData?.total_trips || 0;
    const statusBreakdown = tripData?.status_breakdown || {};

    const statusData = Object.entries(statusBreakdown).map(([status, count]) => ({
      name: status.replace(/_/g, ' ').toUpperCase(),
      value: count,
    }));

    const pending = statusBreakdown['pending_mayors_office'] || 0;
    const inTransit = statusBreakdown['in_transit'] || 0;
    const completed = statusBreakdown['closed'] || 0;
    const rejected = statusBreakdown['rejected'] || 0;

    return (
      <div className="space-y-4 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Trips</p>
                  <p className="text-2xl font-bold">{formatNumber(totalTrips)}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <Truck className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Pending</p>
                  <p className="text-2xl font-bold text-yellow-500">{formatNumber(pending)}</p>
                </div>
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                  <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">In Transit</p>
                  <p className="text-2xl font-bold text-blue-500">{formatNumber(inTransit)}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Completed</p>
                  <p className="text-2xl font-bold text-green-500">{formatNumber(completed)}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {statusData.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-slate-500 dark:text-slate-400">No data available</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={120}
                        dataKey="value"
                        nameKey="name"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader>
              <CardTitle>Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan="3" className="text-center text-slate-500">No data available</TableCell>
                    </TableRow>
                  ) : (
                    statusData.map((item, index) => {
                      const key = item.name || `status-${index}`;
                      return (
                        <TableRow key={key}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">{formatNumber(item.value)}</TableCell>
                          <TableCell className="text-right">
                            {totalTrips > 0 ? ((item.value / totalTrips) * 100).toFixed(1) : 0}%
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // ============================================
  // RENDER VEHICLE EFFICIENCY TAB
  // ============================================

  const renderVehicleEfficiency = () => {
    const vehicles = vehicleData || [];

    const totalVehicles = vehicles.length;
    const excellent = vehicles.filter(v => (v.km_per_liter || 0) >= 10).length;
    const needsAttention = vehicles.filter(v => (v.km_per_liter || 0) < 5 && (v.km_per_liter || 0) > 0).length;

    const sortedVehicles = [...vehicles].sort((a, b) => (b.km_per_liter || 0) - (a.km_per_liter || 0));

    return (
      <div className="space-y-4 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Vehicles</p>
                  <p className="text-2xl font-bold">{formatNumber(totalVehicles)}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <Truck className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Excellent Rating</p>
                  <p className="text-2xl font-bold text-green-500">{formatNumber(excellent)}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <Award className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Needs Attention</p>
                  <p className="text-2xl font-bold text-red-500">{formatNumber(needsAttention)}</p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardHeader>
            <CardTitle>Vehicle Efficiency Rankings</CardTitle>
            <CardDescription>Sorted by fuel efficiency (km/L)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {sortedVehicles.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <p>No vehicle data available</p>
                  <p className="text-sm">Try adjusting your filters or date range</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Fuel Type</TableHead>
                      <TableHead className="text-right">Trips</TableHead>
                      <TableHead className="text-right">Total Distance</TableHead>
                      <TableHead className="text-right">Total Fuel</TableHead>
                      <TableHead className="text-right">Km/L</TableHead>
                      <TableHead>Efficiency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedVehicles.map((vehicle, index) => {
                      const efficiency = getEfficiencyBadge(vehicle.km_per_liter);
                      const key = vehicle.vehicle_id || `vehicle-${index}`;
                      return (
                        <TableRow key={key}>
                          <TableCell>
                            <Badge 
                              variant={index < 3 ? 'default' : 'secondary'} 
                              className={
                                index === 0 ? 'bg-yellow-500' : 
                                index === 1 ? 'bg-slate-400' : 
                                index === 2 ? 'bg-amber-600' : ''
                              }
                            >
                              #{index + 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{vehicle.plate_number || 'N/A'}</TableCell>
                          <TableCell>{vehicle.model || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {vehicle.fuel_type || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{vehicle.trip_count || 0}</TableCell>
                          <TableCell className="text-right">{formatNumber(vehicle.total_distance_km)} km</TableCell>
                          <TableCell className="text-right">{formatNumber(vehicle.total_liters)} L</TableCell>
                          <TableCell className="text-right font-medium">{vehicle.km_per_liter || 0}</TableCell>
                          <TableCell>
                            <Badge className={efficiency.color}>{efficiency.label}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ============================================
  // RENDER BUDGET UTILIZATION TAB
  // ============================================

  const renderBudgetUtilization = () => {
    const periods = budgetData?.periods || [];
    const summary = budgetData?.summary || {};

    console.log('💰 Budget Periods:', periods);
    console.log('💰 Budget Summary:', summary);

    const totalAllocated = periods.reduce((sum, p) => {
      const val = parseFloat(p.allocated) || 0;
      return sum + val;
    }, 0);

    const totalUsed = periods.reduce((sum, p) => {
      const val = parseFloat(p.used) || 0;
      return sum + val;
    }, 0);

    const totalRemaining = totalAllocated - totalUsed;

    if (periods.length === 0 && !summary.total_allocated) {
      return (
        <div className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="dark:bg-slate-800/80 dark:border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Allocated</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(0)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="dark:bg-slate-800/80 dark:border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Used</p>
                    <p className="text-2xl font-bold text-yellow-600">{formatCurrency(0)}</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="dark:bg-slate-800/80 dark:border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Remaining</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(0)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="py-12 text-center">
              <DollarSign className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No budget data available</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Try adjusting your filters or date range
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-4 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Allocated</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAllocated || summary.total_allocated)}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <DollarSign className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Used</p>
                  <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalUsed || summary.total_used)}</p>
                </div>
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                  <TrendingDown className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Remaining</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRemaining || summary.total_remaining)}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardHeader className="cursor-pointer" onClick={() => toggleSection('departmentBreakdown')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-500" />
                <CardTitle>Budget Utilization by Department</CardTitle>
                <Badge variant="secondary">{periods.length} Departments</Badge>
              </div>
              {expandedSections.departmentBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
          {expandedSections.departmentBreakdown && (
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Allocated</TableHead>
                      <TableHead className="text-right">Used</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="text-right">Utilization</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan="6" className="text-center text-slate-500 py-4">No department budget data available</TableCell>
                      </TableRow>
                    ) : (
                      periods.map((period) => {
                        const key = period.period_id || `period-${Math.random()}`;
                        const allocated = parseFloat(period.allocated) || 0;
                        const used = parseFloat(period.used) || 0;
                        const remaining = allocated - used;
                        const utilPercent = allocated > 0 ? ((used / allocated) * 100) : 0;
                        
                        let statusLabel = 'On Track';
                        let statusColor = 'bg-green-500';
                        
                        if (remaining < 0) {
                          statusLabel = 'Over Budget';
                          statusColor = 'bg-red-500';
                        } else if (utilPercent > 80) {
                          statusLabel = 'Near Limit';
                          statusColor = 'bg-yellow-500';
                        }
                        
                        return (
                          <TableRow key={key}>
                            <TableCell className="font-medium">{period.department_name || 'Unknown'}</TableCell>
                            <TableCell className="text-right">{formatCurrency(allocated)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(used)}</TableCell>
                            <TableCell className={`text-right font-medium ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(remaining)}
                            </TableCell>
                            <TableCell className="text-right">{utilPercent.toFixed(1)}%</TableCell>
                            <TableCell>
                              <Badge className={statusColor}>{statusLabel}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>

        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardHeader 
            className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            onClick={() => setShowBudgetChart(!showBudgetChart)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
                <CardTitle>Budget Visualization</CardTitle>
                <Badge variant="secondary" className="ml-2">
                  {showBudgetChart ? 'Hide' : 'Show'}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                {showBudgetChart ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showBudgetChart ? 'Hide Chart' : 'Show Chart'}
              </div>
            </div>
          </CardHeader>
          {showBudgetChart && (
            <CardContent>
              <div className="h-80">
                {periods.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-slate-500 dark:text-slate-400">No data to visualize</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={periods}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department_name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="allocated" fill="#3b82f6" name="Allocated" />
                      <Bar dataKey="used" fill="#f59e0b" name="Used" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    );
  };

  // ============================================
  // RENDER - LOADING
  // ============================================

  const isLoading = tripLoading || vehicleLoading || receiptLoading || budgetLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Loading reports...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - MAIN
  // ============================================

  return (
    <div className="space-y-6 p-4 md:p-6 print:p-4">
      {/* ========== HEADER ========== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            {activeTab === 'fuel-receipt' ? 'Fuel Receipt Report' : 'Fuel Consumption Monitoring Report'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {periodType.charAt(0).toUpperCase() + periodType.slice(1)} report from {dateRange.startDate} to {dateRange.endDate}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={receiptFetching || budgetFetching}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${receiptFetching || budgetFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handlePrint}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            disabled={exportLoading}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            <FileSpreadsheet className="h-4 w-4" />
            PDF
          </Button>
          <Button
            onClick={() => handleExport('excel')}
            disabled={exportLoading}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      {/* ========== FILTERS ========== */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700 print:hidden">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Period Type */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Period</label>
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger className="mt-1 dark:bg-slate-900 dark:border-slate-700">
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_TYPES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Start Date</label>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="mt-1 dark:bg-slate-900 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">End Date</label>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="mt-1 dark:bg-slate-900 dark:border-slate-700"
              />
            </div>

            {/* Department Filter */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="mt-1 dark:bg-slate-900 dark:border-slate-700">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.department_id} value={String(dept.department_id)}>
                      {dept.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle Filter - Filtered by Department */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Vehicle</label>
              <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                <SelectTrigger className="mt-1 dark:bg-slate-900 dark:border-slate-700">
                  <SelectValue placeholder="All Vehicles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles</SelectItem>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.vehicle_id} value={String(vehicle.vehicle_id)}>
                      {vehicle.plate_number} - {vehicle.vehicle_model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Date Buttons */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const range = getDateRange('weekly');
                setCustomStartDate(range.startDate);
                setCustomEndDate(range.endDate);
                setPeriodType('weekly');
              }}
              className="text-xs"
            >
              This Week
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const range = getDateRange('monthly');
                setCustomStartDate(range.startDate);
                setCustomEndDate(range.endDate);
                setPeriodType('monthly');
              }}
              className="text-xs"
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const range = getDateRange('yearly');
                setCustomStartDate(range.startDate);
                setCustomEndDate(range.endDate);
                setPeriodType('yearly');
              }}
              className="text-xs"
            >
              This Year
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="text-xs"
            >
              Clear Dates
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ========== TABS ========== */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl print:hidden">
          <TabsTrigger value="fuel-receipt" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
            <Receipt className="h-4 w-4 mr-2" />
            Receipts
          </TabsTrigger>
          <TabsTrigger value="trip-summary" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
            <Truck className="h-4 w-4 mr-2" />
            Trip Summary
          </TabsTrigger>
          <TabsTrigger value="vehicle-efficiency" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
            <TrendingUp className="h-4 w-4 mr-2" />
            Vehicle Efficiency
          </TabsTrigger>
          <TabsTrigger value="budget-utilization" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
            <DollarSign className="h-4 w-4 mr-2" />
            Budget
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: FUEL RECEIPT */}
        <TabsContent value="fuel-receipt" className="space-y-4 mt-6">
          {renderSummaryCards(receiptData, 'receipt')}
          {renderFuelReceiptTable()}
        </TabsContent>

        {/* TAB 2: TRIP SUMMARY */}
        <TabsContent value="trip-summary">
          {renderTripSummary()}
        </TabsContent>

        {/* TAB 3: VEHICLE EFFICIENCY */}
        <TabsContent value="vehicle-efficiency">
          {renderVehicleEfficiency()}
        </TabsContent>

        {/* TAB 4: BUDGET UTILIZATION */}
        <TabsContent value="budget-utilization">
          {renderBudgetUtilization()}
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-700 print:block hidden">
        <p>Generated on {format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
        <p>FCMS - {activeTab === 'fuel-receipt' ? 'Fuel Receipt Report' : 'Fuel Consumption Monitoring Report'} • Laguindingan Municipality</p>
      </div>
    </div>
  );
};

export default GsoReports;
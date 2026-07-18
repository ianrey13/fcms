// src/pages/mayor/MayorReports.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI, mayorsOfficeAPI, departmentAPI, vehicleAPI } from '../../services/api';
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

const MayorReports = () => {
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
    departmentBreakdown: true,
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

  // 1. Budget Report
  const {
    data: budgetData,
    isLoading: budgetLoading,
    refetch: refetchBudget,
    isFetching: budgetFetching,
  } = useQuery({
    queryKey: ['mayor-budget-report', dateRange, departmentFilter],
    queryFn: async () => {
      try {
        const params = {
          department_id: departmentFilter !== 'all' ? departmentFilter : undefined,
        };
        const response = await mayorsOfficeAPI.getBudgetOverview();
        console.log('💰 Budget API Response:', response.data);
        
        // ✅ Handle different response formats
        let data = response.data?.data || response.data || [];
        if (!Array.isArray(data)) {
          data = [];
        }
        return data;
      } catch (error) {
        console.error('Error fetching budget report:', error);
        toast.error('Failed to load budget report');
        return [];
      }
    },
    enabled: true,
  });

  // 2. Fuel Receipt Report
  const {
    data: receiptData,
    isLoading: receiptLoading,
    refetch: refetchReceipts,
    isFetching: receiptFetching,
  } = useQuery({
    queryKey: ['mayor-fuel-receipt-report', dateRange, departmentFilter, vehicleFilter],
    queryFn: async () => {
      try {
        const params = {
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
          department_id: departmentFilter !== 'all' ? departmentFilter : undefined,
          vehicle_id: vehicleFilter !== 'all' ? vehicleFilter : undefined,
        };
        const response = await reportsAPI.getFuelReceiptReport(params);
        console.log('🧾 Fuel Receipt API Response:', response.data);
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
    refetchReceipts();
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

  const renderSummaryCards = (data) => {
    const summary = data?.summary || {};
    
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
                  <TableHead>Fuel (Lubricant)</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Qty (L)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((receipt, index) => {
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
  // RENDER BUDGET UTILIZATION TAB
  // ============================================

  const renderBudgetUtilization = () => {
    // ✅ Ensure budgetData is an array
    const periods = Array.isArray(budgetData) ? budgetData : [];
    
    console.log('💰 Budget periods for rendering:', periods);

    if (periods.length === 0) {
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

    // Calculate totals
    const totalAllocated = periods.reduce((sum, p) => {
      const val = parseFloat(p.allocated_amount) || 0;
      return sum + val;
    }, 0);

    const totalUsed = periods.reduce((sum, p) => {
      const val = parseFloat(p.spent_amount) || 0;
      return sum + val;
    }, 0);

    const totalRemaining = totalAllocated - totalUsed;

    // Prepare data for charts - ensure we have the right field names
    const chartData = periods.map(p => ({
      department_name: p.department_name || 'Unknown',
      allocated: parseFloat(p.allocated_amount) || 0,
      used: parseFloat(p.spent_amount) || 0,
      remaining: parseFloat(p.remaining_amount) || 0,
      utilization: parseFloat(p.utilization_percentage) || 
                   (p.allocated_amount > 0 ? ((p.spent_amount / p.allocated_amount) * 100) : 0),
    }));

    // Pie chart data
    const pieData = periods
      .filter(p => parseFloat(p.allocated_amount) > 0)
      .map(p => ({
        name: p.department_name || 'Unknown',
        value: parseFloat(p.allocated_amount) || 0,
      }));

    return (
      <div className="space-y-4 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Allocated</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAllocated)}</p>
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
                  <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalUsed)}</p>
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
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRemaining)}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Budget Allocation Pie Chart */}
        {pieData.length > 0 && (
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                <PieChart className="h-5 w-5 text-blue-500" />
                Budget Allocation by Department
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Department Budget Table */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardHeader 
            className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            onClick={() => toggleSection('departmentBreakdown')}
          >
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
                    {periods.map((period, index) => {
                      const allocated = parseFloat(period.allocated_amount) || 0;
                      const used = parseFloat(period.spent_amount) || 0;
                      const remaining = parseFloat(period.remaining_amount) || (allocated - used);
                      const utilPercent = allocated > 0 ? ((used / allocated) * 100) : 0;
                      
                      let statusLabel = 'On Track';
                      let statusColor = 'bg-green-500';
                      
                      if (remaining < 0 || utilPercent > 100) {
                        statusLabel = 'Over Budget';
                        statusColor = 'bg-red-500';
                      } else if (utilPercent > 80) {
                        statusLabel = 'Near Limit';
                        statusColor = 'bg-yellow-500';
                      }
                      
                      return (
                        <TableRow key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
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
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Budget Bar Chart */}
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
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-slate-500 dark:text-slate-400">No data to visualize</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department_name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="allocated" fill="#3b82f6" name="Allocated" />
                      <Bar dataKey="used" fill="#f59e0b" name="Used" />
                      <Bar dataKey="remaining" fill="#10b981" name="Remaining" />
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

  const isLoading = receiptLoading || budgetLoading;

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
            {activeTab === 'fuel-receipt' ? 'Fuel Receipt Report' : 'Budget & Receipt Report'}
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
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl print:hidden">
          <TabsTrigger value="fuel-receipt" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
            <Receipt className="h-4 w-4 mr-2" />
            Receipts
          </TabsTrigger>
          <TabsTrigger value="budget-utilization" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
            <DollarSign className="h-4 w-4 mr-2" />
            Budget
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: FUEL RECEIPT */}
        <TabsContent value="fuel-receipt" className="space-y-4 mt-6">
          {renderSummaryCards(receiptData)}
          {renderFuelReceiptTable()}
        </TabsContent>

        {/* TAB 2: BUDGET UTILIZATION */}
        <TabsContent value="budget-utilization">
          {renderBudgetUtilization()}
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-700 print:block hidden">
        <p>Generated on {format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
        <p>FCMS - {activeTab === 'fuel-receipt' ? 'Fuel Receipt Report' : 'Budget & Receipt Report'} • Laguindingan Municipality</p>
      </div>
    </div>
  );
};

export default MayorReports;
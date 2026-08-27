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
  ArrowLeft,
  Zap,
  Shield,
  Wallet,
  Gauge,
  Activity,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

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
    'working': { label: 'Working', color: 'bg-emerald-500' },
    'ongoing': { label: 'Ongoing', color: 'bg-blue-500' },
    'started': { label: 'Started', color: 'bg-yellow-500' },
    'pending': { label: 'Pending', color: 'bg-orange-500' },
    'pending_verification': { label: 'Pending Verification', color: 'bg-yellow-500' },
    'pending_reconciliation': { label: 'Pending Recon', color: 'bg-yellow-500' },
    'pending_mayors_office': { label: 'Pending MO', color: 'bg-yellow-500' },
    'verified': { label: 'Verified', color: 'bg-emerald-500' },
    'approved': { label: 'Approved', color: 'bg-emerald-500' },
    'closed': { label: 'Closed', color: 'bg-green-600' },
    'completed': { label: 'Completed', color: 'bg-green-500' },
    'rejected': { label: 'Rejected', color: 'bg-red-500' },
    'cancelled': { label: 'Cancelled', color: 'bg-slate-500' },
    'in_transit': { label: 'In Transit', color: 'bg-purple-500' },
    'funds_issued': { label: 'Funds Issued', color: 'bg-blue-500' },
    'acknowledged': { label: 'Acknowledged', color: 'bg-cyan-500' },
    'discrepancy': { label: 'Discrepancy', color: 'bg-red-500' },
    'active': { label: 'Active', color: 'bg-blue-500' },
    'returned_for_revision': { label: 'Returned', color: 'bg-purple-500' },
    'draft': { label: 'Draft', color: 'bg-slate-400' },
    'pending_gso_validation': { label: 'Pending Validation', color: 'bg-indigo-500' },
  };
  return statusMap[status?.toLowerCase()] || { label: status || 'N/A', color: 'bg-slate-400' };
};

// ============================================
// STATS CARD COMPONENT
// ============================================

const StatsCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <Card className="dark:bg-slate-800/80 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
        <CardContent className="pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
                    {subtitle && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
                    )}
                    {trend !== undefined && (
                        <div className="flex items-center gap-1 mt-1 text-[10px]">
                            {trend > 0 ? (
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                            ) : trend < 0 ? (
                                <TrendingDown className="h-3 w-3 text-red-500" />
                            ) : (
                                <Activity className="h-3 w-3 text-slate-400" />
                            )}
                            <span className={trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : trend < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}>
                                {trend > 0 ? '+' : ''}{trend}%
                            </span>
                        </div>
                    )}
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                </div>
            </div>
        </CardContent>
    </Card>
);

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
  const navigate = useNavigate();
  
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
  // RENDER - FUEL RECEIPT TABLE (ENHANCED WITH TOTAL)
  // ============================================

  const renderFuelReceiptTable = () => {
    const receipts = receiptData?.receipts || [];

    // ✅ Calculate totals
    const totals = receipts.reduce((acc, receipt) => {
      acc.totalAmount += parseFloat(receipt.amount || 0);
      acc.totalQuantity += parseFloat(receipt.quantity || 0);
      acc.totalUnitPrice += parseFloat(receipt.unit_price || 0);
      return acc;
    }, { totalAmount: 0, totalQuantity: 0, totalUnitPrice: 0 });

    if (receipts.length === 0) {
      return (
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Receipt className="h-10 w-10 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No fuel receipt records found</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              Try adjusting your filters or date range
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
        <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                <Receipt className="h-5 w-5 text-blue-500" />
                Fuel Receipt Details
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Showing {receipts.length} receipt{receipts.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            {receipts.length > 0 && (
              <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                <Zap className="h-3 w-3 mr-1" />
                {receipts.length} records
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                  <TableHead className="font-bold text-blue-600 dark:text-blue-400 text-xs uppercase tracking-wider">Invoice #</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Ticket #</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Date</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Driver</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Vehicle</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Plate No.</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Destination</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Time Departure</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Time Arrival</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Fuel Type</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Unit Price</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Amount</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Qty (L)</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((receipt, index) => {
                  const invoiceNumber = receipt.invoice_number || receipt.charge_invoice_no || 'N/A';
                  const unitPrice = receipt.unit_price || 0;
                  const key = receipt.fuel_receipt_id || receipt.gas_slip_id || `receipt-${index}`;
                  const status = receipt.status || receipt.reconciliation_status || 'pending';
                  const statusConfig = getStatusBadge(status);
                  
                  return (
                    <TableRow key={key} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                      <TableCell className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                        {invoiceNumber}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-slate-700 dark:text-slate-300">
                        {receipt.ticket_number || receipt.trip_ticket_number || 'N/A'}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {receipt.date || receipt.trip_date || 'N/A'}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {receipt.driver_name || receipt.driver || 'N/A'}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {receipt.vehicle_model || receipt.vehicle || 'N/A'}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-slate-700 dark:text-slate-300">
                        {receipt.plate_number || receipt.plate_no || 'N/A'}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {receipt.destination || 'N/A'}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {receipt.time_departure || receipt.departure_time || 'N/A'}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {receipt.time_arrival || receipt.arrival_time || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs dark:border-slate-600">
                          {receipt.fuel_type || receipt.lubricant || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatCurrency(unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-medium font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(receipt.amount || receipt.amount_on_receipt || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatNumber(receipt.quantity || receipt.liters_availed || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusConfig.color} text-white`}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* ✅ TOTAL ROW */}
                <TableRow className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                  <TableCell colSpan={10} className="text-right text-slate-800 dark:text-white">
                    TOTAL
                  </TableCell>
                  <TableCell className="text-right text-slate-800 dark:text-white">
                    {formatCurrency(totals.totalUnitPrice || 0)}
                  </TableCell>
                  <TableCell className="text-right text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(totals.totalAmount || 0)}
                  </TableCell>
                  <TableCell className="text-right text-slate-800 dark:text-white">
                    {formatNumber(totals.totalQuantity || 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="bg-slate-500 text-white">
                      {receipts.length} Records
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ============================================
  // RENDER - BUDGET UTILIZATION TAB
  // ============================================

  const renderBudgetUtilization = () => {
    const periods = Array.isArray(budgetData) ? budgetData : [];

    if (periods.length === 0) {
      return (
        <div className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatsCard
              title="Total Allocated"
              value={formatCurrency(0)}
              icon={DollarSign}
              color="from-blue-500 to-blue-600"
              subtitle="Budget allocation"
            />
            <StatsCard
              title="Used"
              value={formatCurrency(0)}
              icon={TrendingDown}
              color="from-yellow-500 to-yellow-600"
              subtitle="Amount used"
            />
            <StatsCard
              title="Remaining"
              value={formatCurrency(0)}
              icon={TrendingUp}
              color="from-emerald-500 to-emerald-600"
              subtitle="Budget remaining"
            />
          </div>
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-10 w-10 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No budget data available</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Try adjusting your filters or date range
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Calculate totals
    const totalAllocated = periods.reduce((sum, p) => sum + (parseFloat(p.allocated_amount) || 0), 0);
    const totalUsed = periods.reduce((sum, p) => sum + (parseFloat(p.spent_amount) || 0), 0);
    const totalRemaining = totalAllocated - totalUsed;

    // Prepare data for charts
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

    // Stats
    const budgetStats = [
      {
        title: "Total Allocated",
        value: formatCurrency(totalAllocated),
        icon: DollarSign,
        color: "from-blue-500 to-blue-600",
        subtitle: "Total budget",
        trend: totalAllocated > 0 ? 5 : 0,
      },
      {
        title: "Used",
        value: formatCurrency(totalUsed),
        icon: TrendingDown,
        color: "from-yellow-500 to-yellow-600",
        subtitle: "Amount spent",
        trend: totalUsed > 0 ? 8 : 0,
      },
      {
        title: "Remaining",
        value: formatCurrency(totalRemaining),
        icon: TrendingUp,
        color: totalRemaining > 0 ? "from-emerald-500 to-emerald-600" : "from-red-500 to-red-600",
        subtitle: "Budget remaining",
        trend: totalRemaining > 0 ? -3 : 0,
      },
    ];

    return (
      <div className="space-y-4 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {budgetStats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>

        {/* Budget Allocation Pie Chart */}
        {pieData.length > 0 && (
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                <PieChart className="h-5 w-5 text-blue-500" />
                Budget Allocation by Department
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                {pieData.length} departments with active budgets
              </CardDescription>
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
            className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl"
            onClick={() => toggleSection('departmentBreakdown')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-500" />
                <CardTitle className="text-slate-800 dark:text-white">Budget Utilization by Department</CardTitle>
                <Badge variant="secondary" className="ml-2">{periods.length} Departments</Badge>
              </div>
              {expandedSections.departmentBreakdown ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </div>
          </CardHeader>
          {expandedSections.departmentBreakdown && (
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Department</TableHead>
                      <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Allocated</TableHead>
                      <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Used</TableHead>
                      <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Remaining</TableHead>
                      <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Utilization</TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods.map((period, index) => {
                      const allocated = parseFloat(period.allocated_amount) || 0;
                      const used = parseFloat(period.spent_amount) || 0;
                      const remaining = parseFloat(period.remaining_amount) || (allocated - used);
                      const utilPercent = allocated > 0 ? ((used / allocated) * 100) : 0;
                      
                      let statusLabel = 'On Track';
                      let statusColor = 'bg-emerald-500';
                      
                      if (remaining < 0 || utilPercent > 100) {
                        statusLabel = 'Over Budget';
                        statusColor = 'bg-red-500';
                      } else if (utilPercent > 80) {
                        statusLabel = 'Near Limit';
                        statusColor = 'bg-yellow-500';
                      }
                      
                      return (
                        <TableRow key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <TableCell className="font-medium text-slate-800 dark:text-white">
                            {period.department_name || 'Unknown'}
                          </TableCell>
                          <TableCell className="text-right text-blue-600 dark:text-blue-400">
                            {formatCurrency(allocated)}
                          </TableCell>
                          <TableCell className="text-right text-yellow-600 dark:text-yellow-400">
                            {formatCurrency(used)}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-medium",
                            remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                          )}>
                            {formatCurrency(remaining)}
                          </TableCell>
                          <TableCell className="text-right text-slate-700 dark:text-slate-300">
                            {utilPercent.toFixed(1)}%
                          </TableCell>
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
            className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl"
            onClick={() => setShowBudgetChart(!showBudgetChart)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-slate-800 dark:text-white">Budget Visualization</CardTitle>
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="department_name" angle={-45} textAnchor="end" height={80} stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="allocated" fill="#3b82f6" name="Allocated" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="used" fill="#f59e0b" name="Used" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="remaining" fill="#10b981" name="Remaining" radius={[4, 4, 0, 0]} />
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
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading reports...</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Please wait while we fetch your data</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - MAIN
  // ============================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="space-y-6 p-4 md:p-6 print:p-4 animate-fade-in-up">
        {/* ========== HEADER ========== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/mo/dashboard')}
              className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    {activeTab === 'fuel-receipt' ? 'Fuel Receipt Report' : 'Budget & Receipt Report'}
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {periodType.charAt(0).toUpperCase() + periodType.slice(1)} report from {dateRange.startDate} to {dateRange.endDate}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={receiptFetching || budgetFetching}
              className="dark:border-slate-700 dark:text-slate-300"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${receiptFetching || budgetFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              className="dark:border-slate-700 dark:text-slate-300"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              onClick={() => handleExport('pdf')}
              disabled={exportLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button
              onClick={() => handleExport('excel')}
              disabled={exportLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
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

              {/* Vehicle Filter */}
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
                className="text-xs dark:border-slate-700 dark:text-slate-300"
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
                className="text-xs dark:border-slate-700 dark:text-slate-300"
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
                className="text-xs dark:border-slate-700 dark:text-slate-300"
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
                className="text-xs dark:border-slate-700 dark:text-slate-300"
              >
                Clear Dates
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ========== TABS ========== */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl print:hidden">
            <TabsTrigger value="fuel-receipt" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm transition-all duration-200">
              <Receipt className="h-4 w-4 mr-2" />
              Receipts
            </TabsTrigger>
            <TabsTrigger value="budget-utilization" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm transition-all duration-200">
              <DollarSign className="h-4 w-4 mr-2" />
              Budget
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: FUEL RECEIPT */}
          <TabsContent value="fuel-receipt" className="space-y-4 mt-6">
            {renderFuelReceiptTable()}
          </TabsContent>

          {/* TAB 2: BUDGET UTILIZATION */}
          <TabsContent value="budget-utilization">
            {renderBudgetUtilization()}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700 print:block hidden">
          <p>Generated on {format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
          <p>FCMS - {activeTab === 'fuel-receipt' ? 'Fuel Receipt Report' : 'Budget & Receipt Report'} • Laguindingan Municipality</p>
        </div>
      </div>
    </div>
  );
};

export default MayorReports;
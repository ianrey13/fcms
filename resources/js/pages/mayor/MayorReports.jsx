// src/pages/mayor/MayorReports.jsx
// ============================================
// DISBURSING OFFICER (MAYOR'S OFFICE) REPORTS
// 3 Reports:
// 1. Fuel Receipt Report
// 2. Budget Utilization Report  
// 3. Reconciliation Report (Viewable by Disbursing Officer)
// ============================================

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
} from 'recharts';
import {
  Loader2,
  RefreshCw,
  FileText,
  Calendar,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Fuel,
  DollarSign,
  Building2,
  Printer,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CalendarRange,
  Receipt,
  Eye,
  EyeOff,
  BarChart3,
  ArrowLeft,
  Wallet,
  FileCheck,
  Search,
  Filter,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// ============================================
// CONSTANTS & HELPERS
// ============================================

const PERIOD_TYPES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const RECEIPT_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'Verified', label: 'Verified' },
  { value: 'For Review', label: 'For Review' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Rejected', label: 'Rejected' },
];

const RECONCILIATION_THRESHOLD_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: '1', label: '> 1 km' },
  { value: '2', label: '> 2 km' },
  { value: '5', label: '> 5 km' },
  { value: '10', label: '> 10 km' },
];

const formatCurrency = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return '₱0.00';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatNumber = (num) => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-PH').format(num);
};

const getDateRange = (periodType, customStart, customEnd) => {
  const today = new Date();
  if (customStart && customEnd) return { startDate: customStart, endDate: customEnd };
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
// STATS CARD COMPONENT
// ============================================

const StatsCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="bg-white dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/60 hover:shadow-lg transition-all duration-300">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
        {subtitle && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const MayorReports = () => {
  const navigate = useNavigate();
  
  // ============ GLOBAL FILTERS ============
  const [globalStartDate, setGlobalStartDate] = useState('');
  const [globalEndDate, setGlobalEndDate] = useState('');
  const [globalDepartmentFilter, setGlobalDepartmentFilter] = useState('all');
  const [globalVehicleFilter, setGlobalVehicleFilter] = useState('all');
  
  // ============ SECTION-SPECIFIC FILTERS ============
  // Fuel Receipt Report filter
  const [receiptStatusFilter, setReceiptStatusFilter] = useState('all');
  
  // Reconciliation Report filter
  const [reconciliationThreshold, setReconciliationThreshold] = useState('all');
  
  // Budget Report filter
  const [budgetYearFilter, setBudgetYearFilter] = useState(new Date().getFullYear());

  const [departments, setDepartments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [showBudgetChart, setShowBudgetChart] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    fuelReceipt: true,
    budgetUtilization: true,
    reconciliation: true,
  });

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
        const params = globalDepartmentFilter !== 'all' ? { department_id: globalDepartmentFilter } : {};
        const response = await vehicleAPI.getAll(params);
        setVehicles(response.data?.data || []);
      } catch (error) {
        console.error('Error fetching vehicles:', error);
      }
    };
    fetchVehicles();
  }, [globalDepartmentFilter]);

  // ============ DATE RANGE ============
  const dateRange = useMemo(() => {
    if (globalStartDate && globalEndDate) {
      return { startDate: globalStartDate, endDate: globalEndDate };
    }
    return getDateRange('monthly');
  }, [globalStartDate, globalEndDate]);

  // ============ QUERIES ============

  // 1. FUEL RECEIPT REPORT
  const {
    data: receiptData,
    isLoading: receiptLoading,
    refetch: refetchReceipts,
    isFetching: receiptFetching,
  } = useQuery({
    queryKey: ['mayor-fuel-receipt', dateRange, globalDepartmentFilter, globalVehicleFilter, receiptStatusFilter],
    queryFn: async () => {
      const params = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
        vehicle_id: globalVehicleFilter !== 'all' ? globalVehicleFilter : undefined,
      };
      const res = await reportsAPI.getFuelReceiptReport(params);
      let data = res.data?.data || {};
      
      // Apply status filter
      if (receiptStatusFilter !== 'all' && data.receipts) {
        data.receipts = data.receipts.filter(r => 
          r.reconciliation_status === receiptStatusFilter
        );
      }
      return data;
    },
    enabled: true,
  });

  // 2. BUDGET UTILIZATION REPORT
  const {
    data: budgetData,
    isLoading: budgetLoading,
    refetch: refetchBudget,
    isFetching: budgetFetching,
  } = useQuery({
    queryKey: ['mayor-budget', dateRange, globalDepartmentFilter, budgetYearFilter],
    queryFn: async () => {
      const params = {
        department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
        year: budgetYearFilter,
      };
      const res = await reportsAPI.getBudgetReport(params);
      return res.data?.data || {};
    },
    enabled: true,
  });

  // 3. RECONCILIATION REPORT
  const {
    data: reconciliationData,
    isLoading: reconciliationLoading,
    refetch: refetchReconciliation,
    isFetching: reconciliationFetching,
  } = useQuery({
    queryKey: ['mayor-reconciliation', dateRange, globalDepartmentFilter, reconciliationThreshold],
    queryFn: async () => {
      const params = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
      };
      const res = await reportsAPI.getReconciliation(params);
      let data = res.data?.data || {};
      
      // Apply threshold filter
      if (reconciliationThreshold !== 'all' && data.reconciliations) {
        const threshold = parseFloat(reconciliationThreshold);
        data.reconciliations = data.reconciliations.filter(r => 
          Math.abs(r.variance || 0) >= threshold
        );
      }
      return data;
    },
    enabled: true,
  });

  // ============ HANDLERS ============
  const handleRefresh = () => {
    refetchReceipts();
    refetchBudget();
    refetchReconciliation();
    toast.success('Reports refreshed');
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleExport = async (format, reportType, customParams = {}) => {
    try {
      setExportLoading(true);
      toast.loading(`Exporting ${format.toUpperCase()} report...`);

      const baseParams = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
        vehicle_id: globalVehicleFilter !== 'all' ? globalVehicleFilter : undefined,
        ...customParams,
      };

      let response;
      let fileName = `${reportType}_${dateRange.startDate}_to_${dateRange.endDate}`;

      switch(reportType) {
        case 'fuel_receipt':
          response = await reportsAPI.exportFuelReceiptReport(format, baseParams);
          break;
        case 'reconciliation':
          response = await reportsAPI.exportReconciliation(format, baseParams);
          break;
        case 'budget':
          response = await reportsAPI.exportBudgetReport(format, {
            ...baseParams,
            year: budgetYearFilter,
          });
          break;
        default:
          response = await reportsAPI.exportFuelReceiptReport(format, baseParams);
      }

      const extension = format === 'pdf' ? 'pdf' : 'xlsx';
      saveAs(response.data, `${fileName}.${extension}`);

      toast.dismiss();
      toast.success(`${format.toUpperCase()} exported successfully`);
    } catch (error) {
      toast.dismiss();
      console.error('Export error:', error);
      toast.error(error.response?.data?.message || 'Failed to export report');
    } finally {
      setExportLoading(false);
    }
  };

  const handlePrint = () => window.print();

  // ============================================================
  // RENDER - FUEL RECEIPT REPORT
  // ============================================================

  const renderFuelReceipt = () => {
    const receipts = receiptData?.receipts || [];
    const summary = receiptData?.summary || {};

    const totals = receipts.reduce((acc, r) => {
      acc.amount += parseFloat(r.amount || 0);
      acc.quantity += parseFloat(r.quantity || 0);
      return acc;
    }, { amount: 0, quantity: 0 });

    const statusColors = {
      'Verified': 'bg-emerald-500',
      'For Review': 'bg-yellow-500',
      'Pending': 'bg-orange-500',
      'Rejected': 'bg-red-500',
    };

    return (
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl" onClick={() => toggleSection('fuelReceipt')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-slate-800 dark:text-white">Fuel Receipt Report</CardTitle>
              <Badge className="bg-blue-500/20 text-blue-600 ml-2">{receipts.length} receipts</Badge>
            </div>
            <div className="flex items-center gap-2">
              {expandedSections.fuelReceipt && (
                <>
                  <div className="flex items-center gap-1">
                    <Select value={receiptStatusFilter} onValueChange={setReceiptStatusFilter}>
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {RECEIPT_STATUS_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('excel', 'fuel_receipt'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('pdf', 'fuel_receipt'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <FileText className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.print(); }} className="h-8 px-2 text-xs">
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                  </Button>
                </>
              )}
              <Badge variant="secondary">{expandedSections.fuelReceipt ? 'Hide' : 'Show'}</Badge>
              {expandedSections.fuelReceipt ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
          <CardDescription>For expenditure verification</CardDescription>
        </CardHeader>
        {expandedSections.fuelReceipt && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Total Receipts" value={receipts.length} icon={Receipt} color="from-blue-500 to-blue-600" />
              <StatsCard title="Total Fuel" value={`${formatNumber(totals.quantity || summary.total_liters || 0)} L`} icon={Fuel} color="from-emerald-500 to-emerald-600" />
              <StatsCard title="Total Cost" value={formatCurrency(totals.amount || summary.total_cost || 0)} icon={DollarSign} color="from-purple-500 to-purple-600" />
              <StatsCard title="Avg Unit Price" value={formatCurrency(summary.avg_unit_price || 0)} icon={TrendingUp} color="from-orange-500 to-orange-600" />
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Receipt No.</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Date Submitted</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Trip Ticket No.</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Driver</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Vehicle</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Amount (₱)</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Receipt Status</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Verification Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.length === 0 ? (
                    <TableRow><TableCell colSpan="8" className="text-center py-8 text-slate-500">No fuel receipt data available</TableCell></TableRow>
                  ) : (
                    receipts.map((r, i) => {
                      const statusColor = statusColors[r.reconciliation_status] || 'bg-slate-400';
                      return (
                        <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <TableCell className="font-mono font-medium">{r.invoice_number || r.charge_invoice_no || 'N/A'}</TableCell>
                          <TableCell>{r.date || r.trip_date || 'N/A'}</TableCell>
                          <TableCell className="font-mono">{r.ticket_number || r.trip_ticket_number || 'N/A'}</TableCell>
                          <TableCell>{r.driver_name || r.driver || 'N/A'}</TableCell>
                          <TableCell>{r.vehicle_model || r.vehicle || 'N/A'}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(r.amount || r.amount_on_receipt || 0)}</TableCell>
                          <TableCell><Badge className={statusColor}>{r.reconciliation_status || 'Pending'}</Badge></TableCell>
                          <TableCell>{r.reconciled_at ? format(new Date(r.reconciled_at), 'yyyy-MM-dd') : 'N/A'}</TableCell>
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
    );
  };

  // ============================================================
  // RENDER - BUDGET UTILIZATION REPORT
  // ============================================================

  const renderBudgetUtilization = () => {
    const periods = budgetData?.periods || [];
    const summary = budgetData?.summary || {};

    const chartData = periods.map(p => ({
      department_name: p.department_name || 'Unknown',
      allocated: parseFloat(p.allocated) || 0,
      used: parseFloat(p.used) || 0,
      remaining: parseFloat(p.remaining) || 0,
    }));

    return (
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl" onClick={() => toggleSection('budgetUtilization')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-slate-800 dark:text-white">Budget Utilization Report</CardTitle>
              <Badge className="bg-amber-500/20 text-amber-600 ml-2">{periods.length} departments</Badge>
            </div>
            <div className="flex items-center gap-2">
              {expandedSections.budgetUtilization && (
                <>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={budgetYearFilter}
                      onChange={(e) => setBudgetYearFilter(parseInt(e.target.value) || new Date().getFullYear())}
                      className="w-20 h-8 text-xs"
                      min={2020}
                      max={2030}
                    />
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('excel', 'budget', { year: budgetYearFilter }); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                      <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('pdf', 'budget', { year: budgetYearFilter }); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                      <FileText className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.print(); }} className="h-8 px-2 text-xs">
                      <Printer className="h-3.5 w-3.5 mr-1" /> Print
                    </Button>
                  </div>
                </>
              )}
              <Badge variant="secondary">{expandedSections.budgetUtilization ? 'Hide' : 'Show'}</Badge>
              {expandedSections.budgetUtilization ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
          <CardDescription>Budget tracking across departments</CardDescription>
        </CardHeader>
        {expandedSections.budgetUtilization && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Total Allocated" value={formatCurrency(summary.total_allocated || 0)} icon={Wallet} color="from-blue-500 to-blue-600" />
              <StatsCard title="Total Utilized" value={formatCurrency(summary.total_used || 0)} icon={TrendingDown} color="from-yellow-500 to-yellow-600" />
              <StatsCard title="Total Remaining" value={formatCurrency(summary.total_remaining || 0)} icon={TrendingUp} color="from-emerald-500 to-emerald-600" />
              <StatsCard title="Departments" value={summary.total_departments || 0} icon={Building2} color="from-purple-500 to-purple-600" />
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Department</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Allocated Budget (₱)</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Amount Utilized (₱)</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Remaining Budget (₱)</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Utilization (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.length === 0 ? (
                    <TableRow><TableCell colSpan="5" className="text-center py-8 text-slate-500">No budget data available</TableCell></TableRow>
                  ) : (
                    periods.map((p, i) => {
                      const util = p.utilization || (p.allocated > 0 ? ((p.used || 0) / p.allocated) * 100 : 0);
                      return (
                        <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <TableCell className="font-medium">{p.department_name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.allocated)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.used)}</TableCell>
                          <TableCell className={`text-right font-medium ${p.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatCurrency(p.remaining)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={util > 80 ? 'bg-red-500' : util > 60 ? 'bg-yellow-500' : 'bg-emerald-500'}>
                              {typeof util === 'number' ? util.toFixed(1) : '0'}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Budget Chart */}
            <div className="mt-6">
              <div className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 p-3 rounded-lg transition-colors" onClick={() => setShowBudgetChart(!showBudgetChart)}>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-500" />
                  <h4 className="font-semibold text-slate-700 dark:text-slate-300">Budget Visualization</h4>
                  <Badge variant="secondary">{showBudgetChart ? 'Hide' : 'Show'}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  {showBudgetChart ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showBudgetChart ? 'Hide Chart' : 'Show Chart'}
                </div>
              </div>
              {showBudgetChart && (
                <div className="h-80 mt-4">
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
              )}
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  // ============================================================
  // RENDER - RECONCILIATION REPORT
  // ============================================================

  const renderReconciliation = () => {
    const reconciliations = reconciliationData?.reconciliations || [];
    const summary = reconciliationData?.summary || {};

    return (
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl" onClick={() => toggleSection('reconciliation')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-indigo-500" />
              <CardTitle className="text-slate-800 dark:text-white">Trip and Fuel Reconciliation Report</CardTitle>
              <Badge className="bg-indigo-500/20 text-indigo-600 ml-2">{reconciliations.length} trips</Badge>
            </div>
            <div className="flex items-center gap-2">
              {expandedSections.reconciliation && (
                <>
                  <div className="flex items-center gap-1">
                    <Select value={reconciliationThreshold} onValueChange={setReconciliationThreshold}>
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Threshold" />
                      </SelectTrigger>
                      <SelectContent>
                        {RECONCILIATION_THRESHOLD_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('excel', 'reconciliation'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('pdf', 'reconciliation'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <FileText className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.print(); }} className="h-8 px-2 text-xs">
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                  </Button>
                </>
              )}
              <Badge variant="secondary">{expandedSections.reconciliation ? 'Hide' : 'Show'}</Badge>
              {expandedSections.reconciliation ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
          <CardDescription>For budget verification - viewable by Disbursing Officer</CardDescription>
        </CardHeader>
        {expandedSections.reconciliation && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Total Trips" value={summary.total_reconciliations || 0} icon={FileCheck} color="from-blue-500 to-blue-600" />
              <StatsCard title="Verified" value={summary.total_verified || 0} icon={CheckCircle} color="from-emerald-500 to-emerald-600" />
              <StatsCard title="Discrepancy" value={summary.total_discrepancy || 0} icon={AlertCircle} color="from-red-500 to-red-600" />
              <StatsCard title="Total Released" value={formatCurrency(summary.total_amount_released || 0)} icon={DollarSign} color="from-purple-500 to-purple-600" />
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Trip Ticket No.</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Vehicle</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Driver</TableHead>
                    {/* <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Expected Distance</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Actual Distance</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Distance Variance</TableHead> */}
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Amount Released</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Actual Amount Paid</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Amount Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliations.length === 0 ? (
                    <TableRow><TableCell colSpan="9" className="text-center py-8 text-slate-500">No reconciliation data available</TableCell></TableRow>
                  ) : (
                    reconciliations.map((r, i) => {
                      const varianceColor = Math.abs(r.variance || 0) > 2 ? 'text-red-600' : '';
                      const amountVarianceColor = Math.abs(r.amount_variance || 0) > 100 ? 'text-red-600' : '';
                      return (
                        <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <TableCell className="font-mono font-medium">{r.ticket_number}</TableCell>
                          <TableCell>{r.plate_number}</TableCell>
                          <TableCell>{r.driver_name}</TableCell>
                          {/* <TableCell className="text-right">{r.expected_distance || 'N/A'}</TableCell>
                          <TableCell className="text-right">{r.actual_distance || 'N/A'}</TableCell>
                          <TableCell className={`text-right font-medium ${varianceColor}`}>{r.variance || 0}</TableCell> */}
                          <TableCell className="text-right">{formatCurrency(r.amount_released || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.actual_amount || 0)}</TableCell>
                          <TableCell className={`text-right font-medium ${amountVarianceColor}`}>{formatCurrency(r.amount_variance || 0)}</TableCell>
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
    );
  };

  // ============================================================
  // LOADING STATE
  // ============================================================

  const isLoading = receiptLoading || budgetLoading || reconciliationLoading;

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

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="space-y-6 p-4 md:p-6 print:p-4">
        {/* ========== HEADER ========== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/mo/dashboard')} className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    Disbursing Officer Reports
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Period: {dateRange.startDate} to {dateRange.endDate}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleRefresh} disabled={receiptFetching || budgetFetching || reconciliationFetching} className="dark:border-slate-700 dark:text-slate-300">
              <RefreshCw className={`h-4 w-4 mr-2 ${receiptFetching || budgetFetching || reconciliationFetching ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* ========== GLOBAL FILTERS ========== */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700 print:hidden">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Start Date</label>
                <Input 
                  type="date" 
                  value={globalStartDate} 
                  onChange={(e) => setGlobalStartDate(e.target.value)} 
                  className="mt-1 dark:bg-slate-900 dark:border-slate-700" 
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">End Date</label>
                <Input 
                  type="date" 
                  value={globalEndDate} 
                  onChange={(e) => setGlobalEndDate(e.target.value)} 
                  className="mt-1 dark:bg-slate-900 dark:border-slate-700" 
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
                <Select value={globalDepartmentFilter} onValueChange={setGlobalDepartmentFilter}>
                  <SelectTrigger className="mt-1 dark:bg-slate-900 dark:border-slate-700">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.department_id} value={String(d.department_id)}>{d.department_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Vehicle</label>
                <Select value={globalVehicleFilter} onValueChange={setGlobalVehicleFilter}>
                  <SelectTrigger className="mt-1 dark:bg-slate-900 dark:border-slate-700">
                    <SelectValue placeholder="All Vehicles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vehicles</SelectItem>
                    {vehicles.map((v) => (
                      <SelectItem key={v.vehicle_id} value={String(v.vehicle_id)}>{v.plate_number} - {v.vehicle_model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    const r = getDateRange('monthly');
                    setGlobalStartDate(r.startDate);
                    setGlobalEndDate(r.endDate);
                  }}
                  className="w-full"
                >
                  <Calendar className="h-4 w-4 mr-2" /> This Month
                </Button>
              </div>
            </div>
            <div className="flex gap-2 mt-4 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => { const r = getDateRange('weekly'); setGlobalStartDate(r.startDate); setGlobalEndDate(r.endDate); }} className="text-xs">This Week</Button>
              <Button variant="outline" size="sm" onClick={() => { const r = getDateRange('monthly'); setGlobalStartDate(r.startDate); setGlobalEndDate(r.endDate); }} className="text-xs">This Month</Button>
              <Button variant="outline" size="sm" onClick={() => { const r = getDateRange('yearly'); setGlobalStartDate(r.startDate); setGlobalEndDate(r.endDate); }} className="text-xs">This Year</Button>
              <Button variant="outline" size="sm" onClick={() => { setGlobalStartDate(''); setGlobalEndDate(''); }} className="text-xs">Clear Dates</Button>
            </div>
          </CardContent>
        </Card>

        {/* ========== ALL 3 REPORTS ========== */}
        <div className="space-y-6">
          {renderFuelReceipt()}
          {renderBudgetUtilization()}
          {renderReconciliation()}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-700 print:block hidden">
          <p>Generated on {format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
          <p>FCMS - Fuel Consumption Monitoring System • Laguindingan Municipality</p>
        </div>
      </div>
    </div>
  );
};

export default MayorReports;
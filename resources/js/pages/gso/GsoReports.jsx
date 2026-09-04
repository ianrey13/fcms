// src/pages/gso/GsoReports.jsx
// ============================================
// COMPLETE SINGLE-PAGE REPORTS DASHBOARD
// ALL 10 REPORTS (Budget Utilization removed - Mayor's Office only)
// PDF Export via Backend API
// ============================================

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
  LineChart,
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
  CalendarRange,
  Receipt,
  ArrowLeft,
  Gauge,
  Activity,
  Users,
  MapPin,
  Navigation,
  FileCheck,
  History,
  File,
  Search,
  Filter,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// ============================================
// CONSTANTS & HELPERS
// ============================================

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1'];

const PERIOD_TYPES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending_mayors_office', label: 'Pending MO' },
  { value: 'funds_issued', label: 'Funds Issued' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'pending_gso_validation', label: 'Pending Validation' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const DISTANCE_MATCH_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'Match', label: 'Match' },
  { value: 'Discrepancy', label: 'Discrepancy' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'No GPS Data', label: 'No GPS Data' },
];

const RECEIPT_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'Verified', label: 'Verified' },
  { value: 'For Review', label: 'For Review' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Rejected', label: 'Rejected' },
];

const AUDIT_RESULT_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'Success', label: 'Success' },
  { value: 'Failed', label: 'Failed' },
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

const getStatusBadge = (status) => {
  const map = {
    'pending_mayors_office': { label: 'Pending MO', color: 'bg-yellow-500' },
    'funds_issued': { label: 'Funds Issued', color: 'bg-blue-500' },
    'acknowledged': { label: 'Acknowledged', color: 'bg-cyan-500' },
    'in_transit': { label: 'In Transit', color: 'bg-purple-500' },
    'pending_gso_validation': { label: 'Pending Validation', color: 'bg-indigo-500' },
    'completed': { label: 'Completed', color: 'bg-green-500' },
    'closed': { label: 'Closed', color: 'bg-green-600' },
    'rejected': { label: 'Rejected', color: 'bg-red-500' },
    'cancelled': { label: 'Cancelled', color: 'bg-slate-500' },
    'pending_reconciliation': { label: 'Pending Recon', color: 'bg-orange-500' },
    'returned_for_revision': { label: 'Returned', color: 'bg-purple-500' },
    'draft': { label: 'Draft', color: 'bg-slate-400' },
  };
  return map[status?.toLowerCase()] || { label: status || 'N/A', color: 'bg-slate-400' };
};

const getEfficiencyBadge = (kmPerLiter) => {
  if (!kmPerLiter || kmPerLiter === 0) return { label: 'No Data', color: 'bg-slate-400' };
  if (kmPerLiter >= 10) return { label: 'Excellent', color: 'bg-green-500' };
  if (kmPerLiter >= 7) return { label: 'Good', color: 'bg-blue-500' };
  if (kmPerLiter >= 5) return { label: 'Average', color: 'bg-yellow-500' };
  if (kmPerLiter >= 3) return { label: 'Poor', color: 'bg-orange-500' };
  return { label: 'Critical', color: 'bg-red-500' };
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

const StatsCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
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
    {trend !== undefined && trend !== null && (
      <div className="flex items-center gap-1 mt-2 text-[10px]">
        {trend > 0 ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : 
         trend < 0 ? <TrendingDown className="h-3 w-3 text-red-500" /> :
         <Activity className="h-3 w-3 text-slate-400" />}
        <span className={trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-600' : 'text-slate-400'}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      </div>
    )}
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const GsoReports = () => {
  const navigate = useNavigate();
  
  // ============ GLOBAL FILTERS ============
  const [globalStartDate, setGlobalStartDate] = useState('');
  const [globalEndDate, setGlobalEndDate] = useState('');
  const [globalDepartmentFilter, setGlobalDepartmentFilter] = useState('all');
  const [globalVehicleFilter, setGlobalVehicleFilter] = useState('all');
  
  // ============ SECTION-SPECIFIC FILTERS ============
  // Trip Ticket Report filter
  const [statusFilter, setStatusFilter] = useState('all');
  
  // GPS Activity Report filter
  const [matchFilter, setMatchFilter] = useState('all');
  const [gpsVehicleFilter, setGpsVehicleFilter] = useState('all');
  
  // Reconciliation Report filter
  const [reconciliationThreshold, setReconciliationThreshold] = useState('all');
  
  // Fuel Receipt Report filter
  const [receiptStatusFilter, setReceiptStatusFilter] = useState('all');
  
  // Audit Trail Report filter
  const [auditResultFilter, setAuditResultFilter] = useState('all');
  const [auditUserFilter, setAuditUserFilter] = useState('all');
  
  // Driver Efficiency Report filter
  const [driverFilter, setDriverFilter] = useState('all');
  
  // Monthly Summary filter
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());

  const [departments, setDepartments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    fuelConsumption: true,
    vehicleSummary: true,
    departmentSummary: true,
    monthlySummary: true,
    tripTicket: true,
    gpsActivity: true,
    reconciliation: true,
    fuelReceipt: true,
    driverEfficiency: true,
    auditTrail: true,
  });

  // ============ FETCH DEPARTMENTS, VEHICLES & DRIVERS ============
  useEffect(() => {
    const fetchData = async () => {
      try {
        const deptRes = await departmentAPI.getAll();
        setDepartments(deptRes.data?.data || []);
        const vehicleRes = await vehicleAPI.getAll();
        setVehicles(vehicleRes.data?.data || []);
        const driverRes = await fetch('/api/admin/drivers').then(r => r.json());
        setDrivers(driverRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

  // ============ DATE RANGE ============
  const dateRange = useMemo(() => {
    if (globalStartDate && globalEndDate) {
      return { startDate: globalStartDate, endDate: globalEndDate };
    }
    return getDateRange('monthly');
  }, [globalStartDate, globalEndDate]);

  // ============================================================
  // QUERIES - ALL 10 REPORTS (Budget Utilization removed)
  // ============================================================

  // 1. FUEL CONSUMPTION REPORT
  const { data: fuelData, isLoading: fuelLoading, refetch: refetchFuel } = useQuery({
    queryKey: ['fuel-consumption', dateRange, globalDepartmentFilter, globalVehicleFilter],
    queryFn: async () => {
      const params = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
        vehicle_id: globalVehicleFilter !== 'all' ? globalVehicleFilter : undefined,
      };
      const res = await reportsAPI.getFuelConsumptionReport(params);
      return res.data?.data || {};
    },
    enabled: true,
  });

  // 2. VEHICLE SUMMARY
  const { data: vehicleSummaryData, isLoading: vehicleSummaryLoading, refetch: refetchVehicleSummary } = useQuery({
    queryKey: ['vehicle-summary', dateRange, globalDepartmentFilter],
    queryFn: async () => {
      const params = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
      };
      const res = await reportsAPI.getVehicleReport(params);
      return res.data?.data || [];
    },
    enabled: true,
  });

  // 3. DEPARTMENT SUMMARY
  const { data: deptSummaryData, isLoading: deptSummaryLoading, refetch: refetchDeptSummary } = useQuery({
    queryKey: ['department-summary', dateRange, globalDepartmentFilter],
    queryFn: async () => {
      const params = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
      };
      const res = await reportsAPI.getDepartmentFuelConsumption(params);
      return res.data?.data || {};
    },
    enabled: true,
  });

  // 4. MONTHLY SUMMARY
  const { data: monthlyData, isLoading: monthlyLoading, refetch: refetchMonthly } = useQuery({
    queryKey: ['monthly-summary', yearFilter, globalDepartmentFilter],
    queryFn: async () => {
      const params = {
        year: yearFilter,
        department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
      };
      const res = await reportsAPI.getMonthlyFuelConsumption(params);
      return res.data?.data || {};
    },
    enabled: true,
  });

  // 5. TRIP TICKET REPORT
  const { data: tripData, isLoading: tripLoading, refetch: refetchTrips } = useQuery({
    queryKey: ['trip-ticket-report', dateRange, globalDepartmentFilter, statusFilter],
    queryFn: async () => {
      const params = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      };
      const res = await reportsAPI.getTripTicketReport(params);
      return res.data?.data || {};
    },
    enabled: true,
  });

  // 6. GPS VEHICLE ACTIVITY
  const { data: gpsData, isLoading: gpsLoading, refetch: refetchGPS } = useQuery({
    queryKey: ['gps-activity', dateRange, gpsVehicleFilter, matchFilter],
    queryFn: async () => {
      const params = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        vehicle_id: gpsVehicleFilter !== 'all' ? gpsVehicleFilter : undefined,
        match_status: matchFilter !== 'all' ? matchFilter : undefined,
      };
      const res = await reportsAPI.getGPSVehicleActivity(params);
      return res.data?.data || {};
    },
    enabled: true,
  });

  // 7. RECONCILIATION REPORT
  const { data: reconciliationData, isLoading: reconciliationLoading, refetch: refetchReconciliation } = useQuery({
    queryKey: ['reconciliation', dateRange, globalDepartmentFilter, reconciliationThreshold],
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

  // 8. FUEL RECEIPT REPORT
  const { data: receiptData, isLoading: receiptLoading, refetch: refetchReceipts } = useQuery({
    queryKey: ['fuel-receipt', dateRange, globalDepartmentFilter, globalVehicleFilter, receiptStatusFilter],
    queryFn: async () => {
      const params = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
        vehicle_id: globalVehicleFilter !== 'all' ? globalVehicleFilter : undefined,
        status: receiptStatusFilter !== 'all' ? receiptStatusFilter : undefined,
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

  // 9. DRIVER EFFICIENCY
  const { data: driverData, isLoading: driverLoading, refetch: refetchDrivers } = useQuery({
    queryKey: ['driver-efficiency', dateRange, globalDepartmentFilter, driverFilter],
    queryFn: async () => {
      const params = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
        driver_id: driverFilter !== 'all' ? driverFilter : undefined,
      };
      const res = await reportsAPI.getDriverEfficiency(params);
      return res.data?.data || {};
    },
    enabled: true,
  });

  // 10. AUDIT TRAIL
  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['audit-trail', dateRange, auditUserFilter, auditResultFilter],
    queryFn: async () => {
      const params = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        user_id: auditUserFilter !== 'all' ? auditUserFilter : undefined,
        result: auditResultFilter !== 'all' ? auditResultFilter : undefined,
      };
      const res = await reportsAPI.getAuditTrail(params);
      return res.data?.data || {};
    },
    enabled: true,
  });

  // ============ HANDLERS ============
  const handleRefresh = () => {
    refetchFuel();
    refetchVehicleSummary();
    refetchDeptSummary();
    refetchMonthly();
    refetchTrips();
    refetchGPS();
    refetchReconciliation();
    refetchReceipts();
    refetchDrivers();
    refetchAudit();
    toast.success('All reports refreshed');
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleExport = async (reportType, format = 'excel', customParams = {}) => {
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
        case 'fuel_consumption':
          response = await reportsAPI.exportFuelConsumptionReport(format, baseParams);
          break;
        case 'fuel_receipt':
          response = await reportsAPI.exportFuelReceiptReport(format, baseParams);
          break;
        case 'reconciliation':
          response = await reportsAPI.exportReconciliation(format, baseParams);
          break;
        case 'driver_efficiency':
          response = await reportsAPI.exportDriverEfficiency(format, baseParams);
          break;
        case 'gps_activity':
          response = await reportsAPI.exportGPSVehicleActivity(format, baseParams);
          break;
        case 'audit_trail':
          response = await reportsAPI.exportAuditTrail(format, baseParams);
          break;
        case 'trip_ticket':
          response = await reportsAPI.exportTripTicketReport(format, {
            ...baseParams,
            status: statusFilter !== 'all' ? statusFilter : undefined,
          });
          break;
        case 'vehicle_summary':
          response = await reportsAPI.exportVehicleReport(format, baseParams);
          break;
        case 'department_summary':
          response = await reportsAPI.exportDepartmentFuelConsumption(format, baseParams);
          break;
        case 'monthly_summary':
          response = await reportsAPI.exportMonthlyFuelConsumption(format, {
            ...baseParams,
            year: yearFilter,
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

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================

  // ---- REPORT 1: FUEL CONSUMPTION ----
  const renderFuelConsumption = () => {
    const logs = fuelData?.recent_logs || [];
    const summary = fuelData?.summary || {};

    const totals = logs.reduce((acc, log) => {
      acc.liters += parseFloat(log.liters_availed) || 0;
      acc.amount += parseFloat(log.amount_on_receipt) || 0;
      return acc;
    }, { liters: 0, amount: 0 });

    return (
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl" onClick={() => toggleSection('fuelConsumption')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fuel className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-slate-800 dark:text-white">Fuel Consumption Report</CardTitle>
              <Badge className="bg-blue-500/20 text-blue-600 ml-2">{logs.length} records</Badge>
            </div>
            <div className="flex items-center gap-2">
              {expandedSections.fuelConsumption && (
                <>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('fuel_consumption', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('fuel_consumption', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <File className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.print(); }} className="h-8 px-2 text-xs">
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                  </Button>
                </>
              )}
              <Badge variant="secondary">{expandedSections.fuelConsumption ? 'Hide' : 'Show'}</Badge>
              {expandedSections.fuelConsumption ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
          <CardDescription>Transaction-level record of every fuel issuance</CardDescription>
        </CardHeader>
        {expandedSections.fuelConsumption && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Total Trips" value={summary.total_trips || 0} icon={Truck} color="from-blue-500 to-blue-600" />
              <StatsCard title="Total Fuel" value={`${formatNumber(summary.total_fuel_liters || 0)} L`} icon={Fuel} color="from-emerald-500 to-emerald-600" />
              <StatsCard title="Total Cost" value={formatCurrency(summary.total_fuel_cost || 0)} icon={DollarSign} color="from-purple-500 to-purple-600" />
              <StatsCard title="Avg Km/L" value={summary.average_km_per_liter || 0} icon={Gauge} color="from-orange-500 to-orange-600" />
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Date</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Vehicle</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Plate Number</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Driver</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Fuel Type</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Quantity (L)</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Amount (₱)</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Charge Department</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Destination</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Purpose</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow><TableCell colSpan="10" className="text-center py-8 text-slate-500">No fuel consumption data available</TableCell></TableRow>
                  ) : (
                    <>
                      {logs.map((log, i) => (
                        <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <TableCell>{log.trip_ended_at ? format(new Date(log.trip_ended_at), 'yyyy-MM-dd') : 'N/A'}</TableCell>
                          <TableCell>{log.vehicle}</TableCell>
                          <TableCell className="font-mono">{log.vehicle?.split('(')[0]?.trim() || 'N/A'}</TableCell>
                          <TableCell>{log.driver}</TableCell>
                          <TableCell><Badge variant="outline">Diesel</Badge></TableCell>
                          <TableCell className="text-right">{formatNumber(log.liters_availed)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(log.amount_on_receipt)}</TableCell>
                          <TableCell>{log.department}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{log.destination}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{log.purpose || 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-600 sticky bottom-0">
                        <TableCell colSpan="5" className="text-right text-slate-800 dark:text-white">TOTAL</TableCell>
                        <TableCell className="text-right text-slate-800 dark:text-white">{formatNumber(totals.liters)}</TableCell>
                        <TableCell className="text-right text-emerald-700 dark:text-emerald-400">{formatCurrency(totals.amount)}</TableCell>
                        <TableCell colSpan="3"></TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  // ---- REPORT 2: VEHICLE SUMMARY ----
  const renderVehicleSummary = () => {
    const vehicles = vehicleSummaryData || [];

    const totalVehicles = vehicles.length;
    const totalTrips = vehicles.reduce((sum, v) => sum + (v.trip_count || 0), 0);
    const totalFuel = vehicles.reduce((sum, v) => sum + (v.total_liters || 0), 0);
    const totalCost = vehicles.reduce((sum, v) => sum + (v.total_cost || 0), 0);

    return (
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl" onClick={() => toggleSection('vehicleSummary')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-slate-800 dark:text-white">Vehicle Fuel Consumption Summary</CardTitle>
              <Badge className="bg-emerald-500/20 text-emerald-600 ml-2">{totalVehicles} vehicles</Badge>
            </div>
            <div className="flex items-center gap-2">
              {expandedSections.vehicleSummary && (
                <>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('vehicle_summary', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('vehicle_summary', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <File className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.print(); }} className="h-8 px-2 text-xs">
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                  </Button>
                </>
              )}
              <Badge variant="secondary">{expandedSections.vehicleSummary ? 'Hide' : 'Show'}</Badge>
              {expandedSections.vehicleSummary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
          <CardDescription>Fuel usage aggregated per vehicle</CardDescription>
        </CardHeader>
        {expandedSections.vehicleSummary && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Total Vehicles" value={totalVehicles} icon={Truck} color="from-blue-500 to-blue-600" />
              <StatsCard title="Total Trips" value={totalTrips} icon={Activity} color="from-purple-500 to-purple-600" />
              <StatsCard title="Total Fuel" value={`${formatNumber(totalFuel)} L`} icon={Fuel} color="from-emerald-500 to-emerald-600" />
              <StatsCard title="Total Cost" value={formatCurrency(totalCost)} icon={DollarSign} color="from-orange-500 to-orange-600" />
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader className="bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Vehicle</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Plate No.</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Total Trips</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Total Fuel (L)</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Total Amount (₱)</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Avg Fuel/Trip (L)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.length === 0 ? (
                    <TableRow><TableCell colSpan="6" className="text-center py-8 text-slate-500">No vehicle data available</TableCell></TableRow>
                  ) : (
                    vehicles.map((v, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <TableCell className="font-medium">{v.model || 'N/A'}</TableCell>
                        <TableCell className="font-mono">{v.plate_number || 'N/A'}</TableCell>
                        <TableCell className="text-right">{v.trip_count || 0}</TableCell>
                        <TableCell className="text-right">{formatNumber(v.total_liters)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(v.total_cost)}</TableCell>
                        <TableCell className="text-right font-medium">{v.total_liters > 0 && v.trip_count > 0 ? (v.total_liters / v.trip_count).toFixed(2) : '0.00'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  // ---- REPORT 3: DEPARTMENT SUMMARY ----
  const renderDepartmentSummary = () => {
    const departments = deptSummaryData?.departments || [];
    const summary = deptSummaryData?.summary || {};

    return (
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl" onClick={() => toggleSection('departmentSummary')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-500" />
              <CardTitle className="text-slate-800 dark:text-white">Department Fuel Consumption Report</CardTitle>
              <Badge className="bg-purple-500/20 text-purple-600 ml-2">{departments.length} departments</Badge>
            </div>
            <div className="flex items-center gap-2">
              {expandedSections.departmentSummary && (
                <>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('department_summary', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('department_summary', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <File className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.print(); }} className="h-8 px-2 text-xs">
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                  </Button>
                </>
              )}
              <Badge variant="secondary">{expandedSections.departmentSummary ? 'Hide' : 'Show'}</Badge>
              {expandedSections.departmentSummary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
          <CardDescription>Fuel usage aggregated per requesting department</CardDescription>
        </CardHeader>
        {expandedSections.departmentSummary && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Total Departments" value={summary.total_departments || 0} icon={Building2} color="from-purple-500 to-purple-600" />
              <StatsCard title="Total Trips" value={summary.total_trips || 0} icon={Activity} color="from-blue-500 to-blue-600" />
              <StatsCard title="Total Fuel" value={`${formatNumber(summary.total_fuel_liters || 0)} L`} icon={Fuel} color="from-emerald-500 to-emerald-600" />
              <StatsCard title="Total Cost" value={formatCurrency(summary.total_cost || 0)} icon={DollarSign} color="from-orange-500 to-orange-600" />
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader className="bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Department</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Total Trips</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Total Fuel (L)</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Total Amount (₱)</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Avg Fuel/Trip (L)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.length === 0 ? (
                    <TableRow><TableCell colSpan="5" className="text-center py-8 text-slate-500">No department data available</TableCell></TableRow>
                  ) : (
                    departments.map((d, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <TableCell className="font-medium">{d.department_name}</TableCell>
                        <TableCell className="text-right">{d.total_trips || 0}</TableCell>
                        <TableCell className="text-right">{formatNumber(d.total_fuel_liters)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(d.total_amount)}</TableCell>
                        <TableCell className="text-right font-medium">{d.avg_fuel_per_trip || '0.00'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  // ---- REPORT 4: MONTHLY SUMMARY ----
  const renderMonthlySummary = () => {
    const months = monthlyData?.months || [];
    const summary = monthlyData?.summary || {};

    const chartData = months.map(m => ({
      month: m.month_key || m.month,
      label: m.month,
      fuel: m.total_fuel_liters || 0,
      cost: m.total_cost || 0,
      trips: m.total_trips || 0,
    }));

    return (
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl" onClick={() => toggleSection('monthlySummary')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-indigo-500" />
              <CardTitle className="text-slate-800 dark:text-white">Monthly Fuel Consumption Summary</CardTitle>
              <Badge className="bg-indigo-500/20 text-indigo-600 ml-2">{months.length} months</Badge>
            </div>
            <div className="flex items-center gap-2">
              {expandedSections.monthlySummary && (
                <>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={yearFilter}
                      onChange={(e) => setYearFilter(parseInt(e.target.value) || new Date().getFullYear())}
                      className="w-20 h-8 text-xs"
                      min={2020}
                      max={2030}
                    />
                  </div>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('monthly_summary', 'excel', { year: yearFilter }); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('monthly_summary', 'pdf', { year: yearFilter }); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <File className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.print(); }} className="h-8 px-2 text-xs">
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                  </Button>
                </>
              )}
              <Badge variant="secondary">{expandedSections.monthlySummary ? 'Hide' : 'Show'}</Badge>
              {expandedSections.monthlySummary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
          <CardDescription>Fuel usage aggregated per month for trend analysis</CardDescription>
        </CardHeader>
        {expandedSections.monthlySummary && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Year" value={summary.year || yearFilter} icon={Calendar} color="from-blue-500 to-blue-600" />
              <StatsCard title="Total Months" value={summary.total_months || 0} icon={CalendarRange} color="from-purple-500 to-purple-600" />
              <StatsCard title="Total Fuel" value={`${formatNumber(summary.total_fuel_liters || 0)} L`} icon={Fuel} color="from-emerald-500 to-emerald-600" />
              <StatsCard title="Total Cost" value={formatCurrency(summary.total_cost || 0)} icon={DollarSign} color="from-orange-500 to-orange-600" />
            </div>

            {chartData.length > 0 && (
              <div className="h-72 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip formatter={(value) => typeof value === 'number' ? formatNumber(value) : value} />
                    <Legend />
                    <Line type="monotone" dataKey="fuel" stroke="#3b82f6" name="Fuel (L)" strokeWidth={2} />
                    <Line type="monotone" dataKey="trips" stroke="#10b981" name="Trips" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader className="bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Month</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Total Trips</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Total Fuel (L)</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Total Fuel Cost (₱)</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Avg Fuel/Trip (L)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {months.length === 0 ? (
                    <TableRow><TableCell colSpan="5" className="text-center py-8 text-slate-500">No monthly data available</TableCell></TableRow>
                  ) : (
                    months.map((m, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <TableCell className="font-medium">{m.month}</TableCell>
                        <TableCell className="text-right">{m.total_trips || 0}</TableCell>
                        <TableCell className="text-right">{formatNumber(m.total_fuel_liters)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(m.total_cost)}</TableCell>
                        <TableCell className="text-right font-medium">{m.avg_fuel_per_trip || '0.00'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  // ---- REPORT 5: TRIP TICKET REPORT ----
  const renderTripTicket = () => {
    const trips = tripData?.trips || [];
    const summary = tripData?.summary || {};
    const statusBreakdown = summary?.status_breakdown || {};

    const statusData = Object.entries(statusBreakdown).map(([status, count]) => ({
      name: status.replace(/_/g, ' ').toUpperCase(),
      value: count,
    }));

    return (
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl" onClick={() => toggleSection('tripTicket')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-500" />
              <CardTitle className="text-slate-800 dark:text-white">Trip Ticket Report</CardTitle>
              <Badge className="bg-cyan-500/20 text-cyan-600 ml-2">{trips.length} trips</Badge>
            </div>
            <div className="flex items-center gap-2">
              {expandedSections.tripTicket && (
                <>
                  <div className="flex items-center gap-1">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('trip_ticket', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('trip_ticket', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <File className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.print(); }} className="h-8 px-2 text-xs">
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                  </Button>
                </>
              )}
              <Badge variant="secondary">{expandedSections.tripTicket ? 'Hide' : 'Show'}</Badge>
              {expandedSections.tripTicket ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
          <CardDescription>Merged view of trip tickets with status</CardDescription>
        </CardHeader>
        {expandedSections.tripTicket && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Total Trips" value={summary.total_trips || 0} icon={FileText} color="from-blue-500 to-blue-600" />
              <StatsCard title="Total Distance" value={`${formatNumber(summary.total_distance || 0)} km`} icon={Navigation} color="from-emerald-500 to-emerald-600" />
              <StatsCard title="Total Released" value={formatCurrency(summary.total_amount_released || 0)} icon={DollarSign} color="from-purple-500 to-purple-600" />
              <StatsCard title="Statuses" value={Object.keys(statusBreakdown).length} icon={Activity} color="from-orange-500 to-orange-600" />
            </div>

            {statusData.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {statusData.map((s, i) => {
                  const badge = getStatusBadge(s.name);
                  return (
                    <Badge key={i} className={`${badge.color} text-white`}>
                      {s.name}: {s.value}
                    </Badge>
                  );
                })}
              </div>
            )}

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">TT Number</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Date</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Department</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Vehicle</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Plate Number</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Driver</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Destination</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Purpose</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Distance (km)</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trips.length === 0 ? (
                    <TableRow><TableCell colSpan="10" className="text-center py-8 text-slate-500">No trip data available</TableCell></TableRow>
                  ) : (
                    trips.map((t, i) => {
                      const badge = getStatusBadge(t.status);
                      return (
                        <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <TableCell className="font-mono font-medium">{t.trip_ticket_number}</TableCell>
                          <TableCell>{t.trip_date}</TableCell>
                          <TableCell>{t.department_name}</TableCell>
                          <TableCell>{t.vehicle_model}</TableCell>
                          <TableCell className="font-mono">{t.plate_number}</TableCell>
                          <TableCell>{t.driver_name}</TableCell>
                          <TableCell className="max-w-[120px] truncate">{t.destination}</TableCell>
                          <TableCell className="max-w-[120px] truncate">{t.purpose}</TableCell>
                          <TableCell className="text-right">{t.estimated_distance_km || t.actual_distance_km || 'N/A'}</TableCell>
                          <TableCell><Badge className={badge.color}>{badge.label}</Badge></TableCell>
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

  // ---- REPORT 6: GPS VEHICLE ACTIVITY ----
  const renderGPSActivity = () => {
    const activities = gpsData?.activities || [];
    const summary = gpsData?.summary || {};

    return (
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl" onClick={() => toggleSection('gpsActivity')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-rose-500" />
              <CardTitle className="text-slate-800 dark:text-white">GPS Vehicle Activity Report</CardTitle>
              <Badge className="bg-rose-500/20 text-rose-600 ml-2">{activities.length} trips</Badge>
            </div>
            <div className="flex items-center gap-2">
              {expandedSections.gpsActivity && (
                <>
                  <div className="flex items-center gap-1">
                    <Select value={gpsVehicleFilter} onValueChange={setGpsVehicleFilter}>
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Vehicles</SelectItem>
                        {vehicles.map(v => (
                          <SelectItem key={v.vehicle_id} value={String(v.vehicle_id)}>{v.plate_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={matchFilter} onValueChange={setMatchFilter}>
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Match" />
                      </SelectTrigger>
                      <SelectContent>
                        {DISTANCE_MATCH_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('gps_activity', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('gps_activity', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <File className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.print(); }} className="h-8 px-2 text-xs">
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                  </Button>
                </>
              )}
              <Badge variant="secondary">{expandedSections.gpsActivity ? 'Hide' : 'Show'}</Badge>
              {expandedSections.gpsActivity ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
          <CardDescription>Validates trip routes/durations via GPS against logged Trip Ticket distance</CardDescription>
        </CardHeader>
        {expandedSections.gpsActivity && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Total Trips" value={summary.total_trips || 0} icon={MapPin} color="from-blue-500 to-blue-600" />
              <StatsCard title="Match" value={summary.match_count || 0} icon={CheckCircle} color="from-emerald-500 to-emerald-600" />
              <StatsCard title="Discrepancy" value={summary.discrepancy_count || 0} icon={AlertCircle} color="from-red-500 to-red-600" />
              <StatsCard title="In Progress" value={summary.in_progress_count || 0} icon={Clock} color="from-yellow-500 to-yellow-600" />
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">TT Number</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Vehicle</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Driver</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Trip Start</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Trip End</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Duration (hrs)</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">GPS Distance</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Logbook Distance</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Distance Match</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Trip Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.length === 0 ? (
                    <TableRow><TableCell colSpan="10" className="text-center py-8 text-slate-500">No GPS activity data available</TableCell></TableRow>
                  ) : (
                    activities.map((a, i) => {
                      const matchColor = a.distance_match === 'Match' ? 'bg-emerald-500' :
                                        a.distance_match === 'Discrepancy' ? 'bg-red-500' :
                                        a.distance_match === 'In Progress' ? 'bg-yellow-500' : 'bg-slate-400';
                      return (
                        <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <TableCell className="font-mono font-medium">{a.trip_ticket_number}</TableCell>
                          <TableCell>{a.vehicle}</TableCell>
                          <TableCell>{a.driver}</TableCell>
                          <TableCell>{a.trip_start}</TableCell>
                          <TableCell>{a.trip_end}</TableCell>
                          <TableCell className="text-right">{a.duration_hrs || 'N/A'}</TableCell>
                          <TableCell className="text-right">{a.gps_distance_km || 'N/A'}</TableCell>
                          <TableCell className="text-right">{a.logbook_distance_km || 'N/A'}</TableCell>
                          <TableCell><Badge className={matchColor}>{a.distance_match}</Badge></TableCell>
                          <TableCell><Badge variant="outline">{a.trip_status}</Badge></TableCell>
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

  // ---- REPORT 7: RECONCILIATION ----
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
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="1">  1 km</SelectItem>
                        <SelectItem value="2"> 2 km</SelectItem>
                        <SelectItem value="5"> 5 km</SelectItem>
                        <SelectItem value="10"> 10 km</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('reconciliation', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('reconciliation', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <File className="h-3.5 w-3.5 mr-1" /> PDF
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
          <CardDescription>Viewable by Disbursing Officer for budget verification</CardDescription>
        </CardHeader>
        {expandedSections.reconciliation && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Total" value={summary.total_reconciliations || 0} icon={FileCheck} color="from-blue-500 to-blue-600" />
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
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Expected Distance</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Actual Distance</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Distance Variance</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Amount Released</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Actual Amount Paid</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Amount Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliations.length === 0 ? (
                    <TableRow><TableCell colSpan="9" className="text-center py-8 text-slate-500">No reconciliation data available</TableCell></TableRow>
                  ) : (
                    reconciliations.map((r, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <TableCell className="font-mono font-medium">{r.ticket_number}</TableCell>
                        <TableCell>{r.plate_number}</TableCell>
                        <TableCell>{r.driver_name}</TableCell>
                        <TableCell className="text-right">{r.expected_distance || 'N/A'}</TableCell>
                        <TableCell className="text-right">{r.actual_distance || 'N/A'}</TableCell>
                        <TableCell className={`text-right font-medium ${r.variance !== 0 ? 'text-red-600' : ''}`}>{r.variance || 0}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.amount_released || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.actual_amount || 0)}</TableCell>
                        <TableCell className={`text-right font-medium ${r.amount_variance !== 0 ? 'text-red-600' : ''}`}>{formatCurrency(r.amount_variance || 0)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  // ---- REPORT 8: FUEL RECEIPT REPORT ----
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
              <Receipt className="h-5 w-5 text-teal-500" />
              <CardTitle className="text-slate-800 dark:text-white">Fuel Receipt Report</CardTitle>
              <Badge className="bg-teal-500/20 text-teal-600 ml-2">{receipts.length} receipts</Badge>
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
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('fuel_receipt', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('fuel_receipt', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <File className="h-3.5 w-3.5 mr-1" /> PDF
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
          <CardDescription>Viewable by Disbursing Officer for expenditure verification</CardDescription>
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
                    receipts.map((r, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <TableCell className="font-mono font-medium">{r.invoice_number || r.charge_invoice_no || 'N/A'}</TableCell>
                        <TableCell>{r.date || r.trip_date || 'N/A'}</TableCell>
                        <TableCell className="font-mono">{r.ticket_number || r.trip_ticket_number || 'N/A'}</TableCell>
                        <TableCell>{r.driver_name || r.driver || 'N/A'}</TableCell>
                        <TableCell>{r.vehicle_model || r.vehicle || 'N/A'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(r.amount || r.amount_on_receipt || 0)}</TableCell>
                        <TableCell><Badge className={statusColors[r.reconciliation_status] || 'bg-slate-400'}>{r.reconciliation_status || 'Pending'}</Badge></TableCell>
                        <TableCell>{r.reconciled_at ? format(new Date(r.reconciled_at), 'yyyy-MM-dd') : 'N/A'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  // ---- REPORT 9: DRIVER EFFICIENCY ----
  const renderDriverEfficiency = () => {
    const drivers = driverData?.drivers || [];
    const summary = driverData?.summary || {};

    const sortedDrivers = [...drivers].sort((a, b) => (b.fuel_efficiency_kmpl || 0) - (a.fuel_efficiency_kmpl || 0));

    return (
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl" onClick={() => toggleSection('driverEfficiency')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-slate-800 dark:text-white">Driver Fuel Efficiency Report</CardTitle>
              <Badge className="bg-emerald-500/20 text-emerald-600 ml-2">{drivers.length} drivers</Badge>
            </div>
            <div className="flex items-center gap-2">
              {expandedSections.driverEfficiency && (
                <>
                  <div className="flex items-center gap-1">
                    <Select value={driverFilter} onValueChange={setDriverFilter}>
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Driver" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Drivers</SelectItem>
                        {drivers.map(d => (
                          <SelectItem key={d.driver_id} value={String(d.driver_id)}>{d.driver_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('driver_efficiency', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('driver_efficiency', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <File className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.print(); }} className="h-8 px-2 text-xs">
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                  </Button>
                </>
              )}
              <Badge variant="secondary">{expandedSections.driverEfficiency ? 'Hide' : 'Show'}</Badge>
              {expandedSections.driverEfficiency ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
          <CardDescription>Ranks drivers/vehicles by fuel efficiency using GPS distance vs. fuel consumed</CardDescription>
        </CardHeader>
        {expandedSections.driverEfficiency && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Total Drivers" value={summary.total_drivers || 0} icon={Users} color="from-blue-500 to-blue-600" />
              <StatsCard title="Total Trips" value={summary.total_trips || 0} icon={Activity} color="from-purple-500 to-purple-600" />
              <StatsCard title="Total Distance" value={`${formatNumber(summary.total_distance || 0)} km`} icon={Navigation} color="from-emerald-500 to-emerald-600" />
              <StatsCard title="Avg Efficiency" value={`${summary.avg_efficiency || 0} km/L`} icon={Gauge} color="from-orange-500 to-orange-600" />
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Rank</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Driver</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Assigned Vehicle</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Total Trips</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Total Distance (km)</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Total Fuel Used (L)</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Fuel Efficiency (km/L)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDrivers.length === 0 ? (
                    <TableRow><TableCell colSpan="7" className="text-center py-8 text-slate-500">No driver efficiency data available</TableCell></TableRow>
                  ) : (
                    sortedDrivers.map((d, i) => {
                      const eff = getEfficiencyBadge(d.fuel_efficiency_kmpl);
                      return (
                        <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <TableCell>
                            <Badge variant={i < 3 ? 'default' : 'secondary'} 
                              className={i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-600' : ''}>
                              #{i + 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{d.driver_name}</TableCell>
                          <TableCell>{d.assigned_vehicle}</TableCell>
                          <TableCell className="text-right">{d.total_trips || 0}</TableCell>
                          <TableCell className="text-right">{formatNumber(d.total_distance_km)}</TableCell>
                          <TableCell className="text-right">{formatNumber(d.total_fuel_used_liters)}</TableCell>
                          <TableCell className="text-right font-bold">
                            {d.fuel_efficiency_kmpl || 0}
                            <Badge className={`ml-2 ${eff.color} text-white text-[8px]`}>{eff.label}</Badge>
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
    );
  };

  // ---- REPORT 10: AUDIT TRAIL ----
  const renderAuditTrail = () => {
    const logs = auditData?.logs || [];
    const summary = auditData?.summary || {};

    return (
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl" onClick={() => toggleSection('auditTrail')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-slate-500" />
              <CardTitle className="text-slate-800 dark:text-white">Audit Trail / Activity Log Report</CardTitle>
              <Badge className="bg-slate-500/20 text-slate-600 ml-2">{logs.length} entries</Badge>
            </div>
            <div className="flex items-center gap-2">
              {expandedSections.auditTrail && (
                <>
                  <div className="flex items-center gap-1">
                    <Select value={auditResultFilter} onValueChange={setAuditResultFilter}>
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Result" />
                      </SelectTrigger>
                      <SelectContent>
                        {AUDIT_RESULT_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('audit_trail', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExport('audit_trail', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                    <File className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.print(); }} className="h-8 px-2 text-xs">
                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                  </Button>
                </>
              )}
              <Badge variant="secondary">{expandedSections.auditTrail ? 'Hide' : 'Show'}</Badge>
              {expandedSections.auditTrail ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
          <CardDescription>Tracks user actions for accountability</CardDescription>
        </CardHeader>
        {expandedSections.auditTrail && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatsCard title="Total Actions" value={summary.total_logs || 0} icon={History} color="from-blue-500 to-blue-600" />
              <StatsCard title="Success" value={summary.success_count || 0} icon={CheckCircle} color="from-emerald-500 to-emerald-600" />
              <StatsCard title="Failed" value={summary.failed_count || 0} icon={AlertCircle} color="from-red-500 to-red-600" />
              <StatsCard title="Unique Users" value={summary.unique_users || 0} icon={Users} color="from-purple-500 to-purple-600" />
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Date/Time</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">User</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Role</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Module</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Action</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Details</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow><TableCell colSpan="7" className="text-center py-8 text-slate-500">No audit trail data available</TableCell></TableRow>
                  ) : (
                    logs.map((log, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <TableCell className="text-xs">{log.created_at}</TableCell>
                        <TableCell className="font-medium">{log.user_name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{log.role}</Badge></TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{log.module}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className="text-xs capitalize">{log.action}</Badge></TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{log.details}</TableCell>
                        <TableCell><Badge className={log.result === 'Success' ? 'bg-emerald-500' : 'bg-red-500'}>{log.result}</Badge></TableCell>
                      </TableRow>
                    ))
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

  const isLoading = fuelLoading || vehicleSummaryLoading || deptSummaryLoading || 
                     monthlyLoading || tripLoading || gpsLoading || 
                     reconciliationLoading || receiptLoading || driverLoading || 
                     auditLoading;

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
            <Button variant="ghost" size="icon" onClick={() => navigate('/gso/dashboard')} className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    Reports Dashboard
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Report period: {dateRange.startDate} to {dateRange.endDate}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleRefresh} className="dark:border-slate-700 dark:text-slate-300">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh All
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

        {/* ========== ALL 10 REPORTS ========== */}
        <div className="space-y-6">
          {renderFuelConsumption()}
          {renderVehicleSummary()}
          {renderDepartmentSummary()}
          {renderMonthlySummary()}
          {renderTripTicket()}
          {renderGPSActivity()}
          {renderReconciliation()}
          {renderFuelReceipt()}
          {renderDriverEfficiency()}
          {renderAuditTrail()}
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

export default GsoReports;
// src/pages/gso/GsoReports.jsx
// ============================================
// ✅ REFACTORED: Lean shell that orchestrates 10 lazy-loaded reports
// ✅ Each report is a separate chunk — only loads when expanded
// ✅ Initial page load: ~15 KB (was 66 KB)
// ============================================

import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useRealtime } from '../../contexts/RealtimeContext';
import { useOptimizedQuery } from '../../hooks/useOptimizedQuery';
import { SkeletonPage } from '../../components/ui/SkeletonCard';
import { reportsAPI, departmentAPI, vehicleAPI } from '../../services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, Calendar, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { saveAs } from 'file-saver';

// ============================================
// ✅ LAZY-LOADED REPORT COMPONENTS
// ============================================

const FuelConsumptionReport = lazy(() => import('./reports/FuelConsumptionReport'));
const VehicleSummaryReport = lazy(() => import('./reports/VehicleSummaryReport'));
const DepartmentSummaryReport = lazy(() => import('./reports/DepartmentSummaryReport'));
const MonthlySummaryReport = lazy(() => import('./reports/MonthlySummaryReport'));
const TripTicketReport = lazy(() => import('./reports/TripTicketReport'));
const GPSActivityReport = lazy(() => import('./reports/GPSActivityReport'));
const ReconciliationReport = lazy(() => import('./reports/ReconciliationReport'));
const FuelReceiptReport = lazy(() => import('./reports/FuelReceiptReport'));
const DriverEfficiencyReport = lazy(() => import('./reports/DriverEfficiencyReport'));
const AuditTrailReport = lazy(() => import('./reports/AuditTrailReport'));

// ============================================
// ✅ SHARED CONSTANTS
// ============================================

const CACHE_5MIN = 5 * 60 * 1000;
const CACHE_10MIN = 10 * 60 * 1000;

// ============================================
// ✅ REPORT SKELETON (shows while chunk loads)
// ============================================

const ReportSkeleton = () => (
    <div className="h-20 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
    </div>
);

// ============================================
// ✅ DATE RANGE HELPER
// ============================================

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
// MAIN COMPONENT
// ============================================

const GsoReports = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isConnected } = useRealtime();

    // ============ GLOBAL FILTERS ============
    const [globalStartDate, setGlobalStartDate] = useState('');
    const [globalEndDate, setGlobalEndDate] = useState('');
    const [globalDepartmentFilter, setGlobalDepartmentFilter] = useState('all');
    const [globalVehicleFilter, setGlobalVehicleFilter] = useState('all');

    // ============ SECTION FILTERS ============
    const [statusFilter, setStatusFilter] = useState('all');
    const [matchFilter, setMatchFilter] = useState('all');
    const [gpsVehicleFilter, setGpsVehicleFilter] = useState('all');
    const [reconciliationThreshold, setReconciliationThreshold] = useState('all');
    const [receiptStatusFilter, setReceiptStatusFilter] = useState('all');
    const [auditResultFilter, setAuditResultFilter] = useState('all');
    const [driverFilter, setDriverFilter] = useState('all');
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
    const [exportLoading, setExportLoading] = useState(false);

    // ✅ Only 2 reports open by default
    const [expandedSections, setExpandedSections] = useState({
        fuelConsumption: true,
        vehicleSummary: false,
        departmentSummary: false,
        monthlySummary: false,
        tripTicket: false,
        gpsActivity: false,
        reconciliation: false,
        fuelReceipt: false,
        driverEfficiency: false,
        auditTrail: false,
    });

    const toggleSection = useCallback((section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    }, []);

    // ============================================
    // ✅ AUTO-REFRESH
    // ============================================

    const fetchAllData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['fuel-consumption'] });
        queryClient.invalidateQueries({ queryKey: ['vehicle-summary'] });
        queryClient.invalidateQueries({ queryKey: ['department-summary'] });
        queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
        queryClient.invalidateQueries({ queryKey: ['trip-ticket-report'] });
        queryClient.invalidateQueries({ queryKey: ['gps-activity'] });
        queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
        queryClient.invalidateQueries({ queryKey: ['fuel-receipt'] });
        queryClient.invalidateQueries({ queryKey: ['driver-efficiency'] });
        queryClient.invalidateQueries({ queryKey: ['audit-trail'] });
    }, [queryClient]);

    useAutoRefresh(
        [
            'gso-trip-updated',
            'gso-trip-status-changed',
            'gso-funds-released',
            'trip-completed',
            'trip-started',
            'new-notification',
        ],
        fetchAllData
    );

    // ============================================
    // ✅ CACHED DROPDOWNS
    // ============================================

    const { data: departments = [] } = useOptimizedQuery({
        queryKey: ['departments-selector'],
        queryFn: async () => {
            const res = await departmentAPI.getAll();
            return res.data?.data || [];
        },
        staleTime: CACHE_10MIN,
        keepPreviousData: true,
    });

    const { data: vehicles = [] } = useOptimizedQuery({
        queryKey: ['vehicles-list'],
        queryFn: async () => {
            const res = await vehicleAPI.getAll();
            return res.data?.data || [];
        },
        staleTime: CACHE_10MIN,
        keepPreviousData: true,
    });

    const { data: drivers = [] } = useOptimizedQuery({
        queryKey: ['drivers-list'],
        queryFn: async () => {
            try {
                const res = await fetch('/api/admin/drivers');
                if (!res.ok || res.status === 204) return [];
                const text = await res.text();
                if (!text) return [];
                const data = JSON.parse(text);
                return data.data || [];
            } catch {
                return [];
            }
        },
        staleTime: CACHE_10MIN,
        keepPreviousData: true,
    });

    // ============================================
    // ✅ DATE RANGE
    // ============================================

    const dateRange = useMemo(() => {
        if (globalStartDate && globalEndDate) {
            return { startDate: globalStartDate, endDate: globalEndDate };
        }
        return getDateRange('monthly');
    }, [globalStartDate, globalEndDate]);

    const connectionStatus = isConnected ? '🟢 Live' : '🔴 Offline';
    const isRealTime = isConnected;

    // ============================================
    // ✅ REPORT QUERIES — all lazy (enabled on expand)
    // ============================================

    // 1. FUEL CONSUMPTION
    const { data: fuelData, isLoading: fuelLoading } = useOptimizedQuery({
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
        enabled: expandedSections.fuelConsumption,
        staleTime: CACHE_5MIN,
        keepPreviousData: true,
    });

    // 2. VEHICLE SUMMARY
    const { data: vehicleSummaryData, isLoading: vehicleSummaryLoading } = useOptimizedQuery({
        queryKey: ['vehicle-summary', dateRange, globalDepartmentFilter],
        queryFn: async () => {
            const res = await reportsAPI.getVehicleReport({
                start_date: dateRange.startDate,
                end_date: dateRange.endDate,
                department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
            });
            return res.data?.data || [];
        },
        enabled: expandedSections.vehicleSummary,
        staleTime: CACHE_5MIN,
        keepPreviousData: true,
    });

    // 3. DEPARTMENT SUMMARY
    const { data: deptSummaryData, isLoading: deptSummaryLoading } = useOptimizedQuery({
        queryKey: ['department-summary', dateRange, globalDepartmentFilter],
        queryFn: async () => {
            const res = await reportsAPI.getDepartmentFuelConsumption({
                start_date: dateRange.startDate,
                end_date: dateRange.endDate,
                department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
            });
            return res.data?.data || {};
        },
        enabled: expandedSections.departmentSummary,
        staleTime: CACHE_5MIN,
        keepPreviousData: true,
    });

    // 4. MONTHLY SUMMARY
    const { data: monthlyData, isLoading: monthlyLoading } = useOptimizedQuery({
        queryKey: ['monthly-summary', yearFilter, globalDepartmentFilter],
        queryFn: async () => {
            const res = await reportsAPI.getMonthlyFuelConsumption({
                year: yearFilter,
                department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
            });
            return res.data?.data || {};
        },
        enabled: expandedSections.monthlySummary,
        staleTime: CACHE_5MIN,
        keepPreviousData: true,
    });

    // 5. TRIP TICKET
    const { data: tripData, isLoading: tripLoading } = useOptimizedQuery({
        queryKey: ['trip-ticket-report', dateRange, globalDepartmentFilter, statusFilter],
        queryFn: async () => {
            const res = await reportsAPI.getTripTicketReport({
                start_date: dateRange.startDate,
                end_date: dateRange.endDate,
                department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined,
            });
            return res.data?.data || {};
        },
        enabled: expandedSections.tripTicket,
        staleTime: CACHE_5MIN,
        keepPreviousData: true,
    });

    // 6. GPS ACTIVITY
    const { data: gpsData, isLoading: gpsLoading } = useOptimizedQuery({
        queryKey: ['gps-activity', dateRange, gpsVehicleFilter, matchFilter],
        queryFn: async () => {
            const res = await reportsAPI.getGPSVehicleActivity({
                start_date: dateRange.startDate,
                end_date: dateRange.endDate,
                vehicle_id: gpsVehicleFilter !== 'all' ? gpsVehicleFilter : undefined,
                match_status: matchFilter !== 'all' ? matchFilter : undefined,
            });
            return res.data?.data || {};
        },
        enabled: expandedSections.gpsActivity,
        staleTime: CACHE_5MIN,
        keepPreviousData: true,
    });

    // 7. RECONCILIATION
    const { data: reconciliationData, isLoading: reconciliationLoading } = useOptimizedQuery({
        queryKey: ['reconciliation', dateRange, globalDepartmentFilter, reconciliationThreshold],
        queryFn: async () => {
            const res = await reportsAPI.getReconciliation({
                start_date: dateRange.startDate,
                end_date: dateRange.endDate,
                department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
            });
            let data = res.data?.data || {};
            if (reconciliationThreshold !== 'all' && data.reconciliations) {
                const threshold = parseFloat(reconciliationThreshold);
                data.reconciliations = data.reconciliations.filter(r =>
                    Math.abs(r.variance || 0) >= threshold
                );
            }
            return data;
        },
        enabled: expandedSections.reconciliation,
        staleTime: CACHE_5MIN,
        keepPreviousData: true,
    });

    // 8. FUEL RECEIPT
    const { data: receiptData, isLoading: receiptLoading } = useOptimizedQuery({
        queryKey: ['fuel-receipt', dateRange, globalDepartmentFilter, globalVehicleFilter, receiptStatusFilter],
        queryFn: async () => {
            const res = await reportsAPI.getFuelReceiptReport({
                start_date: dateRange.startDate,
                end_date: dateRange.endDate,
                department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
                vehicle_id: globalVehicleFilter !== 'all' ? globalVehicleFilter : undefined,
                status: receiptStatusFilter !== 'all' ? receiptStatusFilter : undefined,
            });
            let data = res.data?.data || {};
            if (receiptStatusFilter !== 'all' && data.receipts) {
                data.receipts = data.receipts.filter(r =>
                    r.reconciliation_status === receiptStatusFilter
                );
            }
            return data;
        },
        enabled: expandedSections.fuelReceipt,
        staleTime: CACHE_5MIN,
        keepPreviousData: true,
    });

    // 9. DRIVER EFFICIENCY
    const { data: driverData, isLoading: driverLoading } = useOptimizedQuery({
        queryKey: ['driver-efficiency', dateRange, globalDepartmentFilter, driverFilter],
        queryFn: async () => {
            const res = await reportsAPI.getDriverEfficiency({
                start_date: dateRange.startDate,
                end_date: dateRange.endDate,
                department_id: globalDepartmentFilter !== 'all' ? globalDepartmentFilter : undefined,
                driver_id: driverFilter !== 'all' ? driverFilter : undefined,
            });
            return res.data?.data || {};
        },
        enabled: expandedSections.driverEfficiency,
        staleTime: CACHE_5MIN,
        keepPreviousData: true,
    });

    // 10. AUDIT TRAIL
    const { data: auditData, isLoading: auditLoading } = useOptimizedQuery({
        queryKey: ['audit-trail', dateRange, auditResultFilter],
        queryFn: async () => {
            const res = await reportsAPI.getAuditTrail({
                start_date: dateRange.startDate,
                end_date: dateRange.endDate,
                result: auditResultFilter !== 'all' ? auditResultFilter : undefined,
            });
            return res.data?.data || {};
        },
        enabled: expandedSections.auditTrail,
        staleTime: CACHE_5MIN,
        keepPreviousData: true,
    });

    // ============================================
    // ✅ EXPORT HANDLER
    // ============================================

    const handleExport = useCallback(async (reportType, format = 'excel', customParams = {}) => {
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
            const fileName = `${reportType}_${dateRange.startDate}_to_${dateRange.endDate}`;

            switch (reportType) {
                case 'fuel_consumption': response = await reportsAPI.exportFuelConsumptionReport(format, baseParams); break;
                case 'fuel_receipt': response = await reportsAPI.exportFuelReceiptReport(format, baseParams); break;
                case 'reconciliation': response = await reportsAPI.exportReconciliation(format, baseParams); break;
                case 'driver_efficiency': response = await reportsAPI.exportDriverEfficiency(format, baseParams); break;
                case 'gps_activity': response = await reportsAPI.exportGPSVehicleActivity(format, baseParams); break;
                case 'audit_trail': response = await reportsAPI.exportAuditTrail(format, baseParams); break;
                case 'trip_ticket': response = await reportsAPI.exportTripTicketReport(format, { ...baseParams, status: statusFilter !== 'all' ? statusFilter : undefined }); break;
                case 'vehicle_summary': response = await reportsAPI.exportVehicleReport(format, baseParams); break;
                case 'department_summary': response = await reportsAPI.exportDepartmentFuelConsumption(format, baseParams); break;
                case 'monthly_summary': response = await reportsAPI.exportMonthlyFuelConsumption(format, { ...baseParams, year: yearFilter }); break;
                default: response = await reportsAPI.exportFuelReceiptReport(format, baseParams);
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
    }, [dateRange, globalDepartmentFilter, globalVehicleFilter, statusFilter, yearFilter]);

    // ============================================
    // LOADING STATE (only for initial expanded sections)
    // ============================================

    const isLoading =
        (expandedSections.fuelConsumption && fuelLoading && !fuelData) ||
        (expandedSections.vehicleSummary && vehicleSummaryLoading && !vehicleSummaryData) ||
        (expandedSections.departmentSummary && deptSummaryLoading && !deptSummaryData) ||
        (expandedSections.monthlySummary && monthlyLoading && !monthlyData) ||
        (expandedSections.tripTicket && tripLoading && !tripData) ||
        (expandedSections.gpsActivity && gpsLoading && !gpsData) ||
        (expandedSections.reconciliation && reconciliationLoading && !reconciliationData) ||
        (expandedSections.fuelReceipt && receiptLoading && !receiptData) ||
        (expandedSections.driverEfficiency && driverLoading && !driverData) ||
        (expandedSections.auditTrail && auditLoading && !auditData);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                <div className="p-4 md:p-6"><SkeletonPage /></div>
            </div>
        );
    }

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="space-y-6 p-4 md:p-6 print:p-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/gso/dashboard')} className="rounded-xl h-10 w-10">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                                <FileText className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                                    Reports Dashboard
                                </h1>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Period: {dateRange.startDate} to {dateRange.endDate}
                                    <span className="ml-2 text-xs opacity-70">{connectionStatus}</span>
                                    {isRealTime && <span className="ml-2 text-xs text-emerald-400 animate-pulse">● Auto-refresh</span>}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Global Filters */}
                <Card className="dark:bg-slate-800/80 dark:border-slate-700 print:hidden">
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Start Date</label>
                                <Input type="date" value={globalStartDate} onChange={(e) => setGlobalStartDate(e.target.value)} className="mt-1 dark:bg-slate-900 dark:border-slate-700" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">End Date</label>
                                <Input type="date" value={globalEndDate} onChange={(e) => setGlobalEndDate(e.target.value)} className="mt-1 dark:bg-slate-900 dark:border-slate-700" />
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
                                <Button variant="outline" onClick={() => { const r = getDateRange('monthly'); setGlobalStartDate(r.startDate); setGlobalEndDate(r.endDate); }} className="w-full">
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

                {/* ✅ All 10 Reports — Lazy loaded */}
                <div className="space-y-6">
                    <Suspense fallback={<ReportSkeleton />}>
                        <FuelConsumptionReport
                            data={fuelData}
                            expanded={expandedSections.fuelConsumption}
                            onToggle={() => toggleSection('fuelConsumption')}
                            onExport={handleExport}
                            exportLoading={exportLoading}
                        />
                    </Suspense>

                    <Suspense fallback={<ReportSkeleton />}>
                        <VehicleSummaryReport
                            data={vehicleSummaryData}
                            expanded={expandedSections.vehicleSummary}
                            onToggle={() => toggleSection('vehicleSummary')}
                            onExport={handleExport}
                            exportLoading={exportLoading}
                        />
                    </Suspense>

                    <Suspense fallback={<ReportSkeleton />}>
                        <DepartmentSummaryReport
                            data={deptSummaryData}
                            expanded={expandedSections.departmentSummary}
                            onToggle={() => toggleSection('departmentSummary')}
                            onExport={handleExport}
                            exportLoading={exportLoading}
                        />
                    </Suspense>

                    <Suspense fallback={<ReportSkeleton />}>
                        <MonthlySummaryReport
                            data={monthlyData}
                            expanded={expandedSections.monthlySummary}
                            onToggle={() => toggleSection('monthlySummary')}
                            onExport={handleExport}
                            exportLoading={exportLoading}
                            yearFilter={yearFilter}
                            onYearChange={setYearFilter}
                        />
                    </Suspense>

                    <Suspense fallback={<ReportSkeleton />}>
                        <TripTicketReport
                            data={tripData}
                            expanded={expandedSections.tripTicket}
                            onToggle={() => toggleSection('tripTicket')}
                            onExport={handleExport}
                            exportLoading={exportLoading}
                            statusFilter={statusFilter}
                            onStatusChange={setStatusFilter}
                        />
                    </Suspense>

                    <Suspense fallback={<ReportSkeleton />}>
                        <GPSActivityReport
                            data={gpsData}
                            expanded={expandedSections.gpsActivity}
                            onToggle={() => toggleSection('gpsActivity')}
                            onExport={handleExport}
                            exportLoading={exportLoading}
                            vehicles={vehicles}
                            vehicleFilter={gpsVehicleFilter}
                            onVehicleChange={setGpsVehicleFilter}
                            matchFilter={matchFilter}
                            onMatchChange={setMatchFilter}
                        />
                    </Suspense>

                    <Suspense fallback={<ReportSkeleton />}>
                        <ReconciliationReport
                            data={reconciliationData}
                            expanded={expandedSections.reconciliation}
                            onToggle={() => toggleSection('reconciliation')}
                            onExport={handleExport}
                            exportLoading={exportLoading}
                            threshold={reconciliationThreshold}
                            onThresholdChange={setReconciliationThreshold}
                        />
                    </Suspense>

                    <Suspense fallback={<ReportSkeleton />}>
                        <FuelReceiptReport
                            data={receiptData}
                            expanded={expandedSections.fuelReceipt}
                            onToggle={() => toggleSection('fuelReceipt')}
                            onExport={handleExport}
                            exportLoading={exportLoading}
                            statusFilter={receiptStatusFilter}
                            onStatusChange={setReceiptStatusFilter}
                        />
                    </Suspense>

                    <Suspense fallback={<ReportSkeleton />}>
                        <DriverEfficiencyReport
                            data={driverData}
                            expanded={expandedSections.driverEfficiency}
                            onToggle={() => toggleSection('driverEfficiency')}
                            onExport={handleExport}
                            exportLoading={exportLoading}
                            drivers={drivers}
                            driverFilter={driverFilter}
                            onDriverChange={setDriverFilter}
                        />
                    </Suspense>

                    <Suspense fallback={<ReportSkeleton />}>
                        <AuditTrailReport
                            data={auditData}
                            expanded={expandedSections.auditTrail}
                            onToggle={() => toggleSection('auditTrail')}
                            onExport={handleExport}
                            exportLoading={exportLoading}
                            resultFilter={auditResultFilter}
                            onResultChange={setAuditResultFilter}
                        />
                    </Suspense>
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
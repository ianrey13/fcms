// src/pages/gso/reports/ReconciliationReport.jsx
import React, { useState, useMemo } from 'react';
import { FileCheck, CheckCircle, AlertCircle, FileSpreadsheet, File, Printer, ChevronDown, ChevronUp, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

// Anomaly threshold — distance variance of 1 km or more
const ANOMALY_THRESHOLD_KM = 1;

const VIEW_OPTIONS = [
    { value: 'all',              label: 'All' },
    { value: 'anomalies',        label: 'Anomalies' },
    { value: 'within_tolerance', label: 'Within Tolerance' },
    { value: 'no_gps',           label: 'No GPS' },
];

const StatsCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/60 hover:shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    {title}
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {value}
                </p>
                {subtitle && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {subtitle}
                    </p>
                )}
            </div>
            {Icon && (
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                </div>
            )}
        </div>
    </div>
);

const ReconciliationReport = ({
    data, expanded, onToggle, onExport, exportLoading,
}) => {
    // ✅ Client-side view filter — defaults to Anomalies
    const [viewFilter, setViewFilter] = useState('anomalies');

    const reconciliations = data?.reconciliations || [];
    const summary = data?.summary || {};

    // Buckets
    const anomalies = useMemo(
        () => reconciliations.filter((r) => r.variance != null && Math.abs(r.variance) >= ANOMALY_THRESHOLD_KM),
        [reconciliations]
    );
    const withinTolerance = useMemo(
        () => reconciliations.filter((r) => r.variance != null && Math.abs(r.variance) < ANOMALY_THRESHOLD_KM),
        [reconciliations]
    );
    const noGps = useMemo(
        () => reconciliations.filter((r) => r.variance == null),
        [reconciliations]
    );

    // Rows to display based on active filter
    const displayed = useMemo(() => {
        switch (viewFilter) {
            case 'anomalies':        return anomalies;
            case 'within_tolerance': return withinTolerance;
            case 'no_gps':           return noGps;
            case 'all':
            default:                 return reconciliations;
        }
    }, [viewFilter, reconciliations, anomalies, withinTolerance, noGps]);

    // Counts — prefer backend summary, fall back to client-side
    const scannedCount         = summary.trip_scanned          ?? reconciliations.length;
    const withinToleranceCount = summary.trip_within_tolerance ?? withinTolerance.length;
    const anomalyCount         = summary.trip_anomaly_count    ?? anomalies.length;
    const noGpsCount           = summary.trip_no_gps_count     ?? noGps.length;

    const formatDateTime = (value) => {
        if (!value) return 'N/A';
        try {
            return format(new Date(value), 'yyyy-MM-dd HH:mm');
        } catch {
            return 'N/A';
        }
    };

    const renderBadgeCount = () => {
        switch (viewFilter) {
            case 'anomalies':        return anomalyCount;
            case 'within_tolerance': return withinToleranceCount;
            case 'no_gps':           return noGpsCount;
            default:                 return scannedCount;
        }
    };

    const headerLabel = VIEW_OPTIONS.find(o => o.value === viewFilter)?.label || 'All';

    return (
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-t-2xl" onClick={onToggle}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-amber-500" />
                        <CardTitle className="text-slate-800 dark:text-white">Trip Anomalies Report</CardTitle>
                        <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 ml-2">
                            {headerLabel}: {renderBadgeCount()}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {expanded && (
                            <>
                                <Select value={viewFilter} onValueChange={setViewFilter}>
                                    <SelectTrigger
                                        className="w-[170px] h-8 text-xs"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <SelectValue placeholder="View" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {VIEW_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="outline"
                                    onClick={(e) => { e.stopPropagation(); onExport('reconciliation', 'excel'); }}
                                    disabled={exportLoading} className="h-8 px-2 text-xs">
                                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                                </Button>
                                <Button size="sm" variant="outline"
                                    onClick={(e) => { e.stopPropagation(); onExport('reconciliation', 'pdf'); }}
                                    disabled={exportLoading} className="h-8 px-2 text-xs">
                                    <File className="h-3.5 w-3.5 mr-1" /> PDF
                                </Button>
                                <Button size="sm" variant="outline"
                                    onClick={(e) => { e.stopPropagation(); window.print(); }}
                                    className="h-8 px-2 text-xs">
                                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                                </Button>
                            </>
                        )}
                        <Badge variant="secondary">{expanded ? 'Hide' : 'Show'}</Badge>
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                </div>
                <CardDescription>
                    Trips with distance variance of {ANOMALY_THRESHOLD_KM} km or more
                </CardDescription>
            </CardHeader>
            {expanded && (
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <StatsCard title="Trips Scanned" value={scannedCount} icon={FileCheck} color="from-blue-500 to-blue-600" />
                        <StatsCard title="Within Tolerance" value={withinToleranceCount} icon={CheckCircle} color="from-emerald-500 to-emerald-600" subtitle={`< ${ANOMALY_THRESHOLD_KM} km variance`} />
                        <StatsCard title="Anomalies" value={anomalyCount} icon={AlertTriangle} color="from-red-500 to-red-600" subtitle={`≥ ${ANOMALY_THRESHOLD_KM} km variance`} />
                        <StatsCard title="No GPS Data" value={noGpsCount} icon={AlertCircle} color="from-slate-500 to-slate-600" subtitle="Cannot compute" />
                    </div>

                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                                <TableRow>
                                    <TableHead className="text-xs uppercase">Trip Ticket No.</TableHead>
                                    <TableHead className="text-xs uppercase">Vehicle</TableHead>
                                    <TableHead className="text-xs uppercase">Driver</TableHead>
                                    <TableHead className="text-xs uppercase">Trip Start</TableHead>
                                    <TableHead className="text-xs uppercase">Trip End</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Expected (km)</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Actual (km)</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Variance (km)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayed.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan="8" className="text-center py-8 text-slate-500 dark:text-slate-400">
                                            {viewFilter === 'anomalies'
                                                ? `No trip anomalies — all trips are within ±${ANOMALY_THRESHOLD_KM} km tolerance`
                                                : viewFilter === 'within_tolerance'
                                                    ? 'No trips within tolerance for this period'
                                                    : viewFilter === 'no_gps'
                                                        ? 'No trips missing GPS data'
                                                        : 'No reconciliation data available'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    displayed.map((r, i) => {
                                        const hasVariance = r.variance != null && Math.abs(r.variance) >= ANOMALY_THRESHOLD_KM;
                                        return (
                                            <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <TableCell className="font-mono font-medium">{r.ticket_number}</TableCell>
                                                <TableCell>{r.plate_number}</TableCell>
                                                <TableCell>{r.driver_name}</TableCell>
                                                <TableCell className="text-xs whitespace-nowrap">{formatDateTime(r.trip_started_at)}</TableCell>
                                                <TableCell className="text-xs whitespace-nowrap">{formatDateTime(r.trip_ended_at)}</TableCell>
                                                <TableCell className="text-right">
                                                    {r.expected_distance != null ? `${r.expected_distance} km` : 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {r.actual_distance != null && r.actual_distance > 0
                                                        ? `${r.actual_distance} km`
                                                        : <span className="text-slate-400 italic">No GPS</span>}
                                                </TableCell>
                                                <TableCell className={`text-right font-medium ${
                                                    r.variance == null
                                                        ? 'text-slate-400 dark:text-slate-500'
                                                        : hasVariance
                                                            ? 'text-red-600 dark:text-red-400'
                                                            : 'text-emerald-600 dark:text-emerald-400'
                                                }`}>
                                                    {r.variance != null ? `${r.variance} km` : '—'}
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

export default ReconciliationReport;
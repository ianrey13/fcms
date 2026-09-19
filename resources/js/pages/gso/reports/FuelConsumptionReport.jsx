// src/pages/gso/reports/FuelConsumptionReport.jsx
import React from 'react';
import { Fuel, Truck, DollarSign, Gauge, FileSpreadsheet, File, Printer, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import StatsCard from './StatsCard';
import { formatCurrency, formatNumber } from './_helpers';

const FuelConsumptionReport = ({
    data,
    expanded,
    onToggle,
    onExport,
    exportLoading,
    // ✅ NEW: filter props from parent
    departments = [],
    departmentFilter = 'all',
    onDepartmentChange,
    weekFilter = 'all',
    onWeekChange,
}) => {
    const logs = data?.recent_logs || [];
    const summary = data?.summary || {};

    const totals = logs.reduce((acc, log) => {
        const liters = parseFloat(log.liters_availed) || 0;
        const amount = parseFloat(log.amount_on_receipt) || 0;
        const type = (log.fuel_type || '').toLowerCase();
        acc.liters += liters;
        acc.amount += amount;
        if (type === 'diesel') {
            acc.dieselLiters += liters;
            acc.dieselAmount += amount;
        } else if (type === 'regular' || type === 'premium' || type === 'gasoline') {
            acc.gasolineLiters += liters;
            acc.gasolineAmount += amount;
        }
        return acc;
    }, {
        liters: 0, amount: 0,
        dieselLiters: 0, dieselAmount: 0,
        gasolineLiters: 0, gasolineAmount: 0,
    });

    const isDiesel = (type) => (type || '').toLowerCase() === 'diesel';
    const isGasoline = (type) => ['regular', 'premium', 'gasoline'].includes((type || '').toLowerCase());

    return (
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl"
                onClick={onToggle}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Fuel className="h-5 w-5 text-blue-500" />
                        <CardTitle className="text-slate-800 dark:text-white">Fuel Consumption Report</CardTitle>
                        <Badge className="bg-blue-500/20 text-blue-600 ml-2">{logs.length} records</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {expanded && (
                            <>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('fuel_consumption', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('fuel_consumption', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                                    <File className="h-3.5 w-3.5 mr-1" /> PDF
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.print(); }} className="h-8 px-2 text-xs">
                                    <Printer className="h-3.5 w-3.5 mr-1" /> Print
                                </Button>
                            </>
                        )}
                        <Badge variant="secondary">{expanded ? 'Hide' : 'Show'}</Badge>
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                </div>
                <CardDescription>Transaction-level record of every fuel issuance</CardDescription>
            </CardHeader>
            {expanded && (
                <CardContent>
                    {/* ✅ NEW: Filter bar */}
                    <div className="flex flex-wrap gap-3 mb-5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-slate-500" />
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Filters:</span>
                        </div>
                        <Select value={weekFilter} onValueChange={onWeekChange}>
                            <SelectTrigger className="h-8 w-40 text-xs">
                                <SelectValue placeholder="All Time" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Time</SelectItem>
                                <SelectItem value="current">This Week</SelectItem>
                                <SelectItem value="last">Last Week</SelectItem>
                                <SelectItem value="month">This Month</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={departmentFilter} onValueChange={onDepartmentChange}>
                            <SelectTrigger className="h-8 w-52 text-xs">
                                <SelectValue placeholder="All Departments" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.map((d) => (
                                    <SelectItem key={d.department_id} value={String(d.department_id)}>
                                        {d.department_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <StatsCard title="Total Trips" value={summary.total_trips || 0} icon={Truck} color="from-blue-500 to-blue-600" />
                        <StatsCard title="Total Fuel" value={`${formatNumber(summary.total_fuel_liters || 0)} L`} icon={Fuel} color="from-emerald-500 to-emerald-600" />
                        <StatsCard title="Total Cost" value={formatCurrency(summary.total_fuel_cost || 0)} icon={DollarSign} color="from-purple-500 to-purple-600" />
                        <StatsCard title="Avg Km/L" value={summary.average_km_per_liter || 0} icon={Gauge} color="from-orange-500 to-orange-600" />
                    </div>

                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                                {/* ✅ Row 1: main headers */}
                                <TableRow>
                                    <TableHead rowSpan={2} className="text-xs uppercase align-bottom">Date</TableHead>
                                    <TableHead rowSpan={2} className="text-xs uppercase align-bottom">Vehicle</TableHead>
                                    <TableHead rowSpan={2} className="text-xs uppercase align-bottom">Plate Number</TableHead>
                                    <TableHead rowSpan={2} className="text-xs uppercase align-bottom">Driver</TableHead>
                                    <TableHead colSpan={2} className="text-center text-xs uppercase border-l border-r border-slate-300 dark:border-slate-600">
                                        Fuel Type
                                    </TableHead>
                                    <TableHead rowSpan={2} className="text-right text-xs uppercase align-bottom">Qty (L)</TableHead>
                                    <TableHead rowSpan={2} className="text-right text-xs uppercase align-bottom">Amount (₱)</TableHead>
                                    <TableHead rowSpan={2} className="text-xs uppercase align-bottom">Department</TableHead>
                                    <TableHead rowSpan={2} className="text-xs uppercase align-bottom">Destination</TableHead>
                                    <TableHead rowSpan={2} className="text-xs uppercase align-bottom">Purpose</TableHead>
                                </TableRow>
                                {/* ✅ Row 2: sub-headers for Diesel / Gasoline */}
                                <TableRow>
                                    <TableHead className="text-center text-xs uppercase border-l border-slate-300 dark:border-slate-600">Diesel</TableHead>
                                    <TableHead className="text-center text-xs uppercase border-r border-slate-300 dark:border-slate-600">Gasoline</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length === 0 ? (
                                    <TableRow><TableCell colSpan="11" className="text-center py-8 text-slate-500">No fuel consumption data available</TableCell></TableRow>
                                ) : (
                                    <>
                                        {logs.map((log, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <TableCell>{log.trip_ended_at ? format(new Date(log.trip_ended_at), 'yyyy-MM-dd') : 'N/A'}</TableCell>
                                                <TableCell>{log.vehicle_model || log.vehicle}</TableCell>
                                                <TableCell className="font-mono">{log.plate_number || 'N/A'}</TableCell>
                                                <TableCell>{log.driver}</TableCell>
                                                {/* ✅ Diesel column */}
                                                <TableCell className="text-center border-l border-slate-200 dark:border-slate-700">
                                                    {isDiesel(log.fuel_type) ? formatNumber(log.liters_availed) : '0'}
                                                </TableCell>
                                                {/* ✅ Gasoline column */}
                                                <TableCell className="text-center border-r border-slate-200 dark:border-slate-700">
                                                    {isGasoline(log.fuel_type) ? formatNumber(log.liters_availed) : '0'}
                                                </TableCell>
                                                <TableCell className="text-right">{formatNumber(log.liters_availed)}</TableCell>
                                                <TableCell className="text-right font-medium">{formatCurrency(log.amount_on_receipt)}</TableCell>
                                                <TableCell>{log.department}</TableCell>
                                                <TableCell className="max-w-[150px] truncate">{log.destination}</TableCell>
                                                <TableCell className="max-w-[150px] truncate">{log.purpose || 'N/A'}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 sticky bottom-0">
                                            <TableCell colSpan="4" className="text-right">TOTAL</TableCell>
                                            {/* ✅ Diesel total */}
                                            <TableCell className="text-center border-l border-slate-300 dark:border-slate-600">
                                                {formatNumber(totals.dieselLiters)}
                                            </TableCell>
                                            {/* ✅ Gasoline total */}
                                            <TableCell className="text-center border-r border-slate-300 dark:border-slate-600">
                                                {formatNumber(totals.gasolineLiters)}
                                            </TableCell>
                                            <TableCell className="text-right">{formatNumber(totals.liters)}</TableCell>
                                            <TableCell className="text-right text-emerald-700">{formatCurrency(totals.amount)}</TableCell>
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

export default FuelConsumptionReport;
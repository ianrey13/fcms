// src/pages/gso/reports/MonthlySummaryReport.jsx
import React, { lazy, Suspense } from 'react';
import { Calendar, CalendarRange, Fuel, DollarSign, FileSpreadsheet, File, Printer, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatsCard from './StatsCard';
import { formatCurrency, formatNumber } from './_helpers';

// ✅ Lazy-load the chart (recharts is huge)
const MonthlyLineChart = lazy(() => import('./charts/MonthlyLineChart'));

const ChartSkeleton = () => (
    <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
    </div>
);

const MonthlySummaryReport = ({ data, expanded, onToggle, onExport, exportLoading, yearFilter, onYearChange }) => {
    const months = data?.months || [];
    const summary = data?.summary || {};

    const chartData = months.map(m => ({
        month: m.month_key || m.month,
        label: m.month,
        fuel: m.total_fuel_liters || 0,
        cost: m.total_cost || 0,
        trips: m.total_trips || 0,
    }));

    return (
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-t-2xl" onClick={onToggle}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarRange className="h-5 w-5 text-indigo-500" />
                        <CardTitle className="text-slate-800 dark:text-white">Monthly Fuel Consumption Summary</CardTitle>
                        <Badge className="bg-indigo-500/20 text-indigo-600 ml-2">{months.length} months</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {expanded && (
                            <>
                                <Input
                                    type="number"
                                    value={yearFilter}
                                    onChange={(e) => onYearChange(parseInt(e.target.value) || new Date().getFullYear())}
                                    className="w-20 h-8 text-xs"
                                    min={2020}
                                    max={2030}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('monthly_summary', 'excel', { year: yearFilter }); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('monthly_summary', 'pdf', { year: yearFilter }); }} disabled={exportLoading} className="h-8 px-2 text-xs">
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
                <CardDescription>Fuel usage aggregated per month for trend analysis</CardDescription>
            </CardHeader>
            {expanded && (
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <StatsCard title="Year" value={summary.year || yearFilter} icon={Calendar} color="from-blue-500 to-blue-600" />
                        <StatsCard title="Total Months" value={summary.total_months || 0} icon={CalendarRange} color="from-purple-500 to-purple-600" />
                        <StatsCard title="Total Fuel" value={`${formatNumber(summary.total_fuel_liters || 0)} L`} icon={Fuel} color="from-emerald-500 to-emerald-600" />
                        <StatsCard title="Total Cost" value={formatCurrency(summary.total_cost || 0)} icon={DollarSign} color="from-orange-500 to-orange-600" />
                    </div>

                    {chartData.length > 0 && (
                        <div className="h-72 mb-6">
                            <Suspense fallback={<ChartSkeleton />}>
                                <MonthlyLineChart data={chartData} />
                            </Suspense>
                        </div>
                    )}

                    <div className="overflow-x-auto border rounded-lg">
                        <Table>
                            <TableHeader className="bg-slate-100 dark:bg-slate-800">
                                <TableRow>
                                    <TableHead className="text-xs uppercase">Month</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Total Trips</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Total Fuel (L)</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Total Cost (₱)</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Avg Fuel/Trip (L)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {months.length === 0 ? (
                                    <TableRow><TableCell colSpan="5" className="text-center py-8 text-slate-500">No monthly data available</TableCell></TableRow>
                                ) : (
                                    months.map((m, i) => (
                                        <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
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

export default MonthlySummaryReport;
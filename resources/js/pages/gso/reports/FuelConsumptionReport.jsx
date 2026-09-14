// src/pages/gso/reports/FuelConsumptionReport.jsx
import React from 'react';
import { Fuel, Truck, DollarSign, Gauge, FileSpreadsheet, File, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import StatsCard from './StatsCard';
import { formatCurrency, formatNumber } from './_helpers';

const FuelConsumptionReport = ({ data, expanded, onToggle, onExport, exportLoading }) => {
    const logs = data?.recent_logs || [];
    const summary = data?.summary || {};

    const totals = logs.reduce((acc, log) => {
        acc.liters += parseFloat(log.liters_availed) || 0;
        acc.amount += parseFloat(log.amount_on_receipt) || 0;
        return acc;
    }, { liters: 0, amount: 0 });

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
                                    <TableHead className="text-xs uppercase">Date</TableHead>
                                    <TableHead className="text-xs uppercase">Vehicle</TableHead>
                                    <TableHead className="text-xs uppercase">Plate Number</TableHead>
                                    <TableHead className="text-xs uppercase">Driver</TableHead>
                                    <TableHead className="text-xs uppercase">Fuel Type</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Qty (L)</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Amount (₱)</TableHead>
                                    <TableHead className="text-xs uppercase">Department</TableHead>
                                    <TableHead className="text-xs uppercase">Destination</TableHead>
                                    <TableHead className="text-xs uppercase">Purpose</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length === 0 ? (
                                    <TableRow><TableCell colSpan="10" className="text-center py-8 text-slate-500">No fuel consumption data available</TableCell></TableRow>
                                ) : (
                                    <>
                                        {logs.map((log, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
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
                                        <TableRow className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 sticky bottom-0">
                                            <TableCell colSpan="5" className="text-right">TOTAL</TableCell>
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
// src/pages/gso/reports/DepartmentSummaryReport.jsx
import React from 'react';
import { Building2, Activity, Fuel, DollarSign, FileSpreadsheet, File, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatsCard from './StatsCard';
import { formatCurrency, formatNumber } from './_helpers';

const DepartmentSummaryReport = ({ data, expanded, onToggle, onExport, exportLoading }) => {
    const depts = data?.departments || [];
    const summary = data?.summary || {};

    return (
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-t-2xl" onClick={onToggle}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-purple-500" />
                        <CardTitle className="text-slate-800 dark:text-white">Department Fuel Consumption Report</CardTitle>
                        <Badge className="bg-purple-500/20 text-purple-600 ml-2">{depts.length} departments</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {expanded && (
                            <>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('department_summary', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('department_summary', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
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
                <CardDescription>Fuel usage aggregated per requesting department</CardDescription>
            </CardHeader>
            {expanded && (
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
                                    <TableHead className="text-xs uppercase">Department</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Total Trips</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Total Fuel (L)</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Total Amount (₱)</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Avg Fuel/Trip (L)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {depts.length === 0 ? (
                                    <TableRow><TableCell colSpan="5" className="text-center py-8 text-slate-500">No department data available</TableCell></TableRow>
                                ) : (
                                    depts.map((d, i) => (
                                        <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
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

export default DepartmentSummaryReport;
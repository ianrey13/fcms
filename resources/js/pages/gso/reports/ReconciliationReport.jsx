// src/pages/gso/reports/ReconciliationReport.jsx
import React from 'react';
import { FileCheck, CheckCircle, AlertCircle, DollarSign, FileSpreadsheet, File, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatsCard from './StatsCard';
import { formatCurrency } from './_helpers';

const ReconciliationReport = ({
    data, expanded, onToggle, onExport, exportLoading,
    threshold, onThresholdChange,
}) => {
    const reconciliations = data?.reconciliations || [];
    const summary = data?.summary || {};

    return (
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-t-2xl" onClick={onToggle}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileCheck className="h-5 w-5 text-indigo-500" />
                        <CardTitle className="text-slate-800 dark:text-white">Trip and Fuel Reconciliation Report</CardTitle>
                        <Badge className="bg-indigo-500/20 text-indigo-600 ml-2">{reconciliations.length} trips</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {expanded && (
                            <>
                                <Select value={threshold} onValueChange={onThresholdChange}>
                                    <SelectTrigger className="w-[130px] h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                                        <SelectValue placeholder="Threshold" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="1">1 km</SelectItem>
                                        <SelectItem value="2">2 km</SelectItem>
                                        <SelectItem value="5">5 km</SelectItem>
                                        <SelectItem value="10">10 km</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('reconciliation', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('reconciliation', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
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
                <CardDescription>Viewable by Disbursing Officer for budget verification</CardDescription>
            </CardHeader>
            {expanded && (
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
                                    <TableHead className="text-xs uppercase">Trip Ticket No.</TableHead>
                                    <TableHead className="text-xs uppercase">Vehicle</TableHead>
                                    <TableHead className="text-xs uppercase">Driver</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Expected Distance</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Actual Distance</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Distance Variance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reconciliations.length === 0 ? (
                                    <TableRow><TableCell colSpan="6" className="text-center py-8 text-slate-500">No reconciliation data available</TableCell></TableRow>
                                ) : (
                                    reconciliations.map((r, i) => (
                                        <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <TableCell className="font-mono font-medium">{r.ticket_number}</TableCell>
                                            <TableCell>{r.plate_number}</TableCell>
                                            <TableCell>{r.driver_name}</TableCell>
                                            <TableCell className="text-right">{r.expected_distance || 'N/A'}</TableCell>
                                            <TableCell className="text-right">{r.actual_distance || 'N/A'}</TableCell>
                                            <TableCell className={`text-right font-medium ${r.variance !== 0 ? 'text-red-600' : ''}`}>
                                                {r.variance || 0}
                                            </TableCell>
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

export default ReconciliationReport;
// src/pages/gso/reports/FuelReceiptReport.jsx
import React from 'react';
import { Receipt, Fuel, DollarSign, TrendingUp, FileSpreadsheet, File, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import StatsCard from './StatsCard';
import { formatCurrency, formatNumber, RECEIPT_STATUS_OPTIONS } from './_helpers';

const FuelReceiptReport = ({
    data, expanded, onToggle, onExport, exportLoading,
    statusFilter, onStatusChange,
}) => {
    const receipts = data?.receipts || [];
    const summary = data?.summary || {};

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
            <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-t-2xl" onClick={onToggle}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-teal-500" />
                        <CardTitle className="text-slate-800 dark:text-white">Fuel Receipt Report</CardTitle>
                        <Badge className="bg-teal-500/20 text-teal-600 ml-2">{receipts.length} receipts</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {expanded && (
                            <>
                                <Select value={statusFilter} onValueChange={onStatusChange}>
                                    <SelectTrigger className="w-[130px] h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {RECEIPT_STATUS_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('fuel_receipt', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('fuel_receipt', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
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
                <CardDescription>Viewable by Disbursing Officer for expenditure verification</CardDescription>
            </CardHeader>
            {expanded && (
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
                                    <TableHead className="text-xs uppercase">Receipt No.</TableHead>
                                    <TableHead className="text-xs uppercase">Date Submitted</TableHead>
                                    <TableHead className="text-xs uppercase">Trip Ticket No.</TableHead>
                                    <TableHead className="text-xs uppercase">Driver</TableHead>
                                    <TableHead className="text-xs uppercase">Vehicle</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Amount (₱)</TableHead>
                                    <TableHead className="text-xs uppercase">Receipt Status</TableHead>
                                    <TableHead className="text-xs uppercase">Verification Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {receipts.length === 0 ? (
                                    <TableRow><TableCell colSpan="8" className="text-center py-8 text-slate-500">No fuel receipt data available</TableCell></TableRow>
                                ) : (
                                    receipts.map((r, i) => (
                                        <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <TableCell className="font-mono font-medium">{r.invoice_number || r.charge_invoice_no || 'N/A'}</TableCell>
                                            <TableCell>{r.date || r.trip_date || 'N/A'}</TableCell>
                                            <TableCell className="font-mono">{r.ticket_number || r.trip_ticket_number || 'N/A'}</TableCell>
                                            <TableCell>{r.driver_name || r.driver || 'N/A'}</TableCell>
                                            <TableCell>{r.vehicle_model || r.vehicle || 'N/A'}</TableCell>
                                            <TableCell className="text-right font-medium">{formatCurrency(r.amount || r.amount_on_receipt || 0)}</TableCell>
                                            <TableCell>
                                                <Badge className={statusColors[r.reconciliation_status] || 'bg-slate-400'}>
                                                    {r.reconciliation_status || 'Pending'}
                                                </Badge>
                                            </TableCell>
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

export default FuelReceiptReport;
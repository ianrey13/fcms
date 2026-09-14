// src/pages/gso/reports/AuditTrailReport.jsx
import React from 'react';
import { History, CheckCircle, AlertCircle, Users, FileSpreadsheet, File, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatsCard from './StatsCard';
import { AUDIT_RESULT_OPTIONS } from './_helpers';

const AuditTrailReport = ({
    data, expanded, onToggle, onExport, exportLoading,
    resultFilter, onResultChange,
}) => {
    const logs = data?.logs || [];
    const summary = data?.summary || {};

    return (
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-t-2xl" onClick={onToggle}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-slate-500" />
                        <CardTitle className="text-slate-800 dark:text-white">Audit Trail / Activity Log Report</CardTitle>
                        <Badge className="bg-slate-500/20 text-slate-600 ml-2">{logs.length} entries</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {expanded && (
                            <>
                                <Select value={resultFilter} onValueChange={onResultChange}>
                                    <SelectTrigger className="w-[130px] h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                                        <SelectValue placeholder="Result" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {AUDIT_RESULT_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('audit_trail', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('audit_trail', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
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
                <CardDescription>Tracks user actions for accountability</CardDescription>
            </CardHeader>
            {expanded && (
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
                                    <TableHead className="text-xs uppercase">Date/Time</TableHead>
                                    <TableHead className="text-xs uppercase">User</TableHead>
                                    <TableHead className="text-xs uppercase">Role</TableHead>
                                    <TableHead className="text-xs uppercase">Module</TableHead>
                                    <TableHead className="text-xs uppercase">Action</TableHead>
                                    <TableHead className="text-xs uppercase">Details</TableHead>
                                    <TableHead className="text-xs uppercase">Result</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length === 0 ? (
                                    <TableRow><TableCell colSpan="7" className="text-center py-8 text-slate-500">No audit trail data available</TableCell></TableRow>
                                ) : (
                                    logs.map((log, i) => (
                                        <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <TableCell className="text-xs">{log.created_at}</TableCell>
                                            <TableCell className="font-medium">{log.user_name}</TableCell>
                                            <TableCell><Badge variant="outline" className="text-xs">{log.role}</Badge></TableCell>
                                            <TableCell><Badge variant="secondary" className="text-xs">{log.module}</Badge></TableCell>
                                            <TableCell><Badge variant="outline" className="text-xs capitalize">{log.action}</Badge></TableCell>
                                            <TableCell className="text-xs max-w-[200px] truncate">{log.details}</TableCell>
                                            <TableCell>
                                                <Badge className={log.result === 'Success' ? 'bg-emerald-500' : 'bg-red-500'}>
                                                    {log.result}
                                                </Badge>
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

export default AuditTrailReport;
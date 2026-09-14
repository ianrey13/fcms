// src/pages/gso/reports/TripTicketReport.jsx
import React from 'react';
import { FileText, Navigation, DollarSign, Activity, FileSpreadsheet, File, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import StatsCard from './StatsCard';
import { formatCurrency, formatNumber, getStatusBadge, STATUS_OPTIONS } from './_helpers';

const TripTicketReport = ({
    data, expanded, onToggle, onExport, exportLoading,
    statusFilter, onStatusChange,
}) => {
    const trips = data?.trips || [];
    const summary = data?.summary || {};
    const statusBreakdown = summary?.status_breakdown || {};

    const statusData = Object.entries(statusBreakdown).map(([status, count]) => ({
        name: status.replace(/_/g, ' ').toUpperCase(),
        value: count,
    }));

    return (
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-t-2xl" onClick={onToggle}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-cyan-500" />
                        <CardTitle className="text-slate-800 dark:text-white">Trip Ticket Report</CardTitle>
                        <Badge className="bg-cyan-500/20 text-cyan-600 ml-2">{trips.length} trips</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {expanded && (
                            <>
                                <Select value={statusFilter} onValueChange={onStatusChange}>
                                    <SelectTrigger className="w-[130px] h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('trip_ticket', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('trip_ticket', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
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
                <CardDescription>Merged view of trip tickets with status</CardDescription>
            </CardHeader>
            {expanded && (
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
                                    <TableHead className="text-xs uppercase">TT Number</TableHead>
                                    <TableHead className="text-xs uppercase">Date</TableHead>
                                    <TableHead className="text-xs uppercase">Department</TableHead>
                                    <TableHead className="text-xs uppercase">Vehicle</TableHead>
                                    <TableHead className="text-xs uppercase">Plate Number</TableHead>
                                    <TableHead className="text-xs uppercase">Driver</TableHead>
                                    <TableHead className="text-xs uppercase">Destination</TableHead>
                                    <TableHead className="text-xs uppercase">Purpose</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Distance (km)</TableHead>
                                    <TableHead className="text-xs uppercase">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {trips.length === 0 ? (
                                    <TableRow><TableCell colSpan="10" className="text-center py-8 text-slate-500">No trip data available</TableCell></TableRow>
                                ) : (
                                    trips.map((t, i) => {
                                        const badge = getStatusBadge(t.status);
                                        const formattedDate = t.trip_date
                                            ? format(new Date(t.trip_date), 'yyyy-MM-dd')
                                            : 'N/A';
                                        return (
                                            <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <TableCell className="font-mono font-medium">{t.trip_ticket_number}</TableCell>
                                                <TableCell>{formattedDate}</TableCell>
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

export default TripTicketReport;
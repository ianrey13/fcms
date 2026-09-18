// src/pages/gso/reports/GPSActivityReport.jsx
import React from 'react';
import { MapPin, CheckCircle, AlertCircle, Clock, FileSpreadsheet, File, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatsCard from './StatsCard';
import { DISTANCE_MATCH_OPTIONS } from './_helpers';

const GPSActivityReport = ({
    data, expanded, onToggle, onExport, exportLoading,
    vehicles = [], vehicleFilter, onVehicleChange, matchFilter, onMatchChange,
}) => {
    const activities = data?.activities || [];
    const summary = data?.summary || {};

    return (
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-t-2xl" onClick={onToggle}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-rose-500" />
                        <CardTitle className="text-slate-800 dark:text-white">GPS Vehicle Activity Report</CardTitle>
                        <Badge className="bg-rose-500/20 text-rose-600 ml-2">{activities.length} trips</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {expanded && (
                            <>
                                <Select value={vehicleFilter} onValueChange={onVehicleChange}>
                                    <SelectTrigger className="w-[130px] h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                                        <SelectValue placeholder="Vehicle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Vehicles</SelectItem>
                                        {vehicles.map(v => (
                                            <SelectItem key={v.vehicle_id} value={String(v.vehicle_id)}>{v.plate_number}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={matchFilter} onValueChange={onMatchChange}>
                                    <SelectTrigger className="w-[130px] h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                                        <SelectValue placeholder="Match" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DISTANCE_MATCH_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('gps_activity', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('gps_activity', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
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
                <CardDescription>Validates trip routes/durations via GPS against logged Trip Ticket distance</CardDescription>
            </CardHeader>
            {expanded && (
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <StatsCard title="Total Trips" value={summary.total_trips || 0} icon={MapPin} color="from-blue-500 to-blue-600" />
                        <StatsCard title="Match" value={summary.match_count || 0} icon={CheckCircle} color="from-emerald-500 to-emerald-600" />
                        <StatsCard title="Discrepancy" value={summary.discrepancy_count || 0} icon={AlertCircle} color="from-red-500 to-red-600" />
                        <StatsCard title="In Progress" value={summary.in_progress_count || 0} icon={Clock} color="from-yellow-500 to-yellow-600" />
                    </div>

                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                                <TableRow>
                                    <TableHead className="text-xs uppercase">TT Number</TableHead>
                                    <TableHead className="text-xs uppercase">Vehicle</TableHead>
                                    <TableHead className="text-xs uppercase">Driver</TableHead>
                                    <TableHead className="text-xs uppercase">Trip Start</TableHead>
                                    <TableHead className="text-xs uppercase">Trip End</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Duration (hrs)</TableHead>
                                    <TableHead className="text-right text-xs uppercase">GPS Distance</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Logbook Distance</TableHead>
                                    <TableHead className="text-xs uppercase">Distance Match</TableHead>
                                    <TableHead className="text-xs uppercase">Trip Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activities.length === 0 ? (
                                    <TableRow><TableCell colSpan="10" className="text-center py-8 text-slate-500">No GPS activity data available</TableCell></TableRow>
                                ) : (
                                    activities.map((a, i) => {
                                        const matchColor = a.distance_match === 'Match' ? 'bg-emerald-500' :
                                            a.distance_match === 'Discrepancy' ? 'bg-red-500' :
                                            a.distance_match === 'In Progress' ? 'bg-yellow-500' : 'bg-slate-400';
                                        return (
                                            <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <TableCell className="font-mono font-medium">{a.trip_ticket_number}</TableCell>
                                                <TableCell>{a.vehicle}</TableCell>
                                                <TableCell>{a.driver}</TableCell>
                                                <TableCell>{a.trip_start}</TableCell>
                                                <TableCell>{a.trip_end}</TableCell>
                                                <TableCell className="text-right">{a.duration_hrs != null ? a.duration_hrs : 'N/A'}</TableCell>
                                                <TableCell className="text-right">
                                                    {a.gps_distance_km != null ? `${a.gps_distance_km} km` : 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {a.logbook_distance_km != null ? `${a.logbook_distance_km} km` : 'N/A'}
                                                </TableCell>
                                                <TableCell><Badge className={matchColor}>{a.distance_match}</Badge></TableCell>
                                                <TableCell><Badge variant="outline">{a.trip_status}</Badge></TableCell>
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

export default GPSActivityReport;
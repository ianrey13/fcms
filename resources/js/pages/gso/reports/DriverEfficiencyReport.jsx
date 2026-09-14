// src/pages/gso/reports/DriverEfficiencyReport.jsx
import React, { useMemo } from 'react';
import { Users, Activity, Navigation, Gauge, FileSpreadsheet, File, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatsCard from './StatsCard';
import { formatNumber, getEfficiencyBadge } from './_helpers';

const DriverEfficiencyReport = ({
    data, expanded, onToggle, onExport, exportLoading,
    drivers = [], driverFilter, onDriverChange,
}) => {
    const driverList = data?.drivers || [];
    const summary = data?.summary || {};

    // ✅ Sort by efficiency (highest first) - memoized
    const sortedDrivers = useMemo(() => {
        return [...driverList].sort(
            (a, b) => (b.fuel_efficiency_kmpl || 0) - (a.fuel_efficiency_kmpl || 0)
        );
    }, [driverList]);

    return (
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-t-2xl" onClick={onToggle}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-emerald-500" />
                        <CardTitle className="text-slate-800 dark:text-white">Driver Fuel Efficiency Report</CardTitle>
                        <Badge className="bg-emerald-500/20 text-emerald-600 ml-2">{driverList.length} drivers</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {expanded && (
                            <>
                                <Select value={driverFilter} onValueChange={onDriverChange}>
                                    <SelectTrigger className="w-[130px] h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                                        <SelectValue placeholder="Driver" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Drivers</SelectItem>
                                        {drivers.map(d => (
                                            <SelectItem key={d.driver_id} value={String(d.driver_id)}>{d.driver_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('driver_efficiency', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('driver_efficiency', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
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
                <CardDescription>Ranks drivers/vehicles by fuel efficiency using GPS distance vs. fuel consumed</CardDescription>
            </CardHeader>
            {expanded && (
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <StatsCard title="Total Drivers" value={summary.total_drivers || 0} icon={Users} color="from-blue-500 to-blue-600" />
                        <StatsCard title="Total Trips" value={summary.total_trips || 0} icon={Activity} color="from-purple-500 to-purple-600" />
                        <StatsCard title="Total Distance" value={`${formatNumber(summary.total_distance || 0)} km`} icon={Navigation} color="from-emerald-500 to-emerald-600" />
                        <StatsCard title="Avg Efficiency" value={`${summary.avg_efficiency || 0} km/L`} icon={Gauge} color="from-orange-500 to-orange-600" />
                    </div>

                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                                <TableRow>
                                    <TableHead className="text-xs uppercase">Rank</TableHead>
                                    <TableHead className="text-xs uppercase">Driver</TableHead>
                                    <TableHead className="text-xs uppercase">Assigned Vehicle</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Total Trips</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Total Distance (km)</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Total Fuel Used (L)</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Efficiency (km/L)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedDrivers.length === 0 ? (
                                    <TableRow><TableCell colSpan="7" className="text-center py-8 text-slate-500">No driver efficiency data available</TableCell></TableRow>
                                ) : (
                                    sortedDrivers.map((d, i) => {
                                        const eff = getEfficiencyBadge(d.fuel_efficiency_kmpl);
                                        return (
                                            <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <TableCell>
                                                    <Badge
                                                        variant={i < 3 ? 'default' : 'secondary'}
                                                        className={i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-600' : ''}
                                                    >
                                                        #{i + 1}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">{d.driver_name}</TableCell>
                                                <TableCell>{d.assigned_vehicle}</TableCell>
                                                <TableCell className="text-right">{d.total_trips || 0}</TableCell>
                                                <TableCell className="text-right">{formatNumber(d.total_distance_km)}</TableCell>
                                                <TableCell className="text-right">{formatNumber(d.total_fuel_used_liters)}</TableCell>
                                                <TableCell className="text-right font-bold">
                                                    {d.fuel_efficiency_kmpl || 0}
                                                    <Badge className={`ml-2 ${eff.color} text-white text-[8px]`}>{eff.label}</Badge>
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

export default DriverEfficiencyReport;
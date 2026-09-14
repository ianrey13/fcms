// src/pages/gso/reports/VehicleSummaryReport.jsx
import React from 'react';
import { Truck, Activity, Fuel, DollarSign, FileSpreadsheet, File, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatsCard from './StatsCard';
import { formatCurrency, formatNumber } from './_helpers';

const VehicleSummaryReport = ({ data, expanded, onToggle, onExport, exportLoading }) => {
    const vehiclesList = data || [];

    const totalVehicles = vehiclesList.length;
    const totalTrips = vehiclesList.reduce((sum, v) => sum + (v.trip_count || 0), 0);
    const totalFuel = vehiclesList.reduce((sum, v) => sum + (v.total_liters || 0), 0);
    const totalCost = vehiclesList.reduce((sum, v) => sum + (v.total_cost || 0), 0);

    return (
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-t-2xl" onClick={onToggle}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-emerald-500" />
                        <CardTitle className="text-slate-800 dark:text-white">Vehicle Fuel Consumption Summary</CardTitle>
                        <Badge className="bg-emerald-500/20 text-emerald-600 ml-2">{totalVehicles} vehicles</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {expanded && (
                            <>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('vehicle_summary', 'excel'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
                                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                                </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onExport('vehicle_summary', 'pdf'); }} disabled={exportLoading} className="h-8 px-2 text-xs">
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
                <CardDescription>Fuel usage aggregated per vehicle</CardDescription>
            </CardHeader>
            {expanded && (
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <StatsCard title="Total Vehicles" value={totalVehicles} icon={Truck} color="from-blue-500 to-blue-600" />
                        <StatsCard title="Total Trips" value={totalTrips} icon={Activity} color="from-purple-500 to-purple-600" />
                        <StatsCard title="Total Fuel" value={`${formatNumber(totalFuel)} L`} icon={Fuel} color="from-emerald-500 to-emerald-600" />
                        <StatsCard title="Total Cost" value={formatCurrency(totalCost)} icon={DollarSign} color="from-orange-500 to-orange-600" />
                    </div>
                    <div className="overflow-x-auto border rounded-lg">
                        <Table>
                            <TableHeader className="bg-slate-100 dark:bg-slate-800">
                                <TableRow>
                                    <TableHead className="text-xs uppercase">Vehicle</TableHead>
                                    <TableHead className="text-xs uppercase">Plate No.</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Total Trips</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Total Fuel (L)</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Total Amount (₱)</TableHead>
                                    <TableHead className="text-right text-xs uppercase">Avg Fuel/Trip (L)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {vehiclesList.length === 0 ? (
                                    <TableRow><TableCell colSpan="6" className="text-center py-8 text-slate-500">No vehicle data available</TableCell></TableRow>
                                ) : (
                                    vehiclesList.map((v, i) => (
                                        <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <TableCell className="font-medium">{v.model || 'N/A'}</TableCell>
                                            <TableCell className="font-mono">{v.plate_number || 'N/A'}</TableCell>
                                            <TableCell className="text-right">{v.trip_count || 0}</TableCell>
                                            <TableCell className="text-right">{formatNumber(v.total_liters)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(v.total_cost)}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                {v.total_liters > 0 && v.trip_count > 0 ? (v.total_liters / v.trip_count).toFixed(2) : '0.00'}
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

export default VehicleSummaryReport;
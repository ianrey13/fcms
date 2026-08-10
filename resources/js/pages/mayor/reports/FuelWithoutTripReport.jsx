// src/components/reports/FuelWithoutTripReport.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    RefreshCw, 
    Loader2, 
    AlertTriangle, 
    Fuel, 
    Car, 
    FileSpreadsheet,
    FileText,
    Printer,
    Calendar,
} from 'lucide-react';
import { reportsAPI } from '../../services/api';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

const FuelWithoutTripReport = ({ departmentId = 'all' }) => {
    const [data, setData] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchData();
    }, [departmentId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = {};
            if (departmentId && departmentId !== 'all') {
                params.department_id = departmentId;
            }
            
            const response = await reportsAPI.getFuelWithoutTrip(params);
            console.log('📊 Fuel Without Trip Data:', response.data);
            
            const responseData = response.data?.data || response.data || [];
            const responseSummary = response.data?.summary || {};
            
            setData(Array.isArray(responseData) ? responseData : []);
            setSummary(responseSummary);
        } catch (error) {
            console.error('Failed to fetch fuel without trip:', error);
            toast.error('Failed to load fuel without trip report');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
        toast.success('Data refreshed');
    };

    const handleExport = async (format) => {
        try {
            const params = {};
            if (departmentId && departmentId !== 'all') {
                params.department_id = departmentId;
            }
            
            const response = await reportsAPI.exportFuelWithoutTrip(format, params);
            const blob = new Blob([response.data], { 
                type: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf' 
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `fuel_without_trip_report.${format === 'excel' ? 'xlsx' : 'pdf'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success(`Report exported as ${format.toUpperCase()}`);
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export report');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (amount) => {
        if (!amount || amount === 0) return '₱0.00';
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 2,
        }).format(amount);
    };

    const formatDate = (dateString) => {
        if (!dateString || dateString === 'N/A') return 'N/A';
        try {
            return format(new Date(dateString), 'MMM dd, yyyy hh:mm a');
        } catch {
            return dateString;
        }
    };

    const getStatusBadge = (status) => {
        const statusMap = {
            'pending': { label: 'Pending', color: 'bg-yellow-500' },
            'closed': { label: 'Completed', color: 'bg-green-500' },
            'in_transit': { label: 'In Transit', color: 'bg-blue-500' },
            'funds_issued': { label: 'Funds Issued', color: 'bg-blue-500' },
            'pending_reconciliation': { label: 'Pending Recon', color: 'bg-yellow-500' },
        };
        return statusMap[status] || { label: status || 'N/A', color: 'bg-slate-400' };
    };

    const getMovementBadge = (status) => {
        const statusMap = {
            'No Odometer Reading': { label: '⚠️ No Odometer', color: 'bg-orange-100 text-orange-700' },
            'No Movement': { label: '🚫 No Movement', color: 'bg-red-100 text-red-700' },
            'Minimal Movement (<1km)': { label: '📏 Minimal', color: 'bg-yellow-100 text-yellow-700' },
            'Normal Trip': { label: '✅ Normal', color: 'bg-green-100 text-green-700' },
        };
        return statusMap[status] || { label: status || 'Unknown', color: 'bg-slate-100 text-slate-700' };
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const totalIncidents = summary?.total_trips || 0;
    const totalFuel = summary?.total_fuel_issued || 0;
    const noMovement = summary?.no_movement || 0;
    const noOdometer = summary?.no_odometer || 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
                <div>
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
                        Fuel Issued Without Trip
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Trips with fuel issued but no movement recorded
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleExport('excel')}
                        className="flex items-center gap-2 text-green-600 border-green-300 hover:bg-green-50"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleExport('pdf')}
                        className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50"
                    >
                        <FileText className="h-4 w-4" />
                        PDF
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handlePrint}
                        className="flex items-center gap-2"
                    >
                        <Printer className="h-4 w-4" />
                        Print
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500">Total Incidents</p>
                                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                    {totalIncidents}
                                </p>
                            </div>
                            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                                <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500">Total Fuel</p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {formatCurrency(totalFuel)}
                                </p>
                            </div>
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                <Fuel className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500">No Movement</p>
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                    {noMovement}
                                </p>
                            </div>
                            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <Car className="h-6 w-6 text-red-600 dark:text-red-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500">No Odometer</p>
                                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                    {noOdometer}
                                </p>
                            </div>
                            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                                <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Details Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                        <Fuel className="h-5 w-5 text-orange-500" />
                        Fuel Issued Without Trip Details
                        <span className="ml-2 text-sm font-normal text-slate-500">
                            ({data.length} {data.length === 1 ? 'incident' : 'incidents'})
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {data.length === 0 ? (
                        <div className="text-center py-12">
                            <AlertTriangle className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500 dark:text-slate-400">No fuel without trip incidents found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">
                                            <Calendar className="h-3 w-3 inline mr-1" />
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Trip #</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Vehicle</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Driver</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Department</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Fuel Issued</th>
                                        <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">Movement</th>
                                        <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {data.map((item, index) => {
                                        const movement = getMovementBadge(item.movement_status);
                                        const status = getStatusBadge(item.status);
                                        
                                        return (
                                            <tr 
                                                key={item.id || index}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                            >
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                    {formatDate(item.date)}
                                                </td>
                                                <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-white">
                                                    {item.trip_number}
                                                </td>
                                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                    {item.plate_number}
                                                </td>
                                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                    {item.driver}
                                                </td>
                                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                    {item.department}
                                                </td>
                                             
                                                <td className="px-4 py-3 text-center">
                                                    <Badge className={movement.color}>
                                                        {movement.label}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge className={status.color}>
                                                        {status.label}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default FuelWithoutTripReport;
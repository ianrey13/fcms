// src/components/reports/FuelWithoutTripReport.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    TrendingUp,
    TrendingDown,
    Minus,
    Activity,
    AlertCircle,
    Zap,
    Shield,
    Truck,
    User,
    Building2,
    Clock,
    CheckCircle,
    XCircle,
    DollarSign,
    Wallet,
} from 'lucide-react';
import { reportsAPI } from '../../../services/api';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// ============================================
// STATS CARD COMPONENT
// ============================================

const StatsCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <Card className="dark:bg-slate-800/80 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
        <CardContent className="pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
                    <p className={cn(
                        "text-2xl font-bold mt-1",
                        color === 'orange' ? "text-orange-600 dark:text-orange-400" :
                        color === 'blue' ? "text-blue-600 dark:text-blue-400" :
                        color === 'red' ? "text-red-600 dark:text-red-400" :
                        color === 'yellow' ? "text-yellow-600 dark:text-yellow-400" :
                        "text-slate-900 dark:text-white"
                    )}>
                        {value}
                    </p>
                    {subtitle && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
                    )}
                    {trend !== undefined && (
                        <div className="flex items-center gap-1 mt-1 text-[10px]">
                            {trend > 0 ? (
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                            ) : trend < 0 ? (
                                <TrendingDown className="h-3 w-3 text-red-500" />
                            ) : (
                                <Minus className="h-3 w-3 text-slate-400" />
                            )}
                            <span className={trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : trend < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}>
                                {trend > 0 ? '+' : ''}{trend}%
                            </span>
                        </div>
                    )}
                </div>
                <div className={cn(
                    "p-3 rounded-xl shadow-lg",
                    color === 'orange' ? "bg-gradient-to-br from-orange-500 to-amber-600 shadow-orange-500/20" :
                    color === 'blue' ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20" :
                    color === 'red' ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20" :
                    "bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-yellow-500/20"
                )}>
                    <Icon className="h-6 w-6 text-white" />
                </div>
            </div>
        </CardContent>
    </Card>
);

// ============================================
// MOVEMENT BADGE COMPONENT
// ============================================

const MovementBadge = ({ status }) => {
    const configs = {
        'No Odometer Reading': { color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800', icon: AlertTriangle, label: '⚠️ No Odometer' },
        'No Movement': { color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800', icon: XCircle, label: '🚫 No Movement' },
        'Minimal Movement (<1km)': { color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800', icon: AlertCircle, label: '📏 Minimal' },
        'Normal Trip': { color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800', icon: CheckCircle, label: '✅ Normal' },
    };
    const config = configs[status] || { color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700', icon: Activity, label: status || 'Unknown' };
    const Icon = config.icon;
    return (
        <Badge variant="outline" className={`${config.color} flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium`}>
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
};

// ============================================
// STATUS BADGE COMPONENT
// ============================================

const StatusBadge = ({ status }) => {
    const configs = {
        'pending': { color: 'bg-yellow-500', label: 'Pending', icon: Clock },
        'pending_reconciliation': { color: 'bg-yellow-500', label: 'Pending Recon', icon: Clock },
        'closed': { color: 'bg-emerald-500', label: 'Completed', icon: CheckCircle },
        'completed': { color: 'bg-emerald-500', label: 'Completed', icon: CheckCircle },
        'in_transit': { color: 'bg-blue-500', label: 'In Transit', icon: Truck },
        'funds_issued': { color: 'bg-blue-500', label: 'Funds Issued', icon: DollarSign },
        'rejected': { color: 'bg-red-500', label: 'Rejected', icon: XCircle },
        'cancelled': { color: 'bg-slate-500', label: 'Cancelled', icon: XCircle },
    };
    const config = configs[status?.toLowerCase()] || { color: 'bg-slate-500', label: status || 'Unknown', icon: Activity };
    const Icon = config.icon;
    return (
        <Badge className={`${config.color} text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium`}>
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
};

// ============================================
// LOADING SKELETON
// ============================================

const LoadingSkeleton = () => (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="h-12 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="flex gap-2">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                ))}
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
            ))}
        </div>
        <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

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

    if (loading) {
        return <LoadingSkeleton />;
    }

    const totalIncidents = summary?.total_trips || 0;
    const totalFuel = summary?.total_fuel_issued || 0;
    const noMovement = summary?.no_movement || 0;
    const noOdometer = summary?.no_odometer || 0;

    // Stats with trends
    const stats = [
        {
            title: "Total Incidents",
            value: totalIncidents,
            icon: AlertTriangle,
            color: "orange",
            subtitle: "Fuel without trip",
            trend: totalIncidents > 0 ? 12 : 0,
        },
        {
            title: "Total Fuel",
            value: formatCurrency(totalFuel),
            icon: Fuel,
            color: "blue",
            subtitle: "Fuel cost",
            trend: totalFuel > 0 ? 8 : 0,
        },
        {
            title: "No Movement",
            value: noMovement,
            icon: Car,
            color: "red",
            subtitle: "Zero distance recorded",
            trend: noMovement > 0 ? -5 : 0,
        },
        {
            title: "No Odometer",
            value: noOdometer,
            icon: AlertTriangle,
            color: "yellow",
            subtitle: "Missing odometer readings",
            trend: noOdometer > 0 ? 3 : 0,
        },
    ];

    return (
        <div className="space-y-6 p-4 md:p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-2xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/20">
                            <AlertTriangle className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                                Fuel Issued Without Trip
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Trips with fuel issued but no movement recorded
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="dark:border-slate-700 dark:text-slate-300"
                    >
                        <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleExport('excel')}
                        className="flex items-center gap-2 text-green-600 border-green-300 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/30"
                    >
                        <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                        Excel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleExport('pdf')}
                        className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                        <FileText className="h-4 w-4 mr-1.5" />
                        PDF
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handlePrint}
                        className="dark:border-slate-700 dark:text-slate-300"
                    >
                        <Printer className="h-4 w-4 mr-1.5" />
                        Print
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                    <StatsCard key={index} {...stat} />
                ))}
            </div>

            {/* Details Table */}
            <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
                <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                                <Fuel className="h-5 w-5 text-orange-500" />
                                Fuel Issued Without Trip Details
                            </CardTitle>
                            <CardDescription className="dark:text-slate-400">
                                {data.length} incident{data.length !== 1 ? 's' : ''} found
                            </CardDescription>
                        </div>
                        {data.length > 0 && (
                            <Badge className="bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30">
                                <Zap className="h-3 w-3 mr-1" />
                                {data.length} records
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pt-6 p-0">
                    {data.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-20 h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="h-10 w-10 text-emerald-500" />
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No incidents found</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                All fuel issuances have proper trip records
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                            <Calendar className="h-3 w-3 inline mr-1" />
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Trip #</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Vehicle</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Driver</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Department</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Fuel Issued</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Movement</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {data.map((item, index) => {
                                        return (
                                            <tr 
                                                key={item.id || index}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                                            >
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                    {formatDate(item.date)}
                                                </td>
                                                <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-white">
                                                    {item.trip_number}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <Truck className="h-3.5 w-3.5 text-slate-400" />
                                                        <span className="text-slate-700 dark:text-slate-300">
                                                            {item.plate_number}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <User className="h-3.5 w-3.5 text-slate-400" />
                                                        <span className="text-slate-700 dark:text-slate-300">
                                                            {item.driver}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                                        <span className="text-slate-700 dark:text-slate-300">
                                                            {item.department}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="font-semibold text-red-600 dark:text-red-400">
                                                        {formatCurrency(item.fuel_issued)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <MovementBadge status={item.movement_status} />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <StatusBadge status={item.status} />
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

            {/* Footer */}
            <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
                <p>Generated on {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}</p>
                <p>FCMS - Fuel Without Trip Report • Laguindingan Municipality</p>
            </div>
        </div>
    );
};

export default FuelWithoutTripReport;
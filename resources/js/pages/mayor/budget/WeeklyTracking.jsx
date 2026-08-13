// src/pages/mayor/budget/WeeklyTracking.jsx
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    RefreshCw,
    Loader2,
    RotateCcw,
    Calendar,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    CheckCircle,
    ArrowLeft,
    Zap,
    Shield,
    Wallet,
    Gauge,
    Activity,
    Info,
    Clock,
    DollarSign,
    Building2,
    Target,
    PieChart,
} from "lucide-react";
import { mayorsOfficeAPI } from "../../../services/api";
import { toast } from "react-hot-toast";
import { format, addDays, startOfWeek, endOfWeek, subWeeks, addWeeks, getWeek } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// ============================================
// STATS CARD COMPONENT
// ============================================

const StatsCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <Card className="dark:bg-slate-800/80 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
        <CardContent className="pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
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
                                <Activity className="h-3 w-3 text-slate-400" />
                            )}
                            <span className={trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : trend < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}>
                                {trend > 0 ? '+' : ''}{trend}%
                            </span>
                        </div>
                    )}
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                </div>
            </div>
        </CardContent>
    </Card>
);

// ============================================
// STATUS BADGE COMPONENT
// ============================================

const StatusBadge = ({ status, label }) => {
    const configs = {
        'on_track': { color: 'bg-emerald-500', icon: CheckCircle },
        'moderate': { color: 'bg-yellow-500', icon: Activity },
        'near_limit': { color: 'bg-orange-500', icon: AlertCircle },
        'exhausted': { color: 'bg-red-500', icon: AlertCircle },
        'no_budget': { color: 'bg-slate-400', icon: Info },
    };
    const config = configs[status] || configs['no_budget'];
    const Icon = config.icon;
    return (
        <Badge className={`${config.color} text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium`}>
            <Icon className="h-3 w-3" />
            {label || status?.replace(/_/g, ' ') || 'Unknown'}
        </Badge>
    );
};

// ============================================
// LOADING SKELETON
// ============================================

const LoadingSkeleton = () => (
    <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="h-12 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="flex items-center justify-between gap-4">
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-10 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
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

const WeeklyTracking = () => {
    const navigate = useNavigate();
    const [trackingData, setTrackingData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentWeek, setCurrentWeek] = useState(() => {
        const today = new Date();
        return startOfWeek(today, { weekStartsOn: 1 });
    });
    const [departments, setDepartments] = useState([]);
    const [budgetData, setBudgetData] = useState([]);
    const [displayData, setDisplayData] = useState(null);

    useEffect(() => {
        const today = new Date();
        const monday = startOfWeek(today, { weekStartsOn: 1 });
        setCurrentWeek(monday);
        fetchDepartments();
        fetchBudgetData();
    }, []);

    useEffect(() => {
        if (budgetData.length > 0 || departments.length > 0) {
            fetchTrackingData();
        }
    }, [currentWeek, budgetData, departments]);

    const fetchDepartments = async () => {
        try {
            const response = await mayorsOfficeAPI.getAllDepartmentsForSelector();
            const data = response.data?.data || response.data || [];
            setDepartments(data);
        } catch (error) {
            console.error("Failed to fetch departments:", error);
        }
    };

    const fetchBudgetData = async () => {
        try {
            const response = await mayorsOfficeAPI.getAllDepartmentsWithBudget();
            let data = response.data?.data || response.data || [];
            if (data.data) data = data.data;
            setBudgetData(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch budget data:", error);
        }
    };

    const fetchTrackingData = async () => {
        setLoading(true);
        try {
            const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
            const weekStartStr = format(weekStart, 'yyyy-MM-dd');
            const weekNumber = getWeek(weekStart);
            const year = format(weekStart, 'yyyy');
            
            const response = await mayorsOfficeAPI.getBudgetPeriods();
            let data = response?.data?.data || response?.data || [];
            
            const filteredData = data.filter(item => item.week_start === weekStartStr);
            
            if (filteredData.length === 0) {
                setDisplayData(null);
                setTrackingData([]);
                setLoading(false);
                return;
            }

            const departmentUsage = filteredData.map((item) => {
                const deptInfo = budgetData.find(d => d.department_id === item.department_id);
                const allocated = parseFloat(item.allocated_amount || 0);
                const used = parseFloat(item.actual_used || 0);
                const remaining = allocated - used;
                const utilization = allocated > 0 ? (used / allocated) * 100 : 0;
                
                let status = 'on_track';
                let statusLabel = 'On Track';
                let statusColor = 'bg-emerald-500';
                
                if (allocated === 0) {
                    status = 'no_budget';
                    statusLabel = 'No Budget';
                    statusColor = 'bg-slate-400';
                } else if (used >= allocated) {
                    status = 'exhausted';
                    statusLabel = 'Exhausted';
                    statusColor = 'bg-red-500';
                } else if (utilization >= 80) {
                    status = 'near_limit';
                    statusLabel = 'Near Limit';
                    statusColor = 'bg-orange-500';
                } else if (utilization >= 50) {
                    status = 'moderate';
                    statusLabel = 'Moderate';
                    statusColor = 'bg-yellow-500';
                }
                
                return {
                    department_id: item.department_id,
                    department_name: deptInfo?.department_name || item.department_name || `Department ${item.department_id}`,
                    department_code: deptInfo?.department_code || 'N/A',
                    allocated: allocated,
                    used: used,
                    remaining: remaining,
                    utilization: Math.round(utilization),
                    status: status,
                    status_label: statusLabel,
                    status_color: statusColor,
                    week_start: item.week_start,
                    week_end: item.week_end,
                };
            });

            const totalAllocated = departmentUsage.reduce((sum, d) => sum + d.allocated, 0);
            const totalUsed = departmentUsage.reduce((sum, d) => sum + d.used, 0);
            const totalRemaining = totalAllocated - totalUsed;
            
            const weekData = {
                week_start: weekStartStr,
                week_end: format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
                week_number: weekNumber,
                year: year,
                departments: departmentUsage,
                total_allocated: totalAllocated,
                total_used: totalUsed,
                total_remaining: totalRemaining,
                is_active: departmentUsage.some(d => d.status === 'on_track' || d.status === 'moderate'),
                department_count: departmentUsage.length,
                departments_with_budget: departmentUsage.filter(d => d.allocated > 0).length,
            };

            setDisplayData(weekData);
            setTrackingData([weekData]);
            
        } catch (error) {
            console.error("❌ Failed to fetch tracking data:", error);
            setDisplayData(null);
            setTrackingData([]);
            toast.error("Failed to load tracking data");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        Promise.all([fetchBudgetData(), fetchTrackingData()]);
        toast.success("Data refreshed");
    };

    const handlePrevWeek = () => {
        const newDate = subWeeks(currentWeek, 1);
        const monday = startOfWeek(newDate, { weekStartsOn: 1 });
        setCurrentWeek(monday);
    };

    const handleNextWeek = () => {
        const newDate = addWeeks(currentWeek, 1);
        const monday = startOfWeek(newDate, { weekStartsOn: 1 });
        setCurrentWeek(monday);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 2,
        }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        try {
            return format(new Date(dateString), "MMM dd, yyyy");
        } catch {
            return dateString;
        }
    };

    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
    const currentWeekNumber = getWeek(weekStart);

    // Stats
    const stats = [
        {
            title: "Total Departments",
            value: displayData?.department_count || 0,
            icon: Building2,
            color: "from-blue-500 to-blue-600",
            subtitle: `${displayData?.departments_with_budget || 0} with budget`,
            trend: displayData?.department_count > 0 ? 3 : 0,
        },
        {
            title: "Total Allocated",
            value: formatCurrency(displayData?.total_allocated || 0),
            icon: Wallet,
            color: "from-purple-500 to-purple-600",
            subtitle: "Weekly budget",
            trend: displayData?.total_allocated > 0 ? 5 : 0,
        },
        {
            title: "Total Used",
            value: formatCurrency(displayData?.total_used || 0),
            icon: TrendingDown,
            color: "from-yellow-500 to-yellow-600",
            subtitle: "Consumed this week",
            trend: displayData?.total_used > 0 ? 8 : 0,
        },
        {
            title: "Total Remaining",
            value: formatCurrency(displayData?.total_remaining || 0),
            icon: TrendingUp,
            color: (displayData?.total_remaining || 0) > 0 ? "from-emerald-500 to-emerald-600" : "from-red-500 to-red-600",
            subtitle: "Available balance",
            trend: (displayData?.total_remaining || 0) > 0 ? -2 : 0,
        },
    ];

    if (loading) {
        return <LoadingSkeleton />;
    }

    const weekData = displayData || trackingData[0] || null;
    const departmentsList = weekData?.departments || [];
    const totalUtilization = weekData?.total_allocated > 0 
        ? Math.round((weekData.total_used / weekData.total_allocated) * 100) 
        : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="space-y-6 p-4 md:p-6 animate-fade-in-up">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/mo/dashboard')}
                            className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/20">
                                    <RotateCcw className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                                        Weekly Budget Tracking
                                    </h1>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Track weekly budget consumption per department
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="dark:border-slate-700 dark:text-slate-300"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>

                {/* Navigation */}
                <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handlePrevWeek}
                                className="dark:border-slate-700 dark:text-slate-300"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-purple-500" />
                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                        {formatDate(weekStart)} - {formatDate(weekEnd)}
                                    </span>
                                </div>
                                <Badge variant="outline" className="text-slate-600 dark:text-slate-400">
                                    Week {currentWeekNumber}
                                </Badge>
                                {weekData?.is_active && (
                                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                        <Activity className="h-3 w-3 mr-1" />
                                        Active
                                    </Badge>
                                )}
                                {!weekData && (
                                    <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                        No Data
                                    </Badge>
                                )}
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleNextWeek}
                                className="dark:border-slate-700 dark:text-slate-300"
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat, index) => (
                        <StatsCard key={index} {...stat} />
                    ))}
                </div>

                {/* Weekly Data Table */}
                <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
                    <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                                    <RotateCcw className="h-5 w-5 text-purple-500" />
                                    Department-wise Weekly Usage
                                </CardTitle>
                                <CardDescription className="dark:text-slate-400">
                                    Week {currentWeekNumber} • {departmentsList.length} departments
                                    {departmentsList.length > 0 && ` • ${weekData?.departments_with_budget || 0} with budget`}
                                </CardDescription>
                            </div>
                            {departmentsList.length > 0 && (
                                <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30">
                                    <Zap className="h-3 w-3 mr-1" />
                                    {departmentsList.length} records
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {!weekData || departmentsList.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                                    <RotateCcw className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No budget allocation for this week</p>
                                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-md mx-auto">
                                    This week has not been set up yet. Please go to <strong className="text-purple-600 dark:text-purple-400">Budget Allocation</strong> to set a weekly budget.
                                </p>
                                <Button 
                                    variant="outline" 
                                    className="mt-4 dark:border-slate-700 dark:text-slate-300"
                                    onClick={() => navigate('/mo/budget-allocation')}
                                >
                                    Go to Budget Allocation
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-slate-50 dark:bg-slate-900/50">
                                                <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                                                    Department
                                                </th>
                                                <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                                                    Code
                                                </th>
                                                <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                                                    Allocated
                                                </th>
                                                <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                                                    Used
                                                </th>
                                                <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                                                    Remaining
                                                </th>
                                                <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                                                    Utilization
                                                </th>
                                                <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                                                    Status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {departmentsList.map((dept, idx) => (
                                                <tr 
                                                    key={dept.department_id || idx} 
                                                    className={cn(
                                                        "border-b hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors",
                                                        dept.status === 'exhausted' ? 'bg-red-50/50 dark:bg-red-950/20' :
                                                        dept.status === 'near_limit' ? 'bg-orange-50/50 dark:bg-orange-950/20' :
                                                        dept.status === 'moderate' ? 'bg-yellow-50/50 dark:bg-yellow-950/20' :
                                                        ''
                                                    )}
                                                >
                                                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-white">
                                                        {dept.department_name}
                                                        {dept.allocated === 0 && (
                                                            <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">(No Budget)</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                                                        {dept.department_code}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-medium text-blue-600 dark:text-blue-400">
                                                        {formatCurrency(dept.allocated)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-medium text-yellow-600 dark:text-yellow-400">
                                                        {formatCurrency(dept.used)}
                                                    </td>
                                                    <td className={cn(
                                                        "py-3 px-4 text-right font-medium",
                                                        dept.remaining > 0 ? 'text-emerald-600 dark:text-emerald-400' : 
                                                        dept.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'
                                                    )}>
                                                        {formatCurrency(dept.remaining)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                                                {dept.utilization}%
                                                            </span>
                                                            <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                                                <div 
                                                                    className={cn(
                                                                        "h-1.5 rounded-full",
                                                                        dept.utilization >= 100 ? 'bg-red-500' :
                                                                        dept.utilization >= 80 ? 'bg-orange-500' :
                                                                        dept.utilization >= 50 ? 'bg-yellow-500' :
                                                                        dept.utilization > 0 ? 'bg-emerald-500' :
                                                                        'bg-slate-300'
                                                                    )}
                                                                    style={{ width: `${Math.min(dept.utilization, 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <StatusBadge status={dept.status} label={dept.status_label} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 bg-slate-50 dark:bg-slate-900/50 font-semibold">
                                                <td className="py-3 px-4 text-slate-800 dark:text-white" colSpan="2">TOTAL</td>
                                                <td className="py-3 px-4 text-right text-blue-600 dark:text-blue-400">
                                                    {formatCurrency(weekData?.total_allocated || 0)}
                                                </td>
                                                <td className="py-3 px-4 text-right text-yellow-600 dark:text-yellow-400">
                                                    {formatCurrency(weekData?.total_used || 0)}
                                                </td>
                                                <td className={cn(
                                                    "py-3 px-4 text-right",
                                                    (weekData?.total_remaining || 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                                )}>
                                                    {formatCurrency(weekData?.total_remaining || 0)}
                                                </td>
                                                <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300" colSpan="2">
                                                    {totalUtilization}% utilized
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Overall Status Bar */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Overall Weekly Utilization</span>
                                        <span className="font-semibold text-slate-800 dark:text-white">
                                            {totalUtilization}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-1">
                                        <div 
                                            className={cn(
                                                "h-2 rounded-full transition-all duration-500",
                                                totalUtilization >= 80 ? 'bg-red-500' :
                                                totalUtilization >= 50 ? 'bg-yellow-500' :
                                                'bg-emerald-500'
                                            )}
                                            style={{ width: `${Math.min(totalUtilization, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-1">
                                        <span>Used: {formatCurrency(weekData?.total_used || 0)}</span>
                                        <span>Remaining: {formatCurrency(weekData?.total_remaining || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p>FCMS - Mayor's Office • Weekly Budget Tracking</p>
                    <p className="mt-0.5">Week {currentWeekNumber} • {departmentsList.length} departments • {weekData?.departments_with_budget || 0} with budget</p>
                </div>
            </div>
        </div>
    );
};

export default WeeklyTracking;
// src/components/mayor/WeeklyTrackingCard.jsx
import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    RotateCcw,
    Calendar,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    CheckCircle,
    Activity,
    Info,
    Building2,
    Wallet,
    Zap,
} from "lucide-react";
import { mayorsOfficeAPI } from "../../services/api";
import { toast } from "react-hot-toast";
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks, getWeek } from "date-fns";
import { cn } from "@/lib/utils";

// ============================================
// STATS CARD COMPONENT
// ============================================

const StatTile = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <Card className="dark:bg-slate-800/80 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
        <CardContent className="pt-6">
            <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1 truncate">{value}</p>
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
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-lg flex-shrink-0`}>
                    <Icon className="h-5 w-5 text-white" />
                </div>
            </div>
        </CardContent>
    </Card>
);

// ============================================
// STATUS BADGE
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
// MAIN COMPONENT
// ============================================

const WeeklyTrackingCard = () => {
    const queryClient = useQueryClient();
    const { isConnected } = useRealtime();
    const [currentWeek, setCurrentWeek] = useState(() => {
        const today = new Date();
        return startOfWeek(today, { weekStartsOn: 1 });
    });

    useAutoRefresh(
        [
            "mayor-budget-updated",
            "mayor-trip-updated",
            "gso-funds-released",
            "new-notification",
        ],
        () => {
            queryClient.invalidateQueries({ queryKey: ['departments-selector'] });
            queryClient.invalidateQueries({ queryKey: ['departments-with-budget'] });
            queryClient.invalidateQueries({ queryKey: ['budget-periods', currentWeek] });
        }
    );

    const { data: budgetData = [], isLoading: budgetLoading } = useOptimizedQuery({
        queryKey: ['departments-with-budget'],
        queryFn: async () => {
            try {
                const response = await mayorsOfficeAPI.getAllDepartmentsWithBudget();
                let data = response.data?.data || response.data || [];
                return Array.isArray(data) ? data : [];
            } catch (error) {
                console.error("Failed to fetch budget data:", error);
                return [];
            }
        },
        staleTime: 2 * 60 * 1000,
    });

    const { data: periodsData = [], isLoading: periodsLoading } = useOptimizedQuery({
        queryKey: ['budget-periods', currentWeek],
        queryFn: async () => {
            try {
                const weekStartStr = format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                const response = await mayorsOfficeAPI.getBudgetPeriods();
                let data = response?.data?.data || response?.data || [];
                return data.filter(item => item.week_start === weekStartStr);
            } catch (error) {
                console.error("❌ Failed to fetch tracking data:", error);
                return [];
            }
        },
        staleTime: 60 * 1000,
    });

    const weekData = useMemo(() => {
        if (!periodsData || periodsData.length === 0) return null;

        const departmentUsage = periodsData.map((item) => {
            const deptInfo = budgetData.find(d => d.department_id === item.department_id);
            const allocated = parseFloat(item.allocated_amount || 0);
            const used = parseFloat(item.actual_used || 0);
            const remaining = allocated - used;
            const utilization = allocated > 0 ? (used / allocated) * 100 : 0;

            let status = 'on_track';
            let statusLabel = 'On Track';

            if (allocated === 0) {
                status = 'no_budget';
                statusLabel = 'No Budget';
            } else if (used >= allocated) {
                status = 'exhausted';
                statusLabel = 'Exhausted';
            } else if (utilization >= 80) {
                status = 'near_limit';
                statusLabel = 'Near Limit';
            } else if (utilization >= 50) {
                status = 'moderate';
                statusLabel = 'Moderate';
            }

            return {
                department_id: item.department_id,
                department_name: deptInfo?.department_name || item.department_name || `Department ${item.department_id}`,
                department_code: deptInfo?.department_code || 'N/A',
                allocated,
                used,
                remaining,
                utilization: Math.round(utilization),
                status,
                status_label: statusLabel,
                week_start: item.week_start,
                week_end: item.week_end,
            };
        });

        const totalAllocated = departmentUsage.reduce((sum, d) => sum + d.allocated, 0);
        const totalUsed = departmentUsage.reduce((sum, d) => sum + d.used, 0);
        const totalRemaining = totalAllocated - totalUsed;

        const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });

        return {
            week_start: format(weekStart, 'yyyy-MM-dd'),
            week_end: format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            week_number: getWeek(weekStart),
            departments: departmentUsage,
            total_allocated: totalAllocated,
            total_used: totalUsed,
            total_remaining: totalRemaining,
            is_active: departmentUsage.some(d => d.status === 'on_track' || d.status === 'moderate'),
            department_count: departmentUsage.length,
            departments_with_budget: departmentUsage.filter(d => d.allocated > 0).length,
        };
    }, [periodsData, budgetData, currentWeek]);

    const handlePrevWeek = () => {
        const newDate = subWeeks(currentWeek, 1);
        setCurrentWeek(startOfWeek(newDate, { weekStartsOn: 1 }));
    };

    const handleNextWeek = () => {
        const newDate = addWeeks(currentWeek, 1);
        setCurrentWeek(startOfWeek(newDate, { weekStartsOn: 1 }));
    };

    const formatCurrency = (amount) =>
        new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 2,
        }).format(amount || 0);

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

    const isLoading = budgetLoading || periodsLoading;
    const departmentsList = weekData?.departments || [];
    const totalUtilization = weekData?.total_allocated > 0
        ? Math.round((weekData.total_used / weekData.total_allocated) * 100)
        : 0;
    const isRealTime = isConnected;

    const stats = [
        {
            title: "Departments",
            value: weekData?.department_count || 0,
            icon: Building2,
            color: "from-blue-500 to-blue-600",
            subtitle: `${weekData?.departments_with_budget || 0} with budget`,
        },
        {
            title: "Allocated",
            value: formatCurrency(weekData?.total_allocated || 0),
            icon: Wallet,
            color: "from-purple-500 to-purple-600",
            subtitle: "Weekly budget",
        },
        {
            title: "Used",
            value: formatCurrency(weekData?.total_used || 0),
            icon: TrendingDown,
            color: "from-yellow-500 to-yellow-600",
            subtitle: "Consumed",
        },
        {
            title: "Remaining",
            value: formatCurrency(weekData?.total_remaining || 0),
            icon: TrendingUp,
            color: (weekData?.total_remaining || 0) > 0 ? "from-emerald-500 to-emerald-600" : "from-red-500 to-red-600",
            subtitle: "Available",
        },
    ];

    return (
        <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
            <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-purple-50 dark:bg-purple-900/30 p-2.5">
                            <RotateCcw className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                                Weekly Budget Tracking
                            </CardTitle>
                            <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                                Department-wise weekly budget consumption
                                {isRealTime && (
                                    <span className="ml-2 text-xs text-emerald-500 animate-pulse">● Live</span>
                                )}
                            </CardDescription>
                        </div>
                    </div>
                    {/* Week navigation */}
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrevWeek} className="dark:border-slate-700 dark:text-slate-300">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-2 px-3">
                            <Calendar className="h-4 w-4 text-purple-500" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {formatDate(weekStart)} – {formatDate(weekEnd)}
                            </span>
                            <Badge variant="outline" className="text-slate-600 dark:text-slate-400 text-[10px]">
                                Week {currentWeekNumber}
                            </Badge>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleNextWeek} className="dark:border-slate-700 dark:text-slate-300">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                {/* Stat tiles */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {stats.map((stat, i) => (
                        <StatTile key={i} {...stat} />
                    ))}
                </div>

                {/* Table */}
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="h-8 w-8 border-4 border-slate-200 dark:border-slate-700 border-t-purple-600 rounded-full animate-spin" />
                    </div>
                ) : !weekData || departmentsList.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                            <RotateCcw className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 font-medium">
                            No budget allocation for this week
                        </p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-md mx-auto">
                            This week has not been set up yet. Please go to <strong className="text-purple-600 dark:text-purple-400">Budget Allocation</strong> to set a weekly budget.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-slate-50 dark:bg-slate-900/50">
                                        <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Department</th>
                                        <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Code</th>
                                        <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Allocated</th>
                                        <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Used</th>
                                        <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Remaining</th>
                                        <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Utilization</th>
                                        <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Status</th>
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
                                <span className="font-semibold text-slate-800 dark:text-white">{totalUtilization}%</span>
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
    );
};

export default WeeklyTrackingCard;
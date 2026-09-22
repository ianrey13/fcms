// src/pages/mayor/MayorDashboard.jsx

import React, { useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import WeeklyTrackingCard from "../../pages/mayor/WeeklyTrackingCard";
import {
    SkeletonPage,
    SkeletonStats,
    SkeletonCard,
} from "../../components/ui/SkeletonCard";
import api, { mayorsOfficeAPI, reportsAPI } from "../../services/api";

import {
    Clock,
    CheckCircle,
    DollarSign,
    Loader2,
    Eye,
    Calendar,
    MapPin,
    Building2,
    TrendingUp,
    Wallet,
    BarChart3,
    ArrowRight,
    AlertCircle,
    Zap,
    Shield,
    Target,
    Award,
    Activity,
    PieChart,
    ChevronRight,
    TrendingDown,
    Fuel,
    AlertTriangle,
    Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// ============================================
// SAFE ARRAY EXTRACTION HELPER
// ============================================

const extractArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.data)) return response.data;
    if (response.data && Array.isArray(response.data.data)) return response.data.data;

    const keys = ['items', 'results', 'records', 'rows', 'list', 'tickets', 'trips', 'departments', 'budgets'];
    for (const key of keys) {
        if (Array.isArray(response[key])) return response[key];
        if (response.data && Array.isArray(response.data[key])) {
            return response.data[key];
        }
    }

    if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
        return response.data.data.data;
    }

    console.warn('⚠️ extractArray (MayorDashboard): unexpected shape:', response);
    return [];
};

const useSafeArray = (value) => useMemo(() => Array.isArray(value) ? value : [], [value]);

// ============================================
// STAT CARD
// ============================================

const StatCard = ({ title, value, icon: Icon, color, subtitle, trend, trendValue, secondaryValue }) => (
    <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 dark:bg-slate-800/80">
        <CardContent className="p-6">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
                    {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
                    {secondaryValue && (
                        <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500 border-t border-dashed border-slate-200 dark:border-slate-700 pt-1.5">
                            {secondaryValue}
                        </p>
                    )}
                    {trend && (
                        <div className="mt-2 flex items-center gap-1">
                            {trendValue > 0 ? (
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                            ) : trendValue < 0 ? (
                                <TrendingDown className="h-3 w-3 text-red-500" />
                            ) : (
                                <Activity className="h-3 w-3 text-slate-400" />
                            )}
                            <span className={cn(
                                "text-xs",
                                trendValue > 0 ? "text-emerald-600 dark:text-emerald-400" :
                                    trendValue < 0 ? "text-red-600 dark:text-red-400" :
                                        "text-slate-400"
                            )}>
                                {trendValue > 0 ? '+' : ''}{trendValue}%
                            </span>
                            <span className="text-xs text-slate-400">vs last period</span>
                        </div>
                    )}
                </div>
                <div className={`rounded-xl ${color} p-3 shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                </div>
            </div>
        </CardContent>
    </Card>
);

// ============================================
// QUICK LINK CARD
// ============================================

const QuickLinkCard = ({ title, description, icon: Icon, color, count, onClick }) => (
    <button
        onClick={onClick}
        className="group relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 p-4 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border border-slate-100 dark:border-slate-700"
    >
        <div className={`absolute right-0 top-0 h-20 w-20 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br ${color} opacity-10 transition-transform duration-300 group-hover:scale-150`} />
        <div className="relative flex items-start justify-between">
            <div className="flex-1">
                <div className={`inline-flex rounded-lg ${color.replace("from-", "bg-").replace("to-", "bg-")}/10 p-2.5`}>
                    <Icon className={`h-5 w-5 ${color.replace("from-", "text-").split(" ")[0]}`} />
                </div>
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
                {count !== undefined && (
                    <div className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                        <span>{count} items</span>
                        <ChevronRight className="h-3 w-3" />
                    </div>
                )}
            </div>
            <ChevronRight className="mt-1 h-4 w-4 text-slate-400 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
    </button>
);

// ============================================
// BUDGET PROGRESS BAR
// ============================================

const BudgetProgressBar = ({ department }) => {
    const utilization = parseFloat(department.utilization) || 0;
    const isCritical = utilization >= 80;
    const isWarning = utilization >= 60 && utilization < 80;
    const isGood = utilization < 60 && department.has_budget;

    const getStatusColor = () => isCritical ? "text-red-600 dark:text-red-400"
        : isWarning ? "text-amber-600 dark:text-amber-400"
            : "text-emerald-600 dark:text-emerald-400";

    const getProgressColor = () => isCritical ? "bg-gradient-to-r from-red-500 to-red-600"
        : isWarning ? "bg-gradient-to-r from-amber-500 to-amber-600"
            : "bg-gradient-to-r from-emerald-500 to-emerald-600";

    const getStatusIcon = () => isCritical ? <AlertCircle className="h-4 w-4 text-red-500" />
        : isWarning ? <Activity className="h-4 w-4 text-amber-500" />
            : <CheckCircle className="h-4 w-4 text-emerald-500" />;

    const getStatusMessage = () => isCritical ? "⚠️ Approaching or exceeding annual budget limit"
        : isWarning ? "📊 Moderate budget utilization"
            : isGood ? "✅ Good budget utilization" : null;

    return (
        <div className="group">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                        {department.department_name}
                    </span>
                    {getStatusIcon()}
                    <Badge variant="outline" className="text-xs text-slate-400 border-slate-300 dark:border-slate-600">
                        {department.fiscal_year || 'Annual'}
                    </Badge>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        ₱{(department.spent || 0).toLocaleString()} / ₱{(department.allocated || 0).toLocaleString()}
                    </span>
                    <span className={`text-sm font-semibold ${getStatusColor()}`}>
                        {department.utilization}%
                    </span>
                </div>
            </div>
            <div className="relative">
                <Progress value={Math.min(utilization, 100)} className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700" />
                <div
                    className={`absolute top-0 left-0 h-2.5 rounded-full transition-all duration-500 ${getProgressColor()}`}
                    style={{ width: `${Math.min(utilization, 100)}%` }}
                />
            </div>
            {department.has_budget && getStatusMessage() && (
                <p className={`mt-1.5 text-xs flex items-center gap-1 ${isCritical ? 'text-amber-600 dark:text-amber-400'
                    : isWarning ? 'text-blue-600 dark:text-blue-400'
                        : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {getStatusMessage()}
                </p>
            )}
        </div>
    );
};

// ============================================
// LOADING SKELETON
// ============================================

const LoadingSkeleton = () => (
    <div className="space-y-6 p-4 md:p-6 min-h-screen">
        <SkeletonPage />
        <SkeletonStats count={4} cols={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonCard className="h-80" />
            <SkeletonCard className="h-80" />
        </div>
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const MayorDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { isConnected } = useRealtime();
    const queryClient = useQueryClient();

    // ============================================
    // THROTTLED REFRESH FUNCTION
    // ============================================

    const fetchAllData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["mayor-pending-tickets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-approved-tickets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-department-budgets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-active-fiscal-year"] });
    }, [queryClient]);

    // ============================================
    // AUTO-REFRESH (event-driven only)
    // ============================================

    useAutoRefresh(
        [
            "mayor-trip-updated",
            "mayor-new-pending",
            "mayor-budget-updated",
            "gso-funds-released",
            "trip-completed",
            "new-notification",
        ],
        fetchAllData,
        1000
    );

    // ============================================
    // ACTIVE FISCAL YEAR
    // ============================================

    // ✅ Fetch active fiscal years (same endpoint BudgetAllocation uses)
const { data: activeFiscalYearsRaw, isLoading: fiscalYearLoading } = useOptimizedQuery({
    queryKey: ["mayor-active-fiscal-year"],
    queryFn: async () => {
        try {
            const response = await api.get("/mayors-office/fiscal-years?is_active=1");
            // Backend returns { success, data: [ { year, is_active, ... } ] }
            const arr = response.data?.data || [];
            return Array.isArray(arr) ? arr : [];
        } catch (error) {
            console.error("Error fetching active fiscal year:", error);
            return [];
        }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
});

const activeFiscalYears = useSafeArray(activeFiscalYearsRaw);
const activeFiscalYear =
    activeFiscalYears[0]?.year ?? new Date().getFullYear();
const hasActiveFiscalYear = activeFiscalYears.length > 0;

    // ============================================
    // OPTIMIZED QUERIES (with extractArray)
    // ============================================

   const { data: pendingResponse, isLoading: pendingLoading } = useOptimizedQuery({
    queryKey: ["mayor-pending-tickets"],
    queryFn: async () => {
        try {
            const response = await mayorsOfficeAPI.getPendingTickets();
            return {
                data: extractArray(response),
                meta: response?.data?.meta ?? {},
            };
        } catch (error) {
            if (error.response?.status === 429) return { data: [], meta: {} };
            console.error("Error fetching pending tickets:", error);
            return { data: [], meta: {} };
        }
    },
    refetchOnMount: 'always',
});
const pendingTickets = useSafeArray(pendingResponse?.data);
const pendingMeta = pendingResponse?.meta ?? {};

   const { data: approvedResponse, isLoading: approvedLoading } = useOptimizedQuery({
    queryKey: ["mayor-approved-tickets"],
    queryFn: async () => {
        try {
            const response = await mayorsOfficeAPI.getApprovedTickets();
            return {
                data: extractArray(response),
                meta: response?.data?.meta ?? {},
            };
        } catch (error) {
            console.error("Error fetching approved tickets:", error);
            return { data: [], meta: {} };
        }
    },
    refetchOnMount: 'always',
});
const approvedTickets = useSafeArray(approvedResponse?.data);
const approvedMeta = approvedResponse?.meta ?? {};
    const { data: budgetRaw, isLoading: budgetLoading } = useOptimizedQuery({
        queryKey: ["mayor-department-budgets"],
        queryFn: async () => {
            try {
                const response = await mayorsOfficeAPI.getAllDepartmentsWithBudget();
                return extractArray(response);
            } catch (error) {
                console.error("Error fetching budgets:", error);
                return [];
            }
        },
        refetchOnMount: 'always',
    });
    const budgetData = useSafeArray(budgetRaw);

    // ============================================
    // COMPUTED DATA
    // ============================================

    const departmentBudgets = useMemo(() => {
        const formatted = budgetData.map((dept) => ({
            department_id: dept.department_id,
            department_name: dept.department_name,
            allocated: parseFloat(dept.allocated_amount || dept.annual_amount || dept.allocated || 0),
            spent: parseFloat(dept.spent_amount || dept.used_amount || dept.spent || 0),
            remaining: parseFloat(dept.remaining_amount || 0),
            has_budget: dept.has_budget || false,
            utilization: dept.utilization_percentage || dept.utilization || 0,
            fiscal_year: dept.fiscal_year || activeFiscalYear,
            budget_type: dept.budget_type || 'annual',
            allocated_amount: parseFloat(dept.allocated_amount || dept.annual_amount || 0),
            used_amount: parseFloat(dept.used_amount || 0),
            annual_amount: parseFloat(dept.annual_amount || 0),
        }));
        formatted.sort((a, b) => parseFloat(b.utilization) - parseFloat(a.utilization));
        return formatted;
    }, [budgetData, activeFiscalYear]);

    const stats = useMemo(() => {
        const total = approvedTickets.reduce((sum, t) => {
            let amount = 0;
            if (t.amount_released) amount = parseFloat(t.amount_released);
            else if (t.gas_slip?.amount_released) amount = parseFloat(t.gas_slip.amount_released);
            return sum + (isNaN(amount) ? 0 : amount);
        }, 0);

        const totalAllocated = departmentBudgets.reduce((sum, d) => sum + d.allocated, 0);
        const totalUsed = departmentBudgets.reduce((sum, d) => sum + d.spent, 0);
        const totalRemaining = totalAllocated - totalUsed;
        const deptsWithBudget = departmentBudgets.filter(d => d.has_budget).length;
        const budgetedDepts = departmentBudgets.filter(d => d.has_budget);

        const avgUtil = budgetedDepts.length > 0
            ? budgetedDepts.reduce((sum, d) => sum + parseFloat(d.utilization), 0) / budgetedDepts.length
            : 0;

        return {
            pendingCount: pendingTickets.length,
            releasedCount: approvedTickets.length,
            totalAmount: total,
             pendingAllTime:   pendingMeta.all_time_count  ?? pendingTickets.length,
        releasedAllTime:  approvedMeta.all_time_count ?? approvedTickets.length,
        totalAmountAllTime: approvedMeta.all_time_amount ?? total,
            avgUtilization: avgUtil.toFixed(1),
            criticalDepartments: budgetedDepts.filter(d => parseFloat(d.utilization) >= 80).length,
            totalAnnualBudget: totalAllocated,
            totalAnnualUsed: totalUsed,
            totalAnnualRemaining: totalRemaining,
            departmentsWithBudget: deptsWithBudget,
        };
    }, [pendingTickets, approvedTickets, departmentBudgets]);

    const recentReleases = useMemo(() => approvedTickets.slice(0, 5), [approvedTickets]);
    const topDepartments = useMemo(() => departmentBudgets.slice(0, 6), [departmentBudgets]);

    // ============================================
    // HELPERS
    // ============================================

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    };

    const formatCurrency = (amount) => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount === 0) return "₱0";
        return new Intl.NumberFormat("en-PH", {
            style: "currency", currency: "PHP", minimumFractionDigits: 0,
        }).format(numAmount);
    };

    const formatCompactCurrency = (amount) => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) return "₱0";
        if (numAmount >= 1000000) return `₱${(numAmount / 1000000).toFixed(1)}M`;
        if (numAmount >= 1000) return `₱${(numAmount / 1000).toFixed(1)}K`;
        return `₱${numAmount.toFixed(0)}`;
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    const connectionStatus = isConnected ? "🟢 Live" : "🔴 Offline";
    const isRealTime = isConnected;

    // ============================================
    // LOADING STATE
    // ============================================

    const isLoading = pendingLoading || approvedLoading || budgetLoading || fiscalYearLoading;

    if (isLoading && pendingTickets.length === 0 && approvedTickets.length === 0 && departmentBudgets.length === 0) {
        return <LoadingSkeleton />;
    }

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="space-y-6 p-4 md:p-6">
                {/* Hero Header */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
                    <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl" />
                    <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-3xl" />

                    <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                            <div className="mb-2 flex items-center gap-2 flex-wrap">
                                <Badge className="border-green-500/30 bg-green-500/20 text-green-300">
                                    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                                    Mayor's Office
                                </Badge>
                                <Badge className="border-blue-500/30 bg-blue-500/20 text-blue-300">
                                    {new Date().toLocaleDateString("en-PH", {
                                        weekday: "long", month: "long", day: "numeric",
                                    })}
                                </Badge>

                                {/* ✅ ACTIVE FISCAL YEAR BADGE */}
                                {hasActiveFiscalYear ? (
                                    <Badge className="border-amber-500/30 bg-amber-500/20 text-amber-300">
                                        <Fuel className="mr-1 h-3 w-3" />
                                        Active FY {activeFiscalYear}
                                        <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                                    </Badge>
                                ) : (
                                    <Badge className="border-rose-500/30 bg-rose-500/20 text-rose-300">
                                        <AlertCircle className="mr-1 h-3 w-3" />
                                        No Active FY — showing FY {activeFiscalYear}
                                    </Badge>
                                )}

                                {isRealTime && (
                                    <Badge className="border-emerald-500/30 bg-emerald-500/20 text-emerald-300 animate-pulse">
                                        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Real-time
                                    </Badge>
                                )}
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                                {getGreeting()}, {user?.first_name || "Mayor"}
                            </h1>
                            <p className="mt-1 text-sm text-slate-300">
                                Monitor fund releases and department budget utilization for <strong>FY {activeFiscalYear}</strong>
                                {hasActiveFiscalYear && (
                                    <span className="ml-2 text-xs text-amber-300">
                                        ● Active fiscal year
                                    </span>
                                )}
                                <span className="ml-2 text-xs opacity-70">{connectionStatus}</span>
                                {isRealTime && (
                                    <span className="ml-2 text-xs text-emerald-400 animate-pulse">● Auto-refresh</span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Annual Budget Summary */}
                <Card className="border-0 shadow-sm overflow-hidden dark:bg-slate-800/80 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="rounded-xl bg-blue-500/20 p-2.5">
                                <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Annual Budget Overview FY {activeFiscalYear}
                                    {isRealTime && (
                                        <span className="ml-2 text-xs font-normal text-emerald-500 animate-pulse">● Live</span>
                                    )}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {stats.departmentsWithBudget} departments with active budgets
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/60 dark:bg-slate-900/40 rounded-xl p-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">Total Annual Budget</p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {formatCurrency(stats.totalAnnualBudget)}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">Across all departments</p>
                            </div>
                            <div className="bg-white/60 dark:bg-slate-900/40 rounded-xl p-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">Used to Date</p>
                                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                    {formatCurrency(stats.totalAnnualUsed)}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {stats.totalAnnualBudget > 0
                                        ? `${((stats.totalAnnualUsed / stats.totalAnnualBudget) * 100).toFixed(1)}% utilization`
                                        : 'No budget set'}
                                </p>
                            </div>
                            <div className="bg-white/60 dark:bg-slate-900/40 rounded-xl p-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">Remaining Budget</p>
                                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(stats.totalAnnualRemaining)}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {stats.totalAnnualBudget > 0
                                        ? `${((stats.totalAnnualRemaining / stats.totalAnnualBudget) * 100).toFixed(1)}% remaining`
                                        : 'No budget set'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Pending Release"
                        value={stats.pendingCount}
                        icon={Clock}
                        color="bg-gradient-to-r from-amber-500 to-amber-600"
                        subtitle="Awaiting fund release"
                        trend
                        trendValue={stats.pendingCount > 0 ? 12 : 0}
                    />
                    <StatCard
                        title="Total Released"
                        value={stats.releasedCount}
                        icon={CheckCircle}
                        color="bg-gradient-to-r from-emerald-500 to-emerald-600"
                        subtitle="Completed transactions"
                        trend
                        trendValue={stats.releasedCount > 0 ? 8 : 0}
                    />
                    <StatCard
                        title="Total Amount"
                        value={formatCompactCurrency(stats.totalAmount)}
                        icon={Wallet}
                        color="bg-gradient-to-r from-blue-500 to-blue-600"
                        subtitle={formatCurrency(stats.totalAmount)}
                        trend
                        trendValue={stats.totalAmount > 0 ? 5 : 0}
                    />
                    <StatCard
                        title="Avg Utilization"
                        value={`${stats.avgUtilization}%`}
                        icon={Target}
                        color="bg-gradient-to-r from-purple-500 to-purple-600"
                        subtitle={`${stats.criticalDepartments} departments >80%`}
                        trend
                        trendValue={stats.avgUtilization > 0 ? -3 : 0}
                    />
                </div>

                {/* Department Budget Section */}
                <Card className="border-0 shadow-sm overflow-hidden dark:bg-slate-800/80">
                    <CardHeader className="border-b border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 pb-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/30 p-2.5">
                                    <PieChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                                        Annual Budget Utilization
                                    </CardTitle>
                                    <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                                        Real-time budget consumption across departments for FY {activeFiscalYear}
                                        {isRealTime && (
                                            <span className="ml-2 text-xs text-emerald-500 animate-pulse">● Live updates</span>
                                        )}
                                    </CardDescription>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate("/mo/reports")}
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                                View Detailed Report
                                <ArrowRight className="ml-1 h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {topDepartments.length === 0 || topDepartments.every(d => !d.has_budget) ? (
                            <div className="py-12 text-center">
                                <Building2 className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
                                <p className="mt-3 text-slate-500 dark:text-slate-400">No annual budget data available</p>
                                <p className="text-sm text-slate-400 dark:text-slate-500">
                                    Please set up annual budgets for departments
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {topDepartments.filter(d => d.has_budget).map((dept) => (
                                    <BudgetProgressBar key={dept.department_id} department={dept} />
                                ))}
                                {departmentBudgets.filter(d => d.has_budget).length > 6 && (
                                    <div className="pt-3 text-center">
                                        <Button
                                            variant="link"
                                            onClick={() => navigate("/mo/reports")}
                                            className="text-blue-600 dark:text-blue-400"
                                        >
                                            View all {departmentBudgets.filter(d => d.has_budget).length} departments
                                            <ArrowRight className="ml-1 h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                 {/* Weekly Budget Tracking */}
               <WeeklyTrackingCard activeFiscalYear={activeFiscalYear} />
                {/* Two Column Layout */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Recent Releases */}
                    <Card className="border-0 shadow-sm overflow-hidden dark:bg-slate-800/80">
                        <CardHeader className="border-b border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/30 p-2.5">
                                    <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                                        Recent Fund Releases
                                    </CardTitle>
                                    <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                                        Last 5 transactions
                                        {isRealTime && (
                                            <span className="ml-2 text-xs text-emerald-500 animate-pulse">● Auto-update</span>
                                        )}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {recentReleases.length === 0 ? (
                                <div className="py-12 text-center">
                                    <DollarSign className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
                                    <p className="mt-3 text-slate-500 dark:text-slate-400">No funds released yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {recentReleases.map((ticket) => (
                                        <div
                                            key={ticket.id || ticket.trip_ticket_id}
                                            className="group flex items-center justify-between py-3 first:pt-0 last:pb-0"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                                                        {ticket.ticket_number || ticket.trip_ticket_number}
                                                    </span>
                                                    <Badge variant="outline" className="text-xs dark:border-slate-600 dark:text-slate-400">
                                                        {formatDate(ticket.trip_date)}
                                                    </Badge>
                                                    {ticket.is_mo_funded && (
                                                        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs">
                                                            MO Funded
                                                        </Badge>
                                                    )}
                                                    {ticket.is_cross_department && (
                                                        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs">
                                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                                            Cross-Dept
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <Building2 className="h-3 w-3" />
                                                        {ticket.department_name}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" />
                                                        {ticket.destination?.length > 30
                                                            ? `${ticket.destination.substring(0, 30)}...`
                                                            : ticket.destination}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0 ml-4">
                                                <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {formatCurrency(ticket.amount_released)}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => navigate(`/mo/tickets/${ticket.id || ticket.trip_ticket_id}`)}
                                                    className="mt-1 h-7 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                                >
                                                    <Eye className="mr-1 h-3 w-3" />
                                                    View
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {approvedTickets.length > 5 && (
                                        <div className="pt-3 text-center">
                                            <Button
                                                variant="link"
                                                onClick={() => navigate("/mo/approved")}
                                                className="text-blue-600 dark:text-blue-400"
                                            >
                                                View all {approvedTickets.length} releases
                                                <ArrowRight className="ml-1 h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick Links */}
                    <Card className="border-0 shadow-sm overflow-hidden dark:bg-slate-800/80">
                        <CardHeader className="border-b border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-purple-50 dark:bg-purple-900/30 p-2.5">
                                    <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                                        Quick Navigation
                                    </CardTitle>
                                    <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                                        Access key management features
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <QuickLinkCard
                                    title="Pending Fund Release"
                                    description="Review and release funds"
                                    icon={Clock}
                                    color="from-amber-500 to-amber-600"
                                    count={stats.pendingCount}
                                    onClick={() => navigate("/mo/pending")}
                                />
                                <QuickLinkCard
                                    title="Financial Reports"
                                    description="Budget vs Actual analysis"
                                    icon={BarChart3}
                                    color="from-blue-500 to-blue-600"
                                    onClick={() => navigate("/mo/reports")}
                                />
                                <QuickLinkCard
                                    title="Released Tickets"
                                    description="View all released funds"
                                    icon={CheckCircle}
                                    color="from-purple-500 to-purple-600"
                                    count={stats.releasedCount}
                                    onClick={() => navigate("/mo/approved")}
                                />
                                <QuickLinkCard
                                    title="Receipt Verification"
                                    description="Verify fuel receipts"
                                    icon={Receipt}
                                    color="from-emerald-500 to-emerald-600"
                                    onClick={() => navigate("/mo/receipt-verification")}
                                />
                            </div>

                            <div className="mt-6 rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-slate-800 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        <Award className="h-5 w-5 text-blue-500" />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">
                                            Department Performance
                                        </span>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                                {departmentBudgets.filter(d => parseFloat(d.utilization) < 60 && d.has_budget).length}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Good Standing</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                                                {departmentBudgets.filter(d => parseFloat(d.utilization) >= 60 && parseFloat(d.utilization) < 80 && d.has_budget).length}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Warning</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-red-600 dark:text-red-400">
                                                {departmentBudgets.filter(d => parseFloat(d.utilization) >= 80 && d.has_budget).length}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Critical</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                                    <span>Annual Budgets FY {activeFiscalYear}</span>
                                    <span>{stats.departmentsWithBudget} departments active</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p>FCMS - Mayor's Office Dashboard • Laguindingan Municipality</p>
                    <p className="mt-0.5">
                        FY {activeFiscalYear}
                        {hasActiveFiscalYear ? ' (Active)' : ' (No active fiscal year — using current year)'}
                        {' • '}{stats.departmentsWithBudget} departments with active budgets
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MayorDashboard;
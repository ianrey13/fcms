// src/pages/mayor/MayorDashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import {
    SkeletonPage,
    SkeletonStats,
    SkeletonCard,
} from "../../components/ui/SkeletonCard";
import { mayorsOfficeAPI } from "../../services/api";
import toast from "react-hot-toast";
import echo from "../../services/echo";
import eventBus from "../../utils/eventBus";

import {
    LayoutDashboard,
    Clock,
    CheckCircle,
    DollarSign,
    RefreshCw,
    Loader2,
    Eye,
    Calendar,
    MapPin,
    Building2,
    TrendingUp,
    Wallet,
    FileText,
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
    Bell,
    TrendingDown,
    Fuel,
    AlertTriangle,
    Users,
    FileCheck,
    Receipt,
    Gauge,
    Navigation,
    Sun,
    Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// ============================================
// STAT CARD COMPONENT
// ============================================

const StatCard = ({ title, value, icon: Icon, color, subtitle, trend, trendValue }) => (
    <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 dark:bg-slate-800/80">
        <CardContent className="p-6">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {title}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                        {value}
                    </p>
                    {subtitle && (
                        <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
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
// QUICK LINK CARD COMPONENT
// ============================================

const QuickLinkCard = ({ title, description, icon: Icon, href, color, count, onClick }) => (
    <button
        onClick={onClick || (() => window.location.href = href)}
        className="group relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 p-4 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border border-slate-100 dark:border-slate-700"
    >
        <div
            className={`absolute right-0 top-0 h-20 w-20 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br ${color} opacity-10 transition-transform duration-300 group-hover:scale-150`}
        />
        <div className="relative flex items-start justify-between">
            <div className="flex-1">
                <div
                    className={`inline-flex rounded-lg ${color.replace("from-", "bg-").replace("to-", "bg-")}/10 p-2.5`}
                >
                    <Icon
                        className={`h-5 w-5 ${color.replace("from-", "text-").split(" ")[0]}`}
                    />
                </div>
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
                    {title}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {description}
                </p>
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
// BUDGET PROGRESS BAR COMPONENT
// ============================================

const BudgetProgressBar = ({ department }) => {
    const utilization = parseFloat(department.utilization);
    const isCritical = utilization >= 80;
    const isWarning = utilization >= 60 && utilization < 80;
    const isGood = utilization < 60 && department.has_budget;

    const getStatusColor = () => {
        if (isCritical) return "text-red-600 dark:text-red-400";
        if (isWarning) return "text-amber-600 dark:text-amber-400";
        return "text-emerald-600 dark:text-emerald-400";
    };

    const getProgressColor = () => {
        if (isCritical) return "bg-gradient-to-r from-red-500 to-red-600";
        if (isWarning) return "bg-gradient-to-r from-amber-500 to-amber-600";
        return "bg-gradient-to-r from-emerald-500 to-emerald-600";
    };

    const getStatusIcon = () => {
        if (isCritical) return <AlertCircle className="h-4 w-4 text-red-500" />;
        if (isWarning) return <Activity className="h-4 w-4 text-amber-500" />;
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    };

    const getStatusMessage = () => {
        if (isCritical) return "⚠️ Approaching or exceeding annual budget limit";
        if (isWarning) return "📊 Moderate budget utilization";
        if (isGood) return "✅ Good budget utilization";
        return null;
    };

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
                        ₱{department.spent.toLocaleString()} / ₱{department.allocated.toLocaleString()}
                    </span>
                    <span className={`text-sm font-semibold ${getStatusColor()}`}>
                        {department.utilization}%
                    </span>
                </div>
            </div>
            <div className="relative">
                <Progress
                    value={Math.min(utilization, 100)}
                    className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700"
                />
                <div
                    className={`absolute top-0 left-0 h-2.5 rounded-full transition-all duration-500 ${getProgressColor()}`}
                    style={{
                        width: `${Math.min(utilization, 100)}%`,
                    }}
                />
            </div>
            {department.has_budget && getStatusMessage() && (
                <p className={`mt-1.5 text-xs flex items-center gap-1 ${isCritical ? 'text-amber-600 dark:text-amber-400' :
                        isWarning ? 'text-blue-600 dark:text-blue-400' :
                            'text-emerald-600 dark:text-emerald-400'
                    }`}>
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
    const [pendingTickets, setPendingTickets] = useState([]);
    const [approvedTickets, setApprovedTickets] = useState([]);
    const [departmentBudgets, setDepartmentBudgets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [recentReleases, setRecentReleases] = useState([]);
    const [newNotificationCount, setNewNotificationCount] = useState(0);
    const [latestNotification, setLatestNotification] = useState(null);
    const [isMounted, setIsMounted] = useState(true);
    const [forceUpdate, setForceUpdate] = useState(0);
    const [stats, setStats] = useState({
        pendingCount: 0,
        releasedCount: 0,
        totalAmount: 0,
        avgUtilization: 0,
        criticalDepartments: 0,
        totalAnnualBudget: 0,
        totalAnnualUsed: 0,
        totalAnnualRemaining: 0,
        departmentsWithBudget: 0,
    });

    const fetchAllDataRef = useRef();
    const fetchPendingTicketsRef = useRef();
    const fetchDepartmentBudgetsRef = useRef();

    // ============================================
    // OPTIMIZED QUERIES
    // ============================================

    const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useOptimizedQuery({
        queryKey: ["mayor-pending-tickets"],
        queryFn: async () => {
            const response = await mayorsOfficeAPI.getPendingTickets();
            return response.data?.data || response.data || [];
        },
        staleTime: 30000,
        keepPreviousData: true,
    });

    const { data: approvedData, isLoading: approvedLoading, refetch: refetchApproved } = useOptimizedQuery({
        queryKey: ["mayor-approved-tickets"],
        queryFn: async () => {
            const response = await mayorsOfficeAPI.getApprovedTickets();
            return response.data?.data || response.data || [];
        },
        staleTime: 60000,
        keepPreviousData: true,
    });

    const { data: budgetData, isLoading: budgetLoading, refetch: refetchBudget } = useOptimizedQuery({
        queryKey: ["mayor-department-budgets"],
        queryFn: async () => {
            const response = await mayorsOfficeAPI.getAllDepartmentsWithBudget();
            return response.data?.data || response.data || [];
        },
        staleTime: 120000,
        keepPreviousData: true,
    });

    // ============================================
    // PROCESS DATA
    // ============================================

    useEffect(() => {
        if (!pendingLoading && pendingData) {
            const tickets = Array.isArray(pendingData) ? pendingData : [];
            setPendingTickets(tickets);
            setStats(prev => ({
                ...prev,
                pendingCount: tickets.length,
            }));
        }
    }, [pendingData, pendingLoading]);

    useEffect(() => {
        if (!approvedLoading && approvedData) {
            const tickets = Array.isArray(approvedData) ? approvedData : [];
            setApprovedTickets(tickets);

            const total = tickets.reduce((sum, t) => {
                let amount = 0;
                if (t.amount_released) amount = parseFloat(t.amount_released);
                else if (t.gas_slip?.amount_released)
                    amount = parseFloat(t.gas_slip.amount_released);
                return sum + (isNaN(amount) ? 0 : amount);
            }, 0);

            setStats(prev => ({
                ...prev,
                releasedCount: tickets.length,
                totalAmount: total,
            }));
            setRecentReleases(tickets.slice(0, 5));
        }
    }, [approvedData, approvedLoading]);

    useEffect(() => {
        if (!budgetLoading && budgetData) {
            const budgetDataArray = Array.isArray(budgetData) ? budgetData : [];

            const formatted = budgetDataArray.map((dept) => ({
                department_id: dept.department_id,
                department_name: dept.department_name,
                allocated: parseFloat(dept.allocated_amount || dept.annual_amount || dept.allocated || 0),
                spent: parseFloat(dept.spent_amount || dept.used_amount || dept.spent || 0),
                remaining: parseFloat(dept.remaining_amount || 0),
                has_budget: dept.has_budget || false,
                utilization: dept.utilization_percentage || dept.utilization || 0,
                fiscal_year: dept.fiscal_year || new Date().getFullYear(),
                budget_type: dept.budget_type || 'annual',
                allocated_amount: parseFloat(dept.allocated_amount || dept.annual_amount || 0),
                used_amount: parseFloat(dept.used_amount || 0),
                annual_amount: parseFloat(dept.annual_amount || 0),
            }));

            const totalAllocated = formatted.reduce((sum, d) => sum + d.allocated, 0);
            const totalUsed = formatted.reduce((sum, d) => sum + d.spent, 0);
            const totalRemaining = totalAllocated - totalUsed;
            const deptsWithBudget = formatted.filter(d => d.has_budget).length;

            formatted.sort((a, b) => parseFloat(b.utilization) - parseFloat(a.utilization));

            setDepartmentBudgets(formatted);

            const avgUtil = formatted.filter(d => d.has_budget).length > 0
                ? formatted.filter(d => d.has_budget).reduce((sum, d) => sum + parseFloat(d.utilization), 0) /
                (formatted.filter(d => d.has_budget).length || 1)
                : 0;

            setStats(prev => ({
                ...prev,
                avgUtilization: avgUtil.toFixed(1),
                criticalDepartments: formatted.filter(
                    (d) => parseFloat(d.utilization) >= 80 && d.has_budget,
                ).length,
                totalAnnualBudget: totalAllocated,
                totalAnnualUsed: totalUsed,
                totalAnnualRemaining: totalRemaining,
                departmentsWithBudget: deptsWithBudget,
            }));
        }
    }, [budgetData, budgetLoading]);

    // ============================================
    // FETCH FUNCTIONS
    // ============================================

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([
                refetchPending(),
                refetchApproved(),
                refetchBudget(),
            ]);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
            toast.error("Failed to load dashboard data");
        } finally {
            if (isMounted) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [refetchPending, refetchApproved, refetchBudget, isMounted]);

    // Store refs for event listeners
    useEffect(() => {
        fetchAllDataRef.current = fetchAllData;
        fetchPendingTicketsRef.current = refetchPending;
        fetchDepartmentBudgetsRef.current = refetchBudget;
    }, [fetchAllData, refetchPending, refetchBudget]);

    // ============================================
    // HANDLE NOTIFICATION
    // ============================================

    const handleNotificationByType = useCallback((data) => {
        const type = data.notification_type;

        setNewNotificationCount(prev => prev + 1);

        if (type === 'trip_created' || type === 'trip_submitted') {
            fetchPendingTicketsRef.current?.();
            setForceUpdate(prev => prev + 1);
        }

        if (type === 'fund_issued' || type === 'fund_released') {
            fetchAllDataRef.current?.();
            setForceUpdate(prev => prev + 1);
        }

        if (type === 'trip_completed' || type === 'trip_started' ||
            type === 'driver_acknowledged' || type === 'trip_reconciled') {
            fetchAllDataRef.current?.();
            setForceUpdate(prev => prev + 1);
        }
    }, []);

    // ============================================
    // SETUP REAL-TIME NOTIFICATIONS
    // ============================================

    const setupRealtimeNotifications = useCallback(() => {
        if (!user) return;

        if (!echo.connector || !echo.connector.pusher) {
            setTimeout(setupRealtimeNotifications, 2000);
            return;
        }

        const connection = echo.connector.pusher.connection;

        const subscribeToPrivateChannel = () => {
            try {
                const channel = echo.private(`notifications.${user.user_id}`);

                channel.listen('.notification.new', (data) => {
                    handleNotificationByType(data);
                });

                channel.subscribed(() => {
                    console.log(`✅ Subscribed to notifications.${user.user_id}`);
                });

                channel.error((error) => {
                    console.error('❌ Private channel subscription error:', error);
                });

            } catch (error) {
                console.error('⚠️ Error subscribing to private channel:', error);
            }
        };

        if (connection.state === "connected") {
            subscribeToPrivateChannel();
        } else {
            connection.bind("connected", () => {
                subscribeToPrivateChannel();
            });

            if (connection.state === "disconnected" || connection.state === "unavailable") {
                connection.connect();
            }
        }
    }, [user, handleNotificationByType]);

    // ============================================
    // SETUP
    // ============================================

    useEffect(() => {
        setIsMounted(true);
        fetchAllData();

        if (user) {
            setupRealtimeNotifications();
        }

        return () => {
            setIsMounted(false);
            try {
                if (user) {
                    echo.leave(`notifications.${user.user_id}`);
                }
            } catch (e) {
                // Ignore cleanup errors
            }
        };
    }, [user, fetchAllData, setupRealtimeNotifications]);

    const handleRefresh = () => {
        setRefreshing(true);
        setNewNotificationCount(0);
        fetchAllData();
        toast.success("Dashboard refreshed");
    };

    // ============================================
    // HELPERS
    // ============================================

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
        });
    };

    const formatCurrency = (amount) => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount === 0) return "₱0";
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 0,
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

    const topDepartments = departmentBudgets.slice(0, 6);

    // ============================================
    // LOADING STATE
    // ============================================

    if (loading || pendingLoading || approvedLoading || budgetLoading) {
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
                                        weekday: "long",
                                        month: "long",
                                        day: "numeric",
                                    })}
                                </Badge>
                                <Badge className="border-amber-500/30 bg-amber-500/20 text-amber-300">
                                    <Fuel className="mr-1 h-3 w-3" />
                                    FY {new Date().getFullYear()}
                                </Badge>
                                {newNotificationCount > 0 && (
                                    <Badge className="border-red-500/30 bg-red-500/20 text-red-300 animate-pulse">
                                        <Bell className="mr-1 h-3 w-3" />
                                        {newNotificationCount} new
                                    </Badge>
                                )}
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                                {getGreeting()}, {user?.first_name || "Mayor"}
                            </h1>
                            <p className="mt-1 text-sm text-slate-300">
                                Monitor fund releases and department budget utilization for FY {new Date().getFullYear()}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
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
                                    Annual Budget Overview FY {new Date().getFullYear()}
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
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" key={`stats-${forceUpdate}`}>
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
                                        Real-time budget consumption across departments for FY {new Date().getFullYear()}
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
                                <p className="mt-3 text-slate-500 dark:text-slate-400">
                                    No annual budget data available
                                </p>
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
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {recentReleases.length === 0 ? (
                                <div className="py-12 text-center">
                                    <DollarSign className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
                                    <p className="mt-3 text-slate-500 dark:text-slate-400">
                                        No funds released yet
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {recentReleases.map((ticket, idx) => (
                                        <div
                                            key={ticket.id || ticket.trip_ticket_id}
                                            className="group flex items-center justify-between py-3 first:pt-0 last:pb-0"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                                                        {ticket.ticket_number || ticket.trip_ticket_number}
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className="text-xs dark:border-slate-600 dark:text-slate-400"
                                                    >
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
                                                    onClick={() =>
                                                        navigate(
                                                            `/mo/tickets/${ticket.id || ticket.trip_ticket_id}`,
                                                        )
                                                    }
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
                                    href="/mo/pending"
                                    color="from-amber-500 to-amber-600"
                                    count={stats.pendingCount}
                                    onClick={() => navigate("/mo/pending")}
                                />
                                <QuickLinkCard
                                    title="Financial Reports"
                                    description="Budget vs Actual analysis"
                                    icon={BarChart3}
                                    href="/mo/reports"
                                    color="from-blue-500 to-blue-600"
                                    onClick={() => navigate("/mo/reports")}
                                />
                                <QuickLinkCard
                                    title="Released Tickets"
                                    description="View all released funds"
                                    icon={CheckCircle}
                                    href="/mo/approved"
                                    color="from-purple-500 to-purple-600"
                                    count={stats.releasedCount}
                                    onClick={() => navigate("/mo/approved")}
                                />
                                <QuickLinkCard
                                    title="Receipt Verification"
                                    description="Verify fuel receipts"
                                    icon={Receipt}
                                    href="/mo/receipt-verification"
                                    color="from-emerald-500 to-emerald-600"
                                    onClick={() => navigate("/mo/receipt-verification")}
                                />
                            </div>

                            {/* Quick Stats Footer */}
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
                                                {departmentBudgets.filter(
                                                    (d) => parseFloat(d.utilization) < 60 && d.has_budget,
                                                ).length}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                Good Standing
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                                                {departmentBudgets.filter(
                                                    (d) =>
                                                        parseFloat(d.utilization) >= 60 &&
                                                        parseFloat(d.utilization) < 80 &&
                                                        d.has_budget,
                                                ).length}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                Warning
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-red-600 dark:text-red-400">
                                                {departmentBudgets.filter(
                                                    (d) => parseFloat(d.utilization) >= 80 && d.has_budget,
                                                ).length}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                Critical
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                                    <span>Annual Budgets FY {new Date().getFullYear()}</span>
                                    <span>{stats.departmentsWithBudget} departments active</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p>FCMS - Mayor's Office Dashboard • Laguindingan Municipality</p>
                    <p className="mt-0.5">FY {new Date().getFullYear()} • {stats.departmentsWithBudget} departments with active budgets</p>
                </div>
            </div>
        </div>
    );
};

export default MayorDashboard;
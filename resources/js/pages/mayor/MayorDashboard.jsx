// src/pages/mayor/MayorDashboard.jsx

import React, { useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import {
    SkeletonPage,
    SkeletonCard,
} from "../../components/ui/SkeletonCard";
import api, { mayorsOfficeAPI } from "../../services/api";

import {
    Clock,
    BarChart3,
    ArrowRight,
    AlertCircle,
    Activity,
    PieChart,
    ChevronRight,
    Receipt,
    Coins,
    History,
    Lock,
    DollarSign,
} from "lucide-react";
import {
    PieChart as RePieChart,
    Pie,
    Cell,
    ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

// ============================================
// CONSTANTS
// ============================================

const DONUT_COLORS = {
    remaining: "#10b981", // emerald
    utilized: "#f59e0b",  // amber
};

// ============================================
// SAFE ARRAY EXTRACTION
// ============================================

const extractArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.data)) return response.data;
    if (response.data && Array.isArray(response.data.data)) return response.data.data;

    const keys = ['items', 'results', 'records', 'rows', 'list', 'tickets', 'trips', 'departments', 'budgets'];
    for (const key of keys) {
        if (Array.isArray(response[key])) return response[key];
        if (response.data && Array.isArray(response.data[key])) return response.data[key];
    }
    if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
        return response.data.data.data;
    }
    console.warn('⚠️ extractArray (MayorDashboard): unexpected shape:', response);
    return [];
};

const useSafeArray = (value) => useMemo(() => Array.isArray(value) ? value : [], [value]);

// ============================================
// QUICK NAV PILL
// ============================================

const QuickNavPill = ({ label, icon: Icon, onClick }) => (
    <button
        onClick={onClick}
        className={cn(
            "group flex items-center justify-between gap-3 rounded-xl px-4 h-[58px] text-left transition-all duration-200 border",
            "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300",
            "dark:border-slate-700/60 dark:bg-slate-800/40 dark:hover:bg-slate-700/50 dark:hover:border-slate-600"
        )}
    >
        <span className="flex items-center gap-3 min-w-0">
            <span
                className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    "bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900",
                    "dark:bg-slate-700/70 dark:text-slate-200 dark:group-hover:bg-slate-700 dark:group-hover:text-white"
                )}
            >
                <Icon className="h-4 w-4" />
            </span>
            <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {label}
            </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
    </button>
);

// ============================================
// EMPTY STATE — NO ACTIVE FISCAL YEAR
// ============================================

const NoFiscalYearEmptyState = () => (
    <div
        className={cn(
            "rounded-2xl p-6 border",
            "border-slate-200 bg-white/80",
            "dark:border-slate-700/50 dark:bg-slate-800/30"
        )}
    >
        <div className="py-14 max-w-lg mx-auto text-center">
            <div
                className={cn(
                    "mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-5 border",
                    "bg-gradient-to-br from-amber-100 to-amber-200 border-amber-200",
                    "dark:from-amber-500/20 dark:to-amber-600/20 dark:border-amber-500/30"
                )}
            >
                <Lock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                No Active Fiscal Year
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
                Budget tracking is currently inactive. To view fund releases, budget utilization,
                and department allocations, a fiscal year must first be activated.
            </p>
            <div
                className={cn(
                    "mt-6 rounded-xl p-4 text-left border",
                    "bg-slate-50 border-slate-200",
                    "dark:bg-slate-900/60 dark:border-slate-700/50"
                )}
            >
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    What to do
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Ask the <strong className="text-slate-900 dark:text-white">General Services Office (GSO)</strong> to activate a fiscal year
                    from the Fiscal Year Management page.
                </p>
            </div>
            <p className="mt-6 text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                This dashboard will populate automatically once a fiscal year is active.
            </p>
        </div>
    </div>
);

// ============================================
// HISTORY TIMESTAMP — "23/09/2026, 6:29 PM"
// ============================================

const formatHistoryTimestamp = (dateString) => {
    if (!dateString) return "N/A";
    try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const time = date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
        return `${day}/${month}/${year}, ${time}`;
    } catch {
        return "N/A";
    }
};

// ============================================
// BUDGET LOG MESSAGE — mirrors mo/ActivityLogs.jsx
// ============================================

const formatBudgetLogText = (log) => {
    const userName = log?.user_name || "Unknown User";
    const dept = log?.department_name || "a department";
    const action = (log?.action || "").toLowerCase();

    const fmt = (n) =>
        `₱${Number(n || 0).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    switch (action) {
        case "annual_created":
            return `${userName} created annual budget ${fmt(log.new_amount)} for ${dept}`;
        case "annual_updated":
            return `${userName} updated annual budget for ${dept} (${fmt(log.previous_amount)} → ${fmt(log.new_amount)})`;
        case "annual_added":
            return `${userName} added ${fmt(log.added_amount)} to ${dept} (new total: ${fmt(log.new_amount)})`;
        case "weekly_allocated":
            return `${userName} set weekly ceiling for ${dept} to ${fmt(log.new_amount)}`;
        case "weekly_reset":
            return `${userName} triggered weekly budget reset`;
        default:
            return `${userName} ${action.replace(/_/g, " ")} for ${dept}`;
    }
};

// ============================================
// DONUT CHART (recharts, ~290px)
// ============================================

const BudgetUtilizationDonut = ({ total, used, remaining }) => {
    const safeTotal = total > 0 ? total : 0;
    const safeUsed = used > 0 ? used : 0;
    const safeRemaining = remaining > 0 ? remaining : 0;
    const totalForChart = safeUsed + safeRemaining;

    const fmt = (n) =>
        new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 0,
        }).format(Number(n) || 0);

    const usedPct = totalForChart > 0 ? (safeUsed / totalForChart) * 100 : 0;
    const remainingPct = totalForChart > 0 ? (safeRemaining / totalForChart) * 100 : 0;

    const chartData = [
        { name: "Remaining Balance", value: safeRemaining, color: DONUT_COLORS.remaining },
        { name: "Utilized Amount",   value: safeUsed,      color: DONUT_COLORS.utilized },
    ].filter(d => d.value > 0);

    const hasData = chartData.length > 0;

    return (
        <div className="flex flex-col h-full">
            <div className="relative flex-1 min-h-[340px]">
                {hasData ? (
                    <>
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie
                                    data={chartData}
                                    dataKey="value"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={105}
                                    outerRadius={145}
                                    startAngle={90}
                                    endAngle={-270}
                                    paddingAngle={1}
                                    stroke="none"
                                >
                                    {chartData.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                            </RePieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {fmt(safeTotal)}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                                Total Budget
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                        <PieChart className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            No budget data yet
                        </p>
                    </div>
                )}
            </div>

            <div className="space-y-3 mt-6">
                <LegendRow
                    color={DONUT_COLORS.remaining}
                    label="Remaining Balance"
                    value={fmt(safeRemaining)}
                    pct={remainingPct}
                />
                <LegendRow
                    color={DONUT_COLORS.utilized}
                    label="Utilized Amount"
                    value={fmt(safeUsed)}
                    pct={usedPct}
                />
                <div className="pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                    <LegendRow
                        color="#3b82f6"
                        label="Total Budget"
                        value={fmt(safeTotal)}
                        pct={100}
                        emphasize
                    />
                </div>
            </div>
        </div>
    );
};

const LegendRow = ({ color, label, value, pct, emphasize = false }) => (
    <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
            <span
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
            />
            <span
                className={cn(
                    "text-sm truncate",
                    emphasize
                        ? "font-medium text-slate-800 dark:text-slate-200"
                        : "text-slate-500 dark:text-slate-400"
                )}
            >
                {label}
            </span>
        </div>
        <div className="text-right flex-shrink-0">
            <p
                className={cn(
                    "text-sm font-semibold",
                    emphasize
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-900 dark:text-white"
                )}
            >
                {value}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {pct.toFixed(1)}%
            </p>
        </div>
    </div>
);

// ============================================
// LOADING SKELETON
// ============================================

const LoadingSkeleton = () => (
    <div className="space-y-6 p-4 md:p-6 min-h-screen">
        <SkeletonPage />
        <SkeletonCard className="h-16" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonCard className="h-[560px]" />
            <SkeletonCard className="h-[560px]" />
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

    const fetchAllData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["mayor-approved-tickets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-department-budgets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-active-fiscal-year"] });
        queryClient.invalidateQueries({ queryKey: ["mo-activity-logs-dashboard"] });
    }, [queryClient]);

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

    // ============ ACTIVE FISCAL YEAR ============

    const { data: activeFiscalYearsRaw, isLoading: fiscalYearLoading } = useOptimizedQuery({
        queryKey: ["mayor-active-fiscal-year"],
        queryFn: async () => {
            try {
                const response = await api.get("/mayors-office/fiscal-years?is_active=1");
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
    const activeFiscalYear = activeFiscalYears[0]?.year ?? new Date().getFullYear();
    const hasActiveFiscalYear = activeFiscalYears.length > 0;

    // ============ APPROVED / RELEASED ============

    const { data: approvedResponse, isLoading: approvedLoading } = useOptimizedQuery({
        queryKey: ["mayor-approved-tickets"],
        queryFn: async () => {
            try {
                const response = await mayorsOfficeAPI.getApprovedTickets();
                return { data: extractArray(response) };
            } catch (error) {
                console.error("Error fetching approved tickets:", error);
                return { data: [] };
            }
        },
        refetchOnMount: 'always',
    });
    const approvedTickets = useSafeArray(approvedResponse?.data);

    // ============ DEPARTMENT BUDGETS ============

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

    // ============ MO ACTIVITY LOGS (for Budget History card) ============

    const { data: activityRaw, isLoading: activityLoading } = useOptimizedQuery({
        queryKey: ["mo-activity-logs-dashboard"],
        queryFn: async () => {
            try {
                const res = await api.get("/mayors-office/activity-logs");
                return res?.data?.data?.logs || res?.data?.logs || [];
            } catch (error) {
                console.error("Error fetching activity logs:", error);
                return [];
            }
        },
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
    });
    const activityLogs = useSafeArray(activityRaw);

    // ============ COMPUTED ============

    const departmentBudgets = useMemo(() => {
        const formatted = budgetData.map((dept) => ({
            department_id: dept.department_id,
            department_name: dept.department_name,
            allocated: parseFloat(dept.allocated_amount || dept.annual_amount || dept.allocated || 0),
            spent: parseFloat(dept.spent_amount || dept.used_amount || dept.spent || 0),
            remaining: parseFloat(dept.remaining_amount || 0),
            has_budget: dept.has_budget || false,
            utilization: parseFloat(dept.utilization_percentage || dept.utilization || 0),
            fiscal_year: dept.fiscal_year || activeFiscalYear,
        }));
        formatted.sort((a, b) => parseFloat(b.utilization) - parseFloat(a.utilization));
        return formatted;
    }, [budgetData, activeFiscalYear]);

    const totals = useMemo(() => {
        const totalAllocated = departmentBudgets.reduce((s, d) => s + d.allocated, 0);
        const totalUsed = departmentBudgets.reduce((s, d) => s + d.spent, 0);
        const totalRemaining = Math.max(totalAllocated - totalUsed, 0);
        const deptsWithBudget = departmentBudgets.filter(d => d.has_budget).length;
        return {
            totalAllocated,
            totalUsed,
            totalRemaining,
            departmentsWithBudget: deptsWithBudget,
        };
    }, [departmentBudgets]);

    const recentReleases = useMemo(() => approvedTickets.slice(0, 5), [approvedTickets]);

    // ============ BUDGET HISTORY — from /mayors-office/activity-logs ============

    const budgetHistory = useMemo(() => {
        const budgetLogs = activityLogs.filter((l) => l?.source === "budget");
        return budgetLogs.slice(0, 5);
    }, [activityLogs]);

    // ============ HELPERS ============

    const formatDateShort = (dateString) => {
        if (!dateString) return "—";
        return new Date(dateString).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    };

    const formatCurrency = (amount) => {
        const num = parseFloat(amount);
        if (isNaN(num)) return "₱0";
        return new Intl.NumberFormat("en-PH", {
            style: "currency", currency: "PHP", minimumFractionDigits: 0,
        }).format(num);
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    const isRealTime = isConnected;

    // ============ LOADING ============

    const isLoading = approvedLoading || budgetLoading || fiscalYearLoading || activityLoading;
    const showFullSkeleton =
        isLoading &&
        approvedTickets.length === 0 &&
        departmentBudgets.length === 0 &&
        !hasActiveFiscalYear;

    if (showFullSkeleton) {
        return <LoadingSkeleton />;
    }

    // ============ RENDER ============

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="space-y-5 p-4 md:p-6">

                {/* ===== Hero Header ===== */}
                <div
                    className={cn(
                        "relative overflow-hidden rounded-2xl p-6 shadow-xl border",
                        "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-700/40",
                        "dark:from-[#0d1b3e] dark:via-[#122252] dark:to-[#0d1b3e]"
                    )}
                >
                    <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                                {getGreeting()}, {user?.first_name || "Mayor"}
                            </h1>
                            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                LIVE
                            </span>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-300 dark:text-slate-400">
                            {hasActiveFiscalYear ? (
                                <>
                                    Monitor fund releases and department budget utilization for{" "}
                                    <strong className="text-white dark:text-slate-200">FY {activeFiscalYear}</strong>
                                    <span className="ml-2 text-xs text-amber-400">● Active fiscal year</span>
                                </>
                            ) : (
                                <>Disbursing Officer dashboard — waiting for fiscal year activation</>
                            )}
                            {isRealTime && <span className="ml-2 text-xs text-emerald-400 animate-pulse">● Auto-refresh</span>}
                        </p>
                    </div>
                </div>

                {/* ===== EMPTY OR DASHBOARD ===== */}

                {!hasActiveFiscalYear ? (
                    <NoFiscalYearEmptyState />
                ) : (
                    <>
                        {/* ===== Quick Navigation ===== */}
                        <div>
                            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Quick Navigation
                            </h2>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                                <QuickNavPill label="Budget Allocation" icon={Coins} onClick={() => navigate("/mo/budget-allocation")} />
                                <QuickNavPill label="Disbursement Approval" icon={Clock} onClick={() => navigate("/mo/pending")} />
                                <QuickNavPill label="Receipt Verification" icon={Receipt} onClick={() => navigate("/mo/receipt-verification")} />
                                <QuickNavPill label="Reports" icon={BarChart3} onClick={() => navigate("/mo/reports")} />
                                <QuickNavPill label="Activity Logs" icon={Activity} onClick={() => navigate("/mo/activity-logs")} />
                            </div>
                        </div>

                        {/* ===== Charts + Tables Row ===== */}
                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 items-stretch xl:min-h-[500px]">

                            {/* Donut Chart Card */}
                            <div
                                className={cn(
                                    "rounded-2xl p-5 flex flex-col border shadow-sm",
                                    "border-slate-200 bg-white/80",
                                    "dark:border-slate-700/50 dark:bg-slate-800/30"
                                )}
                            >
                                <div className="mb-5 flex items-center gap-3">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20">
                                        <PieChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </span>
                                    <div>
                                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                            Annual Budget Utilization
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            FY {activeFiscalYear} · Total Budget vs. Utilized vs. Remaining
                                        </p>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col">
                                    <BudgetUtilizationDonut
                                        total={totals.totalAllocated}
                                        used={totals.totalUsed}
                                        remaining={totals.totalRemaining}
                                    />
                                </div>
                            </div>

                            {/* Right column */}
                            <div className="flex flex-col gap-5 h-full">

                                {/* Recent Fund Release */}
                                <div
                                    className={cn(
                                        "rounded-2xl p-5 flex flex-col flex-1 border shadow-sm",
                                        "border-slate-200 bg-white/80",
                                        "dark:border-slate-700/50 dark:bg-slate-800/30"
                                    )}
                                >
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
                                                <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                            </span>
                                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                                Recent Fund Release
                                            </h3>
                                        </div>
                                        <button
                                            onClick={() => navigate("/mo/approved")}
                                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                        >
                                            View All <ArrowRight className="h-3 w-3" />
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto flex-1">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b text-left text-xs text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/60">
                                                    <th className="pb-2 pr-4 font-medium">Date</th>
                                                    <th className="pb-2 pr-4 font-medium">Department</th>
                                                    <th className="pb-2 pr-4 text-right font-medium">Amount</th>
                                                    <th className="pb-2 text-right font-medium">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentReleases.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="py-8 text-center text-slate-400 dark:text-slate-500">
                                                            No funds released yet
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    recentReleases.map((ticket) => (
                                                        <tr
                                                            key={ticket.id || ticket.trip_ticket_id}
                                                            className="border-b last:border-0 border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/20"
                                                        >
                                                            <td className="py-3.5 pr-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                                {formatDateShort(ticket.trip_date || ticket.created_at)}
                                                            </td>
                                                            <td className="py-3.5 pr-4 text-slate-700 dark:text-slate-200 truncate max-w-[180px]">
                                                                {ticket.department_name || "—"}
                                                            </td>
                                                            <td className="py-3.5 pr-4 text-right text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                                                {formatCurrency(ticket.amount_released || ticket.gas_slip?.amount_released || 0)}
                                                            </td>
                                                            <td className="py-3.5 text-right">
                                                                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                                                                    Released
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Budget History */}
                                <div
                                    className={cn(
                                        "rounded-2xl p-5 flex flex-col flex-1 border shadow-sm",
                                        "border-slate-200 bg-white/80",
                                        "dark:border-slate-700/50 dark:bg-slate-800/30"
                                    )}
                                >
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20">
                                                <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                            </span>
                                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                                Budget History
                                            </h3>
                                        </div>
                                        <button
                                            onClick={() => navigate("/mo/activity-logs")}
                                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                        >
                                            View Full History <ArrowRight className="h-3 w-3" />
                                        </button>
                                    </div>

                                    <div className="flex-1">
                                        {budgetHistory.length === 0 ? (
                                            <div className="py-10 text-center">
                                                <History className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    No budget activity yet
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                                {budgetHistory.map((log, i) => (
                                                    <div
                                                        key={log.id || i}
                                                        className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                                                    >
                                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                                            <DollarSign className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                                                {formatBudgetLogText(log)}
                                                            </p>
                                                        </div>
                                                        <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                                                            {log.created_at
                                                                ? formatHistoryTimestamp(log.created_at)
                                                                : "N/A"}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ===== Footer ===== */}
                <div className="text-center text-xs pt-2 border-t border-slate-200 dark:border-slate-700/50 text-slate-400 dark:text-slate-500">
                    <p>FCMS - Mayor's Office Dashboard • Municipality of Laguindingan</p>
                    <p className="mt-0.5">
                        FY {activeFiscalYear}
                        {hasActiveFiscalYear ? ' (Active)' : ' (No active fiscal year)'}
                        {' • '}{totals.departmentsWithBudget} departments with active budgets
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MayorDashboard;
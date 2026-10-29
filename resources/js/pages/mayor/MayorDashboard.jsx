// src/pages/mayor/MayorDashboard.jsx

import React, { useMemo, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import { SkeletonPage, SkeletonCard } from "../../components/ui/SkeletonCard";
import api, { mayorsOfficeAPI } from "../../services/api";

import {
    Clock, BarChart3, ArrowRight, AlertCircle, Activity, PieChart,
    ChevronRight, Receipt, Coins, History, Lock, DollarSign, Fuel,
    Building2, Filter,
} from "lucide-react";
import {
    Cell, PieChart as RePieChart, Pie, ResponsiveContainer, Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

// ============================================
// CONSTANTS
// ============================================

const DEPARTMENT_PALETTE = [
    "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4",
    "#ec4899", "#84cc16", "#f97316", "#6366f1", "#14b8a6", "#a855f7",
];

// ============================================
// SAFE ARRAY EXTRACTION
// ============================================

const extractArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.data)) return response.data;
    if (response.data && Array.isArray(response.data.data)) return response.data.data;
    return [];
};

const useSafeArray = (value) => useMemo(() => (Array.isArray(value) ? value : []), [value]);

// ============================================
// QUICK NAV PILL
// ============================================

const QuickNavPill = ({ label, icon: Icon, onClick }) => (
    <button
        onClick={onClick}
        className={cn(
            "group flex items-center justify-between gap-3 rounded-xl px-4 h-[58px] text-left transition-all duration-200 border",
            "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300",
            "dark:border-slate-700/60 dark:bg-slate-800/40 dark:hover:bg-slate-700/50 dark:hover:border-slate-600",
        )}
    >
        <span className="flex items-center gap-3 min-w-0">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors", "bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900", "dark:bg-slate-700/70 dark:text-slate-200 dark:group-hover:bg-slate-700 dark:group-hover:text-white")}>
                <Icon className="h-4 w-4" />
            </span>
            <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
    </button>
);

// ============================================
// NO FISCAL YEAR EMPTY STATE
// ============================================

const NoFiscalYearEmptyState = () => (
    <div className={cn("rounded-2xl p-6 border", "border-slate-200 bg-white/80", "dark:border-slate-700/50 dark:bg-slate-800/30")}>
        <div className="py-14 max-w-lg mx-auto text-center">
            <div className={cn("mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-5 border", "bg-gradient-to-br from-amber-100 to-amber-200 border-amber-200", "dark:from-amber-500/20 dark:to-amber-600/20 dark:border-amber-500/30")}>
                <Lock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">No Active Fiscal Year</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
                Budget tracking is currently inactive. To view fund releases, budget utilization, and department allocations, a fiscal year must first be activated.
            </p>
            <div className={cn("mt-6 rounded-xl p-4 text-left border", "bg-slate-50 border-slate-200", "dark:bg-slate-900/60 dark:border-slate-700/50")}>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">What to do</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Ask the <strong className="text-slate-900 dark:text-white">General Services Office (GSO)</strong> to activate a fiscal year from the Fiscal Year Management page.
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
// HELPERS
// ============================================

const formatHistoryTimestamp = (dateString) => {
    if (!dateString) return "N/A";
    try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
        return `${day}/${month}/${year}, ${time}`;
    } catch { return "N/A"; }
};

const formatBudgetLogText = (log) => {
    const userName = log?.user_name || "Unknown User";
    const dept = log?.department_name || "a department";
    const action = (log?.action || "").toLowerCase();
    const fmt = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    switch (action) {
        case "annual_created": return `${userName} created annual budget ${fmt(log.new_amount)} for ${dept}`;
        case "annual_updated": return `${userName} updated annual budget for ${dept} (${fmt(log.previous_amount)} → ${fmt(log.new_amount)})`;
        case "annual_added": return `${userName} added ${fmt(log.added_amount)} to ${dept} (new total: ${fmt(log.new_amount)})`;
        case "weekly_allocated": return `${userName} set weekly ceiling for ${dept} to ${fmt(log.new_amount)}`;
        case "weekly_reset": return `${userName} triggered weekly budget reset`;
        default: return `${userName} ${action.replace(/_/g, " ")} for ${dept}`;
    }
};

// ============================================
// DYNAMIC PIE CHART (ALLOCATION & CONSUMPTION)
// ============================================

const DashboardPie = ({ departments, totals, fiscalYear, tickets }) => {
    const [activeIndex, setActiveIndex] = useState(null);
    
    // Toggle between Allocation and Consumption
    const [viewMode, setViewMode] = useState('allocation');
    
    // Department Filter
    const [selectedDept, setSelectedDept] = useState('all');

    // Drill-down state (for Consumption)
    const [selectedYear, setSelectedYear] = useState(String(fiscalYear));
    const [selectedMonth, setSelectedMonth] = useState("all");
    const [selectedWeek, setSelectedWeek] = useState("all");
    const [selectedDay, setSelectedDay] = useState("all");

    const fmt = (n) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 }).format(Number(n) || 0);
    const fmtCompact = (n) => {
        const num = Number(n) || 0;
        if (Math.abs(num) >= 1_000_000) return `₱${(num / 1_000_000).toFixed(2)}M`;
        if (Math.abs(num) >= 1_000) return `₱${(num / 1_000).toFixed(0)}k`;
        return `₱${num.toFixed(0)}`;
    };

    // Filter departments for the dropdown
    const departmentOptions = useMemo(() => {
        return departments.filter(d => d.has_budget).sort((a, b) => a.department_name.localeCompare(b.department_name));
    }, [departments]);

    // --- ALLOCATION DATA ---
    const allocationData = useMemo(() => {
        let filtered = departments.filter(d => d.has_budget && d.allocated > 0);
        if (selectedDept !== 'all') {
            filtered = filtered.filter(d => d.department_name === selectedDept);
        }
        const total = filtered.reduce((s, d) => s + d.allocated, 0);
        return filtered
            .map((d, i) => ({ name: d.department_name, value: d.allocated, color: DEPARTMENT_PALETTE[i % DEPARTMENT_PALETTE.length] }))
            .sort((a, b) => b.value - a.value);
    }, [departments, selectedDept]);

    // --- CONSUMPTION DATA ---
    const consumptionData = useMemo(() => {
        if (viewMode !== 'consumption') return [];
        
        let filteredTickets = tickets.filter(t => {
            const d = new Date(t.trip_date || t.created_at);
            if (isNaN(d)) return false;
            if (d.getFullYear().toString() !== selectedYear) return false;
            if (selectedMonth !== "all" && (d.getMonth() + 1).toString() !== selectedMonth) return false;
            if (selectedWeek !== "all") {
                const weekNum = Math.ceil((((d - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1) / 7);
                if (weekNum.toString() !== selectedWeek) return false;
            }
            if (selectedDay !== "all" && d.getDate().toString() !== selectedDay) return false;
            return true;
        });

        if (selectedDept !== 'all') {
            filteredTickets = filteredTickets.filter(t => t.department_name === selectedDept);
        }

        const grouped = {};
        filteredTickets.forEach(t => {
            // If a specific dept is selected, show destinations. Otherwise, show departments.
            const key = selectedDept === 'all' ? (t.department_name || "Unknown") : (t.destination || "Unknown");
            const amount = parseFloat(t.amount_released ?? t.gas_slip?.amount_released ?? 0);
            if (amount > 0) grouped[key] = (grouped[key] || 0) + amount;
        });

        return Object.entries(grouped)
            .map(([name, value], i) => ({ name, value, color: DEPARTMENT_PALETTE[i % DEPARTMENT_PALETTE.length] }))
            .sort((a, b) => b.value - a.value);
    }, [tickets, selectedDept, viewMode, selectedYear, selectedMonth, selectedWeek, selectedDay]);

    const pieData = viewMode === 'allocation' ? allocationData : consumptionData;
    const totalValue = pieData.reduce((s, d) => s + d.value, 0);

    // Dropdown options for drill-down
    const months = [{ value: "all", label: "All Months" }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }) }))];
    const weeks = [{ value: "all", label: "All Weeks" }, ...Array.from({ length: 53 }, (_, i) => ({ value: String(i + 1), label: `Week ${i + 1}` }))];
    const days = [{ value: "all", label: "All Days" }, ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `Day ${i + 1}` }))];

    const PieTooltip = ({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload;
        return (
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                <p className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{d.name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{viewMode === 'allocation' ? 'Annual Budget' : 'Released'}: <strong>{fmt(d.value)}</strong></p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Share: <strong>{((d.value / totalValue) * 100).toFixed(1)}%</strong></p>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full">
            
            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                
                {/* View Mode Toggle */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mr-auto">
                    <button onClick={() => setViewMode('allocation')} className={cn("px-3 py-1 text-xs font-medium rounded-md", viewMode === 'allocation' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500")}>Allocation</button>
                    <button onClick={() => setViewMode('consumption')} className={cn("px-3 py-1 text-xs font-medium rounded-md", viewMode === 'consumption' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500")}>Consumption</button>
                </div>

                {/* Department Filter */}
                <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="text-xs p-1.5 rounded border dark:bg-slate-800 dark:border-slate-600 font-medium text-slate-900 dark:text-white outline-none">
                    <option value="all">All Departments</option>
                    {departmentOptions.map(d => <option key={d.department_id} value={d.department_name}>{d.department_name}</option>)}
                </select>

                {/* Drill-down Filters (Only visible on Consumption) */}
                {viewMode === 'consumption' && (
                    <div className="flex gap-1">
                        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="text-xs p-1.5 rounded border dark:bg-slate-800 dark:border-slate-600 text-slate-900 dark:text-white outline-none"><option value={String(fiscalYear)}>{fiscalYear}</option></select>
                        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="text-xs p-1.5 rounded border dark:bg-slate-800 dark:border-slate-600 text-slate-900 dark:text-white outline-none">{months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
                        <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} className="text-xs p-1.5 rounded border dark:bg-slate-800 dark:border-slate-600 text-slate-900 dark:text-white outline-none">{weeks.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}</select>
                        <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)} className="text-xs p-1.5 rounded border dark:bg-slate-800 dark:border-slate-600 text-slate-900 dark:text-white outline-none">{days.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select>
                    </div>
                )}
            </div>

            {/* Chart */}
            {pieData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                    <PieChart className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No data for this selection</p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row items-center gap-4">
                    <div className="relative w-full md:w-[55%] h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie
                                    data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                    innerRadius="55%" outerRadius="85%" paddingAngle={2} minAngle={3} stroke="none"
                                    onClick={(_, index) => setActiveIndex(prev => prev === index ? null : index)}
                                    onMouseEnter={(_, index) => setActiveIndex(index)}
                                    onMouseLeave={() => setActiveIndex(null)}
                                >
                                    {pieData.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} style={{ opacity: activeIndex !== null && activeIndex !== i ? 0.3 : 1, cursor: 'pointer' }} />
                                    ))}
                                </Pie>
                                <Tooltip content={<PieTooltip />} cursor={false} />
                            </RePieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <p className="text-[10px] uppercase text-slate-400 font-bold">{viewMode === 'allocation' ? 'Total Budget' : 'Total Released'}</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{fmtCompact(totalValue)}</p>
                        </div>
                    </div>

                    <div className="w-full md:w-[45%] md:max-h-[250px] md:overflow-y-auto">
                        <ul className="space-y-1">
                            {pieData.map((d, i) => (
                                <li key={i} onMouseEnter={() => setActiveIndex(i)} onMouseLeave={() => setActiveIndex(null)} className={cn("flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer", activeIndex === i ? "bg-slate-100 dark:bg-slate-700/50" : "")}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                                        <span className="truncate text-slate-700 dark:text-slate-300">{d.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-slate-800 dark:text-white">{fmtCompact(d.value)}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
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

    useAutoRefresh(["mayor-trip-updated", "mayor-new-pending", "mayor-budget-updated", "gso-funds-released", "trip-completed", "new-notification"], fetchAllData, 1000);

    const { data: activeFiscalYearsRaw, isLoading: fiscalYearLoading } = useOptimizedQuery({
        queryKey: ["mayor-active-fiscal-year"],
        queryFn: async () => {
            try {
                const response = await api.get("/mayors-office/fiscal-years?is_active=1");
                return extractArray(response.data?.data || []);
            } catch { return []; }
        },
        staleTime: 5 * 60 * 1000,
        refetchOnMount: "always",
    });
    const activeFiscalYears = useSafeArray(activeFiscalYearsRaw);
    const activeFiscalYear = activeFiscalYears[0]?.year ?? new Date().getFullYear();
    const hasActiveFiscalYear = activeFiscalYears.length > 0;

    const { data: approvedResponse, isLoading: approvedLoading } = useOptimizedQuery({
        queryKey: ["mayor-approved-tickets"],
        queryFn: async () => {
            try {
                const response = await mayorsOfficeAPI.getApprovedTickets();
                return { data: extractArray(response) };
            } catch { return { data: [] }; }
        },
        refetchOnMount: "always",
    });
    const approvedTickets = useSafeArray(approvedResponse?.data);

    const { data: budgetRaw, isLoading: budgetLoading } = useOptimizedQuery({
        queryKey: ["mayor-department-budgets"],
        queryFn: async () => {
            try {
                const response = await mayorsOfficeAPI.getAllDepartmentsWithBudget();
                return extractArray(response);
            } catch { return []; }
        },
        refetchOnMount: "always",
    });
    const budgetData = useSafeArray(budgetRaw);

    const { data: activityRaw, isLoading: activityLoading } = useOptimizedQuery({
        queryKey: ["mo-activity-logs-dashboard"],
        queryFn: async () => {
            try {
                const res = await api.get("/mayors-office/activity-logs");
                return res?.data?.data?.logs || res?.data?.logs || [];
            } catch { return []; }
        },
        staleTime: 0,
        refetchOnMount: "always",
    });
    const activityLogs = useSafeArray(activityRaw);

    const departmentBudgets = useMemo(() => {
        const formatted = budgetData.map(dept => ({
            department_id: dept.department_id,
            department_name: dept.department_name,
            allocated: parseFloat(dept.allocated_amount ?? dept.annual_amount ?? dept.allocated ?? 0),
            spent: parseFloat(dept.spent_amount ?? dept.used_amount ?? dept.spent ?? 0),
            remaining: parseFloat(dept.remaining_amount ?? 0),
            has_budget: dept.has_budget || false,
            utilization: parseFloat(dept.utilization_percentage ?? dept.utilization ?? 0),
        }));
        return formatted;
    }, [budgetData]);

    const totals = useMemo(() => {
        const totalAllocated = departmentBudgets.reduce((s, d) => s + d.allocated, 0);
        const totalUsed = departmentBudgets.reduce((s, d) => s + d.spent, 0);
        return { totalAllocated, totalUsed, totalRemaining: Math.max(totalAllocated - totalUsed, 0), departmentsWithBudget: departmentBudgets.filter(d => d.has_budget).length };
    }, [departmentBudgets]);

    const recentReleases = useMemo(() => approvedTickets.filter(t => new Date(t.trip_date ?? t.created_at).getFullYear() === activeFiscalYear).slice(0, 5), [approvedTickets, activeFiscalYear]);
    const budgetHistory = useMemo(() => activityLogs.filter(l => l?.source === 'budget' && new Date(l.created_at).getFullYear() === activeFiscalYear).slice(0, 5), [activityLogs, activeFiscalYear]);

    const formatDateShort = (ds) => ds ? new Date(ds).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";
    const formatCurrency = (a) => isNaN(parseFloat(a)) ? "₱0" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 }).format(parseFloat(a));
    const getGreeting = () => new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 18 ? "Good Afternoon" : "Good Evening";
    const isRealTime = isConnected;

    const isLoading = approvedLoading || budgetLoading || fiscalYearLoading || activityLoading;
    if (isLoading && approvedTickets.length === 0 && departmentBudgets.length === 0 && !hasActiveFiscalYear) return <LoadingSkeleton />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="space-y-5 p-4 md:p-6">
                
                {/* Hero Header */}
                <div className={cn("relative overflow-hidden rounded-2xl p-6 shadow-xl border", "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-700/40", "dark:from-[#0d1b3e] dark:via-[#122252] dark:to-[#0d1b3e]")}>
                    <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{getGreeting()}, {user?.first_name || "Mayor"}</h1>
                            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE</span>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-300 dark:text-slate-400">
                            {hasActiveFiscalYear ? (<>Monitor fund releases and department budget utilization for <strong className="text-white dark:text-slate-200">FY {activeFiscalYear}</strong><span className="ml-2 text-xs text-amber-400">● Active fiscal year</span></>) : (<>Disbursing Officer dashboard — waiting for fiscal year activation</>)}
                            {isRealTime && <span className="ml-2 text-xs text-emerald-400 animate-pulse">● Auto-refresh</span>}
                        </p>
                    </div>
                </div>

                {!hasActiveFiscalYear ? <NoFiscalYearEmptyState /> : (
                    <>
                        <div>
                            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick Navigation</h2>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                                <QuickNavPill label="Budget Allocation" icon={Coins} onClick={() => navigate("/mo/budget-allocation")} />
                                <QuickNavPill label="Disbursement Approval" icon={Clock} onClick={() => navigate("/mo/pending")} />
                                <QuickNavPill label="Receipt Verification" icon={Receipt} onClick={() => navigate("/mo/receipt-verification")} />
                                <QuickNavPill label="Reports" icon={BarChart3} onClick={() => navigate("/mo/reports")} />
                                <QuickNavPill label="Activity Logs" icon={Activity} onClick={() => navigate("/mo/activity-logs")} />
                                <QuickNavPill label="Create Gas Slip" icon={Fuel} onClick={() => navigate("/mo/gas-slips/create")} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 items-stretch xl:min-h-[500px]">
                            
                            {/* Pie Chart Card */}
                            <div className={cn("rounded-2xl p-5 flex flex-col border shadow-sm", "border-slate-200 bg-white/80", "dark:border-slate-700/50 dark:bg-slate-800/30")}>
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20">
                                            <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                        </span>
                                        <div className="min-w-0">
                                            <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">Budget Overview</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Toggle between allocated budget and actual consumption</p>
                                        </div>
                                    </div>
                                </div>
                                <DashboardPie departments={departmentBudgets} totals={totals} fiscalYear={activeFiscalYear} tickets={approvedTickets} />
                            </div>

                            {/* Right Column */}
                            <div className="flex flex-col gap-5 h-full">
                                
                                {/* Recent Fund Release */}
                                <div className={cn("rounded-2xl p-5 flex flex-col flex-1 border shadow-sm", "border-slate-200 bg-white/80", "dark:border-slate-700/50 dark:bg-slate-800/30")}>
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20"><Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></span>
                                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Recent Fund Release</h3>
                                        </div>
                                        <button onClick={() => navigate("/mo/approved")} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">View All <ArrowRight className="h-3 w-3" /></button>
                                    </div>
                                    <div className="overflow-x-auto flex-1">
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b text-left text-xs text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/60"><th className="pb-2 pr-4 font-medium">Date</th><th className="pb-2 pr-4 font-medium">Department</th><th className="pb-2 pr-4 text-right font-medium">Amount</th><th className="pb-2 text-right font-medium">Status</th></tr></thead>
                                            <tbody>
                                                {recentReleases.length === 0 ? <tr><td colSpan={4} className="py-8 text-center text-slate-400 dark:text-slate-500">No funds released yet</td></tr> : recentReleases.map(ticket => (
                                                    <tr key={ticket.id || ticket.trip_ticket_id} className="border-b last:border-0 border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                                                        <td className="py-3.5 pr-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatDateShort(ticket.trip_date ?? ticket.created_at)}</td>
                                                        <td className="py-3.5 pr-4 text-slate-700 dark:text-slate-200 truncate max-w-[180px]">{ticket.department_name || "—"}</td>
                                                        <td className="py-3.5 pr-4 text-right text-slate-700 dark:text-slate-200 whitespace-nowrap">{formatCurrency(ticket.amount_released ?? ticket.gas_slip?.amount_released ?? 0)}</td>
                                                        <td className="py-3.5 text-right"><span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">Released</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Budget History */}
                                <div className={cn("rounded-2xl p-5 flex flex-col flex-1 border shadow-sm", "border-slate-200 bg-white/80", "dark:border-slate-700/50 dark:bg-slate-800/30")}>
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20"><History className="h-5 w-5 text-blue-600 dark:text-blue-400" /></span>
                                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Budget History</h3>
                                        </div>
                                        <button onClick={() => navigate("/mo/activity-logs")} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">View Full History <ArrowRight className="h-3 w-3" /></button>
                                    </div>
                                    <div className="flex-1">
                                        {budgetHistory.length === 0 ? <div className="py-10 text-center"><History className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500 dark:text-slate-400">No budget activity yet</p></div> : (
                                            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                                {budgetHistory.map((log, i) => (
                                                    <div key={log.id || i} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                                                        <div className="flex items-start gap-2 flex-1 min-w-0"><DollarSign className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" /><p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{formatBudgetLogText(log)}</p></div>
                                                        <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">{log.created_at ? formatHistoryTimestamp(log.created_at) : "N/A"}</span>
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

                <div className="text-center text-xs pt-2 border-t border-slate-200 dark:border-slate-700/50 text-slate-400 dark:text-slate-500">
                    <p>FCMS - Mayor's Office Dashboard • Municipality of Laguindingan</p>
                    <p className="mt-0.5">FY {activeFiscalYear}{hasActiveFiscalYear ? " (Active)" : " (No active fiscal year)"}</p>
                </div>
            </div>
        </div>
    );
};

export default MayorDashboard;
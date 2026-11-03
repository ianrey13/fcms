// src/pages/mayor/MayorDashboard.jsx

import React, { useMemo, useCallback, useState, useEffect } from "react";
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
    Building2, Calendar, Download, CheckCircle
} from "lucide-react";
import {
    Cell, PieChart as RePieChart, Pie, ResponsiveContainer, Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
// HELPERS
// ============================================

const formatHistoryTimestamp = (dateString) => {
    if (!dateString) return "N/A";
    try {
        const date = new Date(dateString);
        return format(date, "MMM d, yyyy");
    } catch { return "N/A"; }
};

// ============================================
// DYNAMIC PIE CHART WITH DRILL-DOWN
// ============================================

const DashboardPie = ({ departments, totals, fiscalYear, tickets, onSelectDepartment }) => {
    const [activeIndex, setActiveIndex] = useState(null);
    const [viewMode, setViewMode] = useState('consumption'); // Default to consumption for the drill-down

    const fmtCompact = (n) => {
        const num = Number(n) || 0;
        if (Math.abs(num) >= 1_000_000) return `₱${(num / 1_000_000).toFixed(2)}M`;
        if (Math.abs(num) >= 1_000) return `₱${(num / 1_000).toFixed(0)}k`;
        return `₱${num.toFixed(0)}`;
    };

    // --- ALLOCATION DATA ---
    const allocationData = useMemo(() => {
        let filtered = departments.filter(d => d.has_budget && d.allocated > 0);
        return filtered
            .map((d, i) => ({ name: d.department_name, value: d.allocated, color: DEPARTMENT_PALETTE[i % DEPARTMENT_PALETTE.length] }))
            .sort((a, b) => b.value - a.value);
    }, [departments]);

    // --- CONSUMPTION DATA ---
    const consumptionData = useMemo(() => {
        let filteredTickets = tickets.filter(t => {
            const d = new Date(t.trip_date || t.created_at);
            return d.getFullYear() === fiscalYear;
        });

        const grouped = {};
        filteredTickets.forEach(t => {
            const key = t.department_name || "Unknown";
            const amount = parseFloat(t.amount_released ?? t.gas_slip?.amount_released ?? 0);
            if (amount > 0) grouped[key] = (grouped[key] || 0) + amount;
        });

        return Object.entries(grouped)
            .map(([name, value], i) => ({ name, value, color: DEPARTMENT_PALETTE[i % DEPARTMENT_PALETTE.length] }))
            .sort((a, b) => b.value - a.value);
    }, [tickets, fiscalYear]);

    const pieData = viewMode === 'allocation' ? allocationData : consumptionData;
    const totalValue = pieData.reduce((s, d) => s + d.value, 0);

    const PieTooltip = ({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload;
        return (
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                <p className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{d.name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{viewMode === 'allocation' ? 'Annual Budget' : 'Released'}: <strong>{fmtCompact(d.value)}</strong></p>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full">
            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mr-auto">
                    <button onClick={() => setViewMode('allocation')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", viewMode === 'allocation' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500")}>Allocation</button>
                    <button onClick={() => setViewMode('consumption')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", viewMode === 'consumption' ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500")}>Consumption</button>
                </div>
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
                                    onClick={(entry) => {
                                        setActiveIndex(prev => prev === entry.index ? null : entry.index);
                                        if (onSelectDepartment) {
                                            onSelectDepartment(entry.name);
                                        }
                                    }}
                                    onMouseEnter={(entry) => setActiveIndex(entry.index)}
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
                            <p className="text-[10px] uppercase text-slate-400 font-bold">Total Used</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{fmtCompact(totalValue)}</p>
                        </div>
                    </div>

                    <div className="w-full md:w-[45%] md:max-h-[250px] md:overflow-y-auto">
                        <ul className="space-y-1">
                            {pieData.map((d, i) => (
                                <li 
                                    key={i} 
                                    onMouseEnter={() => setActiveIndex(i)} 
                                    onMouseLeave={() => setActiveIndex(null)} 
                                    onClick={() => onSelectDepartment && onSelectDepartment(d.name)}
                                    className={cn("flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors", activeIndex === i ? "bg-slate-100 dark:bg-slate-700/50" : "")}
                                >
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
// DYNAMIC DEPARTMENT PANEL (Right Side)
// ============================================

const DepartmentDrillDownPanel = ({ departmentName, tickets }) => {
    const [timeRange, setTimeRange] = useState("month"); // month, year, all

    // Filter tickets based on selected department and time range
    const filteredTickets = useMemo(() => {
        if (!departmentName) return [];
        
        let data = tickets.filter(t => {
            // Check if department matches (exact name or GSO default)
            const matchesDept = t.department_name === departmentName || 
                               (departmentName === "General Services Office (GSO)" && t.department_name?.includes("GSO"));
            if (!matchesDept) return false;

            // Time filter
            const ticketDate = new Date(t.trip_date || t.created_at);
            const now = new Date();
            
            if (timeRange === "month") {
                return ticketDate.getMonth() === now.getMonth() && 
                       ticketDate.getFullYear() === now.getFullYear();
            }
            if (timeRange === "year") {
                return ticketDate.getFullYear() === now.getFullYear();
            }
            return true; // all time
        });

        return data.sort((a, b) => new Date(b.trip_date || b.created_at) - new Date(a.trip_date || a.created_at));
    }, [departmentName, tickets, timeRange]);

    // Calculate dynamic stats
    const stats = useMemo(() => {
        let fuelPurchased = 0;
        let amountSpent = 0;
        let distance = 0;

        filteredTickets.forEach(t => {
            const liters = parseFloat(t.gas_slip?.fuel_receipt?.liters_availed ?? t.liters ?? 0);
            const amount = parseFloat(t.amount_released ?? t.gas_slip?.amount_released ?? 0);
            const dist = parseFloat(t.actual_distance_km ?? 0);

            fuelPurchased += liters;
            amountSpent += amount;
            distance += dist;
        });

        const avgCost = distance > 0 ? (amountSpent / distance) : 0;

        return { fuelPurchased, amountSpent, distance, avgCost };
    }, [filteredTickets]);

    if (!departmentName) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                <Building2 className="h-12 w-12 mb-3 opacity-50" />
                <p>Click a slice on the pie chart to view details</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-500" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {departmentName}
                    </h3>
                </div>
                <select 
                    value={timeRange} 
                    onChange={(e) => setTimeRange(e.target.value)} 
                    className="text-xs p-1.5 rounded border dark:bg-slate-800 dark:border-slate-600 text-slate-900 dark:text-white outline-none"
                >
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                    <option value="all">All Time</option>
                </select>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1"><Fuel className="h-3 w-3"/> Fuel Purchased</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-white">{stats.fuelPurchased.toFixed(0)} L</p>
                </div>
                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1"><DollarSign className="h-3 w-3"/> Amount Spent</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-white">₱{stats.amountSpent.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1"><Activity className="h-3 w-3"/> Distance</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-white">{stats.distance.toFixed(0)} km</p>
                </div>
                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1"><BarChart3 className="h-3 w-3"/> Avg Cost/km</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-white">₱{stats.avgCost.toFixed(2)}</p>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="flex-1 overflow-x-auto">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <Activity className="h-4 w-4 text-blue-500" /> Transactions
                    </h4>
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b text-left text-xs text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/60">
                            <th className="pb-2 font-medium">Date</th>
                            <th className="pb-2 font-medium">Control No.</th>
                            <th className="pb-2 font-medium">Vehicle</th>
                            <th className="pb-2 text-right font-medium">Fuel (L)</th>
                            <th className="pb-2 text-right font-medium">Amount (₱)</th>
                            <th className="pb-2 text-center font-medium">Receipt</th>
                            <th className="pb-2 text-right font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTickets.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">
                                    No transactions found for this period
                                </td>
                            </tr>
                        ) : (
                            filteredTickets.map(t => (
                                <tr key={t.id || t.trip_ticket_id} className="border-b last:border-0 border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                                    <td className="py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatHistoryTimestamp(t.trip_date || t.created_at)}</td>
                                    <td className="py-2.5 font-mono text-slate-700 dark:text-slate-200">{t.ticket_number || t.trip_ticket_number}</td>
                                    <td className="py-2.5 text-slate-600 dark:text-slate-300">{t.vehicle?.plate_number || 'N/A'}</td>
                                    <td className="py-2.5 text-right text-slate-600 dark:text-slate-300">{t.gas_slip?.fuel_receipt?.liters_availed || '0'}</td>
                                    <td className="py-2.5 text-right font-semibold text-slate-800 dark:text-white">
                                        ₱{parseFloat(t.amount_released || t.gas_slip?.amount_released || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </td>
                                    <td className="py-2.5 text-center">
                                        <button className="text-blue-500 hover:text-blue-700"><Download className="h-3.5 w-3.5 inline" /></button>
                                    </td>
                                    <td className="py-2.5 text-right">
                                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                            Verified
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
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

    // ✅ State for the drill-down
    const [selectedDept, setSelectedDept] = useState("General Services Office (GSO)");

    const fetchAllData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["mayor-approved-tickets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-department-budgets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-active-fiscal-year"] });
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
    });
    const budgetData = useSafeArray(budgetRaw);

    const departmentBudgets = useMemo(() => {
        return budgetData.map(dept => ({
            department_id: dept.department_id,
            department_name: dept.department_name,
            allocated: parseFloat(dept.allocated_amount ?? dept.annual_amount ?? dept.allocated ?? 0),
            spent: parseFloat(dept.spent_amount ?? dept.used_amount ?? dept.spent ?? 0),
            remaining: parseFloat(dept.remaining_amount ?? 0),
            has_budget: dept.has_budget || false,
            utilization: parseFloat(dept.utilization_percentage ?? dept.utilization ?? 0),
        }));
    }, [budgetData]);

    const totals = useMemo(() => {
        const totalAllocated = departmentBudgets.reduce((s, d) => s + d.allocated, 0);
        const totalUsed = departmentBudgets.reduce((s, d) => s + d.spent, 0);
        return { totalAllocated, totalUsed, totalRemaining: Math.max(totalAllocated - totalUsed, 0), departmentsWithBudget: departmentBudgets.filter(d => d.has_budget).length };
    }, [departmentBudgets]);

    const isLoading = approvedLoading || budgetLoading || fiscalYearLoading;
    if (isLoading && approvedTickets.length === 0 && departmentBudgets.length === 0 && !hasActiveFiscalYear) return <LoadingSkeleton />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="space-y-5 p-4 md:p-6">
                
                {/* Hero Header */}
                <div className={cn("relative overflow-hidden rounded-2xl p-6 shadow-xl border", "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-700/40", "dark:from-[#0d1b3e] dark:via-[#122252] dark:to-[#0d1b3e]")}>
                    <div className="relative z-10 flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                                Mayor's Office Dashboard
                            </h1>
                            <p className="mt-1.5 text-sm text-slate-300">
                                Fuel Fund Dashboard for <strong className="text-white">FY {activeFiscalYear}</strong>
                                {isConnected && <span className="ml-2 text-xs text-emerald-400 animate-pulse">● Live</span>}
                            </p>
                        </div>
                    </div>
                </div>

                {!hasActiveFiscalYear ? (
                     <div className="text-center py-20">
                         <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                         <h2 className="text-xl font-bold text-slate-800">No Active Fiscal Year</h2>
                         <p className="text-slate-500">Please activate a fiscal year to view dashboard data.</p>
                     </div>
                ) : (
                    <>
                        {/* Grid Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch min-h-[500px]">
                            
                            {/* Left: Pie Chart */}
                            <div className="rounded-2xl p-5 border bg-white shadow-sm dark:bg-slate-800/80 dark:border-slate-700 flex flex-col">
                                <div className="mb-2">
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">Fuel Budget Utilization by Department</h3>
                                    <p className="text-xs text-slate-500">Click a slice to view department details</p>
                                </div>
                                <DashboardPie 
                                    departments={departmentBudgets} 
                                    totals={totals} 
                                    fiscalYear={activeFiscalYear} 
                                    tickets={approvedTickets} 
                                    onSelectDepartment={setSelectedDept}
                                />
                            </div>

                            {/* Right: Dynamic Drill-Down Panel */}
                            <div className="rounded-2xl p-5 border bg-white shadow-sm dark:bg-slate-800/80 dark:border-slate-700 flex flex-col">
                                <DepartmentDrillDownPanel 
                                    departmentName={selectedDept} 
                                    tickets={approvedTickets} 
                                />
                            </div>

                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default MayorDashboard;
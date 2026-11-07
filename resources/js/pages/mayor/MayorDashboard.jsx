// src/pages/mayor/MayorDashboard.jsx

import React, { useMemo, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import { SkeletonPage } from "../../components/ui/SkeletonCard";
import api, { mayorsOfficeAPI } from "../../services/api";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, isWithinInterval } from "date-fns";

import {
    Clock, BarChart3, ArrowRight, Activity, PieChart,
    DollarSign, Fuel, Building2, Car, Download, TrendingUp, ChevronDown,
    CheckCircle, Truck, X
} from "lucide-react";
import {
    Cell, PieChart as RePieChart, Pie, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// ============================================
// CONSTANTS & HELPERS
// ============================================

const DEPARTMENT_PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

const extractArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.data)) return response.data;
    if (response.data && Array.isArray(response.data.data)) return response.data.data;
    return [];
};

const useSafeArray = (value) => useMemo(() => (Array.isArray(value) ? value : []), [value]);

const formatCurrency = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return "₱0.00";
    return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(num);
};

const formatCompact = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return "₱0";
    if (num >= 1_000_000) return `₱${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `₱${(num / 1_000).toFixed(0)}k`;
    return `₱${num.toFixed(0)}`;
};

const formatDateShort = (ds) => ds ? new Date(ds).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";

// ✅ UPDATED STATUS BADGE
const StatusBadge = ({ status }) => {
    let displayStatus = "Funds Issued";
    let colorClass = "bg-blue-500";

    if (status === "acknowledged") {
        displayStatus = "Acknowledged";
        colorClass = "bg-cyan-500";
    } else if (status === "in_transit") {
        displayStatus = "In Transit";
        colorClass = "bg-indigo-500";
    } else if (
        status === "completed" || 
        status === "closed" || 
        status === "pending_gso_validation" || 
        status === "pending_reconciliation"
    ) {
        displayStatus = "Verified";
        colorClass = "bg-emerald-500";
    }

    return (
        <Badge className={`${colorClass} text-white flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap`}>
            <CheckCircle className="h-3 w-3" />
            {displayStatus}
        </Badge>
    );
};

// ✅ NEW HELPER FOR DOWNLOADING RECEIPTS
const handleDownloadReceipt = async (url, ticketNumber) => {
    if (!url) {
        alert("No receipt uploaded for this trip yet.");
        return;
    }
    
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `Receipt_${ticketNumber}.jpg`;
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error("Download failed:", error);
        window.open(url, '_blank'); // Fallback
    }
};

// ============================================
// MAIN COMPONENT
// ============================================

const MayorDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { isConnected } = useRealtime();
    const queryClient = useQueryClient();

    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [activeTab, setActiveTab] = useState("transactions");
    const [timeFilter, setTimeFilter] = useState("this_month"); 

    const fetchAllData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["mayor-approved-tickets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-department-budgets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-active-fiscal-year"] });
    }, [queryClient]);

    useAutoRefresh(["mayor-trip-updated", "gso-funds-released", "trip-completed"], fetchAllData, 1000);

    // ============ ACTIVE FISCAL YEAR ============
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
    const hasActiveFiscalYear = activeFiscalYears.length > 0;

    // ============ APPROVED TICKETS ============
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
    const approvedTicketsRaw = useSafeArray(approvedResponse?.data);

    // ============ DEPARTMENT BUDGETS ============
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

    // ============ CALCULATIONS (ALL TIME) ============
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

    const allTimeTotals = useMemo(() => {
        const totalAllocated = departmentBudgets.reduce((s, d) => s + d.allocated, 0);
        const totalUsed = departmentBudgets.reduce((s, d) => s + d.spent, 0);
        const totalDistance = approvedTicketsRaw.reduce((sum, t) => sum + (parseFloat(t.actual_distance_km) || 0), 0);
        const totalFuel = approvedTicketsRaw.reduce((sum, t) => sum + (parseFloat(t.actual_fuel_used) || 0), 0);

        return { 
            totalAllocated, 
            totalUsed, 
            totalRemaining: Math.max(totalAllocated - totalUsed, 0), 
            totalDistance,
            totalFuel
        };
    }, [departmentBudgets, approvedTicketsRaw]);

    const pieData = useMemo(() => {
        return departmentBudgets
            .filter(d => d.has_budget && d.allocated > 0)
            .map((d, i) => ({
                name: d.department_name,
                value: d.allocated,
                color: DEPARTMENT_PALETTE[i % DEPARTMENT_PALETTE.length],
                department_id: d.department_id
            }))
            .sort((a, b) => b.value - a.value);
    }, [departmentBudgets]);

    // ============ TIME FILTERING ============
    const timeFilterLabel = useMemo(() => {
        if (timeFilter === "this_week") return "This Week";
        if (timeFilter === "two_weeks_ago") return "Two Weeks Ago";
        if (timeFilter === "all_time") return "All Time";
        return "This Month";
    }, [timeFilter]);

    const filteredTickets = useMemo(() => {
        if (timeFilter === "all_time") return approvedTicketsRaw;

        const today = new Date();
        let start, end;
        
        if (timeFilter === "this_week") {
            start = startOfWeek(today, { weekStartsOn: 1 });
            end = endOfWeek(today, { weekStartsOn: 1 });
        } else if (timeFilter === "two_weeks_ago") {
            const twoWeeksAgo = subWeeks(today, 2);
            start = startOfWeek(twoWeeksAgo, { weekStartsOn: 1 });
            end = endOfWeek(twoWeeksAgo, { weekStartsOn: 1 });
        } else {
            start = startOfMonth(today);
            end = endOfMonth(today);
        }
        
        return approvedTicketsRaw.filter(t => {
            if (!t.trip_date) return false;
            return isWithinInterval(new Date(t.trip_date), { start, end });
        });
    }, [approvedTicketsRaw, timeFilter]);

    const filteredTotals = useMemo(() => {
        const totalReleased = filteredTickets.reduce((sum, t) => sum + (parseFloat(t.amount_released) || 0), 0);
        const totalDistance = filteredTickets.reduce((sum, t) => sum + (parseFloat(t.actual_distance_km) || 0), 0);
        const totalFuel = filteredTickets.reduce((sum, t) => sum + (parseFloat(t.actual_fuel_used) || 0), 0);
        return { totalReleased, totalDistance, totalFuel };
    }, [filteredTickets]);

    // ✅ Dynamic Data for Right Panel
    const dynamicPanelData = useMemo(() => {
        if (!selectedDepartment) {
            return {
                name: "All Departments",
                isAggregate: true,
                stats: {
                    fuelPurchased: filteredTotals.totalFuel,
                    amountReleased: filteredTotals.totalReleased,
                    distance: filteredTotals.totalDistance,
                    avgCost: filteredTotals.totalDistance > 0 ? (filteredTotals.totalReleased / filteredTotals.totalDistance) : 0,
                },
                transactions: filteredTickets
                    .sort((a, b) => new Date(b.trip_date) - new Date(a.trip_date))
                    .slice(0, 5),
                budgetBreakdown: {
                    allocated: allTimeTotals.totalAllocated,
                    used: filteredTotals.totalReleased,
                    remaining: allTimeTotals.totalAllocated - filteredTotals.totalReleased,
                },
                overviewList: departmentBudgets.sort((a, b) => b.utilization - a.utilization),
            };
        }

        const targetDept = departmentBudgets.find(d => d.department_name === selectedDepartment);
        const deptTickets = filteredTickets.filter(t => t.department_name === selectedDepartment);

        const fuelPurchased = deptTickets.reduce((sum, t) => sum + (parseFloat(t.actual_fuel_used) || 0), 0);
        const amountReleased = deptTickets.reduce((sum, t) => sum + (parseFloat(t.amount_released) || 0), 0);
        const distance = deptTickets.reduce((sum, t) => sum + (parseFloat(t.actual_distance_km) || 0), 0);
        const avgCost = distance > 0 ? (amountReleased / distance) : 0;
        
        const transactions = deptTickets
            .sort((a, b) => new Date(b.trip_date) - new Date(a.trip_date))
            .slice(0, 5);

        const overviewList = departmentBudgets.map(dept => {
            const deptTimeframeTickets = filteredTickets.filter(t => t.department_name === dept.department_name);
            const timeframeReleased = deptTimeframeTickets.reduce((sum, t) => sum + (parseFloat(t.amount_released) || 0), 0);
            const timeframeUtilization = dept.allocated > 0 ? (timeframeReleased / dept.allocated) * 100 : 0;
            
            return {
                ...dept,
                spent: timeframeReleased, 
                utilization: timeframeUtilization
            };
        }).sort((a, b) => b.utilization - a.utilization);

        return {
            name: selectedDepartment,
            isAggregate: false,
            stats: { fuelPurchased, amountReleased, distance, avgCost },
            transactions,
            budgetBreakdown: {
                allocated: targetDept?.allocated || 0,
                used: amountReleased,
                remaining: (targetDept?.allocated || 0) - amountReleased,
            },
            overviewList: [
                ...overviewList.filter(d => d.department_name === selectedDepartment),
                ...overviewList.filter(d => d.department_name !== selectedDepartment)
            ],
        };
    }, [selectedDepartment, departmentBudgets, filteredTickets, filteredTotals, allTimeTotals]);

    const isLoading = approvedLoading || budgetLoading || fiscalYearLoading;
    if (isLoading && approvedTicketsRaw.length === 0 && departmentBudgets.length === 0 && !hasActiveFiscalYear) return <SkeletonPage />;

    const summaryDonutData = [
        { name: 'Used', value: dynamicPanelData.budgetBreakdown.used, fill: '#3b82f6' },
        { name: 'Remaining', value: Math.max(dynamicPanelData.budgetBreakdown.remaining, 0), fill: '#e2e8f0' }
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-6 font-sans">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mayor's Office</h1>
                    <p className="text-sm text-slate-500">Fuel Fund Dashboard</p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {timeFilterLabel}
                    </span>
                </div>
            </div>

            {/* 1. Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="dark:bg-slate-800 border-none shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <Fuel className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium uppercase">Total Fuel Budget</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(allTimeTotals.totalAllocated)}</p>
                            <p className="text-[10px] text-slate-400">Annual Allocation</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="dark:bg-slate-800 border-none shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                            <ArrowRight className="h-6 w-6 text-emerald-600 dark:text-emerald-400 -rotate-45" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium uppercase">Amount Used</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(allTimeTotals.totalUsed)}</p>
                            <p className="text-[10px] text-slate-400">
                                {allTimeTotals.totalAllocated > 0 ? ((allTimeTotals.totalUsed / allTimeTotals.totalAllocated) * 100).toFixed(2) : 0}% of Budget
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="dark:bg-slate-800 border-none shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                            <ArrowRight className="h-6 w-6 text-red-600 dark:text-red-400 rotate-45" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium uppercase">Remaining Balance</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(allTimeTotals.totalRemaining)}</p>
                            <p className="text-[10px] text-slate-400">
                                {allTimeTotals.totalAllocated > 0 ? ((allTimeTotals.totalRemaining / allTimeTotals.totalAllocated) * 100).toFixed(2) : 0}% Remaining
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="dark:bg-slate-800 border-none shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                            <Car className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium uppercase">Total Distance</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{allTimeTotals.totalDistance.toLocaleString()} km</p>
                            <p className="text-[10px] text-slate-400">All Time</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 2. Middle Section */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                
                {/* Left: Pie Chart */}
                <Card className="lg:col-span-2 dark:bg-slate-800 border-none shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <PieChart className="h-5 w-5 text-blue-500" />
                            Fuel Budget Allocation
                        </h3>
                        <button className="text-xs text-blue-600 font-medium">View Report →</button>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="relative w-full md:w-1/2 h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%" cy="50%"
                                        innerRadius="60%" outerRadius="85%"
                                        paddingAngle={2} stroke="none"
                                        onClick={(data) => setSelectedDepartment(data.name === selectedDepartment ? null : data.name)}
                                        className="cursor-pointer"
                                    >
                                        {pieData.map((entry, i) => (
                                            <Cell 
                                                key={i} 
                                                fill={entry.color} 
                                                style={{ 
                                                    opacity: selectedDepartment && selectedDepartment !== entry.name ? 0.3 : 1,
                                                    transition: 'opacity 0.2s'
                                                }} 
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                </RePieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCompact(allTimeTotals.totalAllocated)}</p>
                                <p className="text-[10px] text-slate-500 uppercase">Total Allocated</p>
                            </div>
                        </div>
                        
                        <div className="w-full md:w-1/2 space-y-2">
                            {pieData.map((d, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                                        <span className="text-slate-600 dark:text-slate-300 truncate max-w-[120px]">{d.name}</span>
                                    </div>
                                    <span className="font-semibold text-slate-800 dark:text-white">
                                        {allTimeTotals.totalAllocated > 0 ? ((d.value / allTimeTotals.totalAllocated) * 100).toFixed(1) : 0}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                {/* Right: Dynamic Drill-Down Panel */}
                <Card className="lg:col-span-3 dark:bg-slate-800 border-none shadow-sm flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setActiveTab("transactions")}
                                className={cn("px-4 py-1.5 text-xs font-semibold rounded-md transition-colors", activeTab === "transactions" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700")}
                            >
                                Transactions
                            </button>
                            <button 
                                onClick={() => setActiveTab("summary")}
                                className={cn("px-4 py-1.5 text-xs font-semibold rounded-md transition-colors", activeTab === "summary" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700")}
                            >
                                Summary
                            </button>
                            <button 
                                onClick={() => setActiveTab("overview")}
                                className={cn("px-4 py-1.5 text-xs font-semibold rounded-md transition-colors", activeTab === "overview" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700")}
                            >
                                Department Overview
                            </button>
                        </div>

                        <div className="relative group">
                            <button className="flex items-center gap-2 text-xs font-medium border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                <Clock className="h-3.5 w-3.5 text-slate-500" /> 
                                {timeFilterLabel}
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                            </button>
                            
                            <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 overflow-hidden">
                                <button onClick={() => setTimeFilter("all_time")} className={cn("w-full text-left px-4 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700", timeFilter === "all_time" && "font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20")}>All Time</button>
                                <button onClick={() => setTimeFilter("this_month")} className={cn("w-full text-left px-4 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700", timeFilter === "this_month" && "font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20")}>This Month</button>
                                <button onClick={() => setTimeFilter("this_week")} className={cn("w-full text-left px-4 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700", timeFilter === "this_week" && "font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20")}>This Week</button>
                                <button onClick={() => setTimeFilter("two_weeks_ago")} className={cn("w-full text-left px-4 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700", timeFilter === "two_weeks_ago" && "font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20")}>Two Weeks Ago</button>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-blue-500" />
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">{dynamicPanelData.name}</h3>
                                <Badge className="bg-blue-100 text-blue-700 ml-2">
                                    {filteredTotals.totalReleased > 0 ? ((dynamicPanelData.stats.amountReleased / filteredTotals.totalReleased) * 100).toFixed(1) : 0}% of Filtered Usage
                                </Badge>
                                
                                {selectedDepartment && (
                                    <button 
                                        onClick={() => setSelectedDepartment(null)}
                                        className="ml-2 flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-2 py-1 rounded-md transition-colors"
                                    >
                                        <X className="h-3 w-3" /> Clear Filter
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* --- TAB CONTENT: TRANSACTIONS --- */}
                        {activeTab === "transactions" && (
                            <div className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                                    <div>
                                        <p className="text-[10px] text-slate-500">Fuel Purchased</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{dynamicPanelData.stats.fuelPurchased.toLocaleString()} L</p>
                                    </div>
                                    <div>
                                        {/* ✅ Gi-ilis gikan sa Amount Spent ngadto sa Amount Released */}
                                        <p className="text-[10px] text-slate-500">Amount Released</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(dynamicPanelData.stats.amountReleased)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500">Avg. Cost per Km</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(dynamicPanelData.stats.avgCost)}</p>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Recent Transactions</h4>
                                    <button className="text-xs text-blue-600">View All →</button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="text-slate-400 border-b dark:border-slate-700">
                                            <tr>
                                                <th className="pb-2 font-medium">Date</th>
                                                <th className="pb-2 font-medium">Control No.</th>
                                                <th className="pb-2 font-medium">Vehicle</th>
                                                {/* ✅ Gikuha ang Fuel (L) */}
                                                <th className="pb-2 font-medium">Amount Released</th>
                                                {/* ✅ Gi-ilis ang Amount Spent */}
                                                <th className="pb-2 font-medium">Amount Spent</th>
                                                <th className="pb-2 font-medium">Receipt</th>
                                                <th className="pb-2 font-medium text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dynamicPanelData.transactions.length === 0 ? (
                                                <tr><td colSpan={7} className="py-4 text-center text-slate-400">No transactions found for {timeFilterLabel.toLowerCase()}</td></tr>
                                            ) : dynamicPanelData.transactions.map((t, i) => {
                                                // ✅ Logic para maging '-' ang Amount Spent kung wala pa na verify
                                                const isVerified = ["completed", "closed", "pending_gso_validation", "pending_reconciliation"].includes(t.status);
                                                const amountSpentDisplay = isVerified ? formatCurrency(t.actual_fuel_cost || 0) : "-";

                                                return (
                                                <tr key={i} className="border-b last:border-0 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                    <td className="py-2 text-slate-600 dark:text-slate-300">{formatDateShort(t.trip_date)}</td>
                                                    <td className="py-2 text-slate-800 dark:text-white font-medium">{t.ticket_number}</td>
                                                    <td className="py-2 text-slate-600 dark:text-slate-300">{t.vehicle?.plate_number || 'N/A'}</td>
                                                    
                                                    <td className="py-2 text-slate-600 dark:text-slate-300">{formatCurrency(t.amount_released)}</td>
                                                    <td className="py-2 font-medium text-slate-800 dark:text-white">{amountSpentDisplay}</td>
                                                    
                                                    <td className="py-2">
                                                        <button 
                                                            onClick={() => handleDownloadReceipt(t.receipt_url, t.ticket_number)}
                                                            disabled={!t.receipt_url}
                                                            className={cn(
                                                                "p-1 rounded transition-colors",
                                                                t.receipt_url 
                                                                    ? "text-blue-500 hover:text-blue-700 hover:bg-blue-50 cursor-pointer" 
                                                                    : "text-slate-300 cursor-not-allowed"
                                                            )}
                                                            title={t.receipt_url ? "Download Receipt" : "No receipt available"}
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </button>
                                                    </td>

                                                    <td className="py-2 text-right">
                                                        <StatusBadge status={t.status} />
                                                    </td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* --- TAB CONTENT: SUMMARY --- */}
                        {activeTab === "summary" && (
                            <div className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col justify-center items-center">
                                <div className="w-full max-w-md">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-6 text-center">Budget Health ({timeFilterLabel})</h4>
                                    
                                    <div className="flex items-center gap-8 mb-8 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl">
                                        <div className="relative w-32 h-32 shrink-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RePieChart>
                                                    <Pie
                                                        data={summaryDonutData}
                                                        dataKey="value"
                                                        cx="50%" cy="50%"
                                                        innerRadius="70%" outerRadius="100%"
                                                        paddingAngle={0} stroke="none"
                                                    >
                                                        {summaryDonutData.map((entry, i) => (
                                                            <Cell key={i} fill={entry.fill} />
                                                        ))}
                                                    </Pie>
                                                </RePieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <p className="text-sm font-bold text-slate-800 dark:text-white">
                                                    {dynamicPanelData.budgetBreakdown.allocated > 0 
                                                        ? ((dynamicPanelData.budgetBreakdown.used / dynamicPanelData.budgetBreakdown.allocated) * 100).toFixed(1) 
                                                        : 0}%
                                                </p>
                                                <p className="text-[9px] text-slate-500 uppercase">Used</p>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-4 flex-1">
                                            <div>
                                                <p className="text-xs text-slate-500">Total Annual Allocated</p>
                                                <p className="text-lg font-bold text-slate-800 dark:text-white">{formatCurrency(dynamicPanelData.budgetBreakdown.allocated)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Spent ({timeFilterLabel})</p>
                                                <p className="text-lg font-bold text-blue-600">{formatCurrency(dynamicPanelData.budgetBreakdown.used)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Current Remaining</p>
                                                <p className={`text-lg font-bold ${dynamicPanelData.budgetBreakdown.remaining < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    {formatCurrency(dynamicPanelData.budgetBreakdown.remaining)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="text-center text-xs text-slate-500">
                                        {dynamicPanelData.isAggregate 
                                            ? `Showing combined stats for ${timeFilterLabel.toLowerCase()}.` 
                                            : `Showing stats for ${dynamicPanelData.name} for ${timeFilterLabel.toLowerCase()}.`}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- TAB CONTENT: DEPARTMENT OVERVIEW --- */}
                        {activeTab === "overview" && (
                            <div className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-y-auto max-h-[300px] pr-2">
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 sticky top-0 bg-white dark:bg-slate-800 pb-2">Utilization ({timeFilterLabel})</h4>
                                <div className="space-y-4">
                                    {dynamicPanelData.overviewList.map((d, i) => {
                                        const color = d.utilization > 80 ? 'bg-red-500' : d.utilization > 50 ? 'bg-yellow-500' : 'bg-emerald-500';
                                        const statusLabel = d.utilization > 80 ? 'Needs Attention' : d.utilization > 50 ? 'Monitor' : 'On Track';
                                        const statusColor = d.utilization > 80 ? 'text-red-500' : d.utilization > 50 ? 'text-yellow-600' : 'text-emerald-500';
                                        const isHighlighted = !dynamicPanelData.isAggregate && d.department_name === dynamicPanelData.name;
                                        
                                        return (
                                            <div key={i} className={cn("p-3 rounded-lg border transition-all", isHighlighted ? "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-900/20" : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50")}>
                                                <div className="flex justify-between text-xs mb-2">
                                                    <span className={cn("font-bold", isHighlighted ? "text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-slate-300")}>{d.department_name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-500">{formatCurrency(d.spent)} used</span>
                                                        <span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 relative">
                                                    <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.min(d.utilization, 100)}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* 3. Bottom Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Bar Chart */}
                <Card className="dark:bg-slate-800 border-none shadow-sm p-5">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-500"/> Fuel Fund Summary
                    </h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                                { name: 'Used', value: allTimeTotals.totalUsed, fill: '#3b82f6' },
                                { name: 'Remaining', value: allTimeTotals.totalRemaining, fill: '#e2e8f0' }
                            ]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} tickFormatter={(val) => `₱${val/1000000}M`} />
                                <Tooltip formatter={(val) => formatCurrency(val)} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {
                                        [0, 1].map((i) => (
                                            <Cell key={i} fill={i === 0 ? '#3b82f6' : '#cbd5e1'} />
                                        ))
                                    }
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Recent Fund Releases */}
                <Card className="dark:bg-slate-800 border-none shadow-sm p-5">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Activity className="h-5 w-5 text-purple-500"/> Recent Fund Releases
                        </h3>
                        <button className="text-xs text-blue-600">View All →</button>
                    </div>
                    <div className="space-y-3">
                        {approvedTicketsRaw.slice(0, 3).map((t, i) => (
                            <div key={i} className="flex justify-between items-center text-sm">
                                <div>
                                    <p className="font-medium text-slate-800 dark:text-white">{formatDateShort(t.trip_date)}</p>
                                    <p className="text-[10px] text-slate-500">Purpose: Fuel Fund Release</p>
                                </div>
                                <p className="font-bold text-slate-800 dark:text-white">{formatCurrency(t.amount_released)}</p>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Dept Utilization */}
                <Card className="dark:bg-slate-800 border-none shadow-sm p-5">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-500"/> Department Utilization Overview
                        </h3>
                    </div>
                    <div className="space-y-4">
                        {departmentBudgets.slice(0, 4).map((d, i) => {
                            const color = d.utilization > 80 ? 'bg-red-500' : d.utilization > 50 ? 'bg-yellow-500' : 'bg-emerald-500';
                            const statusLabel = d.utilization > 80 ? 'Needs Attention' : d.utilization > 50 ? 'Monitor' : 'On Track';
                            const statusColor = d.utilization > 80 ? 'text-red-500' : d.utilization > 50 ? 'text-yellow-600' : 'text-emerald-500';
                            return (
                                <div key={i}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{d.department_name}</span>
                                        <span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(d.utilization, 100)}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default MayorDashboard;
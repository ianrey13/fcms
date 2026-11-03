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
    Building2, Filter, Car, Download, TrendingUp
} from "lucide-react";
import {
    Cell, PieChart as RePieChart, Pie, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ============================================
// CONSTANTS & HELPERS
// ============================================

const DEPARTMENT_PALETTE = [
    "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4",
];

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
    if (isNaN(num)) return "₱0";
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

// ============================================
// MAIN COMPONENT
// ============================================

const MayorDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { isConnected } = useRealtime();
    const queryClient = useQueryClient();

    // ✅ State for drill-down
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [activeTab, setActiveTab] = useState("transactions"); // "transactions" | "summary" | "overview"

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
    const activeFiscalYear = activeFiscalYears[0]?.year ?? new Date().getFullYear();
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
    const approvedTickets = useSafeArray(approvedResponse?.data);

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

    // ============ CALCULATIONS ============
    
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
        
        const totalDistance = approvedTickets.reduce((sum, t) => sum + (parseFloat(t.actual_distance_km) || 0), 0);

        return { 
            totalAllocated, 
            totalUsed, 
            totalRemaining: Math.max(totalAllocated - totalUsed, 0), 
            totalDistance
        };
    }, [departmentBudgets, approvedTickets]);

    // Pie Data
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

    // ✅ Dynamic Data for Right Panel based on clicked Pie Slice
    const dynamicPanelData = useMemo(() => {
        // 1. Aggregate view (No department selected)
        if (!selectedDepartment) {
            return {
                name: "All Departments",
                isAggregate: true,
                stats: {
                    fuelPurchased: approvedTickets.reduce((sum, t) => sum + (parseFloat(t.actual_fuel_used) || 0), 0),
                    amountSpent: totals.totalUsed,
                    distance: totals.totalDistance,
                    avgCost: totals.totalDistance > 0 ? (totals.totalUsed / totals.totalDistance) : 0,
                },
                transactions: approvedTickets
                    .sort((a, b) => new Date(b.trip_date) - new Date(a.trip_date))
                    .slice(0, 5),
                // For summary tab
                budgetBreakdown: {
                    allocated: totals.totalAllocated,
                    used: totals.totalUsed,
                    remaining: totals.totalRemaining,
                },
                overviewList: departmentBudgets.sort((a, b) => b.utilization - a.utilization),
            };
        }

        // 2. Specific Department view
        const targetDept = departmentBudgets.find(d => d.department_name === selectedDepartment);
        const deptTickets = approvedTickets.filter(t => t.department_name === selectedDepartment);

        const fuelPurchased = deptTickets.reduce((sum, t) => sum + (parseFloat(t.actual_fuel_used) || 0), 0);
        const amountSpent = targetDept ? targetDept.spent : 0;
        const distance = deptTickets.reduce((sum, t) => sum + (parseFloat(t.actual_distance_km) || 0), 0);
        const avgCost = distance > 0 ? (amountSpent / distance) : 0;
        
        const transactions = deptTickets
            .sort((a, b) => new Date(b.trip_date) - new Date(a.trip_date))
            .slice(0, 5);

        return {
            name: selectedDepartment,
            isAggregate: false,
            stats: { fuelPurchased, amountSpent, distance, avgCost },
            transactions,
            // For summary tab
            budgetBreakdown: {
                allocated: targetDept?.allocated || 0,
                used: targetDept?.spent || 0,
                remaining: targetDept?.remaining || 0,
            },
            // For overview tab — highlight this dept first
            overviewList: [
                ...departmentBudgets.filter(d => d.department_name === selectedDepartment),
                ...departmentBudgets.filter(d => d.department_name !== selectedDepartment).sort((a, b) => b.utilization - a.utilization)
            ],
        };
    }, [selectedDepartment, departmentBudgets, approvedTickets, totals]);

    const isLoading = approvedLoading || budgetLoading || fiscalYearLoading;
    if (isLoading && approvedTickets.length === 0 && departmentBudgets.length === 0 && !hasActiveFiscalYear) return <SkeletonPage />;

    // Small donut chart data for the summary tab
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
                        Oct 1, 2026 - Oct 31, 2026
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
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(totals.totalAllocated)}</p>
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
                            <p className="text-xs text-slate-500 font-medium uppercase">Total Amount Used</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(totals.totalUsed)}</p>
                            <p className="text-[10px] text-slate-400">
                                {totals.totalAllocated > 0 ? ((totals.totalUsed / totals.totalAllocated) * 100).toFixed(2) : 0}% of Budget
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
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(totals.totalRemaining)}</p>
                            <p className="text-[10px] text-slate-400">
                                {totals.totalAllocated > 0 ? ((totals.totalRemaining / totals.totalAllocated) * 100).toFixed(2) : 0}% Remaining
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
                            <p className="text-xs text-slate-500 font-medium uppercase">Total Distance Traveled</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{totals.totalDistance.toLocaleString()} km</p>
                            <p className="text-[10px] text-slate-400">This Period</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 2. Middle Section: Pie Chart & Dynamic Transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                
                {/* Left: Pie Chart */}
                <Card className="lg:col-span-2 dark:bg-slate-800 border-none shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <PieChart className="h-5 w-5 text-blue-500" />
                            Fuel Budget Utilization by Department
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
                                <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCompact(totals.totalUsed)}</p>
                                <p className="text-[10px] text-slate-500 uppercase">Total Used</p>
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
                                        {totals.totalUsed > 0 ? ((d.value / totals.totalUsed) * 100).toFixed(1) : 0}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                {/* Right: Dynamic Drill-Down Panel */}
                <Card className="lg:col-span-3 dark:bg-slate-800 border-none shadow-sm flex flex-col min-h-[400px]">
                    {/* Header Tabs */}
                    <div className="flex items-center gap-2 p-4 border-b border-slate-100 dark:border-slate-700">
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

                    {/* Dynamic Content Header */}
                    <div className="p-4 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-blue-500" />
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">{dynamicPanelData.name}</h3>
                                <Badge className="bg-blue-100 text-blue-700 ml-2">
                                    {totals.totalUsed > 0 ? ((dynamicPanelData.stats.amountSpent / totals.totalUsed) * 100).toFixed(1) : 0}% of Total Usage
                                </Badge>
                            </div>
                            <button className="flex items-center gap-1 text-xs border rounded px-2 py-1">
                                <Clock className="h-3 w-3" /> This Month
                            </button>
                        </div>

                        {/* --- TAB CONTENT: TRANSACTIONS --- */}
                        {activeTab === "transactions" && (
                            <div className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="grid grid-cols-4 gap-2 mb-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                                    <div>
                                        <p className="text-[10px] text-slate-500">Fuel Purchased</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{dynamicPanelData.stats.fuelPurchased.toLocaleString()} L</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500">Amount Spent</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCompact(dynamicPanelData.stats.amountSpent)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500">Distance Traveled</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{dynamicPanelData.stats.distance.toLocaleString()} km</p>
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
                                                <th className="pb-2 font-medium">Fuel (L)</th>
                                                <th className="pb-2 font-medium">Amount (₱)</th>
                                                <th className="pb-2 font-medium">Receipt</th>
                                                <th className="pb-2 font-medium text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dynamicPanelData.transactions.length === 0 ? (
                                                <tr><td colSpan={7} className="py-4 text-center text-slate-400">No transactions found</td></tr>
                                            ) : dynamicPanelData.transactions.map((t, i) => (
                                                <tr key={i} className="border-b last:border-0 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                    <td className="py-2 text-slate-600 dark:text-slate-300">{formatDateShort(t.trip_date)}</td>
                                                    <td className="py-2 text-slate-800 dark:text-white font-medium">{t.ticket_number}</td>
                                                    <td className="py-2 text-slate-600 dark:text-slate-300">{t.vehicle?.plate_number || 'N/A'}</td>
                                                    <td className="py-2 text-slate-600 dark:text-slate-300">{t.actual_fuel_used || 0} L</td>
                                                    <td className="py-2 font-medium text-slate-800 dark:text-white">{formatCurrency(t.amount_released)}</td>
                                                    <td className="py-2"><Download className="h-3 w-3 text-blue-500 cursor-pointer hover:text-blue-700" /></td>
                                                    <td className="py-2 text-right">
                                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Verified</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* --- TAB CONTENT: SUMMARY --- */}
                        {activeTab === "summary" && (
                            <div className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col justify-center items-center">
                                <div className="w-full max-w-md">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-6 text-center">Budget Health Overview</h4>
                                    
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
                                                        ? ((dynamicPanelData.budgetBreakdown.used / dynamicPanelData.budgetBreakdown.allocated) * 100).toFixed(0) 
                                                        : 0}%
                                                </p>
                                                <p className="text-[9px] text-slate-500 uppercase">Used</p>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-4 flex-1">
                                            <div>
                                                <p className="text-xs text-slate-500">Total Allocated</p>
                                                <p className="text-lg font-bold text-slate-800 dark:text-white">{formatCurrency(dynamicPanelData.budgetBreakdown.allocated)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Total Spent</p>
                                                <p className="text-lg font-bold text-blue-600">{formatCurrency(dynamicPanelData.budgetBreakdown.used)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Remaining</p>
                                                <p className={`text-lg font-bold ${dynamicPanelData.budgetBreakdown.remaining < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    {formatCurrency(dynamicPanelData.budgetBreakdown.remaining)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="text-center text-xs text-slate-500">
                                        {dynamicPanelData.isAggregate 
                                            ? "Showing combined budget health for all departments." 
                                            : `Showing budget health specifically for ${dynamicPanelData.name}.`}
                                        <br /> Click another slice on the left to filter.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- TAB CONTENT: DEPARTMENT OVERVIEW --- */}
                        {activeTab === "overview" && (
                            <div className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-y-auto max-h-[300px] pr-2">
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-4 sticky top-0 bg-white dark:bg-slate-800 pb-2">All Departments Utilization</h4>
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
                                                        <span className="text-slate-500">{formatCurrency(d.remaining)} left</span>
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
                                { name: 'Used', value: totals.totalUsed, fill: '#3b82f6' },
                                { name: 'Remaining', value: totals.totalRemaining, fill: '#e2e8f0' }
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
                        {approvedTickets.slice(0, 3).map((t, i) => (
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
                                        <div className={`h-2 rounded-full ${color}`} style={{ width: `${d.utilization}%` }} />
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
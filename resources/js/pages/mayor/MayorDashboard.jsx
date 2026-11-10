import React, { useMemo, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import { SkeletonPage } from "../../components/ui/SkeletonCard";
import api, { mayorsOfficeAPI } from "../../services/api";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isWithinInterval } from "date-fns";

import {
    Clock, ArrowRight, Activity, PieChart,
    Fuel, Building2, Car, Download, TrendingUp, ChevronDown,
    CheckCircle, Wallet, Scale, AlertTriangle, Info, Trophy,
    MoreVertical, ShieldCheck, Calendar, Monitor
} from "lucide-react";
import {
    Cell, PieChart as RePieChart, Pie, ResponsiveContainer, Tooltip,
    AreaChart, Area, XAxis, YAxis, CartesianGrid
} from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

// ============================================
// CONSTANTS & HELPERS
// ============================================

const DEPARTMENT_PALETTE = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444"];

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

const StatusBadge = ({ status }) => {
    let displayStatus = "Funds Issued";
    let colorClass = "bg-blue-500/20 text-blue-400 border border-blue-500/30";

    if (status === "acknowledged") {
        displayStatus = "Received";
        colorClass = "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
    } else if (status === "in_transit") {
        displayStatus = "For Verification";
        colorClass = "bg-orange-500/20 text-orange-400 border border-orange-500/30";
    } else if (["completed", "closed", "pending_gso_validation", "pending_reconciliation"].includes(status)) {
        displayStatus = "Verified";
        colorClass = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    } else if (status === "rejected") {
        displayStatus = "Rejected";
        colorClass = "bg-red-500/20 text-red-400 border border-red-500/30";
    }

    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${colorClass}`}>
            {displayStatus}
        </span>
    );
};

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
        window.open(url, '_blank');
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
    const [timeFilter, setTimeFilter] = useState("this_month"); 

    // Dummy data for the trend chart to match UI
    const trendData = [
        { name: 'Nov 1', spent: 1000000, available: 3500000 },
        { name: 'Nov 7', spent: 1500000, available: 3000000 },
        { name: 'Nov 14', spent: 2200000, available: 2300000 },
        { name: 'Nov 21', spent: 2800000, available: 1700000 },
        { name: 'Nov 30', spent: 3210500, available: 989500 },
    ];

    const fetchAllData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["mayor-approved-tickets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-department-budgets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-active-fiscal-year"] });
    }, [queryClient]);

    useAutoRefresh(["mayor-trip-updated", "gso-funds-released", "trip-completed"], fetchAllData, 1000);

    // ============ DATA FETCHING ============
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
        return budgetData.map(dept => ({
            department_id: dept.department_id,
            department_name: dept.department_name,
            allocated: parseFloat(dept.allocated_amount ?? dept.annual_amount ?? dept.allocated ?? 0),
            spent: parseFloat(dept.spent_amount ?? dept.used_amount ?? dept.spent ?? 0),
            remaining: parseFloat(dept.remaining_amount ?? 0),
            utilization: parseFloat(dept.utilization_percentage ?? dept.utilization ?? 0),
        })).sort((a, b) => b.spent - a.spent); // Sort top consumers
    }, [budgetData]);

    const allTimeTotals = useMemo(() => {
        const totalAllocated = departmentBudgets.reduce((s, d) => s + d.allocated, 0);
        const totalUsed = departmentBudgets.reduce((s, d) => s + d.spent, 0);
        return { 
            totalAllocated, 
            totalUsed, 
            totalRemaining: Math.max(totalAllocated - totalUsed, 0), 
        };
    }, [departmentBudgets]);

    const pieData = useMemo(() => {
        return departmentBudgets
            .filter(d => d.allocated > 0)
            .map((d, i) => ({
                name: d.department_name,
                value: d.allocated,
                color: DEPARTMENT_PALETTE[i % DEPARTMENT_PALETTE.length],
                department_id: d.department_id
            }));
    }, [departmentBudgets]);

    const filteredTickets = useMemo(() => {
        if (timeFilter === "all_time") return approvedTicketsRaw;
        const today = new Date();
        let start, end;
        if (timeFilter === "this_week") {
            start = startOfWeek(today, { weekStartsOn: 1 });
            end = endOfWeek(today, { weekStartsOn: 1 });
        } else if (timeFilter === "two_weeks_ago") {
            start = subDays(today, 14);
            end = today;
        } else {
            start = startOfMonth(today);
            end = endOfMonth(today);
        }
        return approvedTicketsRaw.filter(t => {
            if (!t.trip_date) return false;
            return isWithinInterval(new Date(t.trip_date), { start, end });
        });
    }, [approvedTicketsRaw, timeFilter]);

    const timeFilterLabel = useMemo(() => {
        if (timeFilter === "this_week") return "This Week";
        if (timeFilter === "two_weeks_ago") return "Last 2 Weeks";
        if (timeFilter === "all_time") return "All Time";
        return "This Month";
    }, [timeFilter]);

    const dynamicPanelData = useMemo(() => {
        if (!selectedDepartment) {
            return {
                name: "All Departments",
                transactions: filteredTickets.sort((a, b) => new Date(b.trip_date) - new Date(a.trip_date)).slice(0, 5),
            };
        }
        return {
            name: selectedDepartment,
            transactions: filteredTickets.filter(t => t.department_name === selectedDepartment).sort((a, b) => new Date(b.trip_date) - new Date(a.trip_date)).slice(0, 5),
        };
    }, [selectedDepartment, filteredTickets]);

    if (approvedLoading || budgetLoading) return <SkeletonPage />;

    return (
        <div className="min-h-screen bg-[#090e1a] p-4 md:p-6 font-sans text-slate-200">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Fuel className="h-6 w-6 text-blue-500" /> Fuel Fund Monitoring Dashboard
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">General Services Office • Mayor's Office</p>
                </div>
                <div className="flex items-center gap-4 mt-4 md:mt-0">
                    <div className="flex items-center gap-2 bg-[#121829] border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-300">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        Nov 1 – Nov 30, 2026
                    </div>
                </div>
            </div>

            {/* 1. Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-gradient-to-r from-blue-900/40 to-blue-800/10 border border-blue-500/20 rounded-2xl shadow-lg">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-xs text-blue-300 font-semibold uppercase tracking-wider mb-1">Total Budget</p>
                                <p className="text-2xl font-bold text-white">{formatCurrency(allTimeTotals.totalAllocated)}</p>
                            </div>
                            <div className="p-2.5 bg-blue-500/20 rounded-xl">
                                <Wallet className="h-5 w-5 text-blue-400" />
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-2">Annual Allocation</p>
                        <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full w-full" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-emerald-900/40 to-emerald-800/10 border border-emerald-500/20 rounded-2xl shadow-lg">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-xs text-emerald-300 font-semibold uppercase tracking-wider mb-1">Total Released</p>
                                <p className="text-2xl font-bold text-white">{formatCurrency(allTimeTotals.totalAllocated)}</p>
                            </div>
                            <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                                <CheckCircle className="h-5 w-5 text-emerald-400" />
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-2">93.33% of Budget</p>
                        <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full w-[93%]" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-purple-900/40 to-purple-800/10 border border-purple-500/20 rounded-2xl shadow-lg">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-xs text-purple-300 font-semibold uppercase tracking-wider mb-1">Total Spent</p>
                                <p className="text-2xl font-bold text-white">{formatCurrency(allTimeTotals.totalUsed)}</p>
                            </div>
                            <div className="p-2.5 bg-purple-500/20 rounded-xl">
                                <TrendingUp className="h-5 w-5 text-purple-400" />
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-2">71.34% of Budget</p>
                        <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full w-[71%]" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-yellow-900/40 to-yellow-800/10 border border-yellow-500/20 rounded-2xl shadow-lg">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-xs text-yellow-300 font-semibold uppercase tracking-wider mb-1">Remaining Balance</p>
                                <p className="text-2xl font-bold text-white">{formatCurrency(allTimeTotals.totalRemaining)}</p>
                            </div>
                            <div className="p-2.5 bg-yellow-500/20 rounded-xl">
                                <Scale className="h-5 w-5 text-yellow-400" />
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-2">21.96% of Budget</p>
                        <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-500 rounded-full w-[21%]" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 2. Middle Row: Pie, Top Consumers, Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                
                {/* Pie Chart */}
                <Card className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-5">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <PieChart className="h-4 w-4 text-blue-400" /> BUDGET ALLOCATION
                        </h3>
                        <button className="text-xs text-blue-400 font-medium">View Details →</button>
                    </div>
                    <div className="flex items-center gap-4 h-[220px]">
                        <div className="relative w-1/2 h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%" cy="50%"
                                        innerRadius="65%" outerRadius="85%"
                                        paddingAngle={2} stroke="none"
                                        onClick={(data) => setSelectedDepartment(data.name === selectedDepartment ? null : data.name)}
                                    >
                                        {pieData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </RePieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-xl font-bold text-white">{formatCompact(allTimeTotals.totalAllocated)}</p>
                                <p className="text-[9px] text-slate-400 uppercase">Total Budget</p>
                            </div>
                        </div>
                        <div className="w-1/2 space-y-3">
                            {pieData.map((d, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                                        <span className="text-slate-300 truncate max-w-[100px]">{d.name}</span>
                                    </div>
                                    <span className="font-semibold text-white">
                                        {allTimeTotals.totalAllocated > 0 ? ((d.value / allTimeTotals.totalAllocated) * 100).toFixed(1) : 0}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                {/* Top Fund Consumers */}
                <Card className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-5">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-yellow-500" /> Top Fund Consumers
                        </h3>
                        <div className="flex gap-1 bg-slate-800/50 p-1 rounded-md text-[10px]">
                            <button onClick={() => setTimeFilter("this_week")} className={cn("px-2 py-1 rounded", timeFilter === "this_week" ? "bg-blue-600 text-white" : "text-slate-400")}>This Week</button>
                            <button onClick={() => setTimeFilter("this_month")} className={cn("px-2 py-1 rounded", timeFilter === "this_month" ? "bg-blue-600 text-white" : "text-slate-400")}>This Month</button>
                            <button onClick={() => setTimeFilter("two_weeks_ago")} className={cn("px-2 py-1 rounded", timeFilter === "two_weeks_ago" ? "bg-blue-600 text-white" : "text-slate-400")}>Last 2 Weeks</button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {departmentBudgets.slice(0, 4).map((d, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${i === 0 ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300'}`}>
                                    {i + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-semibold text-slate-200">{d.department_name}</span>
                                        <span className="text-slate-400">{formatCurrency(d.spent)}</span>
                                        <span className="text-slate-300 font-bold">{allTimeTotals.totalUsed > 0 ? ((d.spent / allTimeTotals.totalUsed) * 100).toFixed(1) : 0}%</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                                        <div className={`h-1.5 rounded-full`} style={{ width: `${allTimeTotals.totalUsed > 0 ? (d.spent / allTimeTotals.totalUsed) * 100 : 0}%`, backgroundColor: DEPARTMENT_PALETTE[i] }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Fund Trend Overview */}
                <Card className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-5">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-400" /> FUND TREND OVERVIEW
                        </h3>
                        <button className="flex items-center gap-1 text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-300">
                            This Month <ChevronDown className="h-3 w-3" />
                        </button>
                    </div>
                    <div className="h-[180px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} tickFormatter={(val) => `₱${val/1000000}M`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(val) => formatCurrency(val)}
                                />
                                <Area type="monotone" dataKey="spent" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSpent)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* 3. Middle Row 2: Department Monitoring & Transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                
                {/* Department Fund Monitoring */}
                <Card className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-0 overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-slate-800">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-blue-400" /> DEPARTMENT FUND MONITORING
                        </h3>
                        <button className="flex items-center gap-1 text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-300">
                            This Month <ChevronDown className="h-3 w-3" />
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[#0b101c] text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Department</th>
                                    <th className="px-4 py-3 font-medium text-right">Allocated Budget</th>
                                    <th className="px-4 py-3 font-medium text-right">Released</th>
                                    <th className="px-4 py-3 font-medium text-right">Spent</th>
                                    <th className="px-4 py-3 font-medium text-right">Balance</th>
                                    <th className="px-4 py-3 font-medium">Utilization</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {departmentBudgets.map((d, i) => (
                                    <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="px-4 py-3 text-slate-200 font-medium">{d.department_name}</td>
                                        <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(d.allocated)}</td>
                                        <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(d.allocated)}</td>
                                        <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(d.spent)}</td>
                                        <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(d.remaining)}</td>
                                        <td className="px-4 py-3">
                                            <div className="w-16 bg-slate-800 rounded-full h-1.5">
                                                <div className="h-1.5 rounded-full" style={{ width: `${Math.min(d.utilization, 100)}%`, backgroundColor: DEPARTMENT_PALETTE[i % DEPARTMENT_PALETTE.length] }} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Department Transactions */}
                <Card className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-0 overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-slate-800">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Activity className="h-4 w-4 text-blue-400" /> DEPARTMENT TRANSACTIONS
                        </h3>
                        <div className="flex items-center gap-2">
                            <select className="bg-slate-800 text-[10px] text-slate-300 px-2 py-1 rounded border-none outline-none">
                                <option>All Departments</option>
                            </select>
                            <button className="text-[10px] text-blue-400">View All →</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[#0b101c] text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Date</th>
                                    <th className="px-4 py-3 font-medium">Control No.</th>
                                    <th className="px-4 py-3 font-medium">Vehicle</th>
                                    <th className="px-4 py-3 font-medium text-right">Amount Released</th>
                                    <th className="px-4 py-3 font-medium text-right">Amount Spent</th>
                                    <th className="px-4 py-3 font-medium text-center">Receipt</th>
                                    <th className="px-4 py-3 font-medium text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {dynamicPanelData.transactions.map((t, i) => {
                                    const isVerified = ["completed", "closed", "pending_gso_validation", "pending_reconciliation"].includes(t.status);
                                    return (
                                        <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                                            <td className="px-4 py-3 text-slate-400">{formatDateShort(t.trip_date)}</td>
                                            <td className="px-4 py-3 text-slate-200 font-medium">{t.ticket_number}</td>
                                            <td className="px-4 py-3 text-slate-400">{t.vehicle?.plate_number}</td>
                                            <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(t.amount_released)}</td>
                                            <td className="px-4 py-3 text-right text-slate-300">{isVerified ? formatCurrency(t.actual_fuel_cost || 0) : "₱0.00"}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => handleDownloadReceipt(t.receipt_url, t.ticket_number)} className="text-blue-400 hover:text-blue-300">
                                                    <Download className="h-4 w-4 mx-auto" />
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <StatusBadge status={t.status} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* 4. Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Recent Fund Releases */}
                <Card className="lg:col-span-1 bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                            <Activity className="h-4 w-4 text-blue-400" /> RECENT FUND RELEASES (ALL DEPARTMENTS)
                        </h3>
                        <button className="text-[10px] text-blue-400">View All →</button>
                    </div>
                    <div className="space-y-4">
                        {approvedTicketsRaw.slice(0, 3).map((t, i) => (
                            <div key={i} className="flex justify-between items-center text-xs border-b border-slate-800/50 pb-2">
                                <div>
                                    <p className="text-slate-300 font-medium">{formatDateShort(t.trip_date)}</p>
                                    <p className="text-[10px] text-slate-500">{t.ticket_number}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-300">{t.department_name}</p>
                                    <p className="font-bold text-slate-200">{formatCurrency(t.amount_released)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Insights & Alerts */}
                <Card className="lg:col-span-2 bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-5">
                    <h3 className="font-bold text-white flex items-center gap-2 mb-4 text-sm">
                        <Info className="h-4 w-4 text-yellow-400" /> INSIGHTS & ALERTS
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-300">Rural Health Unit spent 31.5% of total funds this week.</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-300">Engineering Office has unspent balance of ₱170,000.00.</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-300">2 transactions require verification.</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-300">All departments are within their budget limits.</p>
                        </div>
                    </div>
                </Card>

                {/* Branding / Transparency Card */}
                <Card className="lg:col-span-1 bg-gradient-to-br from-blue-900/40 to-[#121829] border border-blue-500/20 rounded-2xl shadow-lg p-5 flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-400" /> Transparent. Accountable. Efficient.
                        </h3>
                        <p className="text-[11px] text-blue-200/70">Monitoring public funds for a more accountable LGU.</p>
                    </div>
                    {/* Subtle Background Icon */}
                    <Building2 className="absolute -bottom-4 -right-4 h-32 w-32 text-blue-500/10 pointer-events-none z-0" />
                </Card>
            </div>
        </div>
    );
};

export default MayorDashboard;
import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import { SkeletonPage } from "../../components/ui/SkeletonCard";
import api, { mayorsOfficeAPI } from "../../services/api";
import { isWithinInterval, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths } from "date-fns";

import {
    ArrowRight, Activity, PieChart, Fuel, Building2, Car, Download, TrendingUp, 
    CheckCircle, Wallet, Scale, AlertTriangle, Info, Trophy, ShieldCheck, Calendar,
    ChevronDown, Search, X
} from "lucide-react";
import {
    Cell, PieChart as RePieChart, Pie, ResponsiveContainer, Tooltip,
    LineChart, Line, XAxis, YAxis
} from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

// ============================================
// HELPERS
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

const StatusBadge = ({ status, actualCost }) => {
    let displayStatus = "Funds Issued";
    let colorClass = "text-blue-400";
    const hasCost = actualCost && parseFloat(actualCost) > 0;

    if (status === "funds_issued") {
        displayStatus = "Funds Issued";
        colorClass = "text-blue-400";
    } else if (status === "acknowledged") {
        displayStatus = "Received";
        colorClass = "text-yellow-400";
    } else if (!hasCost) {
        displayStatus = "For Verification";
        colorClass = "text-orange-400";
    } else if (hasCost) {
        displayStatus = "Verified";
        colorClass = "text-emerald-400";
    } else if (status === "rejected") {
        displayStatus = "Rejected";
        colorClass = "text-red-400";
    }

    return (
        <span className={`text-[11px] font-bold tracking-wide ${colorClass}`}>
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

// ✅ Custom Dropdown Component
const CustomSelect = ({ value, onChange, options, placeholder = "Select..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <div className="relative z-[100]" ref={dropdownRef}>
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="bg-slate-800/80 text-[10px] text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 outline-none cursor-pointer flex items-center justify-between min-w-[120px] hover:bg-slate-700 transition-colors"
            >
                {selectedLabel}
                <ChevronDown className="h-3 w-3 ml-2 text-slate-400" />
            </button>
            
            {isOpen && (
                <div className="absolute right-0 mt-1 w-40 bg-[#1e293b] border border-slate-700 rounded-lg shadow-2xl z-[999] max-h-60 overflow-y-auto">
                    {options.map((option) => (
                        <div 
                            key={option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={cn(
                                "px-3 py-2 text-xs cursor-pointer hover:bg-slate-700 transition-colors",
                                value === option.value ? "bg-blue-600/20 text-blue-400 font-bold" : "text-slate-300"
                            )}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ✅ Custom Pie Tooltip
const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-[#0f172a] border border-slate-700 p-3 rounded-xl shadow-2xl text-xs">
                <p className="font-bold text-white mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: data.color }} />
                    {data.name}
                </p>
                <div className="space-y-1">
                    <p className="text-slate-400 flex justify-between gap-4">
                        Allocated: <span className="font-semibold text-white">{formatCurrency(data.value)}</span>
                    </p>
                    <p className="text-slate-400 flex justify-between gap-4">
                        Used: <span className="font-semibold text-emerald-400">{formatCurrency(data.spent)}</span>
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

// ============================================
// MAIN COMPONENT
// ============================================

const MayorDashboard = () => {
    const queryClient = useQueryClient();
    
    // Filters
    const [topTimeFilter, setTopTimeFilter] = useState("this_month");
    const [topDeptFilter, setTopDeptFilter] = useState("all");
    const [trendDept, setTrendDept] = useState("all");
    
    // Transaction Filters
    const [transDept, setTransDept] = useState("all");
    const [transStatusFilter, setTransStatusFilter] = useState("all"); 
    const [transTimeFilter, setTransTimeFilter] = useState("this_month"); 
    
    // ✅ Monthly Monitoring Search State
    const [monitorSearch, setMonitorSearch] = useState("");
    const [showMonitorDropdown, setShowMonitorDropdown] = useState(false);
    const monitorDropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (monitorDropdownRef.current && !monitorDropdownRef.current.contains(event.target)) {
                setShowMonitorDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchAllData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["mayor-approved-tickets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-department-budgets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-budget-history"] });
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

    const { data: historyRaw } = useOptimizedQuery({
        queryKey: ["mayor-budget-history"],
        queryFn: async () => {
            try {
                const response = await api.get(`/mayors-office/budget-history`);
                return extractArray(response);
            } catch { return []; }
        },
        staleTime: 5 * 60 * 1000,
    });
    const budgetHistoryRaw = useSafeArray(historyRaw);

    // ============ CALCULATIONS ============
    const departmentBudgets = useMemo(() => {
        return budgetData.map(dept => ({
            department_id: dept.department_id,
            department_name: dept.department_name,
            department_code: dept.department_code || "", // For search
            allocated: parseFloat(dept.allocated_amount ?? dept.annual_amount ?? dept.allocated ?? 0),
            spent: parseFloat(dept.spent_amount ?? dept.used_amount ?? dept.spent ?? 0),
            remaining: parseFloat(dept.remaining_amount ?? 0),
            utilization: parseFloat(dept.utilization_percentage ?? dept.utilization ?? 0),
        })).sort((a, b) => b.spent - a.spent);
    }, [budgetData]);

    const allTimeTotals = useMemo(() => {
        const totalAllocated = departmentBudgets.reduce((s, d) => s + d.allocated, 0);
        const totalUsed = departmentBudgets.reduce((s, d) => s + d.spent, 0);
        const totalReleased = approvedTicketsRaw.reduce((sum, t) => sum + (parseFloat(t.amount_released) || 0), 0);
        const totalRemaining = Math.max(0, totalAllocated - totalReleased);

        return { totalAllocated, totalUsed, totalReleased, totalRemaining };
    }, [departmentBudgets, approvedTicketsRaw]);

    const pieData = useMemo(() => {
        return departmentBudgets
            .filter(d => d.allocated > 0)
            .map((d, i) => ({
                name: d.department_name,
                value: d.allocated,
                spent: d.spent,
                color: DEPARTMENT_PALETTE[i % DEPARTMENT_PALETTE.length],
                department_id: d.department_id
            }));
    }, [departmentBudgets]);

    const topConsumersData = useMemo(() => {
        let filteredTickets = approvedTicketsRaw;
        if (topTimeFilter !== "all_time") {
            const today = new Date();
            let start, end;
            if (topTimeFilter === "this_week") {
                start = startOfWeek(today, { weekStartsOn: 1 });
                end = endOfWeek(today, { weekStartsOn: 1 });
            } else if (topTimeFilter === "this_month") {
                start = startOfMonth(today);
                end = endOfMonth(today);
            } else if (topTimeFilter === "two_weeks_ago") {
                start = subDays(today, 14);
                end = today;
            }
            filteredTickets = filteredTickets.filter(t => t.trip_date && isWithinInterval(new Date(t.trip_date), { start, end }));
        }

        const deptSpent = {};
        filteredTickets.forEach(t => {
            if (t.status === 'rejected') return;
            const cost = parseFloat(t.actual_fuel_cost) || 0;
            if (!deptSpent[t.department_name]) deptSpent[t.department_name] = 0;
            deptSpent[t.department_name] += cost;
        });

        let data = departmentBudgets.map(d => ({
            ...d,
            filteredSpent: deptSpent[d.department_name] || 0
        })).sort((a, b) => b.filteredSpent - a.filteredSpent);

        if (topDeptFilter !== "all") data = data.filter(d => d.department_name === topDeptFilter);

        return data.slice(0, 4); 
    }, [departmentBudgets, approvedTicketsRaw, topTimeFilter, topDeptFilter]);

    const trendData = useMemo(() => {
        const filtered = approvedTicketsRaw.filter(t => trendDept === "all" || t.department_name === trendDept);
        const monthlyGroups = {};
        filtered.forEach(t => {
            if (!t.trip_date) return;
            const date = new Date(t.trip_date);
            const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            if (!monthlyGroups[monthYear]) monthlyGroups[monthYear] = { released: 0, dateObj: date };
            monthlyGroups[monthYear].released += parseFloat(t.amount_released) || 0;
        });

        let totalWeeklySuggested = 0;
        if (trendDept === "all") {
            totalWeeklySuggested = departmentBudgets.reduce((sum, d) => sum + (d.allocated / 52), 0);
        } else {
            const dept = departmentBudgets.find(d => d.department_name === trendDept);
            totalWeeklySuggested = dept ? (dept.allocated / 52) : 0;
        }

        const sortedKeys = Object.keys(monthlyGroups).sort((a, b) => monthlyGroups[a].dateObj - monthlyGroups[b].dateObj);
        if (sortedKeys.length === 0) return [{ name: "No Data", released: 0, suggested: totalWeeklySuggested * 4.33 }];

        return sortedKeys.map(key => ({
            name: key,
            released: monthlyGroups[key].released,
            suggested: Math.round(totalWeeklySuggested * 4.33) 
        }));
    }, [approvedTicketsRaw, trendDept, departmentBudgets]);

    const transactionsData = useMemo(() => {
        return approvedTicketsRaw
            .filter(t => {
                const matchesDept = transDept === "all" || t.department_name === transDept;
                
                let matchesStatus = true;
                const hasCost = t.actual_fuel_cost && parseFloat(t.actual_fuel_cost) > 0;
                
                if (transStatusFilter === "funds_issued") {
                    matchesStatus = t.status === "funds_issued";
                } else if (transStatusFilter === "received") {
                    matchesStatus = t.status === "acknowledged";
                } else if (transStatusFilter === "for_verification") {
                    matchesStatus = t.status === "in_transit" && !hasCost;
                } else if (transStatusFilter === "verified") {
                    matchesStatus = hasCost || ["completed", "closed", "pending_gso_validation", "pending_reconciliation"].includes(t.status);
                } else if (transStatusFilter === "rejected") {
                    matchesStatus = t.status === "rejected";
                }

                let matchesDate = true;
                if (transTimeFilter !== "all_time") {
                    const today = new Date();
                    let start, end;
                    if (transTimeFilter === "this_week") {
                        start = startOfWeek(today, { weekStartsOn: 1 });
                        end = endOfWeek(today, { weekStartsOn: 1 });
                    } else if (transTimeFilter === "this_month") {
                        start = startOfMonth(today);
                        end = endOfMonth(today);
                    } else if (transTimeFilter === "last_month") {
                        const lastMonth = subMonths(today, 1);
                        start = startOfMonth(lastMonth);
                        end = endOfMonth(lastMonth);
                    } else if (transTimeFilter === "two_weeks_ago") {
                        start = subDays(today, 14);
                        end = today;
                    }
                    if (!t.trip_date) return false;
                    matchesDate = isWithinInterval(new Date(t.trip_date), { start, end });
                }

                return matchesDept && matchesStatus && matchesDate;
            })
            .sort((a, b) => new Date(b.trip_date) - new Date(a.trip_date))
            .slice(0, 5);
    }, [approvedTicketsRaw, transDept, transStatusFilter, transTimeFilter]);

    // ✅ MONTHLY FUND MONITORING SEARCH FILTER
    const filteredMonitorDepts = useMemo(() => {
        if (!monitorSearch) return departmentBudgets;
        const lowerSearch = monitorSearch.toLowerCase();
        return departmentBudgets.filter(d => 
            d.department_name.toLowerCase().includes(lowerSearch) || 
            (d.department_code && d.department_code.toLowerCase().includes(lowerSearch))
        );
    }, [departmentBudgets, monitorSearch]);

    const activeMonitorDept = useMemo(() => {
        return departmentBudgets.find(d => d.department_name === monitorSearch);
    }, [departmentBudgets, monitorSearch]);

    const monthlyMonitoringData = useMemo(() => {
        if (!activeMonitorDept) return [];

        const tickets = approvedTicketsRaw.filter(t => t.department_name === activeMonitorDept.department_name);
        const history = budgetHistoryRaw.filter(h => h.department_name === activeMonitorDept.department_name);

        const createdRecord = history.find(h => h.action === 'annual_created');
        let startingAnnualBudget = createdRecord ? parseFloat(createdRecord.new_amount) : 0;
        
        if (startingAnnualBudget === 0) {
            startingAnnualBudget = activeMonitorDept.allocated || 0;
        }

        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        const currentYear = new Date().getFullYear();
        const monthlyData = [];
        let currentBalance = 0; 

        months.forEach((monthName, index) => {
            const monthHistory = history.filter(h => {
                if (h.action !== 'annual_added') return false;
                const d = new Date(h.created_at);
                return d.getMonth() === index && d.getFullYear() === currentYear;
            });
            const additionalFunds = monthHistory.reduce((sum, h) => sum + (parseFloat(h.added_amount) || 0), 0);

            const monthTickets = tickets.filter(t => {
                if (!t.trip_date) return false;
                const d = new Date(t.trip_date);
                return d.getMonth() === index && d.getFullYear() === currentYear;
            });
            const consumed = monthTickets.reduce((sum, t) => {
                const hasCost = t.actual_fuel_cost && parseFloat(t.actual_fuel_cost) > 0;
                return sum + (hasCost ? parseFloat(t.actual_fuel_cost) : 0);
            }, 0);

            let beginningBalance;
            if (index === 0) {
                beginningBalance = startingAnnualBudget; 
            } else {
                beginningBalance = currentBalance; 
            }

            const endingBalance = beginningBalance + additionalFunds - consumed;

            if (additionalFunds > 0 || consumed > 0 || index <= new Date().getMonth()) {
                monthlyData.push({
                    month: monthName,
                    beginning: beginningBalance,
                    additional: additionalFunds,
                    consumed: consumed,
                    ending: endingBalance
                });
            }

            currentBalance = endingBalance;
        });

        return monthlyData;
    }, [approvedTicketsRaw, budgetHistoryRaw, activeMonitorDept]);

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
                                <p className="text-2xl font-bold text-white">{formatCurrency(allTimeTotals.totalReleased)}</p>
                            </div>
                            <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                                <CheckCircle className="h-5 w-5 text-emerald-400" />
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-2">
                            {allTimeTotals.totalAllocated > 0 ? ((allTimeTotals.totalReleased / allTimeTotals.totalAllocated) * 100).toFixed(2) : 0}% of Budget
                        </p>
                        <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${allTimeTotals.totalAllocated > 0 ? (allTimeTotals.totalReleased / allTimeTotals.totalAllocated) * 100 : 0}%` }} />
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
                        <p className="text-[11px] text-slate-400 mb-2">
                            {allTimeTotals.totalAllocated > 0 ? ((allTimeTotals.totalUsed / allTimeTotals.totalAllocated) * 100).toFixed(2) : 0}% of Budget
                        </p>
                        <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${allTimeTotals.totalAllocated > 0 ? (allTimeTotals.totalUsed / allTimeTotals.totalAllocated) * 100 : 0}%` }} />
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
                        <p className="text-[11px] text-slate-400 mb-2">
                            {allTimeTotals.totalAllocated > 0 ? ((allTimeTotals.totalRemaining / allTimeTotals.totalAllocated) * 100).toFixed(2) : 0}% of Budget
                        </p>
                        <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${allTimeTotals.totalAllocated > 0 ? (allTimeTotals.totalRemaining / allTimeTotals.totalAllocated) * 100 : 0}%` }} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 2. Budget Allocation Pie Chart (Full Width Section) */}
            <div className="mb-6">
                <Card className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white text-lg flex items-center gap-2">
                            <PieChart className="h-5 w-5 text-blue-400" /> BUDGET ALLOCATION
                        </h3>
                        <button className="text-xs text-blue-400 font-medium">View Details →</button>
                    </div>
                    
                    <div className="flex flex-col items-center">
                        {/* Larger Pie Chart */}
                        <div className="relative w-[300px] h-[300px] md:w-[350px] md:h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%" cy="50%"
                                        innerRadius="65%" outerRadius="90%"
                                        paddingAngle={2} stroke="none"
                                    >
                                        {pieData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomPieTooltip />} />
                                </RePieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-2xl font-bold text-white">{formatCompact(allTimeTotals.totalAllocated)}</p>
                                <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">Total Budget</p>
                            </div>
                        </div>

                        {/* Legend Below Pie */}
                        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
                            {pieData.map((d, i) => (
                                <div key={i} className="flex items-center justify-between bg-slate-800/40 p-2 rounded-lg border border-slate-700/50">
                                    <div className="flex items-center gap-2 truncate">
                                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                                        <span className="text-xs text-slate-300 truncate">{d.name}</span>
                                    </div>
                                    <span className="text-xs font-semibold text-white ml-2">
                                        {allTimeTotals.totalAllocated > 0 ? ((d.value / allTimeTotals.totalAllocated) * 100).toFixed(1) : 0}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>
            </div>

            {/* 3. Middle Row: Top Consumers & Trend (Below Pie) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* ✅ Top Fund Consumers (Removed Progress Bars) */}
                <Card className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-5">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-yellow-500" /> Top Fund Consumers
                        </h3>
                        <div className="flex gap-1 bg-slate-800/50 p-1 rounded-md text-[10px]">
                            <button 
                                onClick={() => setTopTimeFilter("this_week")} 
                                className={cn("px-2 py-1 rounded", topTimeFilter === "this_week" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200")}
                            >
                                This Week
                            </button>
                            <button 
                                onClick={() => setTopTimeFilter("this_month")} 
                                className={cn("px-2 py-1 rounded", topTimeFilter === "this_month" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200")}
                            >
                                This Month
                            </button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {topConsumersData.length === 0 ? (
                            <p className="text-center text-xs text-slate-500 mt-4">No data available.</p>
                        ) : topConsumersData.map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-xs py-2 border-b border-slate-800/50 last:border-0">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${i === 0 ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300'}`}>
                                        {i + 1}
                                    </div>
                                    <span className="font-semibold text-slate-200">{d.department_name}</span>
                                </div>
                                <span className="text-slate-300 font-bold">{formatCurrency(d.filteredSpent)}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Fund Trend Overview */}
                <Card className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-5 relative">
                    <div className="flex items-center justify-between mb-6 z-20 relative">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-400" /> FUND TREND OVERVIEW
                        </h3>
                        
                        <CustomSelect 
                            value={trendDept}
                            onChange={(val) => setTrendDept(val)}
                            placeholder="All Departments"
                            options={[
                                { value: "all", label: "All Departments" },
                                ...departmentBudgets.map(d => ({ 
                                    value: d.department_name, 
                                    label: d.department_name 
                                }))
                            ]}
                        />
                    </div>
                    
                    <div className="h-[180px] w-full relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} tickFormatter={(val) => `₱${val/1000000}M`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(val) => formatCurrency(val)}
                                />
                                <Line type="monotone" name="Amount Released" dataKey="released" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                                <Line type="monotone" name="Weekly Suggested Baseline" dataKey="suggested" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* 4. Bottom Rows: Monthly Monitoring & Transactions (Stacked) */}
            <div className="grid grid-cols-1 gap-6 mb-6">
                
                {/* ✅ Department Monthly Fund Monitoring (Search Bar) */}
                <Card className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-0 overflow-visible">
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border-b border-slate-800 gap-4">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-blue-400" /> DEPARTMENT MONTHLY FUND MONITORING
                        </h3>
                        
                        {/* Search Bar for Department */}
                        <div className="relative z-[100] w-full md:w-[300px]" ref={monitorDropdownRef}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <Input 
                                type="text"
                                placeholder="Search department name/code..."
                                value={monitorSearch}
                                onChange={(e) => {
                                    setMonitorSearch(e.target.value);
                                    setShowMonitorDropdown(true);
                                }}
                                onFocus={() => setShowMonitorDropdown(true)}
                                className="pl-9 pr-8 bg-slate-800/80 border-slate-700 text-white h-10 rounded-lg text-sm placeholder:text-slate-500 w-full"
                            />
                            {monitorSearch && (
                                <button 
                                    onClick={() => { setMonitorSearch(""); setShowMonitorDropdown(false); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}

                            {/* Dropdown results for search */}
                            {showMonitorDropdown && (
                                <div className="absolute left-0 right-0 mt-1 bg-[#1e293b] border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto z-[999]">
                                    {filteredMonitorDepts.length === 0 ? (
                                        <div className="px-3 py-2 text-xs text-slate-400 text-center">No departments found.</div>
                                    ) : (
                                        filteredMonitorDepts.map((d) => (
                                            <div 
                                                key={d.department_id}
                                                onClick={() => {
                                                    setMonitorSearch(d.department_name);
                                                    setShowMonitorDropdown(false);
                                                }}
                                                className="px-3 py-2 text-xs cursor-pointer hover:bg-slate-700 transition-colors flex items-center justify-between"
                                            >
                                                <span className="text-slate-200">{d.department_name}</span>
                                                {d.department_code && <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{d.department_code}</span>}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[#0b101c] text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Month</th>
                                    <th className="px-4 py-3 font-medium text-right">Beginning Balance</th>
                                    <th className="px-4 py-3 font-medium text-right">Additional Funds</th>
                                    <th className="px-4 py-3 font-medium text-right">Consumed</th>
                                    <th className="px-4 py-3 font-medium text-right">Ending Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {!activeMonitorDept ? (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Please search and select a department to view data.</td></tr>
                                ) : monthlyMonitoringData.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No monthly data available.</td></tr>
                                ) : monthlyMonitoringData.map((d, i) => (
                                    <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="px-4 py-3 text-slate-200 font-medium">{d.month}</td>
                                        <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(d.beginning)}</td>
                                        <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(d.additional)}</td>
                                        <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(d.consumed)}</td>
                                        <td className="px-4 py-3 text-right font-bold text-emerald-400">{formatCurrency(d.ending)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* ✅ Department Transactions with Date & Status Filters */}
                <Card className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-0 overflow-hidden relative">
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border-b border-slate-800 gap-4">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Activity className="h-4 w-4 text-blue-400" /> DEPARTMENT TRANSACTIONS
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 relative z-[50]">
                            {/* Dept Filter */}
                            <CustomSelect 
                                value={transDept}
                                onChange={(val) => setTransDept(val)}
                                placeholder="All Departments"
                                options={[
                                    { value: "all", label: "All Departments" },
                                    ...departmentBudgets.map(d => ({ 
                                        value: d.department_name, 
                                        label: d.department_name 
                                    }))
                                ]}
                            />
                            {/* Status Filter */}
                            <CustomSelect 
                                value={transStatusFilter}
                                onChange={(val) => setTransStatusFilter(val)}
                                placeholder="All Statuses"
                                options={[
                                    { value: "all", label: "All Statuses" },
                                    { value: "funds_issued", label: "Funds Issued" },
                                    { value: "received", label: "Received" },
                                    { value: "for_verification", label: "For Verification" },
                                    { value: "verified", label: "Verified" },
                                    { value: "rejected", label: "Rejected" }
                                ]}
                            />
                            {/* ✅ Date Filter (Added Last Month) */}
                            <CustomSelect 
                                value={transTimeFilter}
                                onChange={(val) => setTransTimeFilter(val)}
                                placeholder="This Month"
                                options={[
                                    { value: "this_month", label: "This Month" },
                                    { value: "last_month", label: "Last Month" },
                                    { value: "this_week", label: "This Week" },
                                    { value: "two_weeks_ago", label: "Last 2 Weeks" }
                                ]}
                            />
                            <button className="text-[10px] text-blue-400 ml-2">View All →</button>
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
                                {transactionsData.length === 0 ? (
                                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No transactions found.</td></tr>
                                ) : transactionsData.map((t, i) => {
                                    const hasCost = t.actual_fuel_cost && parseFloat(t.actual_fuel_cost) > 0;
                                    const amountSpentDisplay = hasCost ? formatCurrency(t.actual_fuel_cost) : "-";

                                    return (
                                        <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                                            <td className="px-4 py-3 text-slate-400">{formatDateShort(t.trip_date)}</td>
                                            <td className="px-4 py-3 text-slate-200 font-medium">{t.ticket_number}</td>
                                            <td className="px-4 py-3 text-slate-400">{t.vehicle?.plate_number}</td>
                                            <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(t.amount_released)}</td>
                                            <td className="px-4 py-3 text-right text-slate-300 font-medium">{amountSpentDisplay}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => handleDownloadReceipt(t.receipt_url, t.ticket_number)} className="text-blue-400 hover:text-blue-300">
                                                    <Download className="h-4 w-4 mx-auto" />
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <StatusBadge status={t.status} actualCost={t.actual_fuel_cost} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* 5. Recent Fund Releases (Full Width Section) */}
            <div className="mb-6">
                <Card className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                            <Activity className="h-4 w-4 text-blue-400" /> RECENT FUND RELEASES
                        </h3>
                        <button className="text-[10px] text-blue-400">View All →</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {approvedTicketsRaw.slice(0, 3).map((t, i) => (
                            <div key={i} className="flex justify-between items-center text-xs bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
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
            </div>
        </div>
    );
};

export default MayorDashboard;
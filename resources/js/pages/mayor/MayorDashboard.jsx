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

import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ✅ IMPORT ANG GAS SLIP VIEW
import GasSlipView from "./reports/GasSlipView";

import {
    ArrowRight, Activity, PieChart, Fuel, Building2, Car, Download, TrendingUp, 
    CheckCircle, Wallet, Scale, AlertTriangle, Info, Trophy, ShieldCheck, Calendar,
    ChevronDown, ChevronLeft, ChevronRight, Search, X, BarChart3, Table as TableIcon,
    Landmark, FileText, ExternalLink
} from "lucide-react";
import {
    Cell, PieChart as RePieChart, Pie, ResponsiveContainer, Tooltip,
    LineChart, Line, XAxis, YAxis
} from "recharts";
import { cn } from "@/lib/utils";

// ============================================
// HELPERS
// ============================================

const DEPARTMENT_PALETTE = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#14b8a6", "#f43f5e", "#6366f1", "#8b5cf6", "#ec4899"];

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
    
    // ✅ State para sa gi-click nga slice sa Pie Chart
    const [selectedPieDept, setSelectedPieDept] = useState(null);

    // ✅ State para sa Gas Slip Details (Gagamit sa GasSlipView component)
    const [selectedGasSlip, setSelectedGasSlip] = useState(null);

    // ✅ Fuel Price Monitoring State
    const [fuelTab, setFuelTab] = useState("gasoline");
    const [fuelPage, setFuelPage] = useState(1);
    const itemsPerPage = 5;

    const fetchAllData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["mayor-approved-tickets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-department-budgets"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-budget-history"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-fuel-receipts"] });
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

    // ✅ FETCH FUEL RECEIPTS FOR PRICE MONITORING
    const { data: fuelReceiptsRaw = [] } = useOptimizedQuery({
        queryKey: ["mayor-fuel-receipts"],
        queryFn: async () => {
            try {
                const response = await mayorsOfficeAPI.getVerifiedReceipts();
                return extractArray(response);
            } catch { return []; }
        }
    });
    const fuelReceipts = useSafeArray(fuelReceiptsRaw);

    // ============ CALCULATIONS ============
    const departmentBudgets = useMemo(() => {
        return budgetData.map(dept => ({
            department_id: dept.department_id,
            department_name: dept.department_name,
            department_code: dept.department_code || "",
            allocated: parseFloat(dept.allocated_amount ?? dept.annual_amount ?? dept.allocated ?? 0),
            spent: parseFloat(dept.spent_amount ?? dept.used_amount ?? dept.spent ?? 0),
            remaining: parseFloat(dept.remaining_amount ?? 0),
            utilization: parseFloat(dept.utilization_percentage ?? dept.utilization ?? 0),
        })).sort((a, b) => b.allocated - a.allocated);
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

    // ✅ Filter transactions para sa selected Pie Department
    const selectedDeptTransactions = useMemo(() => {
        if (!selectedPieDept) return [];
        return approvedTicketsRaw
            .filter(t => t.department_name === selectedPieDept.name)
            .sort((a, b) => new Date(b.trip_date) - new Date(a.trip_date));
    }, [approvedTicketsRaw, selectedPieDept]);

    // ✅ Selected department totals
    const selectedDeptTotals = useMemo(() => {
        if (!selectedPieDept) return null;
        const dept = departmentBudgets.find(d => d.department_name === selectedPieDept.name);
        const totalReleased = selectedDeptTransactions.reduce((sum, t) => sum + (parseFloat(t.amount_released) || 0), 0);
        return {
            allocated: dept?.allocated || 0,
            spent: dept?.spent || 0,
            remaining: dept?.remaining || 0,
            totalReleased,
            txCount: selectedDeptTransactions.length
        };
    }, [selectedPieDept, departmentBudgets, selectedDeptTransactions]);

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

    // ✅ FUEL PRICE MONITORING LOGIC
    const fuelPriceData = useMemo(() => {
        const fuelTypeMap = { gasoline: 'gasoline', premium: 'premium', diesel: 'diesel' };
        const targetType = fuelTypeMap[fuelTab];

        return fuelReceipts.filter(r => {
            const vType = r.vehicle?.fuel_type?.toLowerCase() || r.fuel_type?.toLowerCase();
            return vType === targetType;
        }).sort((a, b) => new Date(b.trip_date || b.created_at) - new Date(a.trip_date || a.created_at));
    }, [fuelReceipts, fuelTab]);

    const weightedAvgData = useMemo(() => {
        const last30Days = subDays(new Date(), 30);
        let totalCost = 0;
        let totalLiters = 0;

        fuelPriceData.forEach(r => {
            const date = new Date(r.trip_date || r.created_at);
            if (date >= last30Days) {
                const amt = parseFloat(r.amount) || 0;
                const liters = parseFloat(r.liters_availed) || 0;
                if (amt > 0 && liters > 0) {
                    totalCost += amt;
                    totalLiters += liters;
                }
            }
        });

        return totalLiters > 0 ? (totalCost / totalLiters) : 0;
    }, [fuelPriceData]);

    const totalQuantity = useMemo(() => {
        return fuelPriceData.reduce((sum, r) => {
            const qty = parseFloat(r.liters_availed) || 0;
            return qty > 0 ? sum + qty : sum; 
        }, 0);
    }, [fuelPriceData]);

    const totalFuelCost = useMemo(() => {
        return fuelPriceData.reduce((sum, r) => {
            const amt = parseFloat(r.amount) || 0;
            const qty = parseFloat(r.liters_availed) || 0;
            return qty > 0 ? sum + amt : sum;
        }, 0);
    }, [fuelPriceData]);

    const paginatedFuelData = useMemo(() => {
        const start = (fuelPage - 1) * itemsPerPage;
        return fuelPriceData.slice(start, start + itemsPerPage);
    }, [fuelPriceData, fuelPage]);

    const totalPages = Math.ceil(fuelPriceData.length / itemsPerPage) || 1;

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

            {/* 2. INTERACTIVE BUDGET ALLOCATION & DETAILS */}
            <div className="mb-6">
                <Card className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-white text-lg flex items-center gap-2">
                            <PieChart className="h-5 w-5 text-blue-400" /> BUDGET ALLOCATION
                        </h3>
                        {selectedPieDept && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setSelectedPieDept(null)} 
                                className="text-slate-400 hover:text-white text-xs h-8"
                            >
                                <ArrowRight className="h-4 w-4 mr-1 rotate-180" /> Back to Overview
                            </Button>
                        )}
                    </div>
                    
                    <div className="flex flex-col lg:flex-row gap-8 min-h-[400px]">
                        
                        {/* LEFT SIDE: Pie Chart */}
                        <div className={cn(
                            "transition-all duration-300 flex flex-col items-center justify-center",
                            selectedPieDept ? "w-full lg:w-5/12" : "w-full lg:w-1/2"
                        )}>
                            <div className={cn(
                                "relative transition-all duration-300 w-full max-w-[350px] aspect-square",
                                selectedPieDept ? "max-w-[280px]" : ""
                            )}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <RePieChart>
                                        <Pie
                                            data={pieData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%" cy="50%"
                                            innerRadius={selectedPieDept ? "65%" : "70%"} 
                                            outerRadius={selectedPieDept ? "85%" : "90%"}
                                            paddingAngle={2} 
                                            stroke="none"
                                            onClick={(data) => {
                                                if (selectedPieDept && selectedPieDept.name === data.name) {
                                                    setSelectedPieDept(null);
                                                } else {
                                                    setSelectedPieDept(data);
                                                }
                                            }}
                                            className="cursor-pointer outline-none"
                                        >
                                            {pieData.map((entry, i) => (
                                                <Cell 
                                                    key={i} 
                                                    fill={entry.color} 
                                                    opacity={selectedPieDept && selectedPieDept.name !== entry.name ? 0.2 : 1} 
                                                    className="transition-opacity duration-300"
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomPieTooltip />} />
                                    </RePieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <p className="text-2xl font-bold text-white">{formatCurrency(allTimeTotals.totalAllocated)}</p>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Total Budget</p>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT SIDE: Legend (Kung walay selected) OR Details (Kung naay selected) */}
                        <div className={cn(
                            "transition-all duration-300 flex-1",
                            selectedPieDept ? "w-full lg:w-7/12" : "w-full lg:w-1/2"
                        )}>
                            
                            {!selectedPieDept ? (
                                /* ✅ OVERVIEW MODE: Hapsay nga Legend List */
                                <div className="bg-[#0b101c] border border-slate-800 rounded-xl p-4 h-full overflow-hidden flex flex-col">
                                    <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-blue-400" /> Department Breakdown
                                    </h4>
                                    <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 space-y-2">
                                        {pieData.map((d, i) => (
                                            <div 
                                                key={i} 
                                                onClick={() => setSelectedPieDept(d)}
                                                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/30 hover:bg-slate-800/80 border border-slate-700/50 cursor-pointer transition-colors group"
                                            >
                                                <div className="flex items-center gap-3 truncate">
                                                    <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                                                    <span className="text-xs text-slate-300 truncate group-hover:text-white transition-colors">{d.name}</span>
                                                </div>
                                                <div className="flex items-center gap-4 flex-shrink-0">
                                                    <span className="text-xs font-semibold text-white">{formatCurrency(d.value)}</span>
                                                    <span className="text-[10px] font-bold bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                                                        {allTimeTotals.totalAllocated > 0 ? ((d.value / allTimeTotals.totalAllocated) * 100).toFixed(1) : 0}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-500 text-center mt-3">Click a department to view transactions</p>
                                </div>
                            ) : (
                                /* ✅ FOCUS MODE: Department Details & Transactions */
                                <div className="bg-[#0b101c] border border-slate-800 rounded-xl flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                                    
                                    {/* Header */}
                                    <div className="p-5 border-b border-slate-800 bg-[#121829]">
                                        <div className="flex items-start gap-4 mb-5">
                                            <div className="p-3 bg-blue-500/10 rounded-xl">
                                                <Landmark className="h-6 w-6 text-blue-400" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold text-white mb-0.5">{selectedPieDept.name}</h4>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Department Details</p>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
                                                    <Wallet className="h-3 w-3" /> Allocated
                                                </div>
                                                <p className="font-bold text-white text-sm">{formatCurrency(selectedDeptTotals?.allocated)}</p>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
                                                    <ArrowRight className="h-3 w-3" /> Released
                                                </div>
                                                <p className="font-bold text-white text-sm">{formatCurrency(selectedDeptTotals?.totalReleased)}</p>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
                                                    <Scale className="h-3 w-3" /> Remaining
                                                </div>
                                                <p className="font-bold text-emerald-400 text-sm">{formatCurrency(selectedDeptTotals?.remaining)}</p>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
                                                    <Activity className="h-3 w-3" /> Txns
                                                </div>
                                                <p className="font-bold text-white text-sm">{selectedDeptTotals?.txCount}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Table */}
                                    <div className="overflow-x-auto flex-1 max-h-[300px]">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-[#0f172a] text-slate-400 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium">Date</th>
                                                    <th className="px-4 py-3 font-medium">TT No.</th>
                                                    <th className="px-4 py-3 font-medium">Purpose</th>
                                                    <th className="px-4 py-3 font-medium">Destination</th>
                                                    <th className="px-4 py-3 font-medium text-right">Released</th>
                                                    <th className="px-4 py-3 font-medium text-right">Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/50">
                                                {selectedDeptTransactions.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                                            No transactions found.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    selectedDeptTransactions.map((t, i) => {
                                                        let runningBalance = selectedDeptTotals?.allocated || 0;
                                                        for (let j = 0; j <= i; j++) {
                                                            runningBalance -= parseFloat(selectedDeptTransactions[j].amount_released) || 0;
                                                        }

                                                        return (
                                                            <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                                                                <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{formatDateShort(t.trip_date)}</td>
                                                                <td className="px-4 py-3 text-slate-300 font-mono">{t.ticket_number}</td>
                                                                <td className="px-4 py-3 text-slate-400 truncate max-w-[100px]" title={t.purpose}>{t.purpose || "—"}</td>
                                                                <td className="px-4 py-3 text-slate-400 truncate max-w-[100px]" title={t.destination}>{t.destination || "—"}</td>
                                                                <td className="px-4 py-3 text-right font-medium text-white">{formatCurrency(t.amount_released)}</td>
                                                                <td className="px-4 py-3 text-right font-bold text-slate-200">{formatCurrency(runningBalance)}</td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            {/* 3. Middle Row: Top Consumers & Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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

            {/* 4. Bottom Rows: Transactions */}
            <div className="grid grid-cols-1 gap-6 mb-6">
                <Card className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-0 overflow-hidden relative">
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border-b border-slate-800 gap-4">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Activity className="h-4 w-4 text-blue-400" /> DEPARTMENT TRANSACTIONS
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 relative z-[50]">
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
                                    <th className="px-4 py-3 font-medium text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {transactionsData.length === 0 ? (
                                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No transactions found.</td></tr>
                                ) : transactionsData.map((t, i) => {
                                    const hasCost = t.actual_fuel_cost && parseFloat(t.actual_fuel_cost) > 0;
                                    const amountSpentDisplay = hasCost ? formatCurrency(t.actual_fuel_cost) : "-";

                                    return (
                                        <tr key={i} className="hover:bg-slate-800/20 transition-colors group">
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
                                            <td className="px-4 py-3 text-center">
                                                {/* ✅ CLICK TO OPEN GAS SLIP VIEW MODAL */}
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    onClick={() => setSelectedGasSlip(t)}
                                                    className="h-7 px-2 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                                >
                                                    <FileText className="h-3.5 w-3.5 mr-1" /> View Slip
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* 5. Recent Fund Releases */}
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

            {/* 6. Fuel Price Monitoring & Analysis */}
            <div className="mb-6">
                <Card className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg p-6">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Fuel className="h-5 w-5 text-blue-500" /> Fuel Price Monitoring & Analysis
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                            History of fuel prices for the year, with Weighted Average Price based on the last 30 days.
                        </p>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6">
                        
                        {/* Left Side: Table with Tabs & Pagination */}
                        <div className="flex-1 bg-[#0b101c] border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                            
                            {/* Tabs */}
                            <div className="flex items-center gap-1 border-b border-slate-800 p-2">
                                <button 
                                    onClick={() => { setFuelTab("gasoline"); setFuelPage(1); }}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors",
                                        fuelTab === "gasoline" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:bg-slate-800/50"
                                    )}
                                >
                                    <Fuel className="h-3.5 w-3.5" /> Gasoline
                                </button>
                                <button 
                                    onClick={() => { setFuelTab("premium"); setFuelPage(1); }}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors",
                                        fuelTab === "premium" ? "bg-amber-600/20 text-amber-400 border border-amber-500/30" : "text-slate-400 hover:bg-slate-800/50"
                                    )}
                                >
                                    <Fuel className="h-3.5 w-3.5" /> Premium
                                </button>
                                <button 
                                    onClick={() => { setFuelTab("diesel"); setFuelPage(1); }}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors",
                                        fuelTab === "diesel" ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:bg-slate-800/50"
                                    )}
                                >
                                    <Fuel className="h-3.5 w-3.5" /> Diesel
                                </button>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-[#121829] text-slate-400">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Trip Ticket #</th>
                                            <th className="px-4 py-3 font-medium">Invoice #</th>
                                            <th className="px-4 py-3 font-medium text-right">Quantity (L)</th>
                                            <th className="px-4 py-3 font-medium text-right">Unit Price (₱/L)</th>
                                            <th className="px-4 py-3 font-medium text-right">Total Cost (₱)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {paginatedFuelData.length === 0 ? (
                                            <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No fuel data available for {fuelTab}.</td></tr>
                                        ) : paginatedFuelData.map((r, i) => {
                                            const quantity = parseFloat(r.liters_availed) || 0;
                                            const totalCost = parseFloat(r.amount) || 0;
                                            
                                            const hasQuantity = quantity > 0;
                                            const displayQty = hasQuantity ? quantity.toFixed(2) : "-";
                                            const displayUnit = hasQuantity ? `₱${(totalCost / quantity).toFixed(2)}` : "-";
                                            const displayTotal = hasQuantity ? formatCurrency(totalCost) : "-";
                                            const displayInvoice = r.invoice_number || `INV-${r.ticket_number?.replace(/\D/g, '') || '000'}`;

                                            return (
                                                <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                                                    <td className="px-4 py-3 text-slate-200 font-mono">{r.ticket_number || "N/A"}</td>
                                                    <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">{displayInvoice}</td>
                                                    <td className="px-4 py-3 text-right text-slate-300 font-medium">{displayQty}</td>
                                                    <td className="px-4 py-3 text-right text-slate-300 font-medium">{displayUnit}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-white">{displayTotal}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    {paginatedFuelData.length > 0 && (
                                        <tfoot className="bg-[#121829] border-t border-slate-700 text-xs">
                                            <tr>
                                                <td className="px-4 py-3 font-bold text-white">Total</td>
                                                <td className="px-4 py-3"></td>
                                                <td className="px-4 py-3 text-right font-bold text-white">
                                                    {totalQuantity > 0 ? totalQuantity.toFixed(2) : "-"}
                                                </td>
                                                <td className="px-4 py-3"></td>
                                                <td className="px-4 py-3 text-right font-bold text-white">
                                                    {totalFuelCost > 0 ? formatCurrency(totalFuelCost) : "-"}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="border-t border-slate-800 p-3 flex items-center justify-between bg-[#121829]">
                                <span className="text-[10px] text-slate-400">
                                    Showing {paginatedFuelData.length > 0 ? (fuelPage - 1) * itemsPerPage + 1 : 0} to {Math.min(fuelPage * itemsPerPage, fuelPriceData.length)} of {fuelPriceData.length} entries
                                </span>
                                <div className="flex gap-1">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setFuelPage(p => Math.max(1, p - 1))}
                                        disabled={fuelPage === 1}
                                        className="h-6 w-6 p-0 border-slate-700 text-slate-400 hover:text-white"
                                    >
                                        <ChevronLeft className="h-3 w-3" />
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setFuelPage(p => Math.min(totalPages, p + 1))}
                                        disabled={fuelPage === totalPages}
                                        className="h-6 w-6 p-0 border-slate-700 text-slate-400 hover:text-white"
                                    >
                                        <ChevronRight className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Weighted Average Card */}
                        <div className="w-full lg:w-[280px] flex-shrink-0">
                            <div className="bg-[#0b101c] border border-slate-800 rounded-xl p-5 h-full flex flex-col justify-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
                                <div className="flex items-center gap-2 mb-2 relative z-10">
                                    <BarChart3 className="h-4 w-4 text-blue-400" />
                                    <h4 className="text-xs font-bold text-white">Weighted Average Fuel Price</h4>
                                </div>
                                <p className="text-[10px] text-slate-400 mb-6 relative z-10">(Last 30 Days)</p>
                                
                                <div className="relative z-10">
                                    <span className="text-4xl font-bold text-white tracking-tight">
                                        {formatCurrency(weightedAvgData).split('.')[0]}
                                    </span>
                                    <span className="text-xl font-bold text-slate-400">
                                        .{formatCurrency(weightedAvgData).split('.')[1]} 
                                        <span className="text-sm font-medium ml-1">/L</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                    </div>
                </Card>
            </div>

            {/* ✅ GAS SLIP VIEW — direkta ra i-render (naa na siyay kaugalingon overlay) */}
            {selectedGasSlip && (
                <GasSlipView 
                    ticket={selectedGasSlip} 
                    onClose={() => setSelectedGasSlip(null)} 
                />
            )}
        </div>
    );
};

export default MayorDashboard;
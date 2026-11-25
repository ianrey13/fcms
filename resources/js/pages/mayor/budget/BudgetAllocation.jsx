import React, { useState, useEffect, useMemo } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
import { useOptimizedQuery } from "../../../hooks/useOptimizedQuery";
import { SkeletonPage, SkeletonTable } from "../../../components/ui/SkeletonCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    TrendingUp, TrendingDown, Edit, AlertCircle, Building2, Plus, Info, ArrowLeft, PhilippinePeso, History, Activity, 
    CheckCircle2, ChevronLeft, ChevronRight
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ============================================
// STATS CARD COMPONENT
// ============================================
const StatsCard = ({ title, value, icon: Icon, color }) => (
    <Card className="dark:bg-slate-800/80 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
        <CardContent className="pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                </div>
            </div>
        </CardContent>
    </Card>
);

// ============================================
// TOOLTIP COMPONENT
// ============================================
const DepartmentTooltip = ({ code, name }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative inline-block">
            <span
                className="font-mono text-sm font-medium text-slate-800 dark:text-slate-200 cursor-help hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
            >
                {code}
            </span>
            {show && (
                <div className="absolute z-[9999] left-0 bottom-full mb-2 px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-lg shadow-xl whitespace-nowrap pointer-events-none max-w-[300px] overflow-hidden text-ellipsis">
                    {name}
                    <div className="absolute left-4 top-full border-4 border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
                </div>
            )}
        </div>
    );
};

// ============================================
// FORM FIELD COMPONENT
// ============================================
const FormField = ({ label, icon: Icon, required, error, touched, helper, children, className }) => {
    const hasError = touched && error;
    return (
        <div className={cn("space-y-1.5", className)}>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                {Icon && <Icon className="h-4 w-4 text-slate-400" />}
                {label}
                {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                {React.cloneElement(children, {
                    className: cn(
                        children.props.className, 
                        "dark:bg-slate-900 dark:border-slate-700 dark:text-white", 
                        hasError && "border-red-500 ring-red-500 focus:ring-red-500 bg-red-50/50 dark:bg-red-950/10"
                    )
                })}
                {hasError && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
                    </div>
                )}
            </div>
            {hasError && (
                <p className="text-red-500 text-xs flex items-center gap-1 mt-1 animate-fadeIn">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    {error}
                </p>
            )}
            {helper && !hasError && (
                <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1">
                    <Info className="h-3 w-3" />
                    {helper}
                </p>
            )}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
const BudgetAllocation = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    
    const [selectedYear, setSelectedYear] = useState(null);
    
    // Dialog States
    const [editingBudget, setEditingBudget] = useState(null);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showAddBudgetDialog, setShowAddBudgetDialog] = useState(false);
    
    // ✅ Gi-ilis ang 'reason' ngadto sa 'purpose'
    const [addBudgetData, setAddBudgetData] = useState({ department_id: "", additional_amount: "", purpose: "" });
    const [formData, setFormData] = useState({ annual_amount: "", purpose: "" });
    
    const [editErrors, setEditErrors] = useState({});
    const [editTouched, setEditTouched] = useState({});
    const [addErrors, setAddErrors] = useState({});
    const [addTouched, setAddTouched] = useState({});

    // State for Transaction History Pagination
    const [historyPage, setHistoryPage] = useState(1);
    const historyRowsPerPage = 5;

    useAutoRefresh(["mayor-budget-updated", "mayor-trip-updated", "gso-funds-released"], () => {
        queryClient.invalidateQueries({ queryKey: ["annual-budgets", selectedYear] });
        queryClient.invalidateQueries({ queryKey: ["fiscal-years-active"] });
        queryClient.invalidateQueries({ queryKey: ["budget-history", selectedYear] });
    });

    const { data: yearsData, isLoading: yearsLoading } = useOptimizedQuery({
        queryKey: ["fiscal-years-active"],
        queryFn: async () => {
            try {
                const response = await api.get("/mayors-office/fiscal-years?is_active=1");
                return response.data.data || [];
            } catch (error) { return []; }
        },
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (!yearsData || yearsData.length === 0) return;
        const validYears = yearsData.map((y) => typeof y === "object" ? Number(y.year) : Number(y));
        if (selectedYear && validYears.includes(selectedYear)) return;
        setSelectedYear(validYears.includes(2026) ? 2026 : validYears[0]);
    }, [yearsData, selectedYear]);

    const { data: budgetData, isLoading, error: budgetError } = useOptimizedQuery({
        queryKey: ["annual-budgets", selectedYear],
        queryFn: async () => {
            const response = await api.get(`/mayors-office/annual-budgets/year/${selectedYear}`);
            return response.data;
        },
        enabled: !!selectedYear,
        staleTime: 2 * 60 * 1000,
        keepPreviousData: true,
    });

    const { data: historyData, isLoading: historyLoading } = useOptimizedQuery({
        queryKey: ["budget-history", selectedYear],
        queryFn: async () => {
            const response = await api.get(`/mayors-office/budget-history?year=${selectedYear}`);
            return response.data.data || [];
        },
        enabled: !!selectedYear,
    });

    // ✅ Gi-ilis ang 'reason' ngadto sa 'purpose'
    const setBudgetMutation = useMutation({
        mutationFn: async ({ data }) => {
            const response = await api.post("/mayors-office/annual-budgets", { fiscal_year: selectedYear, ...data });
            return response.data;
        },
        onSuccess: () => {
            toast.success("Annual budget set successfully");
            setShowEditDialog(false);
            queryClient.invalidateQueries(["annual-budgets"]);
            queryClient.invalidateQueries(["budget-history"]);
        },
        onError: (error) => toast.error(error.response?.data?.message || "Failed to set budget"),
    });

   const addBudgetMutation = useMutation({
    mutationFn: async (data) => {
        const response = await api.post("/mayors-office/annual-budgets/add", { 
            fiscal_year: selectedYear,
            department_id: data.department_id,
            additional_amount: data.additional_amount,
            purpose: data.purpose, // ✅ I-send as 'purpose' (dili 'reason')
        });
        return response.data;
    },
    onSuccess: () => {
        toast.success("Additional budget added successfully");
        setShowAddBudgetDialog(false);
        queryClient.invalidateQueries(["annual-budgets"]);
        queryClient.invalidateQueries(["budget-history"]);
    },
    onError: (error) => {
        console.error("Add budget error:", error.response?.data);
        const errors = error.response?.data?.errors;
        if (errors) {
            const firstError = Object.values(errors)[0]?.[0];
            toast.error(firstError || "Validation failed");
        } else {
            toast.error(error.response?.data?.message || "Failed to add budget");
        }
    },
});

    const budgets = useMemo(() => {
        const raw = budgetData?.data;
        if (Array.isArray(raw)) return raw;
        if (raw && Array.isArray(raw.data)) return raw.data;
        return [];
    }, [budgetData]);

    const summary = useMemo(() => {
        if (!budgetData) return {};
        if (budgetData.summary) return budgetData.summary;
        const total_allocated = budgets.reduce((s, b) => s + parseFloat(b.annual_amount || 0), 0);
        const total_used = budgets.reduce((s, b) => s + parseFloat(b.used_amount || 0), 0);
        return {
            total_allocated, total_used, total_remaining: total_allocated - total_used,
            departments_with_budget: budgets.filter((b) => b.has_budget).length,
            total_departments: budgets.length,
        };
    }, [budgetData, budgets]);

    // ============================================
    // ✅ MERGED TRANSACTION HISTORY (ALLOCATIONS + EXPENSES)
    // ============================================
    const processedHistory = useMemo(() => {
        if (!historyData || historyData.length === 0) return { rows: [], totals: {} };

        // 1. Kuhaon ang Allocations (+)
        const allocations = historyData
            .filter(h => ['annual_created', 'annual_added', 'weekly_allocated', 'activated'].includes(h.action))
            .map(h => ({
                id: `alloc-${h.id}`,
                date: new Date(h.created_at),
                reference: h.action === 'annual_created' ? 'ALLOC-001' : `ALLOC-${String(h.id).padStart(3, '0')}`,
                description: h.purpose || h.reason || (h.action === 'annual_created' ? "Initial departmental fuel budget" : "Additional allocation"),
                destination: "—",
                amount: parseFloat(h.added_amount) || 0,
                type: 'allocation'
            }));

        // 2. Kuhaon ang Expenses (-)
        const expenses = historyData
            .filter(h => h.action.toLowerCase().includes('release') || h.action.toLowerCase().includes('fund') || h.action.toLowerCase().includes('surplus'))
            .map(h => ({
                id: `exp-${h.id}`,
                date: new Date(h.created_at),
                reference: h.reference_no || `REF-${h.id}`,
                description: h.purpose || h.reason || "Fund release for Trip Ticket",
                destination: h.destination || "—",
                amount: parseFloat(h.added_amount) || 0,
                type: 'expense'
            }));

        // 3. Merge and sort oldest to newest
        const combined = [...allocations, ...expenses].sort((a, b) => a.date - b.date);

        // 4. Compute Running Balance
        let runningBalance = 0;
        let totalAdded = 0;
        let totalReleased = 0;

        const ledger = combined.map(tx => {
            if (tx.type === 'allocation') {
                runningBalance += tx.amount;
                totalAdded += tx.amount;
            } else {
                runningBalance -= tx.amount;
                totalReleased += tx.amount;
            }
            return { ...tx, runningBalance };
        });

        // 5. Reverse for display (newest first)
        return {
            rows: [...ledger].reverse(),
            totals: {
                totalAllocated: totalAdded,
                totalAdded,
                totalReleased,
                finalBalance: runningBalance
            }
        };
    }, [historyData]);

    // Pagination for Transaction History
    const totalHistoryPages = Math.ceil(processedHistory.rows.length / historyRowsPerPage);
    const currentHistoryData = useMemo(() => {
        const firstPageIndex = (historyPage - 1) * historyRowsPerPage;
        const lastPageIndex = firstPageIndex + historyRowsPerPage;
        return processedHistory.rows.slice(firstPageIndex, lastPageIndex);
    }, [historyPage, processedHistory.rows]);

    const formatCurrency = (amount) => {
        if (!amount || amount === 0) return "₱0.00";
        return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(amount);
    };

    const weeklySuggested = (annualAmount) => {
        const amount = parseFloat(annualAmount) || 0;
        return amount > 0 ? amount / 52 : 0;
    };

    const getStatusBadge = (status) => {
        if (status === "not_set" || !status) return <Badge className="bg-slate-400">Not Set</Badge>;
        return <Badge className="bg-green-500">Active</Badge>;
    };

    // ✅ Gi-ilis ang 'reason' ngadto sa 'purpose'
    const validateEditBudget = () => {
        const newErrors = {};
        if (!formData.annual_amount || parseFloat(formData.annual_amount) <= 0) {
            newErrors.annual_amount = "Annual budget must be greater than 0";
        }
        if (!formData.purpose || formData.purpose.trim().length < 3) {
            newErrors.purpose = "Purpose must be at least 3 characters";
        }
        setEditErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return false;
        return true;
    };

    const validateAddBudget = () => {
        const newErrors = {};
        if (!addBudgetData.department_id) newErrors.department_id = "Department is required";
        if (!addBudgetData.additional_amount || parseFloat(addBudgetData.additional_amount) <= 0) newErrors.additional_amount = "Amount must be > 0";
        if (!addBudgetData.purpose || addBudgetData.purpose.trim().length < 3) newErrors.purpose = "Purpose must be at least 3 characters";
        
        setAddErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            toast.error("Please fix validation errors");
            return false;
        }
        return true;
    };

    const handleEdit = (budget) => {
        setEditingBudget(budget);
        setFormData({ annual_amount: budget.annual_amount?.toString() || "", purpose: "" });
        setShowEditDialog(true);
    };

    const handleSetBudget = () => {
        if (!validateEditBudget()) return;
        setBudgetMutation.mutate({ 
            data: { 
                department_id: editingBudget.department_id, 
                annual_amount: parseFloat(formData.annual_amount),
                purpose: formData.purpose 
            } 
        });
    };

    const handleAddBudget = () => {
    if (!validateAddBudget()) return;
    addBudgetMutation.mutate({
        department_id: parseInt(addBudgetData.department_id),
        additional_amount: parseFloat(addBudgetData.additional_amount),
        purpose: addBudgetData.purpose, // ✅ Kini ang i-send
    });
};

    if (budgetError) return <div className="p-8 text-center text-red-500">Error loading data.</div>;
    if (yearsLoading || !selectedYear || isLoading || !budgetData) return <div className="p-6"><SkeletonPage /><SkeletonTable rows={5} cols={8} /></div>;

    const remainingPct = (processedHistory.totals.finalBalance / (processedHistory.totals.totalAllocated || 1)) * 100;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="space-y-6 p-4 md:p-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/mo/dashboard')} className="rounded-xl h-10 w-10 dark:text-slate-300">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                                <PhilippinePeso className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Budget Management</h1>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Manage allocations and view history</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Year Selector */}
                <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <div className="flex flex-wrap items-center gap-4">
                            <span className="font-medium text-slate-700 dark:text-slate-300">Select Fiscal Year:</span>
                            <div className="flex flex-wrap gap-2">
                                {yearsData?.map((year) => {
                                    const yVal = typeof year === "object" ? Number(year.year) : Number(year);
                                    return (
                                        <Button
                                            key={yVal}
                                            variant={selectedYear === yVal ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setSelectedYear(yVal)}
                                            className={selectedYear === yVal ? "bg-blue-600 text-white" : "dark:text-slate-300 dark:border-slate-600"}
                                        >
                                            {yVal}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard title="Total Annual Budget" value={formatCurrency(summary.total_allocated)} icon={PhilippinePeso} color="from-blue-500 to-blue-600" />
                    <StatsCard title="Used" value={formatCurrency(summary.total_used)} icon={TrendingDown} color="from-yellow-500 to-yellow-600" />
                    <StatsCard title="Remaining Annual" value={formatCurrency(summary.total_remaining)} icon={TrendingUp} color="from-emerald-500 to-emerald-600" />
                    <StatsCard title="Departments" value={`${summary.departments_with_budget || 0} / ${summary.total_departments || 0}`} icon={Building2} color="from-purple-500 to-purple-600" />
                </div>

                {/* Allocation Table */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Budget Details for {selectedYear}</h3>
                    </div>
                    <div className="overflow-auto max-h-[500px]">
                        <Table>
                            <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">
                                <TableRow>
                                    <TableHead className="text-slate-600 dark:text-slate-300">Code</TableHead>
                                    <TableHead className="text-right text-slate-600 dark:text-slate-300">Annual Budget</TableHead>
                                    <TableHead className="text-right text-slate-600 dark:text-slate-300">Weekly Suggested</TableHead>
                                    <TableHead className="text-right text-slate-600 dark:text-slate-300">Used</TableHead>
                                    <TableHead className="text-right text-slate-600 dark:text-slate-300">Remaining</TableHead>
                                    <TableHead className="text-center text-slate-600 dark:text-slate-300">Status</TableHead>
                                    <TableHead className="text-right text-slate-600 dark:text-slate-300">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {budgets.map((budget) => (
                                    <TableRow key={budget.department_id}>
                                        <TableCell><DepartmentTooltip code={budget.department_code} name={budget.department_name} /></TableCell>
                                        <TableCell className="text-right font-medium text-blue-600 dark:text-blue-400">{formatCurrency(budget.annual_amount)}</TableCell>
                                        <TableCell className="text-right text-purple-600 dark:text-purple-400">{formatCurrency(weeklySuggested(budget.annual_amount))}</TableCell>
                                        <TableCell className="text-right text-yellow-600 dark:text-yellow-400">{formatCurrency(budget.used_amount)}</TableCell>
                                        <TableCell className={cn("text-right font-medium", (budget.remaining_amount || 0) < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                                            {formatCurrency(budget.remaining_amount)}
                                        </TableCell>
                                        <TableCell className="text-center">{getStatusBadge(budget.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {!budget.has_budget ? (
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(budget)} className="text-green-600 dark:text-green-400">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                ) : (
                                                    <Button variant="ghost" size="sm" onClick={() => {
                                                        setAddBudgetData({ department_id: budget.department_id.toString(), additional_amount: "", purpose: "" });
                                                        setShowAddBudgetDialog(true);
                                                    }} className="text-emerald-600 dark:text-emerald-400">
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* ============================================ */}
                {/* TRANSACTION HISTORY */}
                {/* ============================================ */}
                <Card className="dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

                    <CardHeader className="border-b border-slate-200/60 dark:border-slate-800/60 pb-6 relative z-10">
                        <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white text-xl">
                            <History className="h-6 w-6 text-blue-500" />
                            Transaction History
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="p-0 relative z-10">
                        {historyLoading ? (
                            <div className="p-12 text-center text-slate-500 dark:text-slate-400"><Activity className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading history...</div>
                        ) : processedHistory.rows.length === 0 ? (
                            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                                <History className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                No budget history found for {selectedYear}.
                            </div>
                        ) : (
                            <>
                                {/* SUMMARY HEADER */}
                                <div className="bg-[#1e293b]/50 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-800">
                                    <div className="flex items-center gap-6">
                                        {/* Donut Chart */}
                                        <div className="relative w-28 h-28 flex items-center justify-center">
                                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                <path className="text-slate-700" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                <path 
                                                    className="text-blue-500" 
                                                    strokeDasharray={`${remainingPct}, 100`} 
                                                    strokeWidth="4" 
                                                    strokeLinecap="round" 
                                                    stroke="currentColor" 
                                                    fill="none" 
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-xl font-bold text-white">
                                                    {remainingPct.toFixed(2)}%
                                                </span>
                                                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Remaining</span>
                                            </div>
                                        </div>

                                        {/* Legend */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                                                <span className="text-sm text-slate-400">Remaining Balance</span>
                                                <span className="font-bold text-white ml-auto">{formatCurrency(processedHistory.totals.finalBalance)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="h-2.5 w-2.5 rounded-full bg-slate-600"></span>
                                                <span className="text-sm text-slate-400">Total Released</span>
                                                <span className="font-bold text-white ml-auto">{formatCurrency(processedHistory.totals.totalReleased)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-center md:text-right md:border-l md:border-slate-700 md:pl-8">
                                        <p className="text-sm text-slate-400 mb-1">Total Allocation</p>
                                        <p className="text-3xl font-extrabold text-white">{formatCurrency(processedHistory.totals.totalAllocated)}</p>
                                    </div>
                                </div>

                                {/* TRANSACTION TABLE */}
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-[#0f172a]">
                                            <TableRow className="border-slate-800 hover:bg-transparent">
                                                <TableHead className="text-slate-400 font-medium">Date</TableHead>
                                                <TableHead className="text-slate-400 font-medium">Reference No.</TableHead>
                                                <TableHead className="text-slate-400 font-medium">Description</TableHead>
                                                <TableHead className="text-slate-400 font-medium">Destination</TableHead>
                                                <TableHead className="text-right text-slate-400 font-medium">Amount</TableHead>
                                                <TableHead className="text-right text-slate-400 font-medium">Running Balance</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {currentHistoryData.map((log, i) => (
                                                <TableRow key={i} className="border-slate-800/50 hover:bg-slate-800/30">
                                                    <TableCell className="text-sm text-slate-300 whitespace-nowrap">
                                                        {format(log.date, 'MMM dd, yyyy')}
                                                    </TableCell>
                                                    <TableCell className="text-sm font-mono text-slate-300">
                                                        {log.reference}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-slate-300 max-w-[250px] truncate" title={log.description}>
                                                        {log.description}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-slate-400 max-w-[150px] truncate">
                                                        {log.destination}
                                                    </TableCell>
                                                    <TableCell className={cn("text-sm font-bold text-right whitespace-nowrap", log.type === 'expense' ? "text-red-400" : "text-emerald-400")}>
                                                        {log.type === 'expense' ? '-' : '+'}{formatCurrency(log.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-sm font-bold text-right text-white whitespace-nowrap">
                                                        {formatCurrency(log.runningBalance)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* PAGINATION */}
                                <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                                    <span>
                                        Showing <span className="font-bold text-white">{((historyPage - 1) * historyRowsPerPage) + 1}</span> to <span className="font-bold text-white">{Math.min(historyPage * historyRowsPerPage, processedHistory.rows.length)}</span> of <span className="font-bold text-white">{processedHistory.rows.length}</span> transactions
                                    </span>
                                    <div className="flex gap-1">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-8 px-2 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                                            onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                            disabled={historyPage === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-8 px-2 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                                            onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                                            disabled={historyPage === totalHistoryPages}
                                        >
                                            Next <ChevronRight className="h-4 w-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* EDIT DIALOG (SET BUDGET) */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="dark:bg-slate-800 dark:border-slate-700 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="dark:text-white">Set Annual Budget</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <FormField label="Annual Budget (₱)" required error={editErrors.annual_amount} touched={editTouched.annual_amount}>
                            <Input 
                                type="number" 
                                value={formData.annual_amount} 
                                onChange={(e) => setFormData({ ...formData, annual_amount: e.target.value })} 
                                placeholder="e.g., 500000"
                            />
                        </FormField>
                        {/* ✅ GIILISAN ANG LABEL NGADTO SA PURPOSE */}
                        <FormField label="Purpose" required error={editErrors.purpose} touched={editTouched.purpose} helper="e.g., Initial allocation for FY 2026">
                            <Input 
                                value={formData.purpose} 
                                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} 
                                placeholder="Purpose for setting budget" 
                            />
                        </FormField>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditDialog(false)} className="dark:text-slate-300 dark:border-slate-600">Cancel</Button>
                        <Button onClick={handleSetBudget} disabled={setBudgetMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">Save Budget</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ADD BUDGET DIALOG */}
            <Dialog open={showAddBudgetDialog} onOpenChange={setShowAddBudgetDialog}>
                <DialogContent className="dark:bg-slate-800 dark:border-slate-700 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="dark:text-white">Add Additional Budget</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <FormField label="Department" required error={addErrors.department_id}>
                            <select
                                value={addBudgetData.department_id}
                                onChange={(e) => setAddBudgetData({ ...addBudgetData, department_id: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                            >
                                <option value="">Select Department</option>
                                {budgets.map((b) => (
                                    <option key={b.department_id} value={b.department_id}>{b.department_code} - {b.department_name}</option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Additional Amount (₱)" required error={addErrors.additional_amount}>
                            <Input type="number" value={addBudgetData.additional_amount} onChange={(e) => setAddBudgetData({ ...addBudgetData, additional_amount: e.target.value })} />
                        </FormField>
                        {/* ✅ GIILISAN ANG LABEL NGADTO SA PURPOSE */}
                        <FormField label="Purpose" required error={addErrors.purpose} helper="e.g., Mayor's Memo No. 2026-001">
                            <Input value={addBudgetData.purpose} onChange={(e) => setAddBudgetData({ ...addBudgetData, purpose: e.target.value })} placeholder="Purpose for adding budget" />
                        </FormField>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddBudgetDialog(false)} className="dark:text-slate-300 dark:border-slate-600">Cancel</Button>
                        <Button onClick={handleAddBudget} disabled={addBudgetMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">Add Budget</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default BudgetAllocation;
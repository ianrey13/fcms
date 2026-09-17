// src/pages/mayor/budget/BudgetAllocation.jsx
// ============================================
// ENHANCED: Auto-refresh with real-time updates
// REMOVED: Manual refresh button
// REMOVED: Add Budget button (kept inside dialog)
// KEPT: Bulk Edit functionality
// ============================================

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
import { useRealtime } from "../../../contexts/RealtimeContext";
import { useOptimizedQuery } from "../../../hooks/useOptimizedQuery";
import {
    SkeletonPage,
    SkeletonStats,
    SkeletonTable,
} from "../../../components/ui/SkeletonCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    RefreshCw,
    Loader2,
    Calendar,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Edit,
    Save,
    AlertCircle,
    Building2,
    X,
    Eye,
    Plus,
    Info,
    ArrowLeft,
    Zap,
    Shield,
    Clock,
    Activity,
    CheckCircle,
    Search,
    Filter,
    ChevronDown,
    ChevronUp,
    Wallet,
    Gauge,
    PhilippinePeso,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { cn } from "@/lib/utils";

// ============================================
// STATS CARD COMPONENT
// ============================================

const StatsCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <Card className="dark:bg-slate-800/80 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
        <CardContent className="pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
                    {subtitle && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
                    )}
                    {trend !== undefined && (
                        <div className="flex items-center gap-1 mt-1 text-[10px]">
                            {trend > 0 ? (
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                            ) : trend < 0 ? (
                                <TrendingDown className="h-3 w-3 text-red-500" />
                            ) : (
                                <Activity className="h-3 w-3 text-slate-400" />
                            )}
                            <span className={trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : trend < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}>
                                {trend > 0 ? '+' : ''}{trend}%
                            </span>
                        </div>
                    )}
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
// ✅ ENHANCED: Form Field with error highlighting
// ============================================

const FormField = ({
    label,
    icon: Icon,
    required,
    error,
    touched,
    helper,
    children,
    className,
}) => {
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
// FILTER SECTION COMPONENT
// ============================================

const FilterSection = ({ filters, setFilters, departments, isFilterOpen, setIsFilterOpen }) => {
    const hasActiveFilters = filters.searchTerm || filters.allocationStatus !== 'all' || filters.budgetRange !== 'all';

    return (
        <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="dark:border-slate-700 dark:text-slate-300"
                >
                    <Filter className="h-4 w-4 mr-1.5" />
                    Filters
                    {hasActiveFilters && (
                        <Badge className="ml-1.5 bg-blue-500 text-white text-[10px] px-1.5 py-0.5">
                            {Object.values(filters).filter(v => v !== 'all' && v !== '').length}
                        </Badge>
                    )}
                    {isFilterOpen ? (
                        <ChevronUp className="h-4 w-4 ml-1.5" />
                    ) : (
                        <ChevronDown className="h-4 w-4 ml-1.5" />
                    )}
                </Button>

                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilters({ searchTerm: '', departmentId: 'all', allocationStatus: 'all', budgetRange: 'all' })}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 h-8 px-2"
                    >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Clear
                    </Button>
                )}
            </div>

            {isFilterOpen && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Search Department</label>
                        <div className="relative mt-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input
                                placeholder="Type department name..."
                                value={filters.searchTerm}
                                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                                className="pl-9 h-9 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Department</label>
                        <select
                            value={filters.departmentId}
                            onChange={(e) => setFilters(prev => ({ ...prev, departmentId: e.target.value }))}
                            className="w-full mt-1 px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                        >
                            <option value="all">All Departments</option>
                            {departments.map((dept) => (
                                <option key={dept.department_id} value={dept.department_id}>
                                    {dept.department_name} ({dept.department_code})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Allocation Status</label>
                        <select
                            value={filters.allocationStatus}
                            onChange={(e) => setFilters(prev => ({ ...prev, allocationStatus: e.target.value }))}
                            className="w-full mt-1 px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                        >
                            <option value="all">All Statuses</option>
                            <option value="has_budget">Has Budget</option>
                            <option value="no_budget">No Budget</option>
                            <option value="over_budget">Over Budget</option>
                            <option value="near_limit">Near Limit (&gt;80%)</option>
                            <option value="on_track">On Track</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Budget Range</label>
                        <select
                            value={filters.budgetRange}
                            onChange={(e) => setFilters(prev => ({ ...prev, budgetRange: e.target.value }))}
                            className="w-full mt-1 px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                        >
                            <option value="all">All Ranges</option>
                            <option value="under_50k">Under ₱50,000</option>
                            <option value="50k_100k">₱50,000 - ₱100,000</option>
                            <option value="100k_500k">₱100,000 - ₱500,000</option>
                            <option value="500k_1m">₱500,000 - ₱1,000,000</option>
                            <option value="over_1m">Over ₱1,000,000</option>
                        </select>
                    </div>
                </div>
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
    const { isConnected } = useRealtime();
    const toastIdRef = useRef(null);
    
    const [selectedYear, setSelectedYear] = useState(2026);
    const [editingBudget, setEditingBudget] = useState(null);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [viewingBudget, setViewingBudget] = useState(null);
    const [showAddBudgetDialog, setShowAddBudgetDialog] = useState(false);
    const [addBudgetData, setAddBudgetData] = useState({
        department_id: "",
        additional_amount: "",
        reason: "",
    });
    const [formData, setFormData] = useState({
        annual_amount: "",
        weekly_ceiling: "",
    });
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkData, setBulkData] = useState({});
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const [showWeeklyDialog, setShowWeeklyDialog] = useState(false);
    const [weeklyData, setWeeklyData] = useState({
        department_id: "",
        weekly_ceiling: "",
        reason: "",
    });
    const [weeklyDepartment, setWeeklyDepartment] = useState(null);

    // Form validation states
    const [editErrors, setEditErrors] = useState({});
    const [editTouched, setEditTouched] = useState({});
    const [addErrors, setAddErrors] = useState({});
    const [addTouched, setAddTouched] = useState({});
    const [weeklyErrors, setWeeklyErrors] = useState({});
    const [weeklyTouched, setWeeklyTouched] = useState({});

    const [filters, setFilters] = useState({
        searchTerm: '',
        departmentId: 'all',
        allocationStatus: 'all',
        budgetRange: 'all',
    });

    // ============================================
    // ✅ AUTO-REFRESH - No manual refresh needed
    // ============================================

    useAutoRefresh(
        [
            "mayor-budget-updated",
            "mayor-trip-updated",
            "gso-funds-released",
            "new-notification",
        ],
        () => {
            queryClient.invalidateQueries({ queryKey: ["annual-budgets", selectedYear] });
            queryClient.invalidateQueries({ queryKey: ["fiscal-years-active"] });
        }
    );

    // ============================================
    // OPTIMIZED QUERIES
    // ============================================

    const { data: yearsData, isLoading: yearsLoading } = useOptimizedQuery({
        queryKey: ["fiscal-years-active"],
        queryFn: async () => {
            try {
                const response = await api.get("/mayors-office/fiscal-years?is_active=1");
                return response.data.data || [];
            } catch (error) {
                console.error("Error fetching fiscal years:", error);
                return [];
            }
        },
        staleTime: 5 * 60 * 1000,
        keepPreviousData: true,
    });

    useEffect(() => {
        if (yearsData && yearsData.length > 0) {
            const has2026 = yearsData.some((y) => y.year === 2026);
            if (has2026) {
                setSelectedYear(2026);
            } else if (yearsData[0]?.year) {
                setSelectedYear(yearsData[0].year);
            }
        }
    }, [yearsData]);

    const {
        data: budgetData,
        isLoading,
        refetch,
        isFetching,
        error: budgetError,
    } = useOptimizedQuery({
        queryKey: ["annual-budgets", selectedYear],
        queryFn: async () => {
            try {
                const response = await api.get(`/mayors-office/annual-budgets/year/${selectedYear}`);
                return response.data;
            } catch (error) {
                console.error("Error fetching budgets:", error);
                throw error;
            }
        },
        enabled: !!selectedYear,
        staleTime: 2 * 60 * 1000,
        keepPreviousData: true,
        retry: 1,
    });

    // ============================================
    // MUTATIONS
    // ============================================

    const setBudgetMutation = useMutation({
        mutationFn: async ({ data }) => {
            const response = await api.post("/mayors-office/annual-budgets", {
                fiscal_year: selectedYear,
                ...data,
            });
            return response.data;
        },
        onSuccess: () => {
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.success("Annual budget set successfully");
            setShowEditDialog(false);
            setEditingBudget(null);
            setEditErrors({});
            setEditTouched({});
            queryClient.invalidateQueries(["annual-budgets"]);
        },
        onError: (error) => {
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.error(error.response?.data?.message || "Failed to set budget");
        },
    });

    const updateWeeklyMutation = useMutation({
        mutationFn: async ({ departmentId, data }) => {
            const response = await api.put(`/mayors-office/budget/weekly/${departmentId}`, {
                weekly_allocation: data.weekly_ceiling,
                reason: data.reason || "Weekly ceiling update",
            });
            return response.data;
        },
        onSuccess: () => {
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.success("Weekly ceiling updated successfully");
            setShowWeeklyDialog(false);
            setWeeklyData({
                department_id: "",
                weekly_ceiling: "",
                reason: "",
            });
            setWeeklyDepartment(null);
            setWeeklyErrors({});
            setWeeklyTouched({});
            queryClient.invalidateQueries(["annual-budgets"]);
        },
        onError: (error) => {
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.error(error.response?.data?.message || "Failed to update weekly ceiling");
        },
    });

    const addBudgetMutation = useMutation({
        mutationFn: async (data) => {
            const response = await api.post("/mayors-office/annual-budgets/add", {
                fiscal_year: selectedYear,
                ...data,
            });
            return response.data;
        },
        onSuccess: () => {
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.success("Additional budget added successfully");
            setShowAddBudgetDialog(false);
            setAddBudgetData({
                department_id: "",
                additional_amount: "",
                reason: "",
            });
            setAddErrors({});
            setAddTouched({});
            queryClient.invalidateQueries(["annual-budgets"]);
        },
        onError: (error) => {
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.error(error.response?.data?.message || "Failed to add budget");
        },
    });

    const bulkUpdateMutation = useMutation({
        mutationFn: async () => {
            const budgets = Object.entries(bulkData).map(([departmentId, data]) => ({
                department_id: parseInt(departmentId),
                annual_amount: parseFloat(data.annual_amount) || 0,
                weekly_ceiling: parseFloat(data.weekly_ceiling) || 0,
            }));

            const response = await api.post("/mayors-office/annual-budgets/bulk", {
                fiscal_year: selectedYear,
                budgets,
            });
            return response.data;
        },
        onSuccess: () => {
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.success("All budgets saved successfully");
            setIsBulkMode(false);
            setBulkData({});
            queryClient.invalidateQueries(["annual-budgets"]);
        },
        onError: (error) => {
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.error(error.response?.data?.message || "Failed to save budgets");
        },
    });

    // ============================================
    // HELPERS
    // ============================================

    const budgets = (() => {
    const raw = budgetData?.data;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.data)) return raw.data;
    if (budgetData && Array.isArray(budgetData)) return budgetData;
    // Fallback: check for common keys
    const keys = ['budgets', 'items', 'results', 'records'];
    for (const k of keys) {
        if (Array.isArray(budgetData?.[k])) return budgetData[k];
        if (Array.isArray(raw?.[k])) return raw[k];
    }
    return [];
})();
    const summary = budgetData?.summary || {};
    const fiscalYear = budgetData?.fiscal_year || {};

    const formatCurrency = (amount) => {
        if (!amount || amount === 0) return "₱0.00";
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 2,
        }).format(amount);
    };

    const getStatusBadge = (status) => {
        if (status === "not_set" || !status) {
            return <Badge className="bg-slate-400">Not Set</Badge>;
        }
        return <Badge className="bg-green-500">Active</Badge>;
    };

    // ============================================
    // VALIDATION FUNCTIONS
    // ============================================

    const validateEditBudget = () => {
        const newErrors = {};
        const newTouched = {};

        if (!formData.annual_amount || parseFloat(formData.annual_amount) <= 0) {
            newErrors.annual_amount = "Annual budget must be greater than 0";
            newTouched.annual_amount = true;
        }

        setEditErrors(newErrors);
        setEditTouched(prev => ({ ...prev, ...newTouched }));

        if (Object.keys(newErrors).length > 0) {
            const errorMessages = Object.entries(newErrors).map(([field, msg]) => {
                const labels = { annual_amount: 'Annual Budget' };
                const label = labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return `• ${label}: ${msg}`;
            });

            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.error(
                <div className="space-y-1">
                    <div className="font-semibold text-red-600 dark:text-red-400">Please fix the following errors:</div>
                    <div className="text-sm text-red-500 dark:text-red-300 space-y-0.5">
                        {errorMessages.map((msg, i) => (
                            <div key={i}>{msg}</div>
                        ))}
                    </div>
                </div>,
                { duration: 5000 }
            );

            const firstField = Object.keys(newErrors)[0];
            if (firstField) {
                const element = document.querySelector(`[name="${firstField}"]`) || document.getElementById(firstField);
                if (element) setTimeout(() => element.focus(), 100);
            }
            return false;
        }
        return true;
    };

    const validateWeeklyBudget = () => {
        const newErrors = {};
        const newTouched = {};

        if (!weeklyData.department_id) {
            newErrors.department_id = "Department is required";
            newTouched.department_id = true;
        }
        if (!weeklyData.weekly_ceiling || parseFloat(weeklyData.weekly_ceiling) <= 0) {
            newErrors.weekly_ceiling = "Weekly ceiling must be greater than 0";
            newTouched.weekly_ceiling = true;
        }
        if (!weeklyData.reason || weeklyData.reason.trim().length < 3) {
            newErrors.reason = "Reason must be at least 3 characters";
            newTouched.reason = true;
        }

        setWeeklyErrors(newErrors);
        setWeeklyTouched(prev => ({ ...prev, ...newTouched }));

        if (Object.keys(newErrors).length > 0) {
            const errorMessages = Object.entries(newErrors).map(([field, msg]) => {
                const labels = {
                    department_id: 'Department',
                    weekly_ceiling: 'Weekly Ceiling',
                    reason: 'Reason'
                };
                const label = labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return `• ${label}: ${msg}`;
            });

            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.error(
                <div className="space-y-1">
                    <div className="font-semibold text-red-600 dark:text-red-400">Please fix the following errors:</div>
                    <div className="text-sm text-red-500 dark:text-red-300 space-y-0.5">
                        {errorMessages.map((msg, i) => (
                            <div key={i}>{msg}</div>
                        ))}
                    </div>
                </div>,
                { duration: 5000 }
            );

            const firstField = Object.keys(newErrors)[0];
            if (firstField) {
                const element = document.querySelector(`[name="${firstField}"]`) || document.getElementById(firstField);
                if (element) setTimeout(() => element.focus(), 100);
            }
            return false;
        }
        return true;
    };

    const validateAddBudget = () => {
        const newErrors = {};
        const newTouched = {};

        if (!addBudgetData.department_id) {
            newErrors.department_id = "Department is required";
            newTouched.department_id = true;
        }
        if (!addBudgetData.additional_amount || parseFloat(addBudgetData.additional_amount) <= 0) {
            newErrors.additional_amount = "Amount must be greater than 0";
            newTouched.additional_amount = true;
        }
        if (!addBudgetData.reason || addBudgetData.reason.trim().length < 3) {
            newErrors.reason = "Reason must be at least 3 characters";
            newTouched.reason = true;
        }

        setAddErrors(newErrors);
        setAddTouched(prev => ({ ...prev, ...newTouched }));

        if (Object.keys(newErrors).length > 0) {
            const errorMessages = Object.entries(newErrors).map(([field, msg]) => {
                const labels = {
                    department_id: 'Department',
                    additional_amount: 'Amount',
                    reason: 'Reason'
                };
                const label = labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return `• ${label}: ${msg}`;
            });

            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.error(
                <div className="space-y-1">
                    <div className="font-semibold text-red-600 dark:text-red-400">Please fix the following errors:</div>
                    <div className="text-sm text-red-500 dark:text-red-300 space-y-0.5">
                        {errorMessages.map((msg, i) => (
                            <div key={i}>{msg}</div>
                        ))}
                    </div>
                </div>,
                { duration: 5000 }
            );

            const firstField = Object.keys(newErrors)[0];
            if (firstField) {
                const element = document.querySelector(`[name="${firstField}"]`) || document.getElementById(firstField);
                if (element) setTimeout(() => element.focus(), 100);
            }
            return false;
        }
        return true;
    };

    // ============================================
    // HANDLERS
    // ============================================

    const openWeeklyDialog = (budget) => {
        setWeeklyDepartment(budget);
        setWeeklyData({
            department_id: budget.department_id.toString(),
            weekly_ceiling: budget.weekly_ceiling?.toString() || "",
            reason: "",
        });
        setWeeklyErrors({});
        setWeeklyTouched({});
        setShowWeeklyDialog(true);
    };

    const handleWeeklyUpdate = () => {
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        if (!validateWeeklyBudget()) return;

        updateWeeklyMutation.mutate({
            departmentId: parseInt(weeklyData.department_id),
            data: {
                weekly_ceiling: parseFloat(weeklyData.weekly_ceiling),
                reason: weeklyData.reason || "Weekly ceiling update",
            },
        });
    };

    const handleEdit = (budget) => {
        setEditingBudget(budget);
        setFormData({
            annual_amount: budget.annual_amount?.toString() || "",
            weekly_ceiling: budget.weekly_ceiling?.toString() || "",
        });
        setEditErrors({});
        setEditTouched({});
        setShowEditDialog(true);
    };

    const handleView = (budget) => {
        setViewingBudget(budget);
        setShowViewDialog(true);
    };

    const handleSetBudget = () => {
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        if (!validateEditBudget()) return;

        const data = {
            department_id: editingBudget.department_id,
            annual_amount: parseFloat(formData.annual_amount) || 0,
        };
        setBudgetMutation.mutate({ data });
    };

    const handleAddBudget = () => {
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        if (!validateAddBudget()) return;

        addBudgetMutation.mutate({
            department_id: parseInt(addBudgetData.department_id),
            additional_amount: parseFloat(addBudgetData.additional_amount),
            reason: addBudgetData.reason || "Additional budget allocation",
        });
    };

    const handleBulkChange = (departmentId, field, value) => {
        setBulkData((prev) => {
            const current = prev[departmentId] || {
                annual_amount: "",
                weekly_ceiling: "",
            };
            return {
                ...prev,
                [departmentId]: {
                    ...current,
                    [field]: value,
                },
            };
        });
    };

    const handleBulkSave = () => {
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        bulkUpdateMutation.mutate();
    };

    const handleBulkCancel = () => {
        setIsBulkMode(false);
        setBulkData({});
    };

    // ============================================
    // FILTER LOGIC
    // ============================================

    const filteredBudgets = useMemo(() => {
        let filtered = [...budgets];

        if (filters.searchTerm) {
            const search = filters.searchTerm.toLowerCase();
            filtered = filtered.filter(b => 
                b.department_name?.toLowerCase().includes(search) ||
                b.department_code?.toLowerCase().includes(search)
            );
        }

        if (filters.departmentId !== 'all') {
            filtered = filtered.filter(b => b.department_id === parseInt(filters.departmentId));
        }

        if (filters.allocationStatus !== 'all') {
            filtered = filtered.filter(b => {
                const annualAmount = b.annual_amount || 0;
                const usedAmount = b.used_amount || 0;
                const utilization = annualAmount > 0 ? (usedAmount / annualAmount) * 100 : 0;

                switch (filters.allocationStatus) {
                    case 'has_budget':
                        return b.has_budget;
                    case 'no_budget':
                        return !b.has_budget;
                    case 'over_budget':
                        return b.remaining_amount < 0;
                    case 'near_limit':
                        return utilization > 80 && utilization <= 100;
                    case 'on_track':
                        return utilization > 0 && utilization <= 80;
                    default:
                        return true;
                }
            });
        }

        if (filters.budgetRange !== 'all') {
            filtered = filtered.filter(b => {
                const amount = b.annual_amount || 0;
                switch (filters.budgetRange) {
                    case 'under_50k':
                        return amount < 50000;
                    case '50k_100k':
                        return amount >= 50000 && amount < 100000;
                    case '100k_500k':
                        return amount >= 100000 && amount < 500000;
                    case '500k_1m':
                        return amount >= 500000 && amount < 1000000;
                    case 'over_1m':
                        return amount >= 1000000;
                    default:
                        return true;
                }
            });
        }

        return filtered;
    }, [budgets, filters]);

    useEffect(() => {
        if (budgets.length > 0 && isBulkMode) {
            const initialBulk = {};
            budgets.forEach((budget) => {
                initialBulk[budget.department_id] = {
                    annual_amount: budget.annual_amount?.toString() || "",
                    weekly_ceiling: budget.weekly_ceiling?.toString() || "",
                };
            });
            setBulkData(initialBulk);
        }
    }, [budgets, isBulkMode]);

    // Connection status
    const connectionStatus = isConnected ? "🟢 Live" : "🔴 Offline";
    const isRealTime = isConnected;

    // ============================================
    // LOADING & ERROR STATES
    // ============================================

    if (budgetError) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="w-20 h-20 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="h-10 w-10 text-red-500" />
                </div>
                <p className="text-red-600 dark:text-red-400 font-medium mb-2">Failed to load budget data</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                    {budgetError.response?.data?.message || budgetError.message}
                </p>
            </div>
        );
    }

    if (yearsLoading || isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                <div className="p-4 md:p-6">
                    <SkeletonPage />
                    <SkeletonStats count={4} />
                    <SkeletonTable rows={5} cols={8} />
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="space-y-6 p-4 md:p-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/mo/dashboard')}
                            className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                                    <PhilippinePeso className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                                        Annual Budget Allocation
                                    </h1>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Set annual fuel budget and weekly ceiling per department
                                        <span className="ml-2 text-xs opacity-70">{connectionStatus}</span>
                                        {isRealTime && (
                                            <span className="ml-2 text-xs text-emerald-400 animate-pulse">
                                                ● Auto-refresh
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {/* ❌ REFRESH BUTTON REMOVED - Auto-refresh handles everything */}
                        {/* ❌ ADD BUDGET BUTTON REMOVED - Use the Plus icon in table or dialog */}
                        {budgets.length > 0 && (
                            <Button
                                variant={isBulkMode ? "default" : "outline"}
                                onClick={() => setIsBulkMode(!isBulkMode)}
                                className={isBulkMode ? "bg-blue-600 hover:bg-blue-700 text-white" : "dark:border-slate-700 dark:text-slate-300"}
                            >
                                {isBulkMode ? "Exit Bulk Edit" : "Bulk Edit"}
                            </Button>
                        )}
                        {isBulkMode && (
                            <>
                                <Button
                                    onClick={handleBulkSave}
                                    disabled={bulkUpdateMutation.isPending}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                    {bulkUpdateMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Save All
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleBulkCancel}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Year Selector */}
                <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-slate-400" />
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                    Select Fiscal Year:
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {yearsData?.length > 0 ? (
                                    yearsData.map((year) => {
                                        const yearValue = typeof year === "object" ? year.year : year;
                                        const isActive = typeof year === "object" ? year.is_active : true;
                                        const key = typeof year === "object" ? year.fiscal_year_id || yearValue : yearValue;

                                        return (
                                            <Button
                                                key={key}
                                                variant={selectedYear === yearValue ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setSelectedYear(yearValue)}
                                                className={
                                                    selectedYear === yearValue
                                                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                                                        : "dark:border-slate-700 dark:text-slate-300"
                                                }
                                            >
                                                {yearValue}
                                                {isActive && (
                                                    <span className="ml-1 text-xs text-green-400">●</span>
                                                )}
                                            </Button>
                                        );
                                    })
                                ) : (
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                                        No fiscal years available. Please ask GSO to add years.
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                        title="Total Annual Budget"
                        value={formatCurrency(summary.total_allocated)}
                        icon={PhilippinePeso}
                        color="from-blue-500 to-blue-600"
                        subtitle="Total allocation"
                        trend={summary.total_allocated > 0 ? 5 : 0}
                    />
                    <StatsCard
                        title="Used"
                        value={formatCurrency(summary.total_used)}
                        icon={TrendingDown}
                        color="from-yellow-500 to-yellow-600"
                        subtitle="Total spent so far"
                        trend={summary.total_used > 0 ? 8 : 0}
                    />
                    <StatsCard
                        title="Remaining Annual"
                        value={formatCurrency(summary.total_remaining)}
                        icon={TrendingUp}
                        color="from-emerald-500 to-emerald-600"
                        subtitle="Available for allocation"
                        trend={summary.total_remaining > 0 ? -3 : 0}
                    />
                    <StatsCard
                        title="Departments"
                        value={`${summary.departments_with_budget || 0} / ${summary.total_departments || 0}`}
                        icon={Building2}
                        color="from-purple-500 to-purple-600"
                        subtitle={`${summary.departments_without_budget || 0} without budget`}
                        trend={summary.departments_with_budget > 0 ? 2 : 0}
                    />
                </div>

                {/* Filter Section */}
                <FilterSection
                    filters={filters}
                    setFilters={setFilters}
                    departments={budgets}
                    isFilterOpen={isFilterOpen}
                    setIsFilterOpen={setIsFilterOpen}
                />

                {/* Budget Table Container */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl shadow-black/5">
                    <div className="border-b border-slate-200/60 dark:border-slate-700/60 px-6 py-4 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="flex items-center gap-2 text-slate-800 dark:text-white font-semibold">
                                    <PhilippinePeso className="h-5 w-5 text-green-500" />
                                    Budget Details for {selectedYear}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {filteredBudgets.length} departments
                                    {filteredBudgets.length !== budgets.length && ` (filtered from ${budgets.length})`}
                                    {fiscalYear?.is_active === false && (
                                        <Badge className="ml-2 bg-yellow-500 text-white">
                                            <AlertCircle className="h-3 w-3 mr-1" />
                                            Inactive
                                        </Badge>
                                    )}
                                </p>
                            </div>
                            {filteredBudgets.length > 0 && (
                                <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                                    <Zap className="h-3 w-3 mr-1" />
                                    {filteredBudgets.length} records
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* TABLE HEADER */}
                    <div 
                        className="sticky top-0 z-40 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700"
                        style={{ 
                            position: 'sticky',
                            top: 0,
                            zIndex: 40
                        }}
                    >
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                                    <TableHead
                                        className="
                                            sticky left-0 z-50
                                            bg-slate-50 dark:bg-slate-900/50
                                            font-semibold
                                            text-slate-600 dark:text-slate-400
                                            text-xs uppercase tracking-wider
                                            min-w-[131.5px]
                                            border-r border-slate-200 dark:border-slate-700
                                        "
                                    >
                                        <span className="flex items-center gap-1">
                                            <Building2 className="h-3 w-5" />
                                            Code
                                        </span>
                                    </TableHead>
                                    <TableHead
                                        className="
                                            text-right
                                            font-semibold
                                            text-slate-600 dark:text-slate-400
                                            text-xs uppercase tracking-wider
                                            min-w-[120px]
                                        "
                                    >
                                        Annual Budget
                                    </TableHead>
                                    <TableHead
                                        className="
                                            text-right
                                            font-semibold
                                            text-slate-600 dark:text-slate-400
                                            text-xs uppercase tracking-wider
                                            min-w-[120px]
                                        "
                                    >
                                        Weekly Ceiling
                                    </TableHead>
                                    <TableHead
                                        className="
                                            text-right
                                            font-semibold
                                            text-slate-600 dark:text-slate-400
                                            text-xs uppercase tracking-wider
                                            min-w-[100px]
                                        "
                                    >
                                        Used
                                    </TableHead>
                                    <TableHead
                                        className="
                                            text-right
                                            font-semibold
                                            text-slate-600 dark:text-slate-400
                                            text-xs uppercase tracking-wider
                                            min-w-[110px]
                                        "
                                    >
                                        Remaining
                                    </TableHead>
                                    <TableHead
                                        className="
                                            text-right
                                            font-semibold
                                            text-slate-600 dark:text-slate-400
                                            text-xs uppercase tracking-wider
                                            min-w-[100px]
                                        "
                                    >
                                        Weekly Used
                                    </TableHead>
                                    <TableHead
                                        className="
                                            text-right
                                            font-semibold
                                            text-slate-600 dark:text-slate-400
                                            text-xs uppercase tracking-wider
                                            min-w-[120px]
                                        "
                                    >
                                        Weekly Remaining
                                    </TableHead>
                                    <TableHead
                                        className="
                                            text-center
                                            font-semibold
                                            text-slate-600 dark:text-slate-400
                                            text-xs uppercase tracking-wider
                                            min-w-[90px]
                                        "
                                    >
                                        Status
                                    </TableHead>
                                    <TableHead
                                        className="
                                            sticky right-0 z-50
                                            bg-slate-50 dark:bg-slate-900/50
                                            text-right
                                            font-semibold
                                            text-slate-600 dark:text-slate-400
                                            text-xs uppercase tracking-wider
                                            min-w-[200px]
                                            border-l border-slate-200 dark:border-slate-700
                                        "
                                    >
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                        </Table>
                    </div>

                    {/* Scrollable Table Body Container */}
                    {filteredBudgets.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                                <Search className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No departments found</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                {filters.searchTerm || filters.departmentId !== 'all' || filters.allocationStatus !== 'all' || filters.budgetRange !== 'all'
                                    ? 'Try adjusting your filters'
                                    : 'Please ask GSO to add departments or select a different year'}
                            </p>
                            {(filters.searchTerm || filters.departmentId !== 'all' || filters.allocationStatus !== 'all' || filters.budgetRange !== 'all') && (
                                <Button
                                    variant="link"
                                    onClick={() => setFilters({ searchTerm: '', departmentId: 'all', allocationStatus: 'all', budgetRange: 'all' })}
                                    className="mt-2"
                                >
                                    Clear filters
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div
                            className="overflow-auto"
                            style={{
                                maxHeight: "500px",
                            }}
                        >
                            <Table className="w-full">
                                <TableBody>
                                    {filteredBudgets.map((budget) => {
                                        const isEditing =
                                            isBulkMode && bulkData[budget.department_id];

                                        const isNew = !budget.has_budget;

                                        const weeklyUsedPercent =
                                            budget.weekly_ceiling > 0
                                                ? Math.round(
                                                    ((budget.weekly_used || 0) /
                                                        budget.weekly_ceiling) *
                                                    100
                                                )
                                                : 0;

                                        return (
                                            <TableRow
                                                key={budget.department_id}
                                                className={cn(
                                                    "hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors",
                                                    isNew
                                                        ? "bg-yellow-50/50 dark:bg-yellow-950/20"
                                                        : ""
                                                )}
                                            >
                                                <TableCell
                                                    className="
                                                        sticky left-0 z-30
                                                        bg-white dark:bg-slate-800
                                                        border-r border-slate-200 dark:border-slate-700
                                                    "
                                                >
                                                    <div className="flex items-center gap-2 min-w-[101.6px]">
                                                        <DepartmentTooltip
                                                            code={budget.department_code || "N/A"}
                                                            name={budget.department_name}
                                                        />
                                                    </div>
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    {isBulkMode ? (
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={
                                                                isEditing
                                                                    ? bulkData[
                                                                        budget.department_id
                                                                    ]?.annual_amount
                                                                    : ""
                                                            }
                                                            onChange={(e) =>
                                                                handleBulkChange(
                                                                    budget.department_id,
                                                                    "annual_amount",
                                                                    e.target.value
                                                                )
                                                            }
                                                            className="w-32 ml-auto text-right dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                                            placeholder="0.00"
                                                        />
                                                    ) : (
                                                        <span className="font-medium text-blue-600 dark:text-blue-400">
                                                            {formatCurrency(
                                                                budget.annual_amount
                                                            )}
                                                        </span>
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    {isBulkMode ? (
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={
                                                                isEditing
                                                                    ? bulkData[
                                                                        budget.department_id
                                                                    ]?.weekly_ceiling
                                                                    : ""
                                                            }
                                                            onChange={(e) =>
                                                                handleBulkChange(
                                                                    budget.department_id,
                                                                    "weekly_ceiling",
                                                                    e.target.value
                                                                )
                                                            }
                                                            className="w-32 ml-auto text-right dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                                            placeholder="Auto"
                                                        />
                                                    ) : (
                                                        <div>
                                                            <span
                                                                className={cn(
                                                                    "font-medium",
                                                                    (budget.weekly_used || 0) > 0
                                                                        ? "text-orange-600 dark:text-orange-400"
                                                                        : "text-slate-700 dark:text-slate-300"
                                                                )}
                                                            >
                                                                {formatCurrency(
                                                                    budget.weekly_ceiling || 0
                                                                )}
                                                            </span>

                                                            {budget.suggested_ceiling > 0 && (
                                                                <div className="text-xs text-slate-400 dark:text-slate-500">
                                                                    Suggested:{" "}
                                                                    {formatCurrency(
                                                                        budget.suggested_ceiling
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    <span className="font-medium text-yellow-600 dark:text-yellow-400">
                                                        {formatCurrency(
                                                            budget.used_amount || 0
                                                        )}
                                                    </span>

                                                    {(budget.total_used_this_year || 0) > 0 && (
                                                        <div className="text-xs text-slate-400 dark:text-slate-500">
                                                            Total:{" "}
                                                            {formatCurrency(
                                                                budget.total_used_this_year
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                                        {formatCurrency(
                                                            budget.remaining_amount || 0
                                                        )}
                                                    </span>

                                                    {budget.remaining_after_weekly !==
                                                        undefined && (
                                                        <div className="text-xs text-slate-400 dark:text-slate-500">
                                                            After weekly:{" "}
                                                            {formatCurrency(
                                                                budget.remaining_after_weekly
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    <span
                                                        className={cn(
                                                            "font-medium",
                                                            (budget.weekly_used || 0) > 0
                                                                ? "text-red-600 dark:text-red-400"
                                                                : "text-slate-400"
                                                        )}
                                                    >
                                                        {formatCurrency(
                                                            budget.weekly_used || 0
                                                        )}
                                                    </span>

                                                    {(budget.weekly_used || 0) > 0 &&
                                                        budget.weekly_ceiling > 0 && (
                                                            <div className="text-xs text-slate-400 dark:text-slate-500">
                                                                {weeklyUsedPercent}% used
                                                            </div>
                                                        )}
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    <span
                                                        className={cn(
                                                            "font-medium",
                                                            (budget.weekly_remaining || 0) <= 0
                                                                ? "text-red-600 dark:text-red-400"
                                                                : (budget.weekly_remaining ||
                                                                    0) <
                                                                    (budget.weekly_ceiling || 0) *
                                                                        0.2
                                                                    ? "text-yellow-600 dark:text-yellow-400"
                                                                    : "text-emerald-600 dark:text-emerald-400"
                                                        )}
                                                    >
                                                        {formatCurrency(
                                                            budget.weekly_remaining || 0
                                                        )}
                                                    </span>

                                                    {(budget.weekly_remaining || 0) > 0 &&
                                                        budget.weekly_ceiling > 0 && (
                                                            <div className="text-xs text-slate-400 dark:text-slate-500">
                                                                {formatCurrency(
                                                                    budget.weekly_ceiling -
                                                                        budget.weekly_remaining
                                                                )}{" "}
                                                                used
                                                            </div>
                                                        )}
                                                </TableCell>

                                                <TableCell className="text-center">
                                                    {getStatusBadge(budget.status)}
                                                </TableCell>

                                                <TableCell
                                                    className="
                                                        sticky right-0 z-30
                                                        bg-white dark:bg-slate-800
                                                        text-right
                                                        border-l border-slate-200 dark:border-slate-700
                                                    "
                                                >
                                                    <div className="flex items-center justify-end gap-1 min-w-[120px]">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleView(budget)
                                                            }
                                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-9 w-9 p-0 rounded-lg transition-all duration-200"
                                                            title="View Details"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>

                                                        {!isBulkMode && (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        openWeeklyDialog(budget)
                                                                    }
                                                                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-950/30 h-9 w-9 p-0 rounded-lg transition-all duration-200"
                                                                    title="Set Weekly Ceiling"
                                                                >
                                                                    <Clock className="h-4 w-4" />
                                                                </Button>

                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setAddBudgetData({
                                                                            department_id:
                                                                                budget.department_id.toString(),
                                                                            additional_amount:
                                                                                "",
                                                                            reason: "",
                                                                        });
                                                                        setAddErrors({});
                                                                        setAddTouched({});
                                                                        setShowAddBudgetDialog(
                                                                            true
                                                                        );
                                                                    }}
                                                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-950/30 h-9 w-9 p-0 rounded-lg transition-all duration-200"
                                                                    title="Add Budget"
                                                                >
                                                                    <Plus className="h-4 w-4" />
                                                                </Button>

                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        handleEdit(budget)
                                                                    }
                                                                    className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/30 h-9 w-9 p-0 rounded-lg transition-all duration-200"
                                                                    title="Edit Annual Budget"
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p>FCMS - Mayor's Office • Annual Budget Allocation</p>
                    <p className="mt-0.5">FY {selectedYear} • {filteredBudgets.length} departments • {filteredBudgets.filter(b => b.has_budget).length} with budget</p>
                </div>
            </div>

            {/* ========== DIALOGS ========== */}

            {/* ANNUAL BUDGET EDIT DIALOG */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="dark:bg-slate-800 dark:border-slate-700 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <div className="p-2 rounded-xl bg-green-500/10">
                                <PhilippinePeso className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            Edit Annual Budget
                        </DialogTitle>
                        <DialogDescription className="dark:text-slate-400">
                            Update annual budget for {editingBudget?.department_name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Department</p>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {editingBudget?.department_name}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Code</p>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {editingBudget?.department_code}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Fiscal Year</p>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {selectedYear}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Current Used</p>
                                    <p className="font-semibold text-yellow-600 dark:text-yellow-400">
                                        {formatCurrency(editingBudget?.used_amount)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <FormField
                            label="Annual Budget (₱)"
                            icon={PhilippinePeso}
                            required
                            error={editErrors.annual_amount}
                            touched={editTouched.annual_amount}
                        >
                            <Input
                                id="annual_amount"
                                name="annual_amount"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.annual_amount}
                                onChange={(e) => {
                                    setFormData({
                                        ...formData,
                                        annual_amount: e.target.value,
                                    });
                                    if (editErrors.annual_amount) {
                                        setEditErrors(prev => ({ ...prev, annual_amount: "" }));
                                    }
                                }}
                                onBlur={() => setEditTouched(prev => ({ ...prev, annual_amount: true }))}
                                className="mt-1.5 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                placeholder="Enter annual budget"
                            />
                        </FormField>

                        <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-3 border border-purple-200 dark:border-purple-800">
                            <p className="text-xs text-purple-700 dark:text-purple-300 flex items-center gap-1">
                                <Info className="h-3 w-3 text-purple-500 dark:text-purple-400" />
                                Current Weekly Ceiling:{" "}
                                <span className="font-semibold text-purple-800 dark:text-purple-200">
                                    {formatCurrency(editingBudget?.weekly_ceiling || 0)}
                                </span>
                            </p>
                            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                💡 To change weekly ceiling, use the <span className="font-medium">Clock icon</span> in the actions column
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowEditDialog(false);
                                setEditingBudget(null);
                                setEditErrors({});
                                setEditTouched({});
                            }}
                            className="dark:border-slate-700 dark:text-slate-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSetBudget}
                            disabled={setBudgetMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            {setBudgetMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            Save Annual Budget
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ========== WEEKLY CEILING DIALOG ========== */}
            <Dialog open={showWeeklyDialog} onOpenChange={setShowWeeklyDialog}>
                <DialogContent className="dark:bg-slate-800 dark:border-slate-700 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <div className="p-2 rounded-xl bg-purple-500/10">
                                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            Set Weekly Ceiling
                        </DialogTitle>
                        <DialogDescription className="dark:text-slate-400">
                            Set weekly fuel ceiling for {weeklyDepartment?.department_name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Department</p>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {weeklyDepartment?.department_name}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Code</p>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {weeklyDepartment?.department_code}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Annual Budget</p>
                                    <p className="font-semibold text-blue-600 dark:text-blue-400">
                                        {formatCurrency(weeklyDepartment?.annual_amount)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Suggested Ceiling</p>
                                    <p className="font-semibold text-purple-600 dark:text-purple-400">
                                        {formatCurrency(weeklyDepartment?.suggested_ceiling || 0)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <FormField
                            label="Weekly Fueling Ceiling (₱)"
                            icon={Clock}
                            required
                            error={weeklyErrors.weekly_ceiling}
                            touched={weeklyTouched.weekly_ceiling}
                        >
                            <Input
                                id="weekly_ceiling"
                                name="weekly_ceiling"
                                type="number"
                                step="0.01"
                                min="0"
                                value={weeklyData.weekly_ceiling}
                                onChange={(e) => {
                                    setWeeklyData({
                                        ...weeklyData,
                                        weekly_ceiling: e.target.value,
                                    });
                                    if (weeklyErrors.weekly_ceiling) {
                                        setWeeklyErrors(prev => ({ ...prev, weekly_ceiling: "" }));
                                    }
                                }}
                                onBlur={() => setWeeklyTouched(prev => ({ ...prev, weekly_ceiling: true }))}
                                className="mt-1.5 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                placeholder="Enter weekly ceiling"
                            />
                        </FormField>

                        <div className="flex items-center gap-2 mt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    if (weeklyDepartment?.suggested_ceiling) {
                                        setWeeklyData({
                                            ...weeklyData,
                                            weekly_ceiling: weeklyDepartment.suggested_ceiling.toString(),
                                        });
                                        if (weeklyErrors.weekly_ceiling) {
                                            setWeeklyErrors(prev => ({ ...prev, weekly_ceiling: "" }));
                                        }
                                    }
                                }}
                                className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                            >
                                Use suggested ({formatCurrency(weeklyDepartment?.suggested_ceiling || 0)})
                            </button>
                            <span className="text-xs text-slate-400 dark:text-slate-500">|</span>
                            <button
                                type="button"
                                onClick={() => {
                                    if (weeklyDepartment?.weekly_ceiling) {
                                        setWeeklyData({
                                            ...weeklyData,
                                            weekly_ceiling: weeklyDepartment.weekly_ceiling.toString(),
                                        });
                                        if (weeklyErrors.weekly_ceiling) {
                                            setWeeklyErrors(prev => ({ ...prev, weekly_ceiling: "" }));
                                        }
                                    }
                                }}
                                className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                            >
                                Reset to current
                            </button>
                        </div>

                        <FormField
                            label="Reason"
                            icon={Info}
                            required
                            error={weeklyErrors.reason}
                            touched={weeklyTouched.reason}
                        >
                            <Input
                                id="reason"
                                name="reason"
                                type="text"
                                value={weeklyData.reason}
                                onChange={(e) => {
                                    setWeeklyData({
                                        ...weeklyData,
                                        reason: e.target.value,
                                    });
                                    if (weeklyErrors.reason) {
                                        setWeeklyErrors(prev => ({ ...prev, reason: "" }));
                                    }
                                }}
                                onBlur={() => setWeeklyTouched(prev => ({ ...prev, reason: true }))}
                                className="mt-1.5 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                placeholder="e.g., Adjust weekly fuel allocation"
                            />
                        </FormField>

                        {weeklyData.weekly_ceiling && weeklyDepartment && (
                            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">📊 Impact:</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-slate-500 dark:text-slate-400">New Ceiling:</span>
                                        <span className="font-semibold text-purple-600 dark:text-purple-400 ml-1">
                                            {formatCurrency(parseFloat(weeklyData.weekly_ceiling) || 0)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 dark:text-slate-400">Previous:</span>
                                        <span className="font-semibold text-slate-600 dark:text-slate-400 ml-1">
                                            {formatCurrency(weeklyDepartment?.weekly_ceiling || 0)}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-slate-500 dark:text-slate-400">Change:</span>
                                        <span className={cn(
                                            "font-semibold ml-1",
                                            parseFloat(weeklyData.weekly_ceiling) > (weeklyDepartment?.weekly_ceiling || 0)
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : parseFloat(weeklyData.weekly_ceiling) < (weeklyDepartment?.weekly_ceiling || 0)
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : 'text-slate-600 dark:text-slate-400'
                                        )}>
                                            {formatCurrency(
                                                (parseFloat(weeklyData.weekly_ceiling) || 0) - (weeklyDepartment?.weekly_ceiling || 0)
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="mt-6">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowWeeklyDialog(false);
                                setWeeklyData({
                                    department_id: "",
                                    weekly_ceiling: "",
                                    reason: "",
                                });
                                setWeeklyDepartment(null);
                                setWeeklyErrors({});
                                setWeeklyTouched({});
                            }}
                            className="dark:border-slate-700 dark:text-slate-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleWeeklyUpdate}
                            disabled={updateWeeklyMutation.isPending}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {updateWeeklyMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Clock className="h-4 w-4 mr-2" />
                            )}
                            Update Weekly Ceiling
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ========== ADD BUDGET DIALOG ========== */}
            <Dialog open={showAddBudgetDialog} onOpenChange={setShowAddBudgetDialog}>
                <DialogContent className="dark:bg-slate-800 dark:border-slate-700 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <div className="p-2 rounded-xl bg-emerald-500/10">
                                <Plus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            Add Additional Budget
                        </DialogTitle>
                        <DialogDescription className="dark:text-slate-400">
                            Add additional annual budget to a department
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                            <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-blue-700 dark:text-blue-300">
                                    <p>Adding budget will:</p>
                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                        <li>Increase the annual budget of the department</li>
                                        <li>Automatically update the weekly ceiling suggestion</li>
                                        <li>Be recorded in the budget history</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <FormField
                            label="Department"
                            icon={Building2}
                            required
                            error={addErrors.department_id}
                            touched={addTouched.department_id}
                        >
                            <select
                                id="department_id"
                                name="department_id"
                                value={addBudgetData.department_id}
                                onChange={(e) => {
                                    setAddBudgetData({
                                        ...addBudgetData,
                                        department_id: e.target.value,
                                    });
                                    if (addErrors.department_id) {
                                        setAddErrors(prev => ({ ...prev, department_id: "" }));
                                    }
                                }}
                                onBlur={() => setAddTouched(prev => ({ ...prev, department_id: true }))}
                                className={cn(
                                    "w-full mt-1.5 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white",
                                    addErrors.department_id && "border-red-500 ring-red-500 bg-red-50/50 dark:bg-red-950/10"
                                )}
                            >
                                <option value="">Select Department</option>
                                {budgets.map((budget) => (
                                    <option key={budget.department_id} value={budget.department_id}>
                                        {budget.department_code} - {budget.department_name}
                                        {budget.has_budget && ` (Current: ${formatCurrency(budget.annual_amount)})`}
                                    </option>
                                ))}
                            </select>
                        </FormField>

                        <FormField
                            label="Additional Amount (₱)"
                            icon={PhilippinePeso}
                            required
                            error={addErrors.additional_amount}
                            touched={addTouched.additional_amount}
                        >
                            <Input
                                id="additional_amount"
                                name="additional_amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={addBudgetData.additional_amount}
                                onChange={(e) => {
                                    setAddBudgetData({
                                        ...addBudgetData,
                                        additional_amount: e.target.value,
                                    });
                                    if (addErrors.additional_amount) {
                                        setAddErrors(prev => ({ ...prev, additional_amount: "" }));
                                    }
                                }}
                                onBlur={() => setAddTouched(prev => ({ ...prev, additional_amount: true }))}
                                className="mt-1.5 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                placeholder="Enter amount to add"
                            />
                        </FormField>

                        <FormField
                            label="Reason"
                            icon={Info}
                            required
                            error={addErrors.reason}
                            touched={addTouched.reason}
                        >
                            <Input
                                id="reason"
                                name="reason"
                                type="text"
                                value={addBudgetData.reason}
                                onChange={(e) => {
                                    setAddBudgetData({
                                        ...addBudgetData,
                                        reason: e.target.value,
                                    });
                                    if (addErrors.reason) {
                                        setAddErrors(prev => ({ ...prev, reason: "" }));
                                    }
                                }}
                                onBlur={() => setAddTouched(prev => ({ ...prev, reason: true }))}
                                className="mt-1.5 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                placeholder="e.g., Mayor's Memo No. 2026-001"
                            />
                        </FormField>

                        {addBudgetData.department_id && addBudgetData.additional_amount && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    {budgets.find(b => b.department_id === parseInt(addBudgetData.department_id))?.department_name} will receive:
                                </p>
                                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(parseFloat(addBudgetData.additional_amount) || 0)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    New suggested weekly ceiling: {formatCurrency((parseFloat(addBudgetData.additional_amount) || 0) / 52)}
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="mt-6">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowAddBudgetDialog(false);
                                setAddBudgetData({
                                    department_id: "",
                                    additional_amount: "",
                                    reason: "",
                                });
                                setAddErrors({});
                                setAddTouched({});
                            }}
                            className="dark:border-slate-700 dark:text-slate-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddBudget}
                            disabled={addBudgetMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {addBudgetMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Plus className="h-4 w-4 mr-2" />
                            )}
                            Add Budget
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ========== VIEW DIALOG ========== */}
            <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
                <DialogContent className="dark:bg-slate-800 dark:border-slate-700 max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <div className="p-2 rounded-xl bg-blue-500/10">
                                <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            Budget Details
                        </DialogTitle>
                        <DialogDescription className="dark:text-slate-400">
                            {viewingBudget?.department_name} - {selectedYear}
                        </DialogDescription>
                    </DialogHeader>

                    {viewingBudget && (
                        <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Department</p>
                                        <p className="font-semibold text-slate-900 dark:text-white">
                                            {viewingBudget.department_name}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Code</p>
                                        <p className="font-semibold text-slate-900 dark:text-white">
                                            {viewingBudget.department_code}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Fiscal Year</p>
                                        <p className="font-semibold text-slate-900 dark:text-white">
                                            {selectedYear}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
                                        <p>{getStatusBadge(viewingBudget.status)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 text-center border border-blue-200 dark:border-blue-800">
                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Annual Budget</p>
                                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                        {formatCurrency(viewingBudget.annual_amount)}
                                    </p>
                                </div>
                                <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-xl p-3 text-center border border-yellow-200 dark:border-yellow-800">
                                    <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Total Used</p>
                                    <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                                        {formatCurrency(viewingBudget.used_amount || 0)}
                                    </p>
                                    {(viewingBudget.total_used_this_year || 0) > 0 && (
                                        <p className="text-xs text-yellow-500 dark:text-yellow-400">
                                            Total: {formatCurrency(viewingBudget.total_used_this_year)}
                                        </p>
                                    )}
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center border border-emerald-200 dark:border-emerald-800">
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Annual Remaining</p>
                                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(viewingBudget.remaining_amount || 0)}
                                    </p>
                                    {viewingBudget.remaining_after_weekly !== undefined && (
                                        <p className="text-xs text-emerald-500 dark:text-emerald-400">
                                            After weekly: {formatCurrency(viewingBudget.remaining_after_weekly)}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-3 text-center border border-purple-200 dark:border-purple-800">
                                    <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Weekly Ceiling</p>
                                    <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                        {formatCurrency(viewingBudget.weekly_ceiling || 0)}
                                    </p>
                                    {viewingBudget.suggested_ceiling > 0 && (
                                        <p className="text-xs text-purple-500 dark:text-purple-400">
                                            Suggested: {formatCurrency(viewingBudget.suggested_ceiling)}
                                        </p>
                                    )}
                                </div>
                                <div className="bg-orange-50 dark:bg-orange-950/30 rounded-xl p-3 text-center border border-orange-200 dark:border-orange-800">
                                    <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Weekly Used</p>
                                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                                        {formatCurrency(viewingBudget.weekly_used || 0)}
                                    </p>
                                    {viewingBudget.weekly_ceiling > 0 && (
                                        <p className="text-xs text-orange-500 dark:text-orange-400">
                                            {Math.round(((viewingBudget.weekly_used || 0) / viewingBudget.weekly_ceiling) * 100)}% used
                                        </p>
                                    )}
                                </div>
                                <div className={cn(
                                    "rounded-xl p-3 text-center border",
                                    (viewingBudget.weekly_remaining || 0) <= 0
                                        ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                                        : (viewingBudget.weekly_remaining || 0) < (viewingBudget.weekly_ceiling || 0) * 0.2
                                            ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800"
                                            : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                                )}>
                                    <p className={cn(
                                        "text-xs font-medium",
                                        (viewingBudget.weekly_remaining || 0) <= 0
                                            ? "text-red-600 dark:text-red-400"
                                            : (viewingBudget.weekly_remaining || 0) < (viewingBudget.weekly_ceiling || 0) * 0.2
                                                ? "text-yellow-600 dark:text-yellow-400"
                                                : "text-emerald-600 dark:text-emerald-400"
                                    )}>
                                        Weekly Remaining
                                    </p>
                                    <p className={cn(
                                        "text-lg font-bold",
                                        (viewingBudget.weekly_remaining || 0) <= 0
                                            ? "text-red-600 dark:text-red-400"
                                            : (viewingBudget.weekly_remaining || 0) < (viewingBudget.weekly_ceiling || 0) * 0.2
                                                ? "text-yellow-600 dark:text-yellow-400"
                                                : "text-emerald-600 dark:text-emerald-400"
                                    )}>
                                        {formatCurrency(viewingBudget.weekly_remaining || 0)}
                                    </p>
                                    {(viewingBudget.weekly_remaining || 0) > 0 && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {formatCurrency((viewingBudget.weekly_ceiling || 0) - (viewingBudget.weekly_remaining || 0))} used
                                        </p>
                                    )}
                                    {(viewingBudget.weekly_remaining || 0) <= 0 && (
                                        <p className="text-xs text-red-500 dark:text-red-400">⚠️ Exceeded!</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">Annual Utilization</span>
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            {viewingBudget.utilization_percentage || 0}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-1">
                                        <div
                                            className={cn(
                                                "h-2 rounded-full transition-all",
                                                (viewingBudget.utilization_percentage || 0) > 80
                                                    ? "bg-red-500"
                                                    : (viewingBudget.utilization_percentage || 0) > 50
                                                        ? "bg-yellow-500"
                                                        : "bg-emerald-500"
                                            )}
                                            style={{ width: `${Math.min(viewingBudget.utilization_percentage || 0, 100)}%` }}
                                        />
                                    </div>
                                </div>

                                {viewingBudget.weekly_ceiling > 0 && (
                                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-500 dark:text-slate-400">Weekly Utilization</span>
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                {viewingBudget.weekly_ceiling > 0
                                                    ? `${Math.round(((viewingBudget.weekly_used || 0) / viewingBudget.weekly_ceiling) * 100)}%`
                                                    : "0%"}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-1">
                                            <div
                                                className={cn(
                                                    "h-2 rounded-full transition-all",
                                                    (viewingBudget.weekly_used || 0) / viewingBudget.weekly_ceiling > 0.8
                                                        ? "bg-red-500"
                                                        : (viewingBudget.weekly_used || 0) / viewingBudget.weekly_ceiling > 0.5
                                                            ? "bg-yellow-500"
                                                            : "bg-emerald-500"
                                                )}
                                                style={{
                                                    width: `${Math.min(((viewingBudget.weekly_used || 0) / viewingBudget.weekly_ceiling) * 100, 100)}%`,
                                                }}
                                            />
                                        </div>
                                        {(viewingBudget.weekly_remaining || 0) > 0 && (
                                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                                                ✅ {formatCurrency(viewingBudget.weekly_remaining)} remaining this week
                                            </p>
                                        )}
                                        {(viewingBudget.weekly_remaining || 0) <= 0 && (
                                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                                ⚠️ Weekly budget exceeded!
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowViewDialog(false);
                                setViewingBudget(null);
                            }}
                            className="dark:border-slate-700 dark:text-slate-300"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default BudgetAllocation;
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
                    className: cn(children.props.className, hasError && "border-red-500 ring-red-500 focus:ring-red-500 bg-red-50/50 dark:bg-red-950/10")
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
    const [addBudgetData, setAddBudgetData] = useState({ department_id: "", additional_amount: "", reason: "" });
    const [formData, setFormData] = useState({ annual_amount: "" });
    
    const [editErrors, setEditErrors] = useState({});
    const [editTouched, setEditTouched] = useState({});
    const [addErrors, setAddErrors] = useState({});
    const [addTouched, setAddTouched] = useState({});

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
            const response = await api.post("/mayors-office/annual-budgets/add", { fiscal_year: selectedYear, ...data });
            return response.data;
        },
        onSuccess: () => {
            toast.success("Additional budget added successfully");
            setShowAddBudgetDialog(false);
            queryClient.invalidateQueries(["annual-budgets"]);
            queryClient.invalidateQueries(["budget-history"]);
        },
        onError: (error) => toast.error(error.response?.data?.message || "Failed to add budget"),
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

    const validateEditBudget = () => {
        const newErrors = {};
        if (!formData.annual_amount || parseFloat(formData.annual_amount) <= 0) {
            newErrors.annual_amount = "Annual budget must be greater than 0";
        }
        setEditErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return false;
        return true;
    };

    const validateAddBudget = () => {
        const newErrors = {};
        if (!addBudgetData.department_id) newErrors.department_id = "Department is required";
        if (!addBudgetData.additional_amount || parseFloat(addBudgetData.additional_amount) <= 0) newErrors.additional_amount = "Amount must be > 0";
        if (!addBudgetData.reason || addBudgetData.reason.trim().length < 3) newErrors.reason = "Reason must be at least 3 characters";
        
        setAddErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            toast.error("Please fix validation errors");
            return false;
        }
        return true;
    };

    const handleEdit = (budget) => {
        setEditingBudget(budget);
        setFormData({ annual_amount: budget.annual_amount?.toString() || "" });
        setShowEditDialog(true);
    };

    const handleSetBudget = () => {
        if (!validateEditBudget()) return;
        setBudgetMutation.mutate({ data: { department_id: editingBudget.department_id, annual_amount: parseFloat(formData.annual_amount) } });
    };

    const handleAddBudget = () => {
        if (!validateAddBudget()) return;
        addBudgetMutation.mutate({
            department_id: parseInt(addBudgetData.department_id),
            additional_amount: parseFloat(addBudgetData.additional_amount),
            reason: addBudgetData.reason,
        });
    };

    if (budgetError) return <div className="p-8 text-center text-red-500">Error loading data.</div>;
    if (yearsLoading || !selectedYear || isLoading || !budgetData) return <div className="p-6"><SkeletonPage /><SkeletonTable rows={5} cols={8} /></div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="space-y-6 p-4 md:p-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/mo/dashboard')} className="rounded-xl h-10 w-10">
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
                                            className={selectedYear === yVal ? "bg-blue-600 text-white" : ""}
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
                    {/* ✅ REMOVED the "Add Budget" button here */}
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
                                        {/* ✅ FIXED DARK MODE COLORS for amounts */}
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
                                                        setAddBudgetData({ department_id: budget.department_id.toString(), additional_amount: "", reason: "" });
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
                {/* BUDGET HISTORY (BELOW) */}
                {/* ============================================ */}
                <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-sm">
                    <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
                        <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                            <History className="h-5 w-5 text-purple-500" />
                            Budget History
                        </CardTitle>
                        <CardDescription>Record of all budget allocations and additions for {selectedYear}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {historyLoading ? (
                            <div className="p-12 text-center text-slate-500"><Activity className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading history...</div>
                        ) : !historyData || historyData.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                <History className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                                No budget history found for {selectedYear}.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                                            <TableHead className="text-slate-600 dark:text-slate-300">Date</TableHead>
                                            <TableHead className="text-slate-600 dark:text-slate-300">Department</TableHead>
                                            <TableHead className="text-slate-600 dark:text-slate-300">Action</TableHead>
                                            <TableHead className="text-right text-slate-600 dark:text-slate-300">Previous</TableHead>
                                            <TableHead className="text-right text-emerald-600 dark:text-emerald-400">Added</TableHead>
                                            <TableHead className="text-right text-slate-600 dark:text-slate-300">New Total</TableHead>
                                            <TableHead className="text-slate-600 dark:text-slate-300">Reason</TableHead>
                                            <TableHead className="text-slate-600 dark:text-slate-300">By</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historyData.map((log, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                                                    {format(new Date(log.created_at), 'MMM dd, yyyy h:mm a')}
                                                </TableCell>
                                                <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                                                    {log.department_name}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize text-xs dark:text-slate-300 dark:border-slate-600">
                                                        {log.action.replace(/_/g, ' ')}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right text-slate-500 dark:text-slate-400">
                                                    {formatCurrency(log.previous_amount)}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                    +{formatCurrency(log.added_amount)}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400">
                                                    {formatCurrency(log.new_amount)}
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate text-slate-600 dark:text-slate-300" title={log.reason}>
                                                    {log.reason || "—"}
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                                                    {log.user_name || "System"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* EDIT DIALOG */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="dark:bg-slate-800 dark:border-slate-700 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="dark:text-white">Set Annual Budget</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <FormField label="Annual Budget (₱)" required error={editErrors.annual_amount} touched={editTouched.annual_amount}>
                            <Input type="number" value={formData.annual_amount} onChange={(e) => setFormData({ annual_amount: e.target.value })} />
                        </FormField>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
                        <Button onClick={handleSetBudget} disabled={setBudgetMutation.isPending}>Save Budget</Button>
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
                        <FormField label="Reason" required error={addErrors.reason} helper="e.g., Mayor's Memo No. 2026-001">
                            <Input value={addBudgetData.reason} onChange={(e) => setAddBudgetData({ ...addBudgetData, reason: e.target.value })} placeholder="Reason for adding budget" />
                        </FormField>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddBudgetDialog(false)}>Cancel</Button>
                        <Button onClick={handleAddBudget} disabled={addBudgetMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">Add Budget</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default BudgetAllocation;
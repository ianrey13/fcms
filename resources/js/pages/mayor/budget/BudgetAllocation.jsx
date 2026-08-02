// src/pages/mayor/budget/BudgetAllocation.jsx
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../../services/api";

const BudgetAllocation = () => {
    const queryClient = useQueryClient();
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

    // Fetch active fiscal years
    const { data: yearsData, isLoading: yearsLoading } = useQuery({
        queryKey: ["fiscal-years-active"],
        queryFn: async () => {
            try {
                const response = await api.get(
                    "/mayors-office/fiscal-years?is_active=1",
                );
                return response.data.data || [];
            } catch (error) {
                console.error("Error fetching fiscal years:", error);
                return [];
            }
        },
    });

    // Set selected year to 2026 if available
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

    // Fetch budget data for selected year
    const {
        data: budgetData,
        isLoading,
        refetch,
        isFetching,
        error: budgetError,
    } = useQuery({
        queryKey: ["annual-budgets", selectedYear],
        queryFn: async () => {
            try {
                const response = await api.get(
                    `/mayors-office/annual-budgets/year/${selectedYear}`,
                );
                return response.data;
            } catch (error) {
                console.error("Error fetching budgets:", error);
                throw error;
            }
        },
        enabled: !!selectedYear,
        retry: 1,
    });

    // Set budget mutation
    const setBudgetMutation = useMutation({
        mutationFn: async ({ data }) => {
            const response = await api.post("/mayors-office/annual-budgets", {
                fiscal_year: selectedYear,
                ...data,
            });
            return response.data;
        },
        onSuccess: () => {
            toast.success("Budget set successfully");
            setShowEditDialog(false);
            setEditingBudget(null);
            queryClient.invalidateQueries(["annual-budgets"]);
        },
        onError: (error) => {
            toast.error(
                error.response?.data?.message || "Failed to set budget",
            );
        },
    });

    // ✅ Add Budget Mutation
    const addBudgetMutation = useMutation({
        mutationFn: async (data) => {
            const response = await api.post(
                "/mayors-office/annual-budgets/add",
                {
                    fiscal_year: selectedYear,
                    ...data,
                },
            );
            return response.data;
        },
        onSuccess: () => {
            toast.success("Additional budget added successfully");
            setShowAddBudgetDialog(false);
            setAddBudgetData({
                department_id: "",
                additional_amount: "",
                reason: "",
            });
            queryClient.invalidateQueries(["annual-budgets"]);
        },
        onError: (error) => {
            toast.error(
                error.response?.data?.message || "Failed to add budget",
            );
        },
    });

    // Bulk update mutation
    const bulkUpdateMutation = useMutation({
        mutationFn: async () => {
            const budgets = Object.entries(bulkData).map(
                ([departmentId, data]) => ({
                    department_id: parseInt(departmentId),
                    annual_amount: parseFloat(data.annual_amount) || 0,
                    weekly_ceiling: parseFloat(data.weekly_ceiling) || 0,
                }),
            );

            const response = await api.post(
                "/mayors-office/annual-budgets/bulk",
                {
                    fiscal_year: selectedYear,
                    budgets,
                },
            );
            return response.data;
        },
        onSuccess: () => {
            toast.success("All budgets saved successfully");
            setIsBulkMode(false);
            setBulkData({});
            queryClient.invalidateQueries(["annual-budgets"]);
        },
        onError: (error) => {
            toast.error(
                error.response?.data?.message || "Failed to save budgets",
            );
        },
    });

    const budgets = budgetData?.data || [];
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

    const handleEdit = (budget) => {
        setEditingBudget(budget);
        setFormData({
            annual_amount: budget.annual_amount?.toString() || "",
            weekly_ceiling: budget.weekly_ceiling?.toString() || "",
        });
        setShowEditDialog(true);
    };

    const handleView = (budget) => {
        setViewingBudget(budget);
        setShowViewDialog(true);
    };

    const handleSetBudget = () => {
        if (!editingBudget) return;

        const data = {
            department_id: editingBudget.department_id,
            annual_amount: parseFloat(formData.annual_amount) || 0,
            weekly_ceiling: parseFloat(formData.weekly_ceiling) || 0,
        };
        setBudgetMutation.mutate({ data });
    };

    const handleAddBudget = () => {
        if (!addBudgetData.department_id) {
            toast.error("Please select a department");
            return;
        }
        if (
            !addBudgetData.additional_amount ||
            parseFloat(addBudgetData.additional_amount) <= 0
        ) {
            toast.error("Please enter a valid amount");
            return;
        }

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
        bulkUpdateMutation.mutate();
    };

    const handleBulkCancel = () => {
        setIsBulkMode(false);
        setBulkData({});
    };

    const getStatusBadge = (status) => {
        if (status === "not_set" || !status) {
            return <Badge className="bg-slate-400">Not Set</Badge>;
        }
        return <Badge className="bg-green-500">Active</Badge>;
    };

    // Auto-calculate weekly ceiling
    useEffect(() => {
        if (formData.annual_amount && !formData.weekly_ceiling) {
            const weekly = parseFloat(formData.annual_amount) / 52;
            setFormData((prev) => ({
                ...prev,
                weekly_ceiling: weekly.toFixed(2),
            }));
        }
    }, [formData.annual_amount]);

    // Initialize bulk data
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

    if (budgetError) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                <p className="text-red-600 mb-2">Failed to load budget data</p>
                <p className="text-slate-500 text-sm mb-4">
                    {budgetError.response?.data?.message || budgetError.message}
                </p>
                <Button onClick={() => refetch()}>Retry</Button>
            </div>
        );
    }

    if (yearsLoading || isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ========== HEADER ========== */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Annual Budget Allocation
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Set annual fuel budget and weekly ceiling per department
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant="outline"
                        onClick={() => refetch()}
                        disabled={isLoading || isFetching}
                    >
                        <RefreshCw
                            className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
                        />
                        Refresh
                    </Button>
                    {budgets.length > 0 && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setShowAddBudgetDialog(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Budget
                            </Button>
                            <Button
                                variant={isBulkMode ? "default" : "outline"}
                                onClick={() => setIsBulkMode(!isBulkMode)}
                                className={
                                    isBulkMode
                                        ? "bg-blue-600 hover:bg-blue-700"
                                        : ""
                                }
                            >
                                {isBulkMode ? "Exit Bulk Edit" : "Bulk Edit"}
                            </Button>
                        </>
                    )}
                    {isBulkMode && (
                        <>
                            <Button
                                onClick={handleBulkSave}
                                disabled={bulkUpdateMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
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
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400"
                            >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* ========== YEAR SELECTOR ========== */}
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
                                    const yearValue =
                                        typeof year === "object"
                                            ? year.year
                                            : year;
                                    const isActive =
                                        typeof year === "object"
                                            ? year.is_active
                                            : true;
                                    const key =
                                        typeof year === "object"
                                            ? year.fiscal_year_id || yearValue
                                            : yearValue;

                                    return (
                                        <Button
                                            key={key}
                                            variant={
                                                selectedYear === yearValue
                                                    ? "default"
                                                    : "outline"
                                            }
                                            size="sm"
                                            onClick={() =>
                                                setSelectedYear(yearValue)
                                            }
                                            className={
                                                selectedYear === yearValue
                                                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                                                    : "dark:border-slate-700 dark:text-slate-300"
                                            }
                                        >
                                            {yearValue}
                                            {isActive && (
                                                <span className="ml-1 text-xs text-green-400">
                                                    ●
                                                </span>
                                            )}
                                        </Button>
                                    );
                                })
                            ) : (
                                <p className="text-slate-500 dark:text-slate-400 text-sm">
                                    No fiscal years available. Please ask GSO to
                                    add years.
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ========== SUMMARY CARDS ========== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Total Annual Budget
                                </p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {formatCurrency(summary.total_allocated)}
                                </p>
                            </div>
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Used
                                </p>
                                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                    {formatCurrency(summary.total_used)}
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                    Total spent so far
                                </p>
                            </div>
                            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                                <TrendingDown className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Remaining Annual
                                </p>
                                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {formatCurrency(summary.total_remaining)}
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                    Available for future allocation
                                </p>
                            </div>
                            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Departments
                                </p>
                                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                    {summary.departments_with_budget || 0} /{" "}
                                    {summary.total_departments || 0}
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                    {summary.departments_without_budget || 0}{" "}
                                    without budget
                                </p>
                            </div>
                            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                                <Building2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ========== BUDGET TABLE ========== */}
            <Card className="dark:bg-slate-800/80 dark:border-slate-700 overflow-hidden">
                <CardHeader className="border-b dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <DollarSign className="h-5 w-5 text-green-500" />
                            Budget Details for {selectedYear}
                            <Badge variant="secondary" className="ml-2">
                                {budgets.length} departments
                            </Badge>
                        </CardTitle>
                        {fiscalYear?.is_active === false && (
                            <Badge className="bg-yellow-500">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Inactive
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {budgets.length === 0 ? (
                        <div className="text-center py-12">
                            <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                            <p className="text-slate-500 dark:text-slate-400">
                                No departments found for {selectedYear}
                            </p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                Please ask GSO to add departments or select a
                                different year
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                                        <TableHead className="font-semibold">
                                            Department
                                        </TableHead>
                                        <TableHead className="font-semibold">
                                            Code
                                        </TableHead>
                                        <TableHead className="text-right font-semibold">
                                            Annual Budget
                                        </TableHead>
                                        <TableHead className="text-right font-semibold">
                                            Weekly Ceiling
                                        </TableHead>
                                        <TableHead className="text-right font-semibold">
                                            Used
                                        </TableHead>
                                        <TableHead className="text-right font-semibold">
                                            Remaining
                                        </TableHead>
                                        <TableHead className="text-right font-semibold">
                                            Weekly Used
                                        </TableHead>{" "}
                                        {/* ✅ NEW */}
                                            <TableHead className="text-right font-semibold">Weekly Remaining</TableHead>  {/* ✅ NEW */}

                                        <TableHead className="text-center font-semibold">
                                            Status
                                        </TableHead>
                                        <TableHead className="text-right font-semibold">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>

                               <TableBody>
  {budgets.map((budget) => {
    const isEditing = isBulkMode && bulkData[budget.department_id];
    const isNew = !budget.has_budget;
    
    // ✅ Calculate weekly used percentage
    const weeklyUsedPercent = budget.weekly_ceiling > 0 
      ? Math.round((budget.weekly_used || 0) / budget.weekly_ceiling * 100) 
      : 0;
    
    return (
      <TableRow
        key={budget.department_id}
        className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
          isNew ? 'bg-yellow-50/50 dark:bg-yellow-950/20' : ''
        }`}
      >
        <TableCell className="font-medium text-slate-900 dark:text-white">
          {budget.department_name}
          {isNew && (
            <Badge variant="outline" className="ml-2 text-yellow-600 border-yellow-300 text-xs">
              New
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <Badge variant="outline">{budget.department_code}</Badge>
        </TableCell>
        <TableCell className="text-right">
          {isBulkMode ? (
            <Input
              type="number"
              step="0.01"
              min="0"
              value={isEditing ? bulkData[budget.department_id]?.annual_amount : ''}
              onChange={(e) => handleBulkChange(budget.department_id, 'annual_amount', e.target.value)}
              className="w-32 ml-auto text-right dark:bg-slate-900 dark:border-slate-700"
              placeholder="0.00"
            />
          ) : (
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {formatCurrency(budget.annual_amount)}
            </span>
          )}
        </TableCell>
        <TableCell className="text-right">
          {isBulkMode ? (
            <Input
              type="number"
              step="0.01"
              min="0"
              value={isEditing ? bulkData[budget.department_id]?.weekly_ceiling : ''}
              onChange={(e) => handleBulkChange(budget.department_id, 'weekly_ceiling', e.target.value)}
              className="w-32 ml-auto text-right dark:bg-slate-900 dark:border-slate-700"
              placeholder="Auto"
            />
          ) : (
            <div>
              <span className={`font-medium ${
                (budget.weekly_used || 0) > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'
              }`}>
                {formatCurrency(budget.weekly_ceiling || 0)}
              </span>
              {budget.suggested_ceiling > 0 && (
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  Suggested: {formatCurrency(budget.suggested_ceiling)}
                </div>
              )}
            </div>
          )}
        </TableCell>
        <TableCell className="text-right">
          <span className="font-medium text-yellow-600 dark:text-yellow-400">
            {formatCurrency(budget.used_amount || 0)}
          </span>
          {(budget.total_used_this_year || 0) > 0 && (
            <div className="text-xs text-slate-400 dark:text-slate-500">
              Total: {formatCurrency(budget.total_used_this_year)}
            </div>
          )}
        </TableCell>
        <TableCell className="text-right">
          <span className="font-medium text-green-600 dark:text-green-400">
            {formatCurrency(budget.remaining_amount || 0)}
          </span>
          {budget.remaining_after_weekly !== undefined && (
            <div className="text-xs text-slate-400 dark:text-slate-500">
              After weekly: {formatCurrency(budget.remaining_after_weekly)}
            </div>
          )}
        </TableCell>
        {/* ✅ Weekly Used Column */}
        <TableCell className="text-right">
          <span className={`font-medium ${
            (budget.weekly_used || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'
          }`}>
            {formatCurrency(budget.weekly_used || 0)}
          </span>
          {(budget.weekly_used || 0) > 0 && budget.weekly_ceiling > 0 && (
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {weeklyUsedPercent}% used
            </div>
          )}
        </TableCell>
        {/* ✅ NEW: Weekly Remaining Column */}
        <TableCell className="text-right">
          <span className={`font-medium ${
            (budget.weekly_remaining || 0) <= 0 ? 'text-red-600 dark:text-red-400' : 
            (budget.weekly_remaining || 0) < (budget.weekly_ceiling || 0) * 0.2 ? 'text-yellow-600 dark:text-yellow-400' : 
            'text-green-600 dark:text-green-400'
          }`}>
            {formatCurrency(budget.weekly_remaining || 0)}
          </span>
          {(budget.weekly_remaining || 0) > 0 && budget.weekly_ceiling > 0 && (
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {formatCurrency(budget.weekly_ceiling - budget.weekly_remaining)} used
            </div>
          )}
        </TableCell>
        <TableCell className="text-center">
          {getStatusBadge(budget.status)}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleView(budget)}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-8 w-8 p-0"
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {!isBulkMode && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddBudgetData({
                      department_id: budget.department_id.toString(),
                      additional_amount: '',
                      reason: '',
                    });
                    setShowAddBudgetDialog(true);
                  }}
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-950/30 h-8 w-8 p-0"
                  title="Add Budget"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(budget)}
                  className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/30 h-8 w-8 p-0"
                  title="Edit Budget"
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
                </CardContent>
            </Card>

            {/* ========== EDIT DIALOG ========== */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="dark:bg-slate-800 dark:border-slate-700 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <Edit className="h-5 w-5 text-green-600" />
                            Set Annual Budget
                        </DialogTitle>
                        <DialogDescription className="dark:text-slate-400">
                            Set annual budget and weekly ceiling for{" "}
                            {editingBudget?.department_name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">
                                        Department
                                    </p>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {editingBudget?.department_name}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">
                                        Code
                                    </p>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {editingBudget?.department_code}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">
                                        Fiscal Year
                                    </p>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {selectedYear}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">
                                        Current Used
                                    </p>
                                    <p className="font-semibold text-yellow-600">
                                        {formatCurrency(
                                            editingBudget?.used_amount,
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Annual Budget (₱){" "}
                                <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.annual_amount}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setFormData({
                                        ...formData,
                                        annual_amount: value,
                                        weekly_ceiling: value
                                            ? (parseFloat(value) / 52).toFixed(
                                                  2,
                                              )
                                            : "",
                                    });
                                }}
                                className="mt-1.5 dark:bg-slate-900 dark:border-slate-700"
                                placeholder="Enter annual budget"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Weekly Fueling Ceiling (₱)
                                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                                    (Suggested:{" "}
                                    {formData.annual_amount
                                        ? formatCurrency(
                                              parseFloat(
                                                  formData.annual_amount,
                                              ) / 52,
                                          )
                                        : "₱0.00"}
                                    )
                                </span>
                            </label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.weekly_ceiling}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        weekly_ceiling: e.target.value,
                                    })
                                }
                                className="mt-1.5 dark:bg-slate-900 dark:border-slate-700"
                                placeholder="Auto-calculated"
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                If left empty, it will be auto-calculated as
                                (Annual ÷ 52)
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowEditDialog(false);
                                setEditingBudget(null);
                            }}
                            className="dark:border-slate-700 dark:text-slate-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSetBudget}
                            disabled={setBudgetMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {setBudgetMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            Save Budget
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ========== ADD BUDGET DIALOG ========== */}
            <Dialog
                open={showAddBudgetDialog}
                onOpenChange={setShowAddBudgetDialog}
            >
                <DialogContent className="dark:bg-slate-800 dark:border-slate-700 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <Plus className="h-5 w-5 text-emerald-600" />
                            Add Additional Budget
                        </DialogTitle>
                        <DialogDescription className="dark:text-slate-400">
                            Add additional annual budget to a department
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                            <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-blue-700 dark:text-blue-300">
                                    <p>Adding budget will:</p>
                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                        <li>
                                            Increase the annual budget of the
                                            department
                                        </li>
                                        <li>
                                            Automatically update the weekly
                                            ceiling
                                        </li>
                                        <li>
                                            Be recorded in the budget history
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Department{" "}
                                <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={addBudgetData.department_id}
                                onChange={(e) =>
                                    setAddBudgetData({
                                        ...addBudgetData,
                                        department_id: e.target.value,
                                    })
                                }
                                className="w-full mt-1.5 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white"
                            >
                                <option value="">Select Department</option>
                                {budgets.map((budget) => (
                                    <option
                                        key={budget.department_id}
                                        value={budget.department_id}
                                    >
                                        {budget.department_name} (
                                        {budget.department_code})
                                        {budget.has_budget &&
                                            ` - Current: ${formatCurrency(budget.annual_amount)}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Additional Amount (₱){" "}
                                <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={addBudgetData.additional_amount}
                                onChange={(e) =>
                                    setAddBudgetData({
                                        ...addBudgetData,
                                        additional_amount: e.target.value,
                                    })
                                }
                                className="mt-1.5 dark:bg-slate-900 dark:border-slate-700"
                                placeholder="Enter amount to add"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Reason <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="text"
                                value={addBudgetData.reason}
                                onChange={(e) =>
                                    setAddBudgetData({
                                        ...addBudgetData,
                                        reason: e.target.value,
                                    })
                                }
                                className="mt-1.5 dark:bg-slate-900 dark:border-slate-700"
                                placeholder="e.g., Mayor's Memo No. 2026-001, Additional fuel allocation"
                            />
                        </div>

                        {addBudgetData.department_id &&
                            addBudgetData.additional_amount && (
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                        {
                                            budgets.find(
                                                (b) =>
                                                    b.department_id ===
                                                    parseInt(
                                                        addBudgetData.department_id,
                                                    ),
                                            )?.department_name
                                        }{" "}
                                        will receive:
                                    </p>
                                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(
                                            parseFloat(
                                                addBudgetData.additional_amount,
                                            ) || 0,
                                        )}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        New weekly ceiling:{" "}
                                        {formatCurrency(
                                            (parseFloat(
                                                addBudgetData.additional_amount,
                                            ) || 0) / 52,
                                        )}
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
                            }}
                            className="dark:border-slate-700 dark:text-slate-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddBudget}
                            disabled={addBudgetMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700"
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

            {/* ========== VIEW DIALOG - IMPROVED ========== */}
<Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
  <DialogContent className="dark:bg-slate-800 dark:border-slate-700 max-w-lg">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
        <Eye className="h-5 w-5 text-blue-600" />
        Budget Details
      </DialogTitle>
      <DialogDescription className="dark:text-slate-400">
        {viewingBudget?.department_name} - {selectedYear}
      </DialogDescription>
    </DialogHeader>

    {viewingBudget && (
      <div className="space-y-4">
        {/* Department Info */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
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
              <p className="font-semibold text-slate-900 dark:text-white">{selectedYear}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
              <p>{getStatusBadge(viewingBudget.status)}</p>
            </div>
          </div>
        </div>

        {/* Annual Budget Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Annual Budget</p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(viewingBudget.annual_amount)}
            </p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-3 text-center border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Total Used</p>
            <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
              {formatCurrency(viewingBudget.used_amount || 0)}
            </p>
            {(viewingBudget.total_used_this_year || 0) > 0 && (
              <p className="text-xs text-yellow-500">
                Total: {formatCurrency(viewingBudget.total_used_this_year)}
              </p>
            )}
          </div>
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">Annual Remaining</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatCurrency(viewingBudget.remaining_amount || 0)}
            </p>
            {viewingBudget.remaining_after_weekly !== undefined && (
              <p className="text-xs text-green-500">
                After weekly: {formatCurrency(viewingBudget.remaining_after_weekly)}
              </p>
            )}
          </div>
        </div>

        {/* Weekly Budget Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 text-center border border-purple-200 dark:border-purple-800">
            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Weekly Ceiling</p>
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(viewingBudget.weekly_ceiling || 0)}
            </p>
            {viewingBudget.suggested_ceiling > 0 && (
              <p className="text-xs text-purple-500">
                Suggested: {formatCurrency(viewingBudget.suggested_ceiling)}
              </p>
            )}
          </div>
          <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 text-center border border-orange-200 dark:border-orange-800">
            <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Weekly Used</p>
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(viewingBudget.weekly_used || 0)}
            </p>
            {viewingBudget.weekly_ceiling > 0 && (
              <p className="text-xs text-orange-500">
                {Math.round(((viewingBudget.weekly_used || 0) / viewingBudget.weekly_ceiling) * 100)}% used
              </p>
            )}
          </div>
          <div className={`rounded-lg p-3 text-center border ${
            (viewingBudget.weekly_remaining || 0) <= 0 
              ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
              : (viewingBudget.weekly_remaining || 0) < (viewingBudget.weekly_ceiling || 0) * 0.2
              ? 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800'
              : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
          }`}>
            <p className={`text-xs font-medium ${
              (viewingBudget.weekly_remaining || 0) <= 0 
                ? 'text-red-600 dark:text-red-400'
                : (viewingBudget.weekly_remaining || 0) < (viewingBudget.weekly_ceiling || 0) * 0.2
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-green-600 dark:text-green-400'
            }`}>
              Weekly Remaining
            </p>
            <p className={`text-lg font-bold ${
              (viewingBudget.weekly_remaining || 0) <= 0 
                ? 'text-red-600 dark:text-red-400'
                : (viewingBudget.weekly_remaining || 0) < (viewingBudget.weekly_ceiling || 0) * 0.2
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-green-600 dark:text-green-400'
            }`}>
              {formatCurrency(viewingBudget.weekly_remaining || 0)}
            </p>
            {(viewingBudget.weekly_remaining || 0) > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatCurrency((viewingBudget.weekly_ceiling || 0) - (viewingBudget.weekly_remaining || 0))} used
              </p>
            )}
            {(viewingBudget.weekly_remaining || 0) <= 0 && (
              <p className="text-xs text-red-500">
                ⚠️ Exceeded!
              </p>
            )}
          </div>
        </div>

        {/* Utilization Bars */}
        <div className="space-y-3">
          {/* Annual Utilization */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">Annual Utilization</span>
              <span className="text-xs font-semibold">
                {viewingBudget.utilization_percentage || 0}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-1">
              <div
                className={`h-2 rounded-full transition-all ${
                  (viewingBudget.utilization_percentage || 0) > 80
                    ? 'bg-red-500'
                    : (viewingBudget.utilization_percentage || 0) > 50
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(viewingBudget.utilization_percentage || 0, 100)}%` }}
              />
            </div>
          </div>

          {/* Weekly Utilization */}
          {viewingBudget.weekly_ceiling > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-slate-400">Weekly Utilization</span>
                <span className="text-xs font-semibold">
                  {viewingBudget.weekly_ceiling > 0 
                    ? `${Math.round(((viewingBudget.weekly_used || 0) / viewingBudget.weekly_ceiling) * 100)}%`
                    : '0%'
                  }
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-1">
                <div
                  className={`h-2 rounded-full transition-all ${
                    ((viewingBudget.weekly_used || 0) / viewingBudget.weekly_ceiling) > 0.8
                      ? 'bg-red-500'
                      : ((viewingBudget.weekly_used || 0) / viewingBudget.weekly_ceiling) > 0.5
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ 
                    width: `${Math.min(((viewingBudget.weekly_used || 0) / viewingBudget.weekly_ceiling) * 100, 100)}%` 
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Weekly Progress Bar (Visual) */}
        {viewingBudget.weekly_ceiling > 0 && (
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">Weekly Progress</span>
              <span className="text-xs font-semibold">
                {formatCurrency(viewingBudget.weekly_used || 0)} / {formatCurrency(viewingBudget.weekly_ceiling)}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 relative overflow-hidden">
              <div
                className={`h-4 rounded-full transition-all flex items-center justify-end pr-1 ${
                  ((viewingBudget.weekly_used || 0) / viewingBudget.weekly_ceiling) > 0.8
                    ? 'bg-red-500'
                    : ((viewingBudget.weekly_used || 0) / viewingBudget.weekly_ceiling) > 0.5
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ 
                  width: `${Math.min(((viewingBudget.weekly_used || 0) / viewingBudget.weekly_ceiling) * 100, 100)}%` 
                }}
              >
                <span className="text-[10px] text-white font-bold">
                  {Math.round(Math.min(((viewingBudget.weekly_used || 0) / viewingBudget.weekly_ceiling) * 100, 100))}%
                </span>
              </div>
            </div>
            {(viewingBudget.weekly_remaining || 0) > 0 && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
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

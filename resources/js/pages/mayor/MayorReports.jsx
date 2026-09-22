// src/pages/mayor/MayorReports.jsx
// ============================================
// DISBURSING OFFICER (MAYOR'S OFFICE) REPORTS
// 4 Reports:
// 1. Fuel Receipt Report
// 2. Budget Utilization Report
// 3. Reconciliation Report
// 4. Billing Statement of Fuel
//
// ✅ Each card has INDEPENDENT Department + Month filters
// ✅ Month = single dropdown with "All Months" (no range toggle)
// ✅ Year fixed to current year internally
// ============================================

import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import { reportsAPI, mayorsOfficeAPI } from "../../services/api";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveAs } from "file-saver";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Loader2,
    FileText,
    CalendarRange,
    TrendingUp,
    TrendingDown,
    CheckCircle,
    Fuel,
    Printer,
    FileSpreadsheet,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Receipt,
    ArrowLeft,
    Wallet,
    FileCheck,
    PhilippinePeso,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { format, endOfMonth } from "date-fns";
import { useNavigate } from "react-router-dom";

// ============================================
// SAFE ARRAY EXTRACTION HELPER
// ============================================

const extractArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.data)) return response.data;
    if (response.data && Array.isArray(response.data.data))
        return response.data.data;

    const keys = [
        "receipts",
        "items",
        "results",
        "records",
        "rows",
        "list",
        "periods",
        "reconciliations",
        "vehicles",
    ];
    for (const key of keys) {
        if (Array.isArray(response[key])) return response[key];
        if (response.data && Array.isArray(response.data[key]))
            return response.data[key];
    }

    if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
        return response.data.data.data;
    }

    console.warn("extractArray: unexpected response shape:", response);
    return [];
};

// ============================================
// CACHE CONSTANTS
// ============================================

const CACHE_5MIN = 5 * 60 * 1000;
const CACHE_10MIN = 10 * 60 * 1000;

// ============================================
// CONSTANTS & HELPERS
// ============================================

const RECEIPT_STATUS_OPTIONS = [
    { value: "all", label: "All Status" },
    { value: "verified", label: "Verified" },
    { value: "pending", label: "Pending" },
    { value: "rejected", label: "Rejected" },
];

const RECONCILIATION_THRESHOLD_OPTIONS = [
    { value: "all", label: "All" },
    { value: "1", label: "> 1 km" },
    { value: "2", label: "> 2 km" },
    { value: "5", label: "> 5 km" },
    { value: "10", label: "> 10 km" },
];

const MONTH_OPTIONS = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
];

const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount))
        return "₱0.00";
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
    }).format(amount);
};

const formatNumber = (num) => {
    if (num === undefined || num === null || isNaN(num)) return "0";
    return new Intl.NumberFormat("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
};

// Derive date range from a single month (or "all") + current year
const deriveDateRange = (month, year) => {
    if (month === "all") {
        return {
            startDate: format(new Date(year, 0, 1), "yyyy-MM-dd"),
            endDate: format(new Date(year, 11, 31), "yyyy-MM-dd"),
        };
    }
    const m = parseInt(month) - 1;
    return {
        startDate: format(new Date(year, m, 1), "yyyy-MM-dd"),
        endDate: format(endOfMonth(new Date(year, m, 1)), "yyyy-MM-dd"),
    };
};

const monthLabel = (month, year) =>
    month === "all"
        ? `All Months ${year}`
        : `${MONTH_OPTIONS.find((m) => m.value === month)?.label} ${year}`;

// ============================================
// STATS CARD COMPONENT
// ============================================

const StatsCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/60 hover:shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {title}
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {value}
                </p>
                {subtitle && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {subtitle}
                    </p>
                )}
            </div>
            <div
                className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-lg`}
            >
                <Icon className="h-5 w-5 text-white" />
            </div>
        </div>
    </div>
);

// ============================================
// INLINE FILTER CONTROLS (for card headers)
// ============================================

const InlineFilters = ({
    departmentFilter,
    setDepartmentFilter,
    monthFilter,
    setMonthFilter,
    departments,
    onInteract,
}) => {
    return (
        <>
            {/* Department */}
            <Select
                value={departmentFilter}
                onValueChange={setDepartmentFilter}
            >
                <SelectTrigger
                    className="w-[180px] h-8 text-xs"
                    onClick={onInteract}
                >
                    <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => (
                        <SelectItem
                            key={d.department_id}
                            value={String(d.department_id)}
                        >
                            {d.department_name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Month */}
            <Select
                value={String(monthFilter)}
                onValueChange={(v) =>
                    setMonthFilter(v === "all" ? "all" : parseInt(v))
                }
            >
                <SelectTrigger
                    className="w-[140px] h-8 text-xs"
                    onClick={onInteract}
                >
                    <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {MONTH_OPTIONS.map((opt) => (
                        <SelectItem
                            key={opt.value}
                            value={String(opt.value)}
                        >
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

const MayorReports = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isConnected } = useRealtime();

    // Fixed internally — not exposed as a filter
    const yearFilter = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // ============ PER-CARD FILTERS (independent) ============

    // 1. Fuel Receipt card
    const [frDepartment, setFrDepartment] = useState("all");
    const [frMonth, setFrMonth] = useState(currentMonth);
    const [receiptStatusFilter, setReceiptStatusFilter] = useState("all");

    // 2. Budget Utilization card
    const [buDepartment, setBuDepartment] = useState("all");
    const [buMonth, setBuMonth] = useState(currentMonth);

    // 3. Reconciliation card
    const [rcDepartment, setRcDepartment] = useState("all");
    const [rcMonth, setRcMonth] = useState(currentMonth);
    const [reconciliationThreshold, setReconciliationThreshold] =
        useState("all");

    // 4. Billing Statement card
    const [bsDepartment, setBsDepartment] = useState("all");
    const [bsMonth, setBsMonth] = useState(currentMonth);

    const [exportLoading, setExportLoading] = useState(false);

    const [expandedSections, setExpandedSections] = useState({
        fuelReceipt: true,
        budgetUtilization: true,
        reconciliation: true,
        billingStatement: true,
    });

    // ============================================
    // AUTO-REFRESH
    // ============================================

    const fetchAllData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["mayor-fuel-receipt"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-budget"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-reconciliation"] });
        queryClient.invalidateQueries({ queryKey: ["mayor-billing-statement"] });
    }, [queryClient]);

    useAutoRefresh(
        [
            "mayor-trip-updated",
            "mayor-budget-updated",
            "gso-funds-released",
            "new-notification",
        ],
        fetchAllData,
    );

    // ============================================
    // DATE RANGES (per card)
    // ============================================

    const frDateRange = useMemo(
        () => deriveDateRange(frMonth, yearFilter),
        [frMonth, yearFilter],
    );
    const rcDateRange = useMemo(
        () => deriveDateRange(rcMonth, yearFilter),
        [rcMonth, yearFilter],
    );
    const bsDateRange = useMemo(
        () => deriveDateRange(bsMonth, yearFilter),
        [bsMonth, yearFilter],
    );

    // ============================================
    // DEPARTMENTS (shared source list)
    // ============================================

    const { data: departmentsRaw = [] } = useOptimizedQuery({
        queryKey: ["mayor-departments-selector"],
        queryFn: async () => {
            try {
                const response =
                    await mayorsOfficeAPI.getAllDepartmentsForSelector();
                return extractArray(response);
            } catch (error) {
                console.error("Failed to load departments:", error);
                return [];
            }
        },
        staleTime: CACHE_10MIN,
        keepPreviousData: true,
    });
    const departments = departmentsRaw || [];

    // ============================================
    // QUERIES
    // ============================================

    // 1. FUEL RECEIPT REPORT
    const { data: receiptData, isLoading: receiptLoading } = useQuery({
        queryKey: [
            "mayor-fuel-receipt",
            frDateRange,
            frDepartment,
            receiptStatusFilter,
        ],
        queryFn: async () => {
            const params = {
                start_date: frDateRange.startDate,
                end_date: frDateRange.endDate,
                department_id:
                    frDepartment !== "all" ? frDepartment : undefined,
                status:
                    receiptStatusFilter !== "all"
                        ? receiptStatusFilter
                        : undefined,
            };
            const res = await reportsAPI.getFuelReceiptReport(params);
            const data = res?.data?.data ?? res?.data ?? {};
            const receipts = extractArray(data);
            return { receipts, summary: data?.summary || {} };
        },
        enabled: expandedSections.fuelReceipt,
        staleTime: CACHE_5MIN,
    });

    // 2. BUDGET UTILIZATION REPORT
    const { data: budgetData, isLoading: budgetLoading } = useQuery({
        queryKey: [
            "mayor-budget",
            yearFilter,
            buDepartment,
            buMonth,
        ],
        queryFn: async () => {
            const params = {
                year: yearFilter,
                department_id:
                    buDepartment !== "all" ? buDepartment : undefined,
            };
            if (buMonth !== "all") {
                params.month = buMonth;
            }
            const res = await reportsAPI.getBudgetReport(params);
            const data = res?.data?.data ?? res?.data ?? {};
            return {
                periods: data?.periods || [],
                summary: data?.summary || {},
                department: data?.department || {},
            };
        },
        enabled: expandedSections.budgetUtilization,
        staleTime: CACHE_5MIN,
    });

    // 3. RECONCILIATION REPORT
    const { data: reconciliationData, isLoading: reconciliationLoading } =
        useQuery({
            queryKey: [
                "mayor-reconciliation",
                rcDateRange,
                rcDepartment,
                reconciliationThreshold,
            ],
            queryFn: async () => {
                const params = {
                    start_date: rcDateRange.startDate,
                    end_date: rcDateRange.endDate,
                    department_id:
                        rcDepartment !== "all" ? rcDepartment : undefined,
                };
                const res = await reportsAPI.getReconciliation(params);
                const data = res?.data?.data ?? res?.data ?? {};
                const reconciliations = extractArray(data);
                const filteredReconciliations =
                    reconciliationThreshold !== "all"
                        ? reconciliations.filter(
                              (r) =>
                                  Math.abs(r.variance || 0) >=
                                  parseFloat(reconciliationThreshold),
                          )
                        : reconciliations;
                return {
                    reconciliations: filteredReconciliations,
                    summary: data?.summary || {},
                };
            },
            enabled: expandedSections.reconciliation,
            staleTime: CACHE_5MIN,
        });

    // 4. BILLING STATEMENT OF FUEL
    const { data: billingData, isLoading: billingLoading } = useQuery({
        queryKey: [
            "mayor-billing-statement",
            bsDateRange,
            bsDepartment,
        ],
        queryFn: async () => {
            const params = {
                start_date: bsDateRange.startDate,
                end_date: bsDateRange.endDate,
                department_id:
                    bsDepartment !== "all" ? bsDepartment : undefined,
            };
            const res = await reportsAPI.getBillingStatement(params);
            return res?.data?.data ?? res?.data ?? {};
        },
        enabled: expandedSections.billingStatement,
        staleTime: CACHE_5MIN,
    });

    // ============ HANDLERS ============

    const toggleSection = (section) => {
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    // Pass each card's own filter values explicitly
    const handleExport = async (
        format,
        reportType,
        params,
        rangeOverride,
    ) => {
        try {
            setExportLoading(true);
            toast.loading(`Exporting ${format.toUpperCase()} report...`);

            let response;
            const range = rangeOverride || frDateRange;
            let fileName = `${reportType}_${range.startDate}_to_${range.endDate}`;

            switch (reportType) {
                case "fuel_receipt":
                    response = await reportsAPI.exportFuelReceiptReport(
                        format,
                        params,
                    );
                    break;
                case "reconciliation":
                    response = await reportsAPI.exportReconciliation(
                        format,
                        params,
                    );
                    break;
                case "budget":
                    response = await reportsAPI.exportBudgetReport(
                        format,
                        params,
                    );
                    break;
                case "billing_statement":
                    response = await reportsAPI.exportBillingStatement(
                        format,
                        params,
                    );
                    break;
                default:
                    response = await reportsAPI.exportFuelReceiptReport(
                        format,
                        params,
                    );
            }

            const extension = format === "pdf" ? "pdf" : "xlsx";
            saveAs(response.data, `${fileName}.${extension}`);

            toast.dismiss();
            toast.success(`${format.toUpperCase()} exported successfully`);
        } catch (error) {
            toast.dismiss();
            console.error("Export error:", error);
            toast.error(
                error.response?.data?.message || "Failed to export report",
            );
        } finally {
            setExportLoading(false);
        }
    };

    const connectionStatus = isConnected ? "🟢 Live" : "🔴 Offline";
    const isRealTime = isConnected;

    // ============================================================
    // RENDER - FUEL RECEIPT REPORT
    // ============================================================

    const renderFuelReceipt = () => {
        const receipts = Array.isArray(receiptData?.receipts)
            ? receiptData.receipts
            : [];
        const summary = receiptData?.summary || {};

        const totals = receipts.reduce(
            (acc, r) => {
                acc.amount += parseFloat(r.amount || 0);
                acc.quantity += parseFloat(r.quantity || 0);
                return acc;
            },
            { amount: 0, quantity: 0 },
        );

        const statusColors = {
            verified: "bg-emerald-500",
            pending: "bg-orange-500",
            rejected: "bg-red-500",
        };

        const periodText = monthLabel(frMonth, yearFilter);

        return (
            <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                <CardHeader
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl"
                    onClick={() => toggleSection("fuelReceipt")}
                >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-blue-500" />
                            <CardTitle className="text-slate-800 dark:text-white">
                                Fuel Receipt Report
                            </CardTitle>
                            <Badge className="bg-blue-500/20 text-blue-600 ml-2">
                                {receipts.length} receipts
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {expandedSections.fuelReceipt && (
                                <>
                                    <InlineFilters
                                        departmentFilter={frDepartment}
                                        setDepartmentFilter={setFrDepartment}
                                        monthFilter={frMonth}
                                        setMonthFilter={setFrMonth}
                                        departments={departments}
                                        onInteract={(e) =>
                                            e.stopPropagation()
                                        }
                                    />
                                    <Select
                                        value={receiptStatusFilter}
                                        onValueChange={setReceiptStatusFilter}
                                    >
                                        <SelectTrigger
                                            className="w-[130px] h-8 text-xs"
                                            onClick={(e) =>
                                                e.stopPropagation()
                                            }
                                        >
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {RECEIPT_STATUS_OPTIONS.map(
                                                (opt) => (
                                                    <SelectItem
                                                        key={opt.value}
                                                        value={opt.value}
                                                    >
                                                        {opt.label}
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleExport(
                                                "excel",
                                                "fuel_receipt",
                                                {
                                                    start_date:
                                                        frDateRange.startDate,
                                                    end_date:
                                                        frDateRange.endDate,
                                                    department_id:
                                                        frDepartment !== "all"
                                                            ? frDepartment
                                                            : undefined,
                                                    status:
                                                        receiptStatusFilter !==
                                                        "all"
                                                            ? receiptStatusFilter
                                                            : undefined,
                                                },
                                                frDateRange,
                                            );
                                        }}
                                        disabled={exportLoading}
                                        className="h-8 px-2 text-xs"
                                    >
                                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                                        Excel
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleExport(
                                                "pdf",
                                                "fuel_receipt",
                                                {
                                                    start_date:
                                                        frDateRange.startDate,
                                                    end_date:
                                                        frDateRange.endDate,
                                                    department_id:
                                                        frDepartment !== "all"
                                                            ? frDepartment
                                                            : undefined,
                                                    status:
                                                        receiptStatusFilter !==
                                                        "all"
                                                            ? receiptStatusFilter
                                                            : undefined,
                                                },
                                                frDateRange,
                                            );
                                        }}
                                        disabled={exportLoading}
                                        className="h-8 px-2 text-xs"
                                    >
                                        <FileText className="h-3.5 w-3.5 mr-1" />
                                        PDF
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.print();
                                        }}
                                        className="h-8 px-2 text-xs"
                                    >
                                        <Printer className="h-3.5 w-3.5 mr-1" />
                                        Print
                                    </Button>
                                </>
                            )}
                            <Badge variant="secondary">
                                {expandedSections.fuelReceipt ? "Hide" : "Show"}
                            </Badge>
                            {expandedSections.fuelReceipt ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </div>
                    </div>
                    <CardDescription>
                        For expenditure verification — {periodText}
                    </CardDescription>
                </CardHeader>
                {expandedSections.fuelReceipt && (
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <StatsCard
                                title="Total Receipts"
                                value={receipts.length}
                                icon={Receipt}
                                color="from-blue-500 to-blue-600"
                            />
                            <StatsCard
                                title="Total Fuel"
                                value={`${formatNumber(totals.quantity || summary.total_liters || 0)} L`}
                                icon={Fuel}
                                color="from-emerald-500 to-emerald-600"
                            />
                            <StatsCard
                                title="Total Cost"
                                value={formatCurrency(
                                    totals.amount || summary.total_cost || 0,
                                )}
                                icon={PhilippinePeso}
                                color="from-purple-500 to-purple-600"
                            />
                            <StatsCard
                                title="Avg Unit Price"
                                value={formatCurrency(
                                    summary.avg_unit_price || 0,
                                )}
                                icon={TrendingUp}
                                color="from-orange-500 to-orange-600"
                            />
                        </div>

                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                                    <TableRow>
                                        <TableHead className="text-xs uppercase">
                                            Receipt No.
                                        </TableHead>
                                        <TableHead className="text-xs uppercase">
                                            Date Submitted
                                        </TableHead>
                                        <TableHead className="text-xs uppercase">
                                            Trip Ticket No.
                                        </TableHead>
                                        <TableHead className="text-xs uppercase">
                                            Driver
                                        </TableHead>
                                        <TableHead className="text-xs uppercase">
                                            Vehicle
                                        </TableHead>
                                        <TableHead className="text-xs uppercase text-right">
                                            Amount (₱)
                                        </TableHead>
                                        <TableHead className="text-xs uppercase">
                                            Receipt Status
                                        </TableHead>
                                        <TableHead className="text-xs uppercase">
                                            Verification Date
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {receipts.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan="8"
                                                className="text-center py-8 text-slate-500"
                                            >
                                                No fuel receipt data available
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        receipts.map((r, i) => {
                                            const statusColor =
                                                statusColors[
                                                    r.receipt_status
                                                ] || "bg-slate-400";
                                            return (
                                                <TableRow key={i}>
                                                    <TableCell className="font-mono font-medium">
                                                        {r.invoice_number ||
                                                            r.charge_invoice_no ||
                                                            "N/A"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {r.date ||
                                                            r.trip_date ||
                                                            "N/A"}
                                                    </TableCell>
                                                    <TableCell className="font-mono">
                                                        {r.ticket_number ||
                                                            r.trip_ticket_number ||
                                                            "N/A"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {r.driver_name ||
                                                            r.driver ||
                                                            "N/A"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {r.vehicle_model ||
                                                            r.vehicle ||
                                                            "N/A"}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {formatCurrency(
                                                            r.amount ||
                                                                r.amount_on_receipt ||
                                                                0,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            className={
                                                                statusColor
                                                            }
                                                        >
                                                            {r.receipt_status ||
                                                                "Pending"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {(() => {
                                                            const dateValue =
                                                                r.verified_at ||
                                                                r.reconciled_at;
                                                            if (!dateValue) {
                                                                return (
                                                                    <span className="text-slate-400 text-xs">
                                                                        Not
                                                                        verified
                                                                    </span>
                                                                );
                                                            }
                                                            return format(
                                                                new Date(
                                                                    dateValue,
                                                                ),
                                                                "yyyy-MM-dd",
                                                            );
                                                        })()}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                )}
            </Card>
        );
    };

    // ============================================================
    // RENDER - BUDGET UTILIZATION REPORT
    // ============================================================

    const renderBudgetUtilization = () => {
        const periods = Array.isArray(budgetData?.periods)
            ? budgetData.periods
            : [];
        const summary = budgetData?.summary || {};
        const dept = budgetData?.department || {};

        const periodText = monthLabel(buMonth, yearFilter);

        return (
            <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                <CardHeader
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl"
                    onClick={() => toggleSection("budgetUtilization")}
                >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-amber-500" />
                            <CardTitle className="text-slate-800 dark:text-white">
                                Budget Utilization Report
                            </CardTitle>
                            <Badge className="bg-amber-500/20 text-amber-600 ml-2">
                                {periods.length} week
                                {periods.length !== 1 ? "s" : ""}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {expandedSections.budgetUtilization && (
                                <>
                                    <InlineFilters
                                        departmentFilter={buDepartment}
                                        setDepartmentFilter={setBuDepartment}
                                        monthFilter={buMonth}
                                        setMonthFilter={setBuMonth}
                                        departments={departments}
                                        onInteract={(e) =>
                                            e.stopPropagation()
                                        }
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleExport(
                                                "excel",
                                                "budget",
                                                {
                                                    year: yearFilter,
                                                    department_id:
                                                        buDepartment !== "all"
                                                            ? buDepartment
                                                            : undefined,
                                                    ...(buMonth !== "all"
                                                        ? { month: buMonth }
                                                        : {}),
                                                },
                                            );
                                        }}
                                        disabled={exportLoading}
                                        className="h-8 px-2 text-xs"
                                    >
                                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                                        Excel
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleExport(
                                                "pdf",
                                                "budget",
                                                {
                                                    year: yearFilter,
                                                    department_id:
                                                        buDepartment !== "all"
                                                            ? buDepartment
                                                            : undefined,
                                                    ...(buMonth !== "all"
                                                        ? { month: buMonth }
                                                        : {}),
                                                },
                                            );
                                        }}
                                        disabled={exportLoading}
                                        className="h-8 px-2 text-xs"
                                    >
                                        <FileText className="h-3.5 w-3.5 mr-1" />
                                        PDF
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.print();
                                        }}
                                        className="h-8 px-2 text-xs"
                                    >
                                        <Printer className="h-3.5 w-3.5 mr-1" />
                                        Print
                                    </Button>
                                </>
                            )}
                            <Badge variant="secondary">
                                {expandedSections.budgetUtilization
                                    ? "Hide"
                                    : "Show"}
                            </Badge>
                            {expandedSections.budgetUtilization ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </div>
                    </div>
                    <CardDescription>
                        {dept.department_name || "Select a department"} —{" "}
                        {periodText}
                    </CardDescription>
                </CardHeader>

                {expandedSections.budgetUtilization && (
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <StatsCard
                                title="Annual Allocated"
                                value={formatCurrency(
                                    summary.total_allocated || 0,
                                )}
                                icon={Wallet}
                                color="from-blue-500 to-blue-600"
                                subtitle={`FY ${yearFilter}`}
                            />
                            <StatsCard
                                title="Annual Utilized"
                                value={formatCurrency(summary.total_used || 0)}
                                icon={TrendingDown}
                                color="from-yellow-500 to-yellow-600"
                                subtitle={`FY ${yearFilter}`}
                            />
                            <StatsCard
                                title="Annual Remaining"
                                value={formatCurrency(
                                    summary.total_remaining || 0,
                                )}
                                icon={TrendingUp}
                                color="from-emerald-500 to-emerald-600"
                                subtitle={`FY ${yearFilter}`}
                            />
                            <StatsCard
                                title="Weeks in View"
                                value={summary.total_weeks || 0}
                                icon={CalendarRange}
                                color="from-purple-500 to-purple-600"
                                subtitle={periodText}
                            />
                        </div>

                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto border rounded-lg">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                                    <TableRow>
                                        <TableHead className="text-xs uppercase">
                                            Week (Date Range)
                                        </TableHead>
                                        <TableHead className="text-xs uppercase text-right">
                                            Budget (₱)
                                        </TableHead>
                                        <TableHead className="text-xs uppercase text-right">
                                            Utilized (₱)
                                        </TableHead>
                                        <TableHead className="text-xs uppercase text-right">
                                            Balance (₱)
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {periods.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan="4"
                                                className="text-center py-8 text-slate-500"
                                            >
                                                No weekly budget periods for
                                                this department and period
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        <>
                                            {periods.map((p, i) => (
                                                <TableRow key={p.period_id || i}>
                                                    <TableCell className="font-medium">
                                                        {p.week_start
                                                            ? format(
                                                                  new Date(
                                                                      p.week_start,
                                                                  ),
                                                                  "MMM d, yyyy",
                                                              )
                                                            : "—"}
                                                        {" – "}
                                                        {p.week_end
                                                            ? format(
                                                                  new Date(
                                                                      p.week_end,
                                                                  ),
                                                                  "MMM d, yyyy",
                                                              )
                                                            : "—"}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {formatCurrency(
                                                            p.allocated || 0,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {formatCurrency(
                                                            p.used || 0,
                                                        )}
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right font-medium ${(p.remaining || 0) < 0 ? "text-red-600" : "text-emerald-600"}`}
                                                    >
                                                        {formatCurrency(
                                                            p.remaining || 0,
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2">
                                                <TableCell className="text-right">
                                                    TOTAL
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(
                                                        periods[0]?.allocated ||
                                                            0,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(
                                                        periods.reduce(
                                                            (sum, p) =>
                                                                sum +
                                                                (p.used || 0),
                                                            0,
                                                        ),
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-emerald-700">
                                                    {formatCurrency(
                                                        periods[
                                                            periods.length - 1
                                                        ]?.remaining || 0,
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        </>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                )}
            </Card>
        );
    };

    // ============================================================
    // RENDER - RECONCILIATION REPORT
    // ============================================================

    const renderReconciliation = () => {
        const reconciliations = Array.isArray(
            reconciliationData?.reconciliations,
        )
            ? reconciliationData.reconciliations
            : [];
        const summary = reconciliationData?.summary || {};
        const periodText = monthLabel(rcMonth, yearFilter);

        return (
            <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                <CardHeader
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl"
                    onClick={() => toggleSection("reconciliation")}
                >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <FileCheck className="h-5 w-5 text-indigo-500" />
                            <CardTitle className="text-slate-800 dark:text-white">
                                Cash Reconciliation Report
                            </CardTitle>
                            <Badge className="bg-indigo-500/20 text-indigo-600 ml-2">
                                {reconciliations.length} trips
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {expandedSections.reconciliation && (
                                <>
                                    <InlineFilters
                                        departmentFilter={rcDepartment}
                                        setDepartmentFilter={setRcDepartment}
                                        monthFilter={rcMonth}
                                        setMonthFilter={setRcMonth}
                                        departments={departments}
                                        onInteract={(e) =>
                                            e.stopPropagation()
                                        }
                                    />
                                    <Select
                                        value={reconciliationThreshold}
                                        onValueChange={
                                            setReconciliationThreshold
                                        }
                                    >
                                        <SelectTrigger
                                            className="w-[130px] h-8 text-xs"
                                            onClick={(e) =>
                                                e.stopPropagation()
                                            }
                                        >
                                            <SelectValue placeholder="Threshold" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {RECONCILIATION_THRESHOLD_OPTIONS.map(
                                                (opt) => (
                                                    <SelectItem
                                                        key={opt.value}
                                                        value={opt.value}
                                                    >
                                                        {opt.label}
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleExport(
                                                "excel",
                                                "reconciliation",
                                                {
                                                    start_date:
                                                        rcDateRange.startDate,
                                                    end_date:
                                                        rcDateRange.endDate,
                                                    department_id:
                                                        rcDepartment !== "all"
                                                            ? rcDepartment
                                                            : undefined,
                                                },
                                                rcDateRange,
                                            );
                                        }}
                                        disabled={exportLoading}
                                        className="h-8 px-2 text-xs"
                                    >
                                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                                        Excel
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleExport(
                                                "pdf",
                                                "reconciliation",
                                                {
                                                    start_date:
                                                        rcDateRange.startDate,
                                                    end_date:
                                                        rcDateRange.endDate,
                                                    department_id:
                                                        rcDepartment !== "all"
                                                            ? rcDepartment
                                                            : undefined,
                                                },
                                                rcDateRange,
                                            );
                                        }}
                                        disabled={exportLoading}
                                        className="h-8 px-2 text-xs"
                                    >
                                        <FileText className="h-3.5 w-3.5 mr-1" />
                                        PDF
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.print();
                                        }}
                                        className="h-8 px-2 text-xs"
                                    >
                                        <Printer className="h-3.5 w-3.5 mr-1" />
                                        Print
                                    </Button>
                                </>
                            )}
                            <Badge variant="secondary">
                                {expandedSections.reconciliation
                                    ? "Hide"
                                    : "Show"}
                            </Badge>
                            {expandedSections.reconciliation ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </div>
                    </div>
                    <CardDescription>
                        For budget verification — {periodText}
                    </CardDescription>
                </CardHeader>

                {expandedSections.reconciliation && (
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <StatsCard
                                title="Total Trips"
                                value={summary.total_reconciliations || 0}
                                icon={FileCheck}
                                color="from-blue-500 to-blue-600"
                                subtitle="Reconciled records"
                            />
                            <StatsCard
                                title="Verified"
                                value={summary.total_verified || 0}
                                icon={CheckCircle}
                                color="from-emerald-500 to-emerald-600"
                                subtitle="Amounts matched"
                            />
                            <StatsCard
                                title="Discrepancy"
                                value={summary.total_discrepancy || 0}
                                icon={AlertCircle}
                                color="from-red-500 to-red-600"
                                subtitle="Needs attention"
                            />
                            <StatsCard
                                title="Total Released"
                                value={formatCurrency(
                                    summary.total_amount_released || 0,
                                )}
                                icon={PhilippinePeso}
                                color="from-purple-500 to-purple-600"
                                subtitle="Total funds issued"
                            />
                        </div>

                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-lg">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                                    <TableRow>
                                        <TableHead className="text-xs uppercase">
                                            Trip Ticket No.
                                        </TableHead>
                                        <TableHead className="text-xs uppercase">
                                            Vehicle
                                        </TableHead>
                                        <TableHead className="text-xs uppercase">
                                            Driver
                                        </TableHead>
                                        <TableHead className="text-xs uppercase text-right">
                                            Amount Released
                                        </TableHead>
                                        <TableHead className="text-xs uppercase text-right">
                                            Actual Amount Paid
                                        </TableHead>
                                        <TableHead className="text-xs uppercase text-right">
                                            Amount Variance
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reconciliations.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan="6"
                                                className="text-center py-8 text-slate-500"
                                            >
                                                No reconciliation data available
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        reconciliations.map((r, i) => {
                                            const amountVarianceColor =
                                                r.amount_variance !== null &&
                                                Math.abs(r.amount_variance) > 100
                                                    ? "text-red-600"
                                                    : "";
                                            return (
                                                <TableRow key={i}>
                                                    <TableCell className="font-mono font-medium">
                                                        {r.ticket_number}
                                                    </TableCell>
                                                    <TableCell>
                                                        {r.plate_number}
                                                    </TableCell>
                                                    <TableCell>
                                                        {r.driver_name}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {formatCurrency(
                                                            r.amount_released ||
                                                                0,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {r.actual_amount !==
                                                            null &&
                                                        r.actual_amount !==
                                                            undefined ? (
                                                            formatCurrency(
                                                                r.actual_amount,
                                                            )
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">
                                                                Not verified
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right font-medium ${amountVarianceColor}`}
                                                    >
                                                        {r.amount_variance !==
                                                            null &&
                                                        r.amount_variance !==
                                                            undefined
                                                            ? formatCurrency(
                                                                  r.amount_variance,
                                                              )
                                                            : "—"}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                )}
            </Card>
        );
    };

    // ============================================================
    // RENDER - BILLING STATEMENT REPORT
    // ============================================================

    const renderBillingStatement = () => {
        const departmentsList = Array.isArray(billingData?.departments)
            ? billingData.departments
            : [];
        const grandTotals = billingData?.grand_totals || {};
        const periodLabel = billingData?.period_label || "";

        const computeFuelAmounts = (rows) => {
            const out = { premium: 0, diesel: 0, regular: 0 };
            (rows || []).forEach((r) => {
                const type = (r.lubricant || "").toLowerCase();
                const amt = parseFloat(r.amount) || 0;
                if (type === "premium") out.premium += amt;
                else if (type === "diesel") out.diesel += amt;
                else if (type === "regular" || type === "gasoline")
                    out.regular += amt;
            });
            return out;
        };

        return (
            <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                <CardHeader
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl"
                    onClick={() => toggleSection("billingStatement")}
                >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-amber-500" />
                            <CardTitle className="text-slate-800 dark:text-white">
                                Billing Statement of Fuel
                            </CardTitle>
                            <Badge className="bg-amber-500/20 text-amber-600 ml-2">
                                {departmentsList.length} department
                                {departmentsList.length !== 1 ? "s" : ""}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {expandedSections.billingStatement && (
                                <>
                                    <InlineFilters
                                        departmentFilter={bsDepartment}
                                        setDepartmentFilter={setBsDepartment}
                                        monthFilter={bsMonth}
                                        setMonthFilter={setBsMonth}
                                        departments={departments}
                                        onInteract={(e) =>
                                            e.stopPropagation()
                                        }
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleExport(
                                                "excel",
                                                "billing_statement",
                                                {
                                                    start_date:
                                                        bsDateRange.startDate,
                                                    end_date:
                                                        bsDateRange.endDate,
                                                    department_id:
                                                        bsDepartment !== "all"
                                                            ? bsDepartment
                                                            : undefined,
                                                },
                                                bsDateRange,
                                            );
                                        }}
                                        disabled={exportLoading}
                                        className="h-8 px-2 text-xs"
                                    >
                                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                                        Excel
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleExport(
                                                "pdf",
                                                "billing_statement",
                                                {
                                                    start_date:
                                                        bsDateRange.startDate,
                                                    end_date:
                                                        bsDateRange.endDate,
                                                    department_id:
                                                        bsDepartment !== "all"
                                                            ? bsDepartment
                                                            : undefined,
                                                },
                                                bsDateRange,
                                            );
                                        }}
                                        disabled={exportLoading}
                                        className="h-8 px-2 text-xs"
                                    >
                                        <FileText className="h-3.5 w-3.5 mr-1" />
                                        PDF
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.print();
                                        }}
                                        className="h-8 px-2 text-xs"
                                    >
                                        <Printer className="h-3.5 w-3.5 mr-1" />
                                        Print
                                    </Button>
                                </>
                            )}
                            <Badge variant="secondary">
                                {expandedSections.billingStatement
                                    ? "Hide"
                                    : "Show"}
                            </Badge>
                            {expandedSections.billingStatement ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </div>
                    </div>
                    <CardDescription>{periodLabel}</CardDescription>
                </CardHeader>

                {expandedSections.billingStatement && (
                    <CardContent>
                        {billingLoading ? (
                            <div className="text-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-slate-400 mx-auto mb-3" />
                                <p className="text-slate-500 dark:text-slate-400">
                                    Loading billing statement...
                                </p>
                            </div>
                        ) : departmentsList.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-500 dark:text-slate-400">
                                    No fuel receipts for the selected period
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-10">
                                {departmentsList.map((dept) => {
                                    const fuelAmounts = computeFuelAmounts(
                                        dept.rows,
                                    );
                                    return (
                                        <div
                                            key={dept.department_id}
                                            className="space-y-4"
                                        >
                                            <div className="text-center border-y-2 border-slate-800 dark:border-slate-200 py-2">
                                                <h3 className="font-bold text-base tracking-wide text-slate-900 dark:text-white">
                                                    FOR{" "}
                                                    {dept.department_code}
                                                </h3>
                                                {dept.department_name &&
                                                    dept.department_name !==
                                                        dept.department_code && (
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                            {
                                                                dept.department_name
                                                            }
                                                        </p>
                                                    )}
                                            </div>

                                            {/* Fuel-type matrix */}
                                            <div className="flex justify-end">
                                                <div className="inline-grid grid-cols-4 border-2 border-slate-800 dark:border-slate-200 text-xs">
                                                    <div className="px-3 py-1.5 font-bold bg-slate-100 dark:bg-slate-800 border-r border-slate-800 dark:border-slate-200 text-center">
                                                        PREMIUM
                                                    </div>
                                                    <div className="px-3 py-1.5 font-bold bg-slate-100 dark:bg-slate-800 border-r border-slate-800 dark:border-slate-200 text-center">
                                                        DIESEL
                                                    </div>
                                                    <div className="px-3 py-1.5 font-bold bg-slate-100 dark:bg-slate-800 border-r border-slate-800 dark:border-slate-200 text-center">
                                                        REGULAR
                                                    </div>
                                                    <div className="px-3 py-1.5 font-bold bg-slate-100 dark:bg-slate-800 text-center">
                                                        QUANTITY
                                                    </div>

                                                    <div className="px-3 py-1.5 text-right border-t border-r border-slate-800 dark:border-slate-200">
                                                        {formatNumber(
                                                            dept.subtotals
                                                                ?.premium_liters ||
                                                                0,
                                                        )}
                                                    </div>
                                                    <div className="px-3 py-1.5 text-right border-t border-r border-slate-800 dark:border-slate-200">
                                                        {formatNumber(
                                                            dept.subtotals
                                                                ?.diesel_liters ||
                                                                0,
                                                        )}
                                                    </div>
                                                    <div className="px-3 py-1.5 text-right border-t border-r border-slate-800 dark:border-slate-200">
                                                        {formatNumber(
                                                            dept.subtotals
                                                                ?.regular_liters ||
                                                                0,
                                                        )}
                                                    </div>
                                                    <div className="px-3 py-1.5 text-right border-t border-slate-800 dark:border-slate-200 font-bold">
                                                        {formatNumber(
                                                            dept.subtotals
                                                                ?.total_liters ||
                                                                0,
                                                        )}
                                                    </div>

                                                    <div className="px-3 py-1.5 font-bold bg-slate-100 dark:bg-slate-800 border-t border-r border-slate-800 dark:border-slate-200 text-center">
                                                        PREMIUM
                                                    </div>
                                                    <div className="px-3 py-1.5 font-bold bg-slate-100 dark:bg-slate-800 border-t border-r border-slate-800 dark:border-slate-200 text-center">
                                                        DIESEL
                                                    </div>
                                                    <div className="px-3 py-1.5 font-bold bg-slate-100 dark:bg-slate-800 border-t border-r border-slate-800 dark:border-slate-200 text-center">
                                                        REGULAR
                                                    </div>
                                                    <div className="px-3 py-1.5 font-bold bg-slate-100 dark:bg-slate-800 border-t text-center">
                                                        AMOUNT
                                                    </div>

                                                    <div className="px-3 py-1.5 text-right border-t border-r border-slate-800 dark:border-slate-200">
                                                        {formatCurrency(
                                                            fuelAmounts.premium,
                                                        )}
                                                    </div>
                                                    <div className="px-3 py-1.5 text-right border-t border-r border-slate-800 dark:border-slate-200">
                                                        {formatCurrency(
                                                            fuelAmounts.diesel,
                                                        )}
                                                    </div>
                                                    <div className="px-3 py-1.5 text-right border-t border-r border-slate-800 dark:border-slate-200">
                                                        {formatCurrency(
                                                            fuelAmounts.regular,
                                                        )}
                                                    </div>
                                                    <div className="px-3 py-1.5 text-right border-t border-slate-800 dark:border-slate-200 font-bold text-emerald-600 dark:text-emerald-400">
                                                        {formatCurrency(
                                                            dept.subtotals
                                                                ?.total_amount ||
                                                                0,
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Rows table */}
                                            <div className="overflow-x-auto border-2 border-slate-800 dark:border-slate-200">
                                                <Table>
                                                    <TableHeader className="bg-slate-100 dark:bg-slate-800">
                                                        <TableRow className="border-b-2 border-slate-800 dark:border-slate-200">
                                                            <TableHead className="text-xs font-bold text-slate-900 dark:text-white">
                                                                NO.
                                                            </TableHead>
                                                            <TableHead className="text-xs font-bold text-slate-900 dark:text-white">
                                                                CHARGE INVOICE
                                                                NO.
                                                            </TableHead>
                                                            <TableHead className="text-xs font-bold text-slate-900 dark:text-white">
                                                                PLATE NO.
                                                            </TableHead>
                                                            <TableHead className="text-xs font-bold text-slate-900 dark:text-white">
                                                                DATE
                                                            </TableHead>
                                                            <TableHead className="text-xs font-bold text-slate-900 dark:text-white">
                                                                CONTROL NO.
                                                            </TableHead>
                                                            <TableHead className="text-xs font-bold text-slate-900 dark:text-white">
                                                                LUBRICANT
                                                            </TableHead>
                                                            <TableHead className="text-xs font-bold text-slate-900 dark:text-white text-right">
                                                                QUANTITY
                                                            </TableHead>
                                                            <TableHead className="text-xs font-bold text-slate-900 dark:text-white text-right">
                                                                UNIT PRICE
                                                            </TableHead>
                                                            <TableHead className="text-xs font-bold text-slate-900 dark:text-white text-right">
                                                                AMOUNT
                                                            </TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {dept.rows.map(
                                                            (r, i) => (
                                                                <TableRow
                                                                    key={i}
                                                                    className="border-b border-slate-200 dark:border-slate-700"
                                                                >
                                                                    <TableCell className="text-xs">
                                                                        {r.no}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs font-mono">
                                                                        {
                                                                            r.charge_invoice_no
                                                                        }
                                                                    </TableCell>
                                                                    <TableCell className="text-xs font-mono">
                                                                        {r.plate_no}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs">
                                                                        {r.date}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs font-mono">
                                                                        {
                                                                            r.control_no
                                                                        }
                                                                    </TableCell>
                                                                    <TableCell className="text-xs">
                                                                        {
                                                                            r.lubricant
                                                                        }
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-right">
                                                                        {formatNumber(
                                                                            r.quantity,
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-right">
                                                                        {formatCurrency(
                                                                            r.unit_price,
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-right font-medium">
                                                                        {formatCurrency(
                                                                            r.amount,
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ),
                                                        )}

                                                        <TableRow className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-800 dark:border-slate-200">
                                                            <TableCell
                                                                colSpan="6"
                                                                className="text-right text-xs"
                                                            >
                                                                TOTAL
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs">
                                                                {formatNumber(
                                                                    dept
                                                                        .subtotals
                                                                        ?.total_liters ||
                                                                        0,
                                                                )}
                                                            </TableCell>
                                                            <TableCell></TableCell>
                                                            <TableCell className="text-right text-xs text-emerald-600 dark:text-emerald-400">
                                                                {formatCurrency(
                                                                    dept
                                                                        .subtotals
                                                                        ?.total_amount ||
                                                                        0,
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Grand total */}
                                <div className="border-2 border-slate-800 dark:border-slate-200 rounded-lg overflow-hidden">
                                    <div className="bg-slate-900 dark:bg-slate-950 text-white px-4 py-2 text-center font-bold text-sm tracking-wide">
                                        GRAND TOTAL
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 text-center bg-slate-50 dark:bg-slate-800">
                                        <div>
                                            <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400">
                                                Premium
                                            </p>
                                            <p className="text-sm font-bold">
                                                {formatNumber(
                                                    grandTotals.premium_liters,
                                                )}{" "}
                                                L
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400">
                                                Diesel
                                            </p>
                                            <p className="text-sm font-bold">
                                                {formatNumber(
                                                    grandTotals.diesel_liters,
                                                )}{" "}
                                                L
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400">
                                                Regular
                                            </p>
                                            <p className="text-sm font-bold">
                                                {formatNumber(
                                                    grandTotals.regular_liters,
                                                )}{" "}
                                                L
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400">
                                                Total Quantity
                                            </p>
                                            <p className="text-sm font-bold">
                                                {formatNumber(
                                                    grandTotals.total_liters,
                                                )}{" "}
                                                L
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400">
                                                Total Amount
                                            </p>
                                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                {formatCurrency(
                                                    grandTotals.total_amount,
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>
        );
    };

    // ============================================================
    // LOADING STATE
    // ============================================================

    const isLoading =
        (expandedSections.fuelReceipt && receiptLoading && !receiptData) ||
        (expandedSections.budgetUtilization &&
            budgetLoading &&
            !budgetData) ||
        (expandedSections.reconciliation &&
            reconciliationLoading &&
            !reconciliationData) ||
        (expandedSections.billingStatement && billingLoading && !billingData);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-96">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                        <Loader2 className="h-8 w-8 text-white animate-spin" />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 font-medium">
                        Loading reports...
                    </p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        Please wait while we fetch your data
                    </p>
                </div>
            </div>
        );
    }

    // ============================================================
    // MAIN RENDER
    // ============================================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="space-y-6 p-4 md:p-6 print:p-4">
                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate("/mo/dashboard")}
                            className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                                <FileText className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                                    Disbursing Officer Reports
                                </h1>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {connectionStatus}
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

                {/* ALL REPORTS */}
                <div className="space-y-6">
                    {renderFuelReceipt()}
                    {renderBudgetUtilization()}
                    {renderReconciliation()}
                    {renderBillingStatement()}
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-700 print:block hidden">
                    <p>
                        Generated on {format(new Date(), "MMMM d, yyyy h:mm a")}
                    </p>
                    <p>
                        FCMS - Fuel Consumption Monitoring System • Laguindingan
                        Municipality
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MayorReports;
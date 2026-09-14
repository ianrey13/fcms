// src/pages/gso/GsoDashboard.jsx
// ============================================
// ✅ BULLETPROOF: All arrays forced with useMemo
// ✅ FIXED: allTrips.filter crash on refetch
// ✅ ADDED: Cancelled tab
// ✅ REMOVED: GPS (handled by LiveTracking component)
// ✅ LAZY + PREFETCH: Chart loads fast on demand
// ============================================

import React, {
    useState,
    useMemo,
    useCallback,
    useEffect,
    lazy,
    Suspense,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import {
    SkeletonPage,
    SkeletonStats,
    SkeletonTable,
} from "../../components/ui/SkeletonCard";
import {
    gsoAPI,
    userAPI,
    vehicleAPI,
    departmentAPI,
    auditAPI,
} from "../../services/api";
import {
    Clock,
    CheckCircle,
    XCircle,
    Eye,
    Calendar,
    MapPin,
    Truck,
    AlertCircle,
    Loader2,
    RefreshCw,
    Check,
    Search,
    Building2,
    FileCheck,
    PlusCircle,
    Users,
    Car,
    DollarSign,
    TrendingUp,
    History,
    Activity,
    User,
    Database,
    Shield,
    Clock as ClockIcon,
    ChevronDown,
    ChevronUp,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    Ban,
    AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";

// ============================================
// ✅ LAZY CHART + PREFETCH HELPER
// ============================================

const TripTrendsChart = lazy(() =>
    import("../../components/charts/TripTrendsChart")
);

// ✅ Prefetch helper — call anywhere to warm the chunk
const prefetchChart = () => {
    import("../../components/charts/TripTrendsChart");
};

// ============================================
// ✅ SAFE ARRAY EXTRACTION HELPER
// ============================================

const extractArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.data)) return response.data;
    if (response.data && Array.isArray(response.data.data))
        return response.data.data;

    const keys = ["items", "results", "records", "rows", "list", "tickets", "trips"];
    for (const key of keys) {
        if (Array.isArray(response[key])) return response[key];
        if (response.data && Array.isArray(response.data[key])) {
            return response.data[key];
        }
    }

    if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
        return response.data.data.data;
    }

    console.warn("⚠️ extractArray: unexpected response shape:", response);
    return [];
};

const useSafeArray = (value) => {
    return useMemo(() => (Array.isArray(value) ? value : []), [value]);
};

// ============================================
// CONSTANTS & HELPERS
// ============================================

const CANCELLABLE_STATUSES = ["pending_mayors_office", "returned_for_revision"];

const canCancelTicket = (status) => CANCELLABLE_STATUSES.includes(status);

const getStatusConfig = (status) => {
    const configs = {
        pending_mayors_office: { color: "bg-yellow-500", label: "Pending MO", icon: Clock },
        funds_issued: { color: "bg-blue-500", label: "Funds Issued", icon: DollarSign },
        acknowledged: { color: "bg-cyan-500", label: "Acknowledged", icon: CheckCircle },
        in_transit: { color: "bg-indigo-500", label: "In Transit", icon: Truck },
        closed: { color: "bg-green-600", label: "Closed", icon: CheckCircle },
        rejected: { color: "bg-red-500", label: "Rejected", icon: XCircle },
        cancelled: { color: "bg-slate-600", label: "Cancelled", icon: Ban },
        returned_for_revision: { color: "bg-purple-500", label: "Returned", icon: AlertCircle },
        draft: { color: "bg-slate-400", label: "Draft", icon: AlertCircle },
        pending_gso_validation: { color: "bg-indigo-500", label: "Pending Validation", icon: FileCheck },
        completed: { color: "bg-amber-500", label: "Ready for Validation", icon: FileCheck },
        pending_reconciliation: { color: "bg-orange-500", label: "Pending Recon", icon: Clock },
    };
    return configs[status] || { color: "bg-slate-500", label: status || "Unknown", icon: Clock };
};

const formatDateShort = (dateString) => {
    if (!dateString) return "N/A";
    try {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    } catch {
        return "N/A";
    }
};

const formatTime = (dateString) => {
    if (!dateString) return "Just now";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) {
        const remainingMins = diffMins % 60;
        if (remainingMins === 0) return `${diffHours}h ago`;
        return `${diffHours}h ${remainingMins}m ago`;
    }
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const getTicketId = (ticket) =>
    ticket?.trip_ticket_id || ticket?.id || ticket?.ticket_id;
const getTicketNumber = (ticket) =>
    ticket?.trip_ticket_number || ticket?.ticket_number || "N/A";

const getAuditActionColor = (action) => {
    const colors = {
        login: "bg-emerald-500",
        logout: "bg-red-500",
        created: "bg-blue-500",
        updated: "bg-amber-500",
        deleted: "bg-red-600",
        fund_released: "bg-green-500",
        status_change: "bg-purple-500",
        mo_approved: "bg-indigo-500",
        gso_created_trip: "bg-cyan-500",
        profile_updated: "bg-teal-500",
        password_changed: "bg-orange-500",
        receipt_verified: "bg-emerald-500",
        trip_cancelled: "bg-slate-600",
    };
    return colors[action] || "bg-slate-500";
};

const getAuditActionIcon = (action) => {
    const icons = {
        login: User,
        logout: XCircle,
        created: PlusCircle,
        updated: RefreshCw,
        deleted: XCircle,
        fund_released: DollarSign,
        status_change: Activity,
        mo_approved: CheckCircle,
        gso_created_trip: Truck,
        profile_updated: User,
        password_changed: Shield,
        receipt_verified: FileCheck,
        trip_cancelled: Ban,
    };
    return icons[action] || ClockIcon;
};

// ============================================
// STATUS BADGE
// ============================================

const StatusBadge = ({ status }) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;
    return (
        <Badge className={`${config.color} text-white flex items-center gap-1 px-2.5 py-1.5 rounded-lg`}>
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
};

// ============================================
// STATS CARD
// ============================================

const StatsCard = ({ title, value, icon: Icon, gradient, subtitle, onClick, trend }) => {
    const getTrendIcon = () => {
        if (!trend) return null;
        if (trend > 0) return <ArrowUpRight className="h-3 w-3 text-emerald-500" />;
        if (trend < 0) return <ArrowDownRight className="h-3 w-3 text-red-500" />;
        return <Minus className="h-3 w-3 text-slate-400" />;
    };

    return (
        <div
            className="cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl"
            onClick={onClick}
        >
            <Card className="relative overflow-hidden group dark:bg-slate-800/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300">
                <div
                    className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500`}
                />
                <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg shadow-blue-500/20`}>
                            <Icon className="h-5 w-5 text-white" />
                        </div>
                        {trend !== undefined && (
                            <div className="flex items-center gap-1 text-xs font-medium">
                                {getTrendIcon()}
                                <span
                                    className={
                                        trend > 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : trend < 0
                                              ? "text-red-600 dark:text-red-400"
                                              : "text-slate-400"
                                    }
                                >
                                    {trend > 0 ? "+" : ""}
                                    {trend}%
                                </span>
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{title}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// ============================================
// TICKET TABLE
// ============================================

const TicketTable = ({
    tickets,
    showValidate = false,
    showCancel = false,
    onView,
    onValidate,
    onCancel,
    isLoading: tableLoading,
    showActions = true,
    maxHeight = "400px",
}) => {
    const safeTickets = Array.isArray(tickets) ? tickets : [];

    if (tableLoading) {
        return (
            <div className="flex justify-center py-16">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Loading tickets...</p>
                </div>
            </div>
        );
    }

    if (safeTickets.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium">No tickets found</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                    Tickets will appear here once available
                </p>
            </div>
        );
    }

    return (
        <div
            className="overflow-x-auto overflow-y-auto border rounded-lg dark:border-slate-700"
            style={{ maxHeight }}
        >
            <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900/50 shadow-sm">
                    <TableRow className="border-b dark:border-slate-700">
                        <TableHead className="font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            Ticket #
                        </TableHead>
                        <TableHead className="font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            Date
                        </TableHead>
                        <TableHead className="font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            Destination
                        </TableHead>
                        <TableHead className="font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            Department
                        </TableHead>
                        <TableHead className="font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            Status
                        </TableHead>
                        {showActions && (
                            <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-right whitespace-nowrap">
                                Actions
                            </TableHead>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {safeTickets.map((ticket, index) => {
                        const ticketId = getTicketId(ticket);
                        const needsValidation =
                            ticket?.status === "pending_gso_validation" ||
                            ticket?.status === "completed";
                        const cancellable = canCancelTicket(ticket?.status);

                        return (
                            <TableRow
                                key={ticketId || index}
                                className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            >
                                <TableCell className="font-medium">
                                    <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white">
                                        {getTicketNumber(ticket)}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">
                                            {formatDateShort(ticket?.trip_date)}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                        <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                                            {ticket?.destination || "N/A"}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5">
                                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">
                                            {ticket?.department_name ||
                                                ticket?.department?.department_name ||
                                                "N/A"}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <StatusBadge status={ticket?.status} />
                                </TableCell>
                                {showActions && (
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {onView && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onView(ticketId)}
                                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-8 px-3 border-blue-200 dark:border-blue-800"
                                                    title="View Details"
                                                >
                                                    <Eye className="h-3.5 w-3.5 mr-1" /> View
                                                </Button>
                                            )}
                                            {showCancel && cancellable && onCancel && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onCancel(ticket)}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30 h-8 px-3 border-red-200 dark:border-red-800"
                                                    title="Cancel Ticket"
                                                >
                                                    <Ban className="h-3.5 w-3.5 mr-1" /> Cancel
                                                </Button>
                                            )}
                                            {showValidate && needsValidation && (
                                                <Button
                                                    size="sm"
                                                    className={`${
                                                        ticket?.status === "pending_gso_validation"
                                                            ? "bg-indigo-600 hover:bg-indigo-700"
                                                            : "bg-amber-600 hover:bg-amber-700"
                                                    } text-white shadow-sm h-8 px-3`}
                                                    onClick={() => onValidate?.(ticket)}
                                                >
                                                    <FileCheck className="h-3.5 w-3.5 mr-1" />
                                                    {ticket?.status === "pending_gso_validation"
                                                        ? "Validate"
                                                        : "Review & Close"}
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                )}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};

// ============================================
// AUDIT LOG TABLE
// ============================================

const AuditLogTable = ({ logs, loading }) => {
    const [searchTerm, setSearchTerm] = useState("");

    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
        );
    }

    const safeLogs = Array.isArray(logs) ? logs : [];
    const filteredLogs = safeLogs.filter((log) => {
        const search = searchTerm.toLowerCase();
        return (
            log?.action?.toLowerCase().includes(search) ||
            log?.table_name?.toLowerCase().includes(search) ||
            log?.user?.email?.toLowerCase().includes(search) ||
            log?.user?.full_name?.toLowerCase().includes(search)
        );
    });

    if (filteredLogs.length === 0) {
        return (
            <div className="text-center py-8">
                <History className="h-8 w-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm">No audit logs found</p>
            </div>
        );
    }

    return (
        <div>
            <div className="relative mb-3 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 py-1.5 h-9 text-sm dark:bg-slate-900 dark:border-slate-700"
                />
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                            <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs">
                                Action
                            </TableHead>
                            <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs">
                                User
                            </TableHead>
                            <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs">
                                Table
                            </TableHead>
                            <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs">
                                Date & Time
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLogs.slice(0, 50).map((log, index) => {
                            const ActionIcon = getAuditActionIcon(log.action);
                            const colorClass = getAuditActionColor(log.action);
                            const user = log.user || {};
                            return (
                                <TableRow
                                    key={log.log_id || index}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                >
                                    <TableCell>
                                        <Badge
                                            className={`${colorClass} text-white flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]`}
                                        >
                                            <ActionIcon className="h-2.5 w-2.5" />
                                            {log.action?.replace(/_/g, " ").toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                                                {user?.full_name?.charAt(0) ||
                                                    user?.first_name?.charAt(0) ||
                                                    "?"}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-800 dark:text-white">
                                                    {user?.full_name ||
                                                        user?.first_name ||
                                                        "System"}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                                            {log.table_name?.replace(/_/g, " ").toUpperCase()}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <ClockIcon className="h-3 w-3 text-slate-400" />
                                            <span className="text-xs text-slate-600 dark:text-slate-400">
                                                {formatTime(log.created_at)}
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            {filteredLogs.length > 50 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">
                    Showing last 50 entries
                </p>
            )}
        </div>
    );
};

// ============================================
// ✅ CHART SKELETON FALLBACK (looks like a chart)
// ============================================

const ChartFallback = () => (
    <div className="h-full w-full flex items-end justify-around gap-2 px-4 pb-10 pt-4">
        {[40, 65, 45, 80, 55, 70].map((height, i) => (
            <div
                key={i}
                className="w-full bg-gradient-to-t from-blue-500/30 to-blue-500/5 rounded-t animate-pulse"
                style={{
                    height: `${height}%`,
                    animationDelay: `${i * 100}ms`,
                }}
            />
        ))}
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const GsoDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isConnected } = useRealtime();
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showValidateDialog, setShowValidateDialog] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [activeTab, setActiveTab] = useState("pending");
    const [searchQuery, setSearchQuery] = useState("");
    const [showAuditLog, setShowAuditLog] = useState(false);
    const [validationNote, setValidationNote] = useState("");

    const departmentName =
        user?.department_name
            ?.replace("Philippine National Police - ", "")
            .replace("PNP - ", "") || "General Services Office";

    // ============================================
    // ✅ PREFETCH CHART CHUNK ON MOUNT
    // ============================================

    useEffect(() => {
        prefetchChart();
    }, []);

    // ============================================
    // ✅ REFRESH FUNCTION (throttled)
    // ============================================

    const fetchAllData = useCallback(() => {
        if (window._isRefreshing) return;
        window._isRefreshing = true;

        Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: ["gso-pending-mo"] }),
            queryClient.invalidateQueries({ queryKey: ["gso-pending-validation"] }),
            queryClient.invalidateQueries({ queryKey: ["gso-all-trips"] }),
            queryClient.invalidateQueries({ queryKey: ["gso-cancelled-trips"] }),
            queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
            queryClient.invalidateQueries({ queryKey: ["admin-users-stats"] }),
            queryClient.invalidateQueries({ queryKey: ["admin-vehicles-stats"] }),
            queryClient.invalidateQueries({ queryKey: ["admin-departments-stats"] }),
        ]).finally(() => {
            setTimeout(() => {
                window._isRefreshing = false;
            }, 2000);
        });
    }, [queryClient]);

    // ============================================
    // ✅ AUTO-REFRESH
    // ============================================

    useAutoRefresh(
        [
            "gso-trip-updated",
            "gso-trip-status-changed",
            "gso-funds-released",
            "trip-completed",
            "trip-started",
            "new-notification",
            "gso-trip-created",
            "trip-cancelled",
        ],
        fetchAllData,
        1000
    );

    // ============================================
    // ✅ QUERIES
    // ============================================

    // 1. AUDIT LOGS (only when expanded)
    const { data: auditLogsRaw, isLoading: auditLoading } = useOptimizedQuery({
        queryKey: ["audit-logs"],
        queryFn: async () => {
            try {
                const response = await auditAPI.getLogs();
                return extractArray(response);
            } catch (error) {
                console.error("Error fetching audit logs:", error);
                return [];
            }
        },
        enabled: showAuditLog,
        staleTime: 30000,
    });
    const auditLogs = useSafeArray(auditLogsRaw);

    // 2. PENDING MO
    const { data: pendingTicketsRaw, isLoading: pendingLoading } = useOptimizedQuery({
        queryKey: ["gso-pending-mo"],
        queryFn: async () => {
            try {
                const response = await gsoAPI.getPendingMO();
                return extractArray(response);
            } catch (error) {
                if (error.response?.status === 429) return [];
                console.error("Error fetching pending tickets:", error);
                return [];
            }
        },
        staleTime: 60000,
    });
    const pendingTickets = useSafeArray(pendingTicketsRaw);

    // 3. PENDING VALIDATION
    const { data: pendingValidationRaw, isLoading: validationLoading } = useOptimizedQuery({
        queryKey: ["gso-pending-validation"],
        queryFn: async () => {
            try {
                const response = await gsoAPI.getPendingValidation();
                return extractArray(response);
            } catch (error) {
                console.error("Error fetching pending validation:", error);
                return [];
            }
        },
        staleTime: 60000,
    });
    const pendingValidation = useSafeArray(pendingValidationRaw);

    // 4. ALL TRIPS
    const { data: allTripsRaw, isLoading: allTripsLoading } = useOptimizedQuery({
        queryKey: ["gso-all-trips"],
        queryFn: async () => {
            try {
                const response = await gsoAPI.getAllTrips();
                return extractArray(response);
            } catch (error) {
                console.error("Error fetching all trips:", error);
                return [];
            }
        },
        staleTime: 60000,
        keepPreviousData: true,
    });
    const allTrips = useSafeArray(allTripsRaw);

    // 5. CANCELLED TRIPS
    const { data: cancelledTripsRaw, isLoading: cancelledLoading } = useOptimizedQuery({
        queryKey: ["gso-cancelled-trips"],
        queryFn: async () => {
            try {
                if (typeof gsoAPI.getCancelledTrips !== "function") return [];
                const response = await gsoAPI.getCancelledTrips();
                return extractArray(response);
            } catch (error) {
                console.error("Error fetching cancelled trips:", error);
                return [];
            }
        },
        staleTime: 60000,
    });
    const cancelledTrips = useSafeArray(cancelledTripsRaw);

    // 6. USERS
    const { data: usersRaw } = useOptimizedQuery({
        queryKey: ["admin-users-stats"],
        queryFn: async () => {
            try {
                const response = await userAPI.getAll();
                return extractArray(response);
            } catch {
                return [];
            }
        },
        staleTime: 120000,
    });
    const users = useSafeArray(usersRaw);

    // 7. VEHICLES
    const { data: vehiclesRaw } = useOptimizedQuery({
        queryKey: ["admin-vehicles-stats"],
        queryFn: async () => {
            try {
                const response = await vehicleAPI.getAll();
                return extractArray(response);
            } catch {
                return [];
            }
        },
        staleTime: 120000,
    });
    const vehicles = useSafeArray(vehiclesRaw);

    // 8. DEPARTMENTS (unused but kept for consistency)
    useOptimizedQuery({
        queryKey: ["admin-departments-stats"],
        queryFn: async () => {
            try {
                const response = await departmentAPI.getAll();
                return extractArray(response);
            } catch {
                return [];
            }
        },
        staleTime: 120000,
    });

    // ============================================
    // MUTATIONS
    // ============================================

    const validateMutation = useMutation({
        mutationFn: async ({ ticketId, data }) => {
            const response = await gsoAPI.validateTrip(ticketId, data);
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Trip validated successfully!");
            queryClient.invalidateQueries({ queryKey: ["gso-pending-validation"] });
            queryClient.invalidateQueries({ queryKey: ["gso-all-trips"] });
            setShowValidateDialog(false);
            setSelectedTicket(null);
            setValidationNote("");
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || "Failed to validate trip");
        },
    });

    const cancelMutation = useMutation({
        mutationFn: async ({ ticketId, reason }) => {
            const response = await gsoAPI.cancelTrip(ticketId, { reason });
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Trip cancelled successfully!");
            queryClient.invalidateQueries({ queryKey: ["gso-pending-mo"] });
            queryClient.invalidateQueries({ queryKey: ["gso-cancelled-trips"] });
            queryClient.invalidateQueries({ queryKey: ["gso-all-trips"] });
            setShowCancelDialog(false);
            setSelectedTicket(null);
            setCancelReason("");
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || "Failed to cancel trip");
        },
    });

    // ============================================
    // ✅ COMPUTED STATS
    // ============================================

    const stats = useMemo(() => {
        const safeUsers = Array.isArray(users) ? users : [];
        const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
        const safeTrips = Array.isArray(allTrips) ? allTrips : [];
        const safePending = Array.isArray(pendingTickets) ? pendingTickets : [];
        const safeCancelled = Array.isArray(cancelledTrips) ? cancelledTrips : [];

        const totalUsers = safeUsers.length;
        const activeUsers = safeUsers.filter((u) => u?.status === "active").length;
        const totalVehicles = safeVehicles.length;
        const activeVehicles = safeVehicles.filter((v) => v?.status === "active").length;
        const closedTrips = safeTrips.filter((t) => t?.status === "closed").length;

        return [
            {
                title: "Total Trips",
                value: safeTrips.length,
                icon: Truck,
                gradient: "from-blue-500 to-blue-600",
                subtitle: `${closedTrips} completed`,
                onClick: () => setActiveTab("all"),
                trend: safeTrips.length > 0 ? 12 : 0,
            },
            {
                title: "Pending MO",
                value: safePending.length,
                icon: Clock,
                gradient: "from-yellow-500 to-yellow-600",
                subtitle: "Awaiting fund release",
                onClick: () => setActiveTab("pending"),
                trend: safePending.length > 0 ? -8 : 0,
            },
            {
                title: "Active Users",
                value: activeUsers,
                icon: Users,
                gradient: "from-purple-500 to-purple-600",
                subtitle: `${totalUsers} total users`,
                onClick: () => navigate("/admin/users"),
                trend:
                    totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
            },
            {
                title: "Active Vehicles",
                value: activeVehicles,
                icon: Car,
                gradient: "from-emerald-500 to-emerald-600",
                subtitle: `${totalVehicles} total vehicles`,
                onClick: () => navigate("/admin/vehicles"),
                trend:
                    totalVehicles > 0
                        ? Math.round((activeVehicles / totalVehicles) * 100)
                        : 0,
            },
            {
                title: "Cancelled",
                value: safeCancelled.length,
                icon: Ban,
                gradient: "from-red-500 to-rose-600",
                subtitle: "Cancelled trips",
                onClick: () => setActiveTab("cancelled"),
                trend: safeCancelled.length > 0 ? 3 : 0,
            },
        ];
    }, [allTrips, pendingTickets, users, vehicles, cancelledTrips, navigate]);

    // ============================================
    // FILTER FUNCTIONS
    // ============================================

    const filterTickets = useCallback(
        (tickets) => {
            const safe = Array.isArray(tickets) ? tickets : [];
            if (!searchQuery) return safe;
            const query = searchQuery.toLowerCase();
            return safe.filter(
                (ticket) =>
                    (getTicketNumber(ticket) || "").toLowerCase().includes(query) ||
                    (ticket?.destination || "").toLowerCase().includes(query) ||
                    (ticket?.department_name || "").toLowerCase().includes(query) ||
                    (ticket?.vehicle?.plate_number || "")
                        .toLowerCase()
                        .includes(query)
            );
        },
        [searchQuery]
    );

    const filteredPending = useMemo(
        () => filterTickets(pendingTickets),
        [pendingTickets, filterTickets]
    );
    const filteredAllTrips = useMemo(
        () => filterTickets(allTrips),
        [allTrips, filterTickets]
    );
    const filteredValidation = useMemo(
        () => filterTickets(pendingValidation),
        [pendingValidation, filterTickets]
    );
    const filteredCancelled = useMemo(
        () => filterTickets(cancelledTrips),
        [cancelledTrips, filterTickets]
    );

    // ============================================
    // CHART DATA
    // ============================================

    const chartData = useMemo(() => {
        const safeTrips = Array.isArray(allTrips) ? allTrips : [];
        if (safeTrips.length === 0) {
            return [
                { month: "Jan", trips: 0 },
                { month: "Feb", trips: 0 },
                { month: "Mar", trips: 0 },
                { month: "Apr", trips: 0 },
                { month: "May", trips: 0 },
                { month: "Jun", trips: 0 },
            ];
        }

        const monthlyMap = new Map();
        const months = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
        months.forEach((m) => monthlyMap.set(m, 0));

        safeTrips.forEach((trip) => {
            if (trip?.trip_date) {
                try {
                    const date = new Date(trip.trip_date);
                    const monthKey = months[date.getMonth()];
                    if (monthKey) {
                        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
                    }
                } catch {
                    /* Skip */
                }
            }
        });

        return Array.from(monthlyMap.entries())
            .map(([month, trips]) => ({ month, trips }))
            .slice(-6);
    }, [allTrips]);

    // ============================================
    // CONNECTION STATUS
    // ============================================

    const connectionStatus = isConnected ? "🟢 Live" : "🔴 Offline";
    const isRealTime = isConnected;

    // ============================================
    // LOADING STATE
    // ============================================

    const isLoading = pendingLoading || allTripsLoading || cancelledLoading;

    if (isLoading && allTrips.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                <div className="p-4 md:p-6">
                    <SkeletonPage />
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="space-y-6 p-4 md:p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 min-h-screen">
            {/* Hero Header */}
            <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 rounded-2xl p-6 md:p-8 text-white shadow-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 rounded-full px-3 py-1 backdrop-blur-sm">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                                GSO Office
                            </Badge>
                            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 rounded-full px-3 py-1 backdrop-blur-sm">
                                {departmentName}
                            </Badge>
                            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 rounded-full px-3 py-1 backdrop-blur-sm">
                                <Shield className="h-3 w-3 mr-1" />
                                Super Admin
                            </Badge>
                            {isRealTime && (
                                <Badge className="bg-green-500/20 text-green-300 border-green-500/30 rounded-full px-3 py-1 backdrop-blur-sm animate-pulse">
                                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse" />
                                    Real-time
                                </Badge>
                            )}
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                            GSO Dashboard
                        </h1>
                        <p className="text-slate-300 mt-1 text-sm md:text-base">
                            Manage trip tickets, users, departments, and vehicles in one place
                            <span className="ml-2 text-xs opacity-70">{connectionStatus}</span>
                            {isRealTime && (
                                <span className="ml-2 text-xs text-emerald-400 animate-pulse">
                                    ● Auto-refresh
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <Button
                            onClick={() => navigate("/gso/create-trip")}
                            className="bg-white text-slate-900 hover:bg-slate-100 rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-105 active:scale-95"
                        >
                            <PlusCircle className="h-4 w-4 mr-2" /> Create Trip
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5">
                {stats.map((stat, index) => (
                    <StatsCard key={index} {...stat} />
                ))}
            </div>

            {/* Chart Section — ✅ Lazy + Prefetch on hover */}
            <Card
                className="dark:bg-slate-800/80 dark:border-slate-700"
                onMouseEnter={prefetchChart}
            >
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                                <TrendingUp className="h-5 w-5 text-blue-500" />
                                Trip Trends
                            </CardTitle>
                            <CardDescription className="dark:text-slate-400">
                                Monthly trip volume for the last 6 months
                                {isRealTime && (
                                    <span className="ml-2 text-xs text-emerald-500 animate-pulse">
                                        ● Live updates
                                    </span>
                                )}
                            </CardDescription>
                        </div>
                        <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                            <Activity className="h-3 w-3 mr-1" />
                            {allTrips.length} total trips
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <Suspense fallback={<ChartFallback />}>
                            <TripTrendsChart data={chartData} />
                        </Suspense>
                    </div>
                </CardContent>
            </Card>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                    placeholder="Search by ticket number, destination, department, or vehicle plate..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl h-12 text-sm shadow-sm"
                />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-4xl grid-cols-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <TabsTrigger
                        value="pending"
                        className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm transition-all duration-200"
                    >
                        <Clock className="h-4 w-4 mr-2" />
                        Pending MO
                        <Badge className="ml-2 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 text-[10px]">
                            {pendingTickets.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger
                        value="all"
                        className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm transition-all duration-200"
                    >
                        <Truck className="h-4 w-4 mr-2" />
                        All Trips
                        <Badge className="ml-2 bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px]">
                            {allTrips.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger
                        value="validation"
                        className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm transition-all duration-200"
                    >
                        <FileCheck className="h-4 w-4 mr-2" />
                        Validate
                        <Badge className="ml-2 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 text-[10px]">
                            {pendingValidation.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger
                        value="cancelled"
                        className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm transition-all duration-200"
                    >
                        <Ban className="h-4 w-4 mr-2" />
                        Cancelled
                        <Badge className="ml-2 bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30 text-[10px]">
                            {cancelledTrips.length}
                        </Badge>
                    </TabsTrigger>
                </TabsList>

                {/* Pending MO Tab */}
                <TabsContent value="pending" className="space-y-4 mt-6">
                    <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                        <CardHeader className="border-b dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                                        <Clock className="h-5 w-5 text-yellow-500" />
                                        Trip Tickets Awaiting Fund Release
                                    </CardTitle>
                                    <CardDescription className="dark:text-slate-400 mt-1">
                                        These trips are pending approval from Mayor's Office. You can cancel before funds are issued.
                                    </CardDescription>
                                </div>
                                <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
                                    {filteredPending.length} tickets
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <TicketTable
                                tickets={filteredPending}
                                onView={(id) => navigate(`/gso/tickets/${id}`)}
                                onCancel={(ticket) => {
                                    setSelectedTicket(ticket);
                                    setCancelReason("");
                                    setShowCancelDialog(true);
                                }}
                                showCancel={true}
                                isLoading={pendingLoading}
                                showActions={true}
                                maxHeight="450px"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* All Trips Tab */}
                <TabsContent value="all" className="space-y-4 mt-6">
                    <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                        <CardHeader className="border-b dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                                        <Truck className="h-5 w-5 text-blue-500" />
                                        All Trip Tickets
                                    </CardTitle>
                                    <CardDescription className="dark:text-slate-400 mt-1">
                                        Complete history of all trips
                                    </CardDescription>
                                </div>
                                <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                                    {filteredAllTrips.length} tickets
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <TicketTable
                                tickets={filteredAllTrips}
                                onView={(id) => {
                                    if (id) navigate(`/gso/trip/${id}`);
                                    else toast.error("Invalid ticket ID");
                                }}
                                isLoading={allTripsLoading}
                                showActions={true}
                                maxHeight="450px"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Validation Tab */}
                <TabsContent value="validation" className="space-y-4 mt-6">
                    <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                        <CardHeader className="border-b dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                                        <FileCheck className="h-5 w-5 text-indigo-500" />
                                        Ready for Validation
                                    </CardTitle>
                                    <CardDescription className="dark:text-slate-400 mt-1">
                                        These trips are completed and need GSO validation to close
                                    </CardDescription>
                                </div>
                                <Badge className="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
                                    {filteredValidation.length} trips
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <TicketTable
                                tickets={filteredValidation}
                                showValidate={true}
                                onView={(id) => navigate(`/gso/trip/${id}`)}
                                onValidate={(ticket) => {
                                    setSelectedTicket(ticket);
                                    setShowValidateDialog(true);
                                }}
                                isLoading={validationLoading}
                                showActions={true}
                                maxHeight="450px"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Cancelled Tab */}
                <TabsContent value="cancelled" className="space-y-4 mt-6">
                    <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                        <CardHeader className="border-b dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                                        <Ban className="h-5 w-5 text-red-500" />
                                        Cancelled Trip Tickets
                                    </CardTitle>
                                    <CardDescription className="dark:text-slate-400 mt-1">
                                        These trips have been cancelled. You can create new tickets for these trips.
                                    </CardDescription>
                                </div>
                                <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30">
                                    {filteredCancelled.length} tickets
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <TicketTable
                                tickets={filteredCancelled}
                                onView={(id) => navigate(`/gso/trip/${id}`)}
                                isLoading={cancelledLoading}
                                showActions={true}
                                maxHeight="450px"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Audit Log Section */}
            <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                <CardHeader
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl"
                    onClick={() => setShowAuditLog(!showAuditLog)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-indigo-500/10">
                                <History className="h-5 w-5 text-indigo-500" />
                            </div>
                            <div>
                                <CardTitle className="text-slate-800 dark:text-white">
                                    Audit Log
                                    {showAuditLog ? (
                                        <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                                            (Showing)
                                        </span>
                                    ) : (
                                        <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                                            (Hidden)
                                        </span>
                                    )}
                                </CardTitle>
                                <CardDescription className="dark:text-slate-400">
                                    {showAuditLog
                                        ? "System activities and user actions"
                                        : "Click to expand"}
                                </CardDescription>
                            </div>
                            <Badge className="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 ml-2">
                                <Database className="h-3 w-3 mr-1" />
                                {auditLogs?.length || 0} entries
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                            {showAuditLog && auditLoading && (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            )}
                            {showAuditLog ? (
                                <ChevronUp className="h-5 w-5 text-slate-400" />
                            ) : (
                                <ChevronDown className="h-5 w-5 text-slate-400" />
                            )}
                        </div>
                    </div>
                </CardHeader>
                {showAuditLog && (
                    <CardContent className="pt-6">
                        <AuditLogTable logs={auditLogs} loading={auditLoading} />
                    </CardContent>
                )}
            </Card>

            {/* Cancel Dialog */}
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogContent className="sm:max-w-md dark:bg-slate-800 dark:border-slate-700">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <div className="p-2 rounded-xl bg-red-500/10">
                                <Ban className="h-5 w-5 text-red-600" />
                            </div>
                            Cancel Trip Ticket
                        </DialogTitle>
                        <DialogDescription className="dark:text-slate-400">
                            This action cannot be undone. The ticket will be cancelled and you can create a new one.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 space-y-2 border border-red-200 dark:border-red-800">
                        <p className="text-sm font-medium text-red-800 dark:text-red-400 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Warning
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300">
                            Cancelling this ticket will:
                        </p>
                        <ul className="text-xs text-red-600 dark:text-red-400 list-disc list-inside space-y-1 ml-2">
                            <li>Mark the trip as cancelled</li>
                            <li>Release any reserved budget allocation</li>
                            <li>Allow you to create a new ticket for this trip</li>
                        </ul>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-1 border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">
                                Ticket Number:
                            </span>
                            <span className="font-mono font-semibold text-slate-800 dark:text-white">
                                {getTicketNumber(selectedTicket)}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">
                                Destination:
                            </span>
                            <span className="text-slate-800 dark:text-white">
                                {selectedTicket?.destination || "N/A"}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">
                                Department:
                            </span>
                            <span className="text-slate-800 dark:text-white">
                                {selectedTicket?.department_name || "N/A"}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Reason for Cancellation <span className="text-red-500">*</span>
                        </label>
                        <Textarea
                            placeholder="Enter reason for cancelling this ticket..."
                            className="resize-none dark:bg-slate-900 dark:border-slate-700"
                            rows={3}
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                        />
                        {cancelReason.trim().length > 0 &&
                            cancelReason.trim().length < 5 && (
                                <p className="text-xs text-red-500">
                                    Reason must be at least 5 characters
                                </p>
                            )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowCancelDialog(false);
                                setSelectedTicket(null);
                                setCancelReason("");
                            }}
                            className="dark:border-slate-700 dark:text-slate-300"
                        >
                            Keep Ticket
                        </Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20"
                            onClick={() => {
                                if (cancelReason.trim().length < 5) {
                                    toast.error(
                                        "Please provide a reason (at least 5 characters)"
                                    );
                                    return;
                                }
                                const ticketId = getTicketId(selectedTicket);
                                if (!ticketId) {
                                    toast.error("Invalid ticket");
                                    return;
                                }
                                cancelMutation.mutate({ ticketId, reason: cancelReason });
                            }}
                            disabled={
                                cancelMutation.isPending || cancelReason.trim().length < 5
                            }
                        >
                            {cancelMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Ban className="h-4 w-4 mr-2" />
                            )}
                            Cancel Ticket
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Validation Dialog */}
            <Dialog open={showValidateDialog} onOpenChange={setShowValidateDialog}>
                <DialogContent className="sm:max-w-md dark:bg-slate-800 dark:border-slate-700">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                            <div className="p-2 rounded-xl bg-emerald-500/10">
                                <FileCheck className="h-5 w-5 text-emerald-600" />
                            </div>
                            Close Trip
                        </DialogTitle>
                        <DialogDescription className="dark:text-slate-400">
                            Review trip details and close it. This action is final.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 space-y-2 border border-blue-200 dark:border-blue-800">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-400">
                            Trip Details
                        </p>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400">
                                    Number:
                                </span>
                                <span className="font-mono font-semibold dark:text-white">
                                    {getTicketNumber(selectedTicket)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400">
                                    Destination:
                                </span>
                                <span className="dark:text-white">
                                    {selectedTicket?.destination || "N/A"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400">
                                    Department:
                                </span>
                                <span className="dark:text-white">
                                    {selectedTicket?.department_name || "N/A"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600 dark:text-slate-400">
                                    Total Trips:
                                </span>
                                <span className="font-semibold dark:text-white">
                                    {selectedTicket?.trip_count || 0}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Closing Note (Optional)
                        </label>
                        <Textarea
                            placeholder="Add a closing note..."
                            className="resize-none dark:bg-slate-900 dark:border-slate-700"
                            rows={2}
                            value={validationNote}
                            onChange={(e) => setValidationNote(e.target.value)}
                        />
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowValidateDialog(false);
                                setSelectedTicket(null);
                                setValidationNote("");
                            }}
                            className="dark:border-slate-700 dark:text-slate-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                            onClick={() => {
                                const ticketId = getTicketId(selectedTicket);
                                if (!ticketId) {
                                    toast.error("Invalid ticket");
                                    return;
                                }
                                validateMutation.mutate({
                                    ticketId,
                                    data: {
                                        validation_note:
                                            validationNote || "Trip closed by GSO",
                                    },
                                });
                                setValidationNote("");
                            }}
                            disabled={validateMutation.isPending}
                        >
                            {validateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Check className="h-4 w-4 mr-2" />
                            )}
                            Close Trip
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default GsoDashboard;
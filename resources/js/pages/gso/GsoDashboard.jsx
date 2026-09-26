// src/pages/gso/GsoDashboard.jsx
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
import { useQuery } from "@tanstack/react-query";
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
    gpsAPI,
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
    ArrowRight,
    Minus,
    Ban,
    AlertTriangle,
    Fuel,
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
import { cn } from "@/lib/utils";

// ============================================
// ✅ LAZY CHART + PREFETCH HELPER
// ============================================

const TripTrendsChart = lazy(
    () => import("../../components/charts/TripTrendsChart"),
);

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

    const keys = [
        "items",
        "results",
        "records",
        "rows",
        "list",
        "tickets",
        "trips",
        "logs",
        "activities",
        "activity_logs",
    ];
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
        pending_mayors_office: {
            color: "bg-yellow-500",
            label: "Pending MO",
            icon: Clock,
        },
        funds_issued: {
            color: "bg-blue-500",
            label: "Funds Issued",
            icon: DollarSign,
        },
        acknowledged: {
            color: "bg-cyan-500",
            label: "Acknowledged",
            icon: CheckCircle,
        },
        in_transit: {
            color: "bg-indigo-500",
            label: "In Transit",
            icon: Truck,
        },
        closed: { color: "bg-green-600", label: "Closed", icon: CheckCircle },
        rejected: { color: "bg-red-500", label: "Rejected", icon: XCircle },
        cancelled: { color: "bg-slate-600", label: "Cancelled", icon: Ban },
        returned_for_revision: {
            color: "bg-purple-500",
            label: "Returned",
            icon: AlertCircle,
        },
        draft: { color: "bg-slate-400", label: "Draft", icon: AlertCircle },
        pending_gso_validation: {
            color: "bg-indigo-500",
            label: "Pending Validation",
            icon: FileCheck,
        },
        completed: {
            color: "bg-amber-500",
            label: "Ready for Validation",
            icon: FileCheck,
        },
        pending_reconciliation: {
            color: "bg-orange-500",
            label: "Pending Recon",
            icon: Clock,
        },
        pending_gso_ticket: {
            color: "bg-amber-600",
            label: "Pending GSO Ticket",
            icon: Fuel,
        },
    };
    return (
        configs[status] || {
            color: "bg-slate-500",
            label: status || "Unknown",
            icon: Clock,
        }
    );
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

// ============================================
// TIMESTAMP FORMATTER — "23/09/2026, 6:29 PM"
// ============================================

const formatLogTimestamp = (dateString) => {
    if (!dateString) return "";
    try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const time = date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
        return `${day}/${month}/${year}, ${time}`;
    } catch {
        return "";
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
        <Badge
            className={`${config.color} text-white flex items-center gap-1 px-2.5 py-1.5 rounded-lg`}
        >
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
};

// ============================================
// STATS CARD
// ============================================

const StatsCard = ({
    title,
    value,
    icon: Icon,
    gradient,
    subtitle,
    onClick,
    trend,
}) => {
    const getTrendIcon = () => {
        if (!trend) return null;
        if (trend > 0)
            return <ArrowUpRight className="h-3 w-3 text-emerald-500" />;
        if (trend < 0)
            return <ArrowDownRight className="h-3 w-3 text-red-500" />;
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
                        <div
                            className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg shadow-blue-500/20`}
                        >
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
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {value}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {title}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {subtitle}
                        </p>
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
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Loading tickets...
                    </p>
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
                <p className="text-slate-600 dark:text-slate-400 font-medium">
                    No tickets found
                </p>
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
                                                ticket?.department
                                                    ?.department_name ||
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
                                                    onClick={() =>
                                                        onView(ticketId)
                                                    }
                                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-8 px-3 border-blue-200 dark:border-blue-800"
                                                    title="View Details"
                                                >
                                                    <Eye className="h-3.5 w-3.5 mr-1" />{" "}
                                                    View
                                                </Button>
                                            )}
                                            {showCancel &&
                                                cancellable &&
                                                onCancel && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            onCancel(ticket)
                                                        }
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30 h-8 px-3 border-red-200 dark:border-red-800"
                                                        title="Cancel Ticket"
                                                    >
                                                        <Ban className="h-3.5 w-3.5 mr-1" />{" "}
                                                        Cancel
                                                    </Button>
                                                )}
                                            {showValidate &&
                                                needsValidation && (
                                                    <Button
                                                        size="sm"
                                                        className={`${
                                                            ticket?.status ===
                                                            "pending_gso_validation"
                                                                ? "bg-indigo-600 hover:bg-indigo-700"
                                                                : "bg-amber-600 hover:bg-amber-700"
                                                        } text-white shadow-sm h-8 px-3`}
                                                        onClick={() =>
                                                            onValidate?.(ticket)
                                                        }
                                                    >
                                                        <FileCheck className="h-3.5 w-3.5 mr-1" />
                                                        {ticket?.status ===
                                                        "pending_gso_validation"
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
// ✅ CHART SKELETON FALLBACK
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
// ✅ TRIP HISTORY WIDGET
// ============================================

const TripHistoryWidget = ({ isLoading }) => {
    const { data: activityRaw, isLoading: activityLoading } = useOptimizedQuery({
        queryKey: ["gso-activity-logs-trip-widget"],
        queryFn: async () => {
            try {
                const res = await gsoAPI.getActivityLogs();
                const logs = res?.data?.data?.logs || res?.data?.logs || [];
                return Array.isArray(logs) ? logs : [];
            } catch (error) {
                console.error("Error fetching activity logs:", error);
                return [];
            }
        },
        staleTime: 0,
        refetchOnMount: true,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        placeholderData: (prev) => prev,
    });

    const activityLogs = useSafeArray(activityRaw);

    const recent = useMemo(() => {
        const trips = activityLogs.filter(
            (log) => log?.source === "trip_history",
        );
        return trips.slice(0, 5);
    }, [activityLogs]);

    const formatLogText = (log) => {
        const userName = log.user_name || "Unknown User";
        const tripNo = log.trip_number ?? "?";
        const ticket = log.trip_ticket_number || "N/A";
        const vehicle =
            log.vehicle_plate && log.vehicle_plate !== "N/A"
                ? ` (${log.vehicle_plate})`
                : "";
        const dest =
            log.destination && log.destination !== "N/A"
                ? ` (${log.destination})`
                : "";

        if (log.action === "started") {
            return `Driver ${userName} started trip #${tripNo} on ticket ${ticket}${vehicle}${dest}`;
        }
        if (log.action === "completed") {
            const dist =
                log.distance_km != null && log.distance_km > 0
                    ? ` — ${log.distance_km} km`
                    : "";
            return `Driver ${userName} completed trip #${tripNo} on ticket ${ticket}${vehicle}${dist}`;
        }
        return `Driver ${userName} trip #${tripNo} on ticket ${ticket}`;
    };

    const loading = isLoading || activityLoading;

    return (
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader className="border-b dark:border-slate-700 pb-4">
                <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                    <History className="h-5 w-5 text-purple-500" />
                    Trip History
                </CardTitle>
                <CardDescription className="dark:text-slate-400 mt-1">
                    Latest 5 trip events across all departments
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                ) : recent.length === 0 ? (
                    <div className="py-10 text-center">
                        <History className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            No trip activity yet
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {recent.map((log, i) => (
                            <div
                                key={log.id || log.log_id || i}
                                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                            >
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                    <Truck className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                        {formatLogText(log)}
                                    </p>
                                </div>
                                <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                                    {log.created_at
                                        ? formatLogTimestamp(log.created_at)
                                        : "N/A"}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

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
    const [activeTab, setActiveTab] = useState("all");
    const [allTripsFilter, setAllTripsFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [validationNote, setValidationNote] = useState("");

    // ✅ Gas Slip modal state
    const [gasSlipModalTicket, setGasSlipModalTicket] = useState(null);
    const [gasSlipForm, setGasSlipForm] = useState({
        estimated_distance_km: "",
        estimated_fuel_liters: "",
        passenger_name: "",
        validation_note: "",
    });

    const departmentName =
        user?.department_name
            ?.replace("Philippine National Police - ", "")
            .replace("PNP - ", "") || "General Services Office";

    useEffect(() => {
        prefetchChart();
    }, []);

    const fetchAllData = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["gso-pending-mo"] });
        queryClient.invalidateQueries({ queryKey: ["gso-pending-validation"] });
        queryClient.invalidateQueries({ queryKey: ["gso-all-trips"] });
        queryClient.invalidateQueries({ queryKey: ["gso-cancelled-trips"] });
        queryClient.invalidateQueries({ queryKey: ["admin-users-stats"] });
        queryClient.invalidateQueries({ queryKey: ["admin-vehicles-stats"] });
        queryClient.invalidateQueries({ queryKey: ["admin-departments-stats"] });
        queryClient.invalidateQueries({ queryKey: ["gso-activity-logs-trip-widget"] });
        queryClient.invalidateQueries({ queryKey: ["gso-pending-gas-slips"] });
    }, [queryClient]);

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
            "gas-slip-created",
        ],
        fetchAllData,
        1000,
    );

    // ============ QUERIES ============

    const { data: pendingTicketsRaw, isLoading: pendingLoading } =
        useOptimizedQuery({
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
            staleTime: 0,
            refetchOnMount: true,
            refetchOnReconnect: true,
            refetchOnWindowFocus: false,
            placeholderData: (prev) => prev,
        });
    const pendingTickets = useSafeArray(pendingTicketsRaw);

    const { data: pendingValidationRaw, isLoading: validationLoading } =
        useOptimizedQuery({
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
            staleTime: 0,
            refetchOnMount: true,
            refetchOnReconnect: true,
            refetchOnWindowFocus: false,
            placeholderData: (prev) => prev,
        });
    const pendingValidation = useSafeArray(pendingValidationRaw);

    const { data: allTripsRaw, isLoading: allTripsLoading } = useOptimizedQuery(
        {
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
            staleTime: 0,
            refetchOnMount: true,
            refetchOnReconnect: true,
            refetchOnWindowFocus: false,
            placeholderData: (prev) => prev,
        },
    );
    const allTrips = useSafeArray(allTripsRaw);

    const { data: cancelledTripsRaw, isLoading: cancelledLoading } =
        useOptimizedQuery({
            queryKey: ["gso-cancelled-trips"],
            queryFn: async () => {
                try {
                    if (typeof gsoAPI.getCancelledTrips !== "function")
                        return [];
                    const response = await gsoAPI.getCancelledTrips();
                    return extractArray(response);
                } catch (error) {
                    console.error("Error fetching cancelled trips:", error);
                    return [];
                }
            },
            staleTime: 0,
            refetchOnMount: true,
            refetchOnReconnect: true,
            refetchOnWindowFocus: false,
            placeholderData: (prev) => prev,
        });
    const cancelledTrips = useSafeArray(cancelledTripsRaw);

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
        staleTime: 0,
        refetchOnMount: true,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        placeholderData: (prev) => prev,
    });
    const users = useSafeArray(usersRaw);

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
        staleTime: 0,
        refetchOnMount: true,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        placeholderData: (prev) => prev,
    });
    const vehicles = useSafeArray(vehiclesRaw);

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
        staleTime: 0,
        refetchOnMount: true,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        placeholderData: (prev) => prev,
    });

    const { data: activeTrips = [] } = useQuery({
        queryKey: ["gps-active-trips"],
        queryFn: async () => {
            try {
                const res = await gpsAPI.getActiveTrips();
                const data = res.data?.data;
                return Array.isArray(data) ? data : [];
            } catch (err) {
                console.error(err);
                return [];
            }
        },
        refetchInterval: 30000,
    });

    // ✅ Pending Gas Slip tickets
    const { data: pendingGasSlipsRaw, isLoading: gasSlipsLoading } =
        useOptimizedQuery({
            queryKey: ["gso-pending-gas-slips"],
            queryFn: async () => {
                try {
                    const response = await gsoAPI.getPendingGasSlipTickets();
                    return extractArray(response);
                } catch (error) {
                    console.error("Error fetching pending gas slips:", error);
                    return [];
                }
            },
            staleTime: 0,
            refetchOnMount: true,
            refetchOnReconnect: true,
            refetchOnWindowFocus: false,
            placeholderData: (prev) => prev,
        });
    const pendingGasSlips = useSafeArray(pendingGasSlipsRaw);

    // ============ MUTATIONS ============

    const validateMutation = useMutation({
        mutationFn: async ({ ticketId, data }) => {
            const response = await gsoAPI.validateTrip(ticketId, data);
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Trip validated successfully!");
            queryClient.invalidateQueries({
                queryKey: ["gso-pending-validation"],
            });
            queryClient.invalidateQueries({ queryKey: ["gso-all-trips"] });
            setShowValidateDialog(false);
            setSelectedTicket(null);
            setValidationNote("");
        },
        onError: (error) => {
            toast.error(
                error?.response?.data?.message || "Failed to validate trip",
            );
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
            queryClient.invalidateQueries({
                queryKey: ["gso-cancelled-trips"],
            });
            queryClient.invalidateQueries({ queryKey: ["gso-all-trips"] });
            setShowCancelDialog(false);
            setSelectedTicket(null);
            setCancelReason("");
        },
        onError: (error) => {
            toast.error(
                error?.response?.data?.message || "Failed to cancel trip",
            );
        },
    });

    // ✅ Gas Slip completion mutation
    const completeGasSlipMutation = useMutation({
        mutationFn: async ({ ticketId, payload }) => {
            const res = await gsoAPI.completeGasSlipTicket(ticketId, payload);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Gas Slip ticket completed");
            queryClient.invalidateQueries({
                queryKey: ["gso-pending-gas-slips"],
            });
            queryClient.invalidateQueries({ queryKey: ["gso-all-trips"] });
            setGasSlipModalTicket(null);
            setGasSlipForm({
                estimated_distance_km: "",
                estimated_fuel_liters: "",
                passenger_name: "",
                validation_note: "",
            });
        },
        onError: (error) => {
            toast.error(
                error?.response?.data?.message ||
                    "Failed to complete Gas Slip ticket",
            );
        },
    });

    // ============ MERGED ALL TRIPS ============

    const mergedAllTrips = useMemo(() => {
        const map = new Map();

        const addAll = (arr) => {
            (Array.isArray(arr) ? arr : []).forEach((t) => {
                const id = getTicketId(t);
                if (id != null && !map.has(id)) {
                    map.set(id, t);
                }
            });
        };

        addAll(allTrips);
        addAll(pendingTickets);
        addAll(cancelledTrips);

        return Array.from(map.values()).sort((a, b) => {
            const da = new Date(a?.submitted_at || a?.trip_date || 0);
            const db = new Date(b?.submitted_at || b?.trip_date || 0);
            return db - da;
        });
    }, [allTrips, pendingTickets, cancelledTrips]);

    // ============ STATS ============

    const stats = useMemo(() => {
        const safeUsers = Array.isArray(users) ? users : [];
        const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
        const safeTrips = mergedAllTrips;
        const safePending = Array.isArray(pendingTickets) ? pendingTickets : [];
        const safeCancelled = Array.isArray(cancelledTrips)
            ? cancelledTrips
            : [];

        const totalUsers = safeUsers.length;
        const activeUsers = safeUsers.filter(
            (u) => u?.status === "active",
        ).length;
        const totalVehicles = safeVehicles.length;
        const activeVehicles = safeVehicles.filter(
            (v) => v?.status === "active",
        ).length;
        const closedTrips = safeTrips.filter(
            (t) => t?.status === "closed",
        ).length;

        return [
            {
                title: "Total Trips",
                value: safeTrips.length,
                icon: Truck,
                gradient: "from-blue-500 to-blue-600",
                subtitle: `${closedTrips} completed`,
                onClick: () => {
                    setActiveTab("all");
                    setAllTripsFilter("all");
                },
                trend: safeTrips.length > 0 ? 12 : 0,
            },
            {
                title: "Pending MO",
                value: safePending.length,
                icon: Clock,
                gradient: "from-yellow-500 to-yellow-600",
                subtitle: "Awaiting fund release",
                onClick: () => {
                    setActiveTab("all");
                    setAllTripsFilter("pending");
                },
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
                    totalUsers > 0
                        ? Math.round((activeUsers / totalUsers) * 100)
                        : 0,
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
                onClick: () => {
                    setActiveTab("all");
                    setAllTripsFilter("cancelled");
                },
                trend: safeCancelled.length > 0 ? 3 : 0,
            },
        ];
    }, [mergedAllTrips, pendingTickets, users, vehicles, cancelledTrips, navigate]);

    // ============ FILTERS ============

    const filterTickets = useCallback(
        (tickets) => {
            const safe = Array.isArray(tickets) ? tickets : [];
            if (!searchQuery) return safe;
            const query = searchQuery.toLowerCase();
            return safe.filter(
                (ticket) =>
                    (getTicketNumber(ticket) || "")
                        .toLowerCase()
                        .includes(query) ||
                    (ticket?.destination || "").toLowerCase().includes(query) ||
                    (ticket?.department_name || "")
                        .toLowerCase()
                        .includes(query) ||
                    (ticket?.vehicle?.plate_number || "")
                        .toLowerCase()
                        .includes(query),
            );
        },
        [searchQuery],
    );

    const filteredAllTrips = useMemo(() => {
        let list = mergedAllTrips;

        if (allTripsFilter === "pending") {
            list = list.filter(
                (t) =>
                    t?.status === "pending_mayors_office" ||
                    t?.status === "returned_for_revision",
            );
        } else if (allTripsFilter === "validation") {
            list = list.filter(
                (t) =>
                    t?.status === "pending_gso_validation" ||
                    t?.status === "completed",
            );
        } else if (allTripsFilter === "cancelled") {
            list = list.filter((t) => t?.status === "cancelled");
        } else if (allTripsFilter === "in_progress") {
            list = list.filter(
                (t) =>
                    t?.status === "funds_issued" ||
                    t?.status === "acknowledged" ||
                    t?.status === "in_transit",
            );
        }

        return filterTickets(list);
    }, [mergedAllTrips, allTripsFilter, filterTickets]);

    const filteredValidation = useMemo(
        () => filterTickets(pendingValidation),
        [pendingValidation, filterTickets],
    );

    const filterCounts = useMemo(() => {
        const base = mergedAllTrips;
        return {
            all: base.length,
            pending: base.filter(
                (t) =>
                    t?.status === "pending_mayors_office" ||
                    t?.status === "returned_for_revision",
            ).length,
            in_progress: base.filter(
                (t) =>
                    t?.status === "funds_issued" ||
                    t?.status === "acknowledged" ||
                    t?.status === "in_transit",
            ).length,
            validation: base.filter(
                (t) =>
                    t?.status === "pending_gso_validation" ||
                    t?.status === "completed",
            ).length,
            cancelled: base.filter((t) => t?.status === "cancelled").length,
        };
    }, [mergedAllTrips]);

    // ============ CHART DATA ============

    const chartData = useMemo(() => {
        const safeTrips = mergedAllTrips;
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
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ];
        months.forEach((m) => monthlyMap.set(m, 0));

        safeTrips.forEach((trip) => {
            if (trip?.trip_date) {
                try {
                    const date = new Date(trip.trip_date);
                    const monthKey = months[date.getMonth()];
                    if (monthKey) {
                        monthlyMap.set(
                            monthKey,
                            (monthlyMap.get(monthKey) || 0) + 1,
                        );
                    }
                } catch {
                    /* Skip */
                }
            }
        });

        return Array.from(monthlyMap.entries())
            .map(([month, trips]) => ({ month, trips }))
            .slice(-6);
    }, [mergedAllTrips]);

    const connectionStatus = isConnected ? "🟢 Live" : "🔴 Offline";
    const isRealTime = isConnected;

    const isLoading = pendingLoading || allTripsLoading || cancelledLoading;

    if (isLoading && mergedAllTrips.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                <div className="p-4 md:p-6">
                    <SkeletonPage />
                </div>
            </div>
        );
    }

    // ============ FILTER PILLS CONFIG ============

    const FILTER_PILLS = [
        { key: "all", label: "All", count: filterCounts.all },
        { key: "pending", label: "Pending MO", count: filterCounts.pending },
        { key: "in_progress", label: "In Progress", count: filterCounts.in_progress },
        { key: "validation", label: "Ready to Validate", count: filterCounts.validation },
        { key: "cancelled", label: "Cancelled", count: filterCounts.cancelled },
    ];

    // ============ RENDER ============

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
                            Manage trip tickets, users, departments, and
                            vehicles in one place
                            <span className="ml-2 text-xs opacity-70">
                                {connectionStatus}
                            </span>
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

            {/* Chart Section */}
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
                            {mergedAllTrips.length} total trips
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
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div data-tabs-section="true">
                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full"
                >
                    <TabsList className="grid w-full max-w-3xl grid-cols-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <TabsTrigger
                            value="all"
                            className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm transition-all duration-200"
                        >
                            <Truck className="h-4 w-4 mr-2" />
                            All Trips
                            <Badge className="ml-2 bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px]">
                                {filteredAllTrips.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="validation"
                            className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm transition-all duration-200"
                        >
                            <FileCheck className="h-4 w-4 mr-2" />
                            Validate
                            <Badge className="ml-2 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 text-[10px]">
                                {filteredValidation.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="gas-slips"
                            className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm transition-all duration-200"
                        >
                            <Fuel className="h-4 w-4 mr-2" />
                            Pending Gas Slips
                            <Badge className="ml-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
                                {pendingGasSlips.length}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>

                    {/* ============ ALL TRIPS TAB ============ */}
                    <TabsContent value="all" className="space-y-4 mt-6">
                        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                            <CardHeader className="border-b dark:border-slate-700">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                                                <Truck className="h-5 w-5 text-blue-500" />
                                                All Trips
                                            </CardTitle>
                                            <CardDescription className="dark:text-slate-400 mt-1">
                                                Combined view of pending, in-progress, completed, and cancelled trips
                                            </CardDescription>
                                        </div>
                                        <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                                            {filteredAllTrips.length} tickets
                                        </Badge>
                                    </div>

                                    {/* Filter pills */}
                                    <div className="flex flex-wrap gap-2">
                                        {FILTER_PILLS.map((pill) => {
                                            const active = allTripsFilter === pill.key;
                                            return (
                                                <button
                                                    key={pill.key}
                                                    onClick={() => setAllTripsFilter(pill.key)}
                                                    className={cn(
                                                        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all border",
                                                        active
                                                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                                            : "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700/60"
                                                    )}
                                                >
                                                    {pill.label}
                                                    <span
                                                        className={cn(
                                                            "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                                                            active
                                                                ? "bg-white/20 text-white"
                                                                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                                                        )}
                                                    >
                                                        {pill.count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <TicketTable
                                    tickets={filteredAllTrips}
                                    onView={(id) => navigate(`/gso/tickets/${id}`)}
                                    onCancel={(ticket) => {
                                        setSelectedTicket(ticket);
                                        setCancelReason("");
                                        setShowCancelDialog(true);
                                    }}
                                    showCancel={true}
                                    isLoading={allTripsLoading || pendingLoading || cancelledLoading}
                                    showActions={true}
                                    maxHeight="320px"
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ============ VALIDATION TAB ============ */}
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
                                    onView={(id) => navigate(`/gso/tickets/${id}`)}
                                    onValidate={(ticket) => {
                                        setSelectedTicket(ticket);
                                        setShowValidateDialog(true);
                                    }}
                                    isLoading={validationLoading}
                                    showActions={true}
                                    maxHeight="320px"
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ============ GAS SLIPS TAB ============ */}
                    <TabsContent value="gas-slips" className="space-y-4 mt-6">
                        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                            <CardHeader className="border-b dark:border-slate-700">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                                            <Fuel className="h-5 w-5 text-amber-500" />
                                            Pending Gas Slip Tickets
                                        </CardTitle>
                                        <CardDescription className="dark:text-slate-400 mt-1">
                                            MO-created Gas Slips awaiting GSO completion before drivers can proceed
                                        </CardDescription>
                                    </div>
                                    <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                        {pendingGasSlips.length} pending
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {gasSlipsLoading ? (
                                    <div className="flex justify-center py-16">
                                        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                                    </div>
                                ) : pendingGasSlips.length === 0 ? (
                                    <div className="text-center py-16">
                                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                            <CheckCircle className="h-8 w-8 text-emerald-500" />
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-400 font-medium">
                                            No pending Gas Slips
                                        </p>
                                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                            All MO-created Gas Slips have been processed.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {pendingGasSlips.map((gs) => (
                                            <div
                                                key={gs.trip_ticket_id}
                                                className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition p-5 space-y-3"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <div className="text-xs uppercase tracking-wide text-amber-600 font-semibold">
                                                            Control No.
                                                        </div>
                                                        <div className="text-lg font-bold text-slate-900 dark:text-white">
                                                            {gs.control_number || gs.trip_ticket_number}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-slate-500">
                                                            Amount
                                                        </div>
                                                        <div className="text-base font-semibold text-emerald-600">
                                                            ₱
                                                            {Number(gs.amount_released).toLocaleString(
                                                                "en-PH",
                                                                { minimumFractionDigits: 2 },
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                        <span className="truncate">
                                                            {gs.driver?.full_name || "—"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 truncate">
                                                        <Truck className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                        <span className="truncate">
                                                            {gs.vehicle
                                                                ? `${gs.vehicle.plate_number} — ${gs.vehicle.vehicle_model}`
                                                                : "—"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 truncate">
                                                        <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                        <span className="truncate">
                                                            {gs.department_name || "—"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 truncate">
                                                        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                        <span className="truncate">
                                                            {gs.destination || "—"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 truncate">
                                                        <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                        <span className="truncate">
                                                            {formatDateShort(gs.trip_date)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <Button
                                                    onClick={() => {
                                                        setGasSlipModalTicket(gs);
                                                        setGasSlipForm({
                                                            estimated_distance_km:
                                                                gs.estimated_distance_km || "",
                                                            estimated_fuel_liters:
                                                                gs.estimated_fuel_liters || "",
                                                            passenger_name: gs.passenger_name || "",
                                                            validation_note: "",
                                                        });
                                                    }}
                                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                                >
                                                    Complete Trip Ticket
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Trip History Widget */}
            <TripHistoryWidget isLoading={isLoading} />

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
                            This action cannot be undone. The ticket will be
                            cancelled and you can create a new one.
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
                            <li>
                                Allow you to create a new ticket for this trip
                            </li>
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
                            Reason for Cancellation{" "}
                            <span className="text-red-500">*</span>
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
                                        "Please provide a reason (at least 5 characters)",
                                    );
                                    return;
                                }
                                const ticketId = getTicketId(selectedTicket);
                                if (!ticketId) {
                                    toast.error("Invalid ticket");
                                    return;
                                }
                                cancelMutation.mutate({
                                    ticketId,
                                    reason: cancelReason,
                                });
                            }}
                            disabled={
                                cancelMutation.isPending ||
                                cancelReason.trim().length < 5
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
            <Dialog
                open={showValidateDialog}
                onOpenChange={setShowValidateDialog}
            >
                <DialogContent className="sm:max-w-md dark:bg-slate-800 dark:border-slate-700">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                            <div className="p-2 rounded-xl bg-emerald-500/10">
                                <FileCheck className="h-5 w-5 text-emerald-600" />
                            </div>
                            Close Trip
                        </DialogTitle>
                        <DialogDescription className="dark:text-slate-400">
                            Review trip details and close it. This action is
                            final.
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
                                            validationNote ||
                                            "Trip closed by GSO",
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

            {/* ============ GAS SLIP COMPLETE MODAL ============ */}
            <Dialog
                open={!!gasSlipModalTicket}
                onOpenChange={(open) => {
                    if (!open && !completeGasSlipMutation.isPending) {
                        setGasSlipModalTicket(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg dark:bg-slate-800 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                            <div className="p-2 rounded-xl bg-amber-500/10">
                                <Fuel className="h-5 w-5 text-amber-600" />
                            </div>
                            Complete Trip Ticket
                        </DialogTitle>
                        <DialogDescription className="dark:text-slate-400">
                            Confirm this MO-created Gas Slip. Driver will be
                            notified to acknowledge funds and start the trip.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-1.5 text-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">
                                Control No.
                            </span>
                            <span className="font-mono font-semibold dark:text-white">
                                {gasSlipModalTicket?.control_number}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">
                                Driver
                            </span>
                            <span className="dark:text-white">
                                {gasSlipModalTicket?.driver?.full_name || "—"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">
                                Vehicle
                            </span>
                            <span className="dark:text-white">
                                {gasSlipModalTicket?.vehicle
                                    ? `${gasSlipModalTicket.vehicle.plate_number} — ${gasSlipModalTicket.vehicle.vehicle_model}`
                                    : "—"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">
                                Department
                            </span>
                            <span className="dark:text-white">
                                {gasSlipModalTicket?.department_name || "—"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">
                                Destination
                            </span>
                            <span className="dark:text-white">
                                {gasSlipModalTicket?.destination || "—"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">
                                Amount Released
                            </span>
                            <span className="font-semibold text-emerald-600">
                                ₱
                                {Number(
                                    gasSlipModalTicket?.amount_released || 0,
                                ).toLocaleString("en-PH", {
                                    minimumFractionDigits: 2,
                                })}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                Estimated Distance (km) — optional
                            </label>
                            <Input
                                type="number"
                                step="0.01"
                                value={gasSlipForm.estimated_distance_km}
                                onChange={(e) =>
                                    setGasSlipForm({
                                        ...gasSlipForm,
                                        estimated_distance_km: e.target.value,
                                    })
                                }
                                className="mt-1 dark:bg-slate-900 dark:border-slate-700"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                Estimated Fuel (liters) — optional
                            </label>
                            <Input
                                type="number"
                                step="0.01"
                                value={gasSlipForm.estimated_fuel_liters}
                                onChange={(e) =>
                                    setGasSlipForm({
                                        ...gasSlipForm,
                                        estimated_fuel_liters: e.target.value,
                                    })
                                }
                                className="mt-1 dark:bg-slate-900 dark:border-slate-700"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                Passenger Name — optional
                            </label>
                            <Input
                                value={gasSlipForm.passenger_name}
                                onChange={(e) =>
                                    setGasSlipForm({
                                        ...gasSlipForm,
                                        passenger_name: e.target.value,
                                    })
                                }
                                className="mt-1 dark:bg-slate-900 dark:border-slate-700"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                Validation Note — optional
                            </label>
                            <Textarea
                                rows={2}
                                value={gasSlipForm.validation_note}
                                onChange={(e) =>
                                    setGasSlipForm({
                                        ...gasSlipForm,
                                        validation_note: e.target.value,
                                    })
                                }
                                placeholder="Any notes for the audit trail"
                                className="mt-1 resize-none dark:bg-slate-900 dark:border-slate-700"
                            />
                        </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 dark:text-amber-300">
                            Once completed, the Trip Ticket moves to{" "}
                            <b>Funds Issued</b>. The driver can then acknowledge, start the
                            trip, and upload the receipt.
                        </p>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setGasSlipModalTicket(null)}
                            disabled={completeGasSlipMutation.isPending}
                            className="dark:border-slate-700 dark:text-slate-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (!gasSlipModalTicket) return;
                                completeGasSlipMutation.mutate({
                                    ticketId: gasSlipModalTicket.trip_ticket_id,
                                    payload: {
                                        estimated_distance_km: gasSlipForm.estimated_distance_km
                                            ? Number(gasSlipForm.estimated_distance_km)
                                            : null,
                                        estimated_fuel_liters: gasSlipForm.estimated_fuel_liters
                                            ? Number(gasSlipForm.estimated_fuel_liters)
                                            : null,
                                        passenger_name:
                                            gasSlipForm.passenger_name.trim() || null,
                                        validation_note:
                                            gasSlipForm.validation_note.trim() || null,
                                    },
                                });
                            }}
                            disabled={completeGasSlipMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                        >
                            {completeGasSlipMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Check className="h-4 w-4 mr-2" />
                            )}
                            Complete Trip Ticket
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default GsoDashboard;
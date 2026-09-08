// src/pages/gso/GsoDashboard.jsx
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
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
    gpsAPI,
    auditAPI,
} from "../../services/api";
import {
    LayoutDashboard,
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
    X,
    Search,
    Building2,
    FileCheck,
    PlusCircle,
    Users,
    Car,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Wallet,
    Fuel,
    Satellite,
    Navigation,
    Zap,
    History,
    Activity,
    User,
    Database,
    Shield,
    Clock as ClockIcon,
    ChevronDown,
    ChevronUp,
    EyeOff,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    Route,
    Gauge,
    Target,
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
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { toast } from "react-hot-toast";
import echo from "../../services/echo";
import eventBus from "../../utils/eventBus";

// ============================================
// MAP IMPORTS
// ============================================

import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Polyline,
    Circle,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ============================================
// CONSTANTS & HELPERS
// ============================================

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
        cancelled: { color: "bg-slate-500", label: "Cancelled", icon: XCircle },
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
    };
    return icons[action] || ClockIcon;
};

// ============================================
// REAL-TIME NOTIFICATIONS SETUP
// ============================================

const setupGsoRealtimeNotifications = (
    user,
    fetchAllDataRef,
    setForceUpdate,
) => {
    if (!user) return;

    console.log(
        "🔔 Setting up GSO real-time notifications for user:",
        user.user_id,
    );

    if (!echo.connector || !echo.connector.pusher) {
        console.warn("⚠️ Echo connector not available, retrying in 2s...");
        setTimeout(
            () =>
                setupGsoRealtimeNotifications(
                    user,
                    fetchAllDataRef,
                    setForceUpdate,
                ),
            2000,
        );
        return;
    }

    const connection = echo.connector.pusher.connection;

    const subscribeToPrivateChannel = () => {
        try {
            const channel = echo.private(`notifications.${user.user_id}`);

            channel.listen(".notification.new", (data) => {
                console.log("🔔 GSO Private notification received:", data);
                eventBus.emit("notification-received", data);
                handleNotificationByType(data);
            });

            channel.subscribed(() => {
                console.log(
                    `✅ Subscribed to private notifications.${user.user_id}`,
                );
            });

            channel.error((error) => {
                console.error("❌ Private subscription error:", error);
            });
        } catch (error) {
            console.error("⚠️ Error subscribing to private channel:", error);
        }
    };

    const handleNotificationByType = (data) => {
        const type = data.notification_type;
        const refreshDelay = 500;

        switch (type) {
            case "fund_released":
            case "fund_issued":
                console.log("💰 Fund release detected - refreshing data");
                setTimeout(() => {
                    fetchAllDataRef.current?.();
                    setForceUpdate((prev) => prev + 1);
                }, refreshDelay);
                break;
            case "trip_started":
            case "trip_completed":
            case "trip_created":
            case "trip_pending_validation":
                console.log("🚗 Trip update detected - refreshing data");
                setTimeout(() => {
                    fetchAllDataRef.current?.();
                    setForceUpdate((prev) => prev + 1);
                }, refreshDelay);
                break;
            default:
                setTimeout(() => {
                    fetchAllDataRef.current?.();
                    setForceUpdate((prev) => prev + 1);
                }, refreshDelay);
                break;
        }
    };

    if (connection.state === "connected") {
        console.log("✅ Already connected, subscribing...");
        subscribeToPrivateChannel();
    } else {
        connection.bind("connected", () => {
            console.log("✅ WebSocket connected!");
            subscribeToPrivateChannel();
        });

        if (
            connection.state === "disconnected" ||
            connection.state === "unavailable"
        ) {
            console.log("🔄 Attempting to connect...");
            connection.connect();
        }
    }
};

// ============================================
// LIVE TRACKING MAP COMPONENT
// ============================================

const LiveTrackingMap = ({ activeTrips, loading }) => {
    const [selectedTrip, setSelectedTrip] = useState(null);
    const center = [8.5833, 124.6667];
    const zoom = 13;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!activeTrips || activeTrips.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <Satellite className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">
                    No active trips with GPS data
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500">
                    Active trips with GPS tracking will appear here
                </p>
            </div>
        );
    }

    const tripsWithLocation = activeTrips.filter(
        (trip) => trip.current_location,
    );

    if (tripsWithLocation.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <Navigation className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">
                    No GPS data available
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500">
                    Waiting for drivers to share location
                </p>
            </div>
        );
    }

    return (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: "400px", width: "100%" }}
                className="z-0"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {tripsWithLocation.map((trip) => {
                    const { current_location } = trip;
                    const isSelected = selectedTrip?.trip_id === trip.trip_id;

                    return (
                        <div key={trip.trip_id}>
                            {trip.route && trip.route.length > 1 && (
                                <Polyline
                                    positions={trip.route.map((p) => [
                                        p.latitude,
                                        p.longitude,
                                    ])}
                                    color={isSelected ? "#2563eb" : "#94a3b8"}
                                    weight={isSelected ? 4 : 2}
                                    opacity={isSelected ? 0.9 : 0.5}
                                    dashArray={isSelected ? null : "5, 5"}
                                />
                            )}

                            <Marker
                                position={[
                                    current_location.latitude,
                                    current_location.longitude,
                                ]}
                                eventHandlers={{
                                    click: () => setSelectedTrip(trip),
                                }}
                            >
                                <Popup>
                                    <div className="p-2 min-w-[200px]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                                            <span className="font-semibold text-sm">
                                                {trip.ticket_number}
                                            </span>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <p>
                                                <span className="text-slate-500">
                                                    Vehicle:
                                                </span>{" "}
                                                {trip.vehicle?.plate_number}
                                            </p>
                                            <p>
                                                <span className="text-slate-500">
                                                    Driver:
                                                </span>{" "}
                                                {trip.driver?.name}
                                            </p>
                                            <p>
                                                <span className="text-slate-500">
                                                    Destination:
                                                </span>{" "}
                                                {trip.destination}
                                            </p>
                                            <p>
                                                <span className="text-slate-500">
                                                    Speed:
                                                </span>{" "}
                                                {current_location.speed_kmh ||
                                                    0}{" "}
                                                km/h
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                Updated:{" "}
                                                {new Date(
                                                    current_location.recorded_at,
                                                ).toLocaleTimeString()}
                                            </p>
                                        </div>
                                        <div className="mt-2 flex gap-2">
                                            <button
                                                onClick={() =>
                                                    (window.location.href = `/gso/trip/${trip.trip_id}`)
                                                }
                                                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                                            >
                                                View Trip
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setSelectedTrip(trip)
                                                }
                                                className="text-xs bg-slate-200 text-slate-700 px-3 py-1 rounded hover:bg-slate-300"
                                            >
                                                Center
                                            </button>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>

                            {current_location.accuracy_meters &&
                                current_location.accuracy_meters < 100 && (
                                    <Circle
                                        center={[
                                            current_location.latitude,
                                            current_location.longitude,
                                        ]}
                                        radius={
                                            current_location.accuracy_meters
                                        }
                                        color={
                                            isSelected ? "#2563eb" : "#94a3b8"
                                        }
                                        fillColor={
                                            isSelected ? "#2563eb" : "#94a3b8"
                                        }
                                        fillOpacity={0.1}
                                    />
                                )}
                        </div>
                    );
                })}
            </MapContainer>

            <div className="absolute bottom-4 left-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-3 text-xs z-[1000]">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-slate-600 dark:text-slate-300">
                            Live
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-slate-600 dark:text-slate-300">
                            Selected
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-0.5 bg-slate-400" />
                        <span className="text-slate-600 dark:text-slate-300">
                            Route
                        </span>
                    </div>
                </div>
            </div>

            <div className="absolute top-4 right-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg px-3 py-2 text-xs z-[1000]">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {tripsWithLocation.length} active
                </span>
            </div>
        </div>
    );
};

// ============================================
// AUDIT LOG TABLE COMPONENT
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

    const filteredLogs =
        logs?.filter((log) => {
            const search = searchTerm.toLowerCase();
            return (
                log?.action?.toLowerCase().includes(search) ||
                log?.table_name?.toLowerCase().includes(search) ||
                log?.user?.email?.toLowerCase().includes(search) ||
                log?.user?.full_name?.toLowerCase().includes(search)
            );
        }) || [];

    if (filteredLogs.length === 0) {
        return (
            <div className="text-center py-8">
                <History className="h-8 w-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    No audit logs found
                </p>
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
                                            {log.action
                                                ?.replace(/_/g, " ")
                                                .toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                                                {user?.full_name?.charAt(0) ||
                                                    user?.first_name?.charAt(
                                                        0,
                                                    ) ||
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
                                            {log.table_name
                                                ?.replace(/_/g, " ")
                                                .toUpperCase()}
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
// STATS CARD COMPONENT
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
// TICKET TABLE COMPONENT
// ============================================

const TicketTable = ({
    tickets,
    showValidate = false,
    onView,
    onValidate,
    isLoading: tableLoading,
    showActions = true,
    maxHeight = "400px",
}) => {
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

    if (!Array.isArray(tickets) || tickets.length === 0) {
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
            style={{ maxHeight: maxHeight }}
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
                    {tickets.map((ticket, index) => {
                        const ticketId = getTicketId(ticket);
                        const needsValidation =
                            ticket?.status === "pending_gso_validation" ||
                            ticket?.status === "completed";

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
                                        <div className="flex items-center justify-end gap-2">
                                            {onView && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        onView(ticketId)
                                                    }
                                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-8 w-8 p-0"
                                                    title="View Details"
                                                >
                                                    <Eye className="h-4 w-4" />
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
// STATUS BADGE COMPONENT
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
// MAIN COMPONENT
// ============================================

const GsoDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showValidateDialog, setShowValidateDialog] = useState(false);
    const [activeTab, setActiveTab] = useState("pending");
    const [searchQuery, setSearchQuery] = useState("");
    const [showLiveTracking, setShowLiveTracking] = useState(true);
    const [showAuditLog, setShowAuditLog] = useState(false);
    const [forceUpdate, setForceUpdate] = useState(0);
    const [validationNote, setValidationNote] = useState("");

    const fetchAllDataRef = useRef(null);

    const departmentName =
        user?.department_name
            ?.replace("Philippine National Police - ", "")
            .replace("PNP - ", "") || "General Services Office";

    // ============================================
    // OPTIMIZED QUERIES
    // ============================================

    const {
        data: auditLogs = [],
        isLoading: auditLoading,
        refetch: refetchAudit,
    } = useOptimizedQuery({
        queryKey: ["audit-logs"],
        queryFn: async () => {
            try {
                const response = await auditAPI.getLogs();
                return response?.data?.data || [];
            } catch (error) {
                console.error("Error fetching audit logs:", error);
                return [];
            }
        },
        refetchInterval: 30000,
        enabled: showAuditLog,
        staleTime: 30000,
    });

    const {
        data: activeTrips = [],
        isLoading: gpsLoading,
        refetch: refetchGps,
        isFetching: gpsFetching,
    } = useOptimizedQuery({
        queryKey: ["gps-active-trips"],
        queryFn: async () => {
            try {
                const response = await gpsAPI.getActiveTrips();
                return response?.data?.data || [];
            } catch (error) {
                console.error("Error fetching active trips:", error);
                return [];
            }
        },
        refetchInterval: 15000,
        staleTime: 5000,
    });

    const {
        data: pendingTickets = [],
        isLoading: pendingLoading,
        refetch: refetchPending,
    } = useOptimizedQuery({
        queryKey: ["gso-pending-mo"],
        queryFn: async () => {
            try {
                const response = await gsoAPI.getPendingMO();
                const data = response?.data?.data || response?.data || [];
                return Array.isArray(data) ? data : [];
            } catch (error) {
                console.error("Error fetching pending tickets:", error);
                return [];
            }
        },
        staleTime: 60000,
    });

    const {
        data: pendingValidation = [],
        isLoading: validationLoading,
        refetch: refetchValidation,
    } = useOptimizedQuery({
        queryKey: ["gso-pending-validation"],
        queryFn: async () => {
            try {
                const response = await gsoAPI.getPendingValidation();
                const data = response?.data?.data || response?.data || [];
                return Array.isArray(data) ? data : [];
            } catch (error) {
                console.error("Error fetching pending validation:", error);
                return [];
            }
        },
        staleTime: 60000,
    });

    const {
        data: allTrips = [],
        isLoading: allTripsLoading,
        refetch: refetchAllTrips,
    } = useOptimizedQuery({
        queryKey: ["gso-all-trips"],
        queryFn: async () => {
            try {
                const response = await gsoAPI.getAllTrips();
                const data = response?.data?.data || response?.data || [];
                return Array.isArray(data) ? data : [];
            } catch (error) {
                console.error("Error fetching all trips:", error);
                return [];
            }
        },
        staleTime: 60000,
        keepPreviousData: true,
    });

    const { data: users = [], isLoading: usersLoading } = useOptimizedQuery({
        queryKey: ["admin-users-stats"],
        queryFn: async () => {
            try {
                const response = await userAPI.getAll();
                return response?.data?.data || [];
            } catch {
                return [];
            }
        },
        staleTime: 120000,
    });

    const { data: vehicles = [], isLoading: vehiclesLoading } = useOptimizedQuery({
        queryKey: ["admin-vehicles-stats"],
        queryFn: async () => {
            try {
                const response = await vehicleAPI.getAll();
                return response?.data?.data || [];
            } catch {
                return [];
            }
        },
        staleTime: 120000,
    });

    const { data: departments = [], isLoading: departmentsLoading } = useOptimizedQuery({
        queryKey: ["admin-departments-stats"],
        queryFn: async () => {
            try {
                const response = await departmentAPI.getAll();
                return response?.data?.data || [];
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

    // ============================================
    // COMPUTED STATS
    // ============================================

    const stats = useMemo(() => {
        const totalUsers = Array.isArray(users) ? users.length : 0;
        const activeUsers = Array.isArray(users)
            ? users.filter((u) => u?.status === "active").length
            : 0;
        const totalVehicles = Array.isArray(vehicles) ? vehicles.length : 0;
        const activeVehicles = Array.isArray(vehicles)
            ? vehicles.filter((v) => v?.status === "active").length
            : 0;

        return [
            {
                title: "Total Trips",
                value: allTrips.length,
                icon: Truck,
                gradient: "from-blue-500 to-blue-600",
                subtitle: `${allTrips.filter((t) => t?.status === "closed").length} completed`,
                onClick: () => setActiveTab("all"),
                trend: allTrips.length > 0 ? 12 : 0,
            },
            {
                title: "Pending MO",
                value: pendingTickets.length,
                icon: Clock,
                gradient: "from-yellow-500 to-yellow-600",
                subtitle: "Awaiting fund release",
                onClick: () => setActiveTab("pending"),
                trend: pendingTickets.length > 0 ? -8 : 0,
            },
            {
                title: "Active GPS",
                value: activeTrips.length,
                icon: Satellite,
                gradient: "from-green-500 to-emerald-600",
                subtitle: "Live tracking",
                onClick: () => setShowLiveTracking(!showLiveTracking),
                trend: activeTrips.length > 0 ? 5 : 0,
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
                title: "Pending Validation",
                value: pendingValidation.length,
                icon: FileCheck,
                gradient: "from-indigo-500 to-indigo-600",
                subtitle: "Ready for GSO review",
                onClick: () => setActiveTab("validation"),
                trend: pendingValidation.length > 0 ? 3 : 0,
            },
        ];
    }, [
        allTrips,
        pendingTickets,
        users,
        vehicles,
        activeTrips.length,
        pendingValidation.length,
        navigate,
    ]);

    // ============================================
    // FILTER FUNCTIONS
    // ============================================

    const filterTickets = (tickets) => {
        if (!searchQuery || !Array.isArray(tickets)) return tickets || [];
        const query = searchQuery.toLowerCase();
        return tickets.filter(
            (ticket) =>
                (getTicketNumber(ticket) || "").toLowerCase().includes(query) ||
                (ticket?.destination || "").toLowerCase().includes(query) ||
                (ticket?.department_name || "").toLowerCase().includes(query) ||
                (ticket?.vehicle?.plate_number || "")
                    .toLowerCase()
                    .includes(query),
        );
    };

    const filteredPending = useMemo(
        () => filterTickets(pendingTickets),
        [pendingTickets, searchQuery],
    );
    const filteredAllTrips = useMemo(
        () => filterTickets(allTrips),
        [allTrips, searchQuery],
    );
    const filteredValidation = useMemo(
        () => filterTickets(pendingValidation),
        [pendingValidation, searchQuery],
    );

    // ============================================
    // CHART DATA
    // ============================================

    const chartData = useMemo(() => {
        if (!Array.isArray(allTrips) || allTrips.length === 0) {
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

        allTrips.forEach((trip) => {
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
                    /* Skip invalid dates */
                }
            }
        });

        return Array.from(monthlyMap.entries())
            .map(([month, trips]) => ({ month, trips }))
            .slice(-6);
    }, [allTrips]);

    // ============================================
    // SETUP REAL-TIME NOTIFICATIONS
    // ============================================

    useEffect(() => {
        fetchAllDataRef.current = fetchAllData;

        if (user) {
            setupGsoRealtimeNotifications(
                user,
                fetchAllDataRef,
                setForceUpdate,
            );
        }

        return () => {
            try {
                if (user) {
                    echo.leave(`notifications.${user.user_id}`);
                    echo.leave("gso.dashboard");
                }
            } catch (e) {
                // Ignore cleanup errors
            }
        };
    }, [user]);

    // ============================================
    // FETCH ALL DATA
    // ============================================

    const fetchAllData = () => {
        refetchPending();
        refetchValidation();
        refetchAllTrips();
        refetchGps();
        refetchAudit();
        queryClient.invalidateQueries({ queryKey: ["admin-users-stats"] });
        queryClient.invalidateQueries({ queryKey: ["admin-vehicles-stats"] });
        queryClient.invalidateQueries({
            queryKey: ["admin-departments-stats"],
        });
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    };

    // ============================================
    // WEBSOCKET REAL-TIME UPDATES
    // ============================================

    useEffect(() => {
        if (!user) return;

        if (!echo.connector || !echo.connector.pusher) {
            console.warn("⚠️ Echo not ready for dashboard updates");
            return;
        }

        const channel = echo.channel("gso-live-tracking");

        channel.listen(".location.updated", (data) => {
            setForceUpdate((prev) => prev + 1);
            const timer = setTimeout(() => fetchAllData(), 1000);
            return () => clearTimeout(timer);
        });

        channel.listen(".trip.completed", (data) => {
            toast.success(`Trip ${data.trip_id || "unknown"} completed`);
            fetchAllData();
        });

        channel.listen(".trip.started", (data) => {
            toast.info(`Trip ${data.trip_id || "unknown"} started`);
            fetchAllData();
        });

        channel.subscribed(() => {
            console.log("✅ Dashboard subscribed to gso-live-tracking");
        });

        return () => {
            try {
                channel.stopListening(".location.updated");
                channel.stopListening(".trip.completed");
                channel.stopListening(".trip.started");
            } catch (e) {
                // Ignore cleanup errors
            }
        };
    }, [user]);

    // ============================================
    // LOADING STATE WITH SKELETON
    // ============================================

    const isLoading =
        pendingLoading || allTripsLoading || gpsLoading;

    if (isLoading && allTrips.length === 0 && activeTrips.length === 0) {
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
            {/* Hero Header Section */}
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
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                            GSO Dashboard
                        </h1>
                        <p className="text-slate-300 mt-1 text-sm md:text-base">
                            Manage trip tickets, users, departments, and
                            vehicles in one place
                        </p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <Button
                            onClick={() => navigate("/gso/create-trip")}
                            className="bg-white text-slate-900 hover:bg-slate-100 rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-105 active:scale-95"
                        >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Create Trip
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                fetchAllData();
                                toast.success("Dashboard refreshed");
                            }}
                            className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl backdrop-blur-sm transition-all duration-300"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 md:gap-5">
                {stats.map((stat, index) => (
                    <StatsCard key={index} {...stat} />
                ))}
            </div>

            {/* Chart Section */}
            <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                                <TrendingUp className="h-5 w-5 text-blue-500" />
                                Trip Trends
                            </CardTitle>
                            <CardDescription className="dark:text-slate-400">
                                Monthly trip volume for the last 6 months
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
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient
                                        id="colorTrips"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="5%"
                                            stopColor="#3b82f6"
                                            stopOpacity={0.3}
                                        />
                                        <stop
                                            offset="95%"
                                            stopColor="#3b82f6"
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    className="stroke-slate-200 dark:stroke-slate-700"
                                />
                                <XAxis
                                    dataKey="month"
                                    className="text-slate-600 dark:text-slate-400 text-xs"
                                />
                                <YAxis className="text-slate-600 dark:text-slate-400 text-xs" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        borderColor: "hsl(var(--border))",
                                        borderRadius: "12px",
                                        boxShadow:
                                            "0 10px 40px -10px rgba(0,0,0,0.15)",
                                    }}
                                    labelClassName="text-slate-600 dark:text-slate-400"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="trips"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fill="url(#colorTrips)"
                                    className="transition-all duration-300"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Live Tracking Section */}
            <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                                <Satellite className="h-5 w-5 text-green-500" />
                                Live GPS Tracking
                                {gpsFetching && (
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500 ml-2" />
                                )}
                            </CardTitle>
                            <CardDescription className="dark:text-slate-400">
                                Real-time location of active trips
                                {activeTrips.length > 0 && (
                                    <span className="ml-2 text-emerald-500 font-medium">
                                        {activeTrips.length} active
                                    </span>
                                )}
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => refetchGps()}
                                disabled={gpsFetching}
                                className="dark:border-slate-700"
                            >
                                <RefreshCw
                                    className={`h-4 w-4 mr-1 ${gpsFetching ? "animate-spin" : ""}`}
                                />
                                Refresh
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setShowLiveTracking(!showLiveTracking)
                                }
                                className="dark:border-slate-700"
                            >
                                {showLiveTracking ? "Hide" : "Show"}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                {showLiveTracking && (
                    <CardContent>
                        <LiveTrackingMap
                            activeTrips={activeTrips}
                            loading={gpsLoading}
                        />
                    </CardContent>
                )}
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

            {/* Tabs for Trip Management */}
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
            >
                <TabsList className="grid w-full max-w-3xl grid-cols-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
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
                                        These trips are pending approval from
                                        Mayor's Office
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
                                    if (id) {
                                        navigate(`/gso/trip/${id}`);
                                    } else {
                                        toast.error("Invalid ticket ID");
                                    }
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
                                        These trips are completed and need GSO
                                        validation to close
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
                        <AuditLogTable
                            logs={auditLogs}
                            loading={auditLoading}
                        />
                    </CardContent>
                )}
            </Card>

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
                            {selectedTicket?.gps_distance_km && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">
                                        GPS Distance:
                                    </span>
                                    <span className="font-semibold dark:text-white">
                                        {selectedTicket.gps_distance_km} km
                                    </span>
                                </div>
                            )}
                            {selectedTicket?.has_receipt && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">
                                        Receipt:
                                    </span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        ✅ Uploaded
                                    </span>
                                </div>
                            )}
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
                                    ticketId: ticketId,
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
        </div>
    );
};

export default GsoDashboard;
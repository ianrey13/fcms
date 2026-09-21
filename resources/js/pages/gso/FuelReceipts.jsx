// src/pages/gso/FuelReceipts.jsx
import React, { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import { useOptimizedQuery } from "../../hooks/useOptimizedQuery";
import {
    SkeletonPage,
    SkeletonStats,
    SkeletonTable,
    SkeletonCard,
} from "../../components/ui/SkeletonCard";
import { gsoAPI } from "../../services/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Receipt,
    Loader2,
    Image as ImageIcon,
    Calendar,
    User,
    Truck,
    Fuel,
    AlertTriangle,
    Clock,
    Gauge,
    Zap,
    CheckCircle,
    XCircle,
    TrendingUp,
    TrendingDown,
    Minus,
    X,
    Save,
    Pencil,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

// ============================================
// ✅ HELPER: Robust array extraction from any API response shape
// ============================================

const extractReceiptsArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;

    const possibleKeys = [
        'receipts',
        'data',
        'items',
        'results',
        'records',
        'fuel_receipts',
        'fuelReceipts',
        'rows',
        'list',
        'payload',
    ];

    for (const key of possibleKeys) {
        if (Array.isArray(response[key])) {
            return response[key];
        }
    }

    if (response.data && typeof response.data === 'object') {
        for (const key of possibleKeys) {
            if (Array.isArray(response.data[key])) {
                return response.data[key];
            }
        }
    }

    if (typeof response === 'object') {
        if (
            response.id ||
            response.fuel_receipt_id ||
            response.ticket_number ||
            response.trip_ticket_number
        ) {
            return [response];
        }
    }

    return [];
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const sanitizeDecimalInput = (value, maxDecimals = 2) => {
    if (value === null || value === undefined) return '';
    let cleaned = String(value).replace(/[^0-9.]/g, '');
    const firstDot = cleaned.indexOf('.');
    if (firstDot !== -1) {
        cleaned =
            cleaned.slice(0, firstDot + 1) +
            cleaned.slice(firstDot + 1).replace(/\./g, '');
    }
    const parts = cleaned.split('.');
    if (parts.length === 2 && parts[1].length > maxDecimals) {
        cleaned = parts[0] + '.' + parts[1].slice(0, maxDecimals);
    }
    return cleaned;
};

const getReceiptImageUrls = (receipt) => {
    let url = receipt?.receipt_url || receipt?.receipt_photo_path || null;
    if (!url) return [];

    const baseUrl = window.location.origin;
    const urlsList = [];

    if (url.startsWith('http://') || url.startsWith('https://')) {
        urlsList.push(url);
        const filename = url.split('/').pop();
        if (filename) {
            urlsList.push(`${baseUrl}/receipts/${filename}`);
            urlsList.push(`${baseUrl}/storage/receipts/${filename}`);
        }
        return [...new Set(urlsList)];
    }

    const filename = url.split('/').pop();
    if (!filename) return [];

    urlsList.push(`${baseUrl}/receipts/${filename}`);
    urlsList.push(`${baseUrl}/storage/receipts/${filename}`);

    if (url.startsWith('/')) {
        urlsList.push(`${baseUrl}${url}`);
    } else if (!url.startsWith('receipts/') && !url.startsWith('storage/')) {
        urlsList.push(`${baseUrl}/${url}`);
    } else if (url.startsWith('receipts/')) {
        urlsList.push(`${baseUrl}/${url}`);
    }

    return [...new Set(urlsList)];
};

const getStatusConfig = (status) => {
    const configs = {
        pending: { color: 'bg-yellow-500', label: 'Pending Verification', icon: Clock },
        verified: { color: 'bg-green-500', label: 'Verified', icon: CheckCircle },
        discrepancy: { color: 'bg-red-500', label: 'Discrepancy Found', icon: AlertTriangle },
        approved: { color: 'bg-emerald-500', label: 'Approved', icon: CheckCircle },
        rejected: { color: 'bg-rose-500', label: 'Rejected', icon: XCircle },
    };
    return configs[status] || configs.pending;
};

const formatDate = (date) => {
    if (!date) return "N/A";
    return format(new Date(date), "MMM dd, yyyy hh:mm a");
};

const formatDateShort = (date) => {
    if (!date) return "N/A";
    return format(new Date(date), "MMM dd, yyyy");
};

const formatTimeAgo = (date) => {
    if (!date) return "N/A";
    const now = new Date();
    const diff = now - new Date(date);
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDateShort(date);
};

// ============================================
// RECEIPT IMAGE COMPONENT
// ============================================

const ReceiptImage = ({ receipt }) => {
    const [imageError, setImageError] = useState(false);
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
    const [imageLoaded, setImageLoaded] = useState(false);

    const urls = React.useMemo(() => getReceiptImageUrls(receipt), [receipt]);

    React.useEffect(() => {
        setImageError(false);
        setCurrentUrlIndex(0);
        setImageLoaded(false);
    }, [receipt]);

    if (urls.length === 0) {
        return (
            <div className="border rounded-xl p-8 text-center bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                    <ImageIcon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">No receipt image uploaded</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Driver did not attach a photo</p>
            </div>
        );
    }

    const currentUrl = urls[currentUrlIndex];
    const hasMoreUrls = currentUrlIndex < urls.length - 1;

    const handleImageError = () => {
        if (hasMoreUrls) {
            setCurrentUrlIndex(prev => prev + 1);
        } else {
            setImageError(true);
        }
    };

    if (imageError) {
        return (
            <div className="border rounded-xl p-8 text-center bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
                <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
                <p className="text-red-600 dark:text-red-400 font-medium">Cannot load receipt image</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 break-all">
                    Tried: {urls.join(' → ')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    DB Path: {receipt.receipt_photo_path || receipt.receipt_url || 'No path'}
                </p>
                <button
                    onClick={() => {
                        setImageError(false);
                        setCurrentUrlIndex(0);
                        setImageLoaded(false);
                    }}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="relative border rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
            {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                </div>
            )}
            <img
                src={currentUrl}
                alt="Fuel Receipt"
                className={`w-full max-h-80 object-contain transition-all duration-300 hover:scale-105 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onError={handleImageError}
                onLoad={() => setImageLoaded(true)}
                loading="lazy"
            />
            {urls.length > 1 && !imageError && (
                <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-lg">
                    Trying {currentUrlIndex + 1}/{urls.length}
                </div>
            )}
            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-lg">
                Click to expand
            </div>
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
        <Badge className={`${config.color} text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium`}>
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
};

// ============================================
// STATS CARD COMPONENT
// ============================================

const StatsCard = ({ title, value, icon: Icon, color, subtitle, trend }) => {
    const getTrendIcon = () => {
        if (!trend) return null;
        if (trend > 0) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
        if (trend < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
        return <Minus className="h-3 w-3 text-slate-400" />;
    };

    return (
        <div className="bg-white dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{title}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
                    {subtitle && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
                    )}
                </div>
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                </div>
            </div>
            {trend !== undefined && (
                <div className="flex items-center gap-1 mt-2 text-[10px]">
                    {getTrendIcon()}
                    <span className={trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : trend < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                    <span className="text-slate-400">vs last month</span>
                </div>
            )}
        </div>
    );
};

// ============================================
// LOADING SKELETON
// ============================================

const LoadingSkeleton = () => (
    <div className="space-y-6 p-4 md:p-6 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <SkeletonPage />
        <SkeletonStats count={4} cols={4} />
        <div className="relative">
            <SkeletonCard className="h-12" />
        </div>
        <SkeletonTable rows={5} cols={6} />
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const FuelReceipts = () => {
    const queryClient = useQueryClient();
    const { isConnected } = useRealtime();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [showReceiptDialog, setShowReceiptDialog] = useState(false);

    // ✅ modal-only liters editing
    const [modalLiters, setModalLiters] = useState('');
    const [isSavingModal, setIsSavingModal] = useState(false);
    // ✅ NEW: track whether the input is in edit mode
    const [isEditingLiters, setIsEditingLiters] = useState(false);

    // ============================================
    // ✅ AUTO-REFRESH
    // ============================================

    useAutoRefresh(
        [
            "gso-trip-updated",
            "gso-trip-status-changed",
            "new-notification",
            "trip-completed",
            "gso-funds-released",
        ],
        () => {
            queryClient.invalidateQueries({ queryKey: ["gso-fuel-receipts"] });
        }
    );

    // ============================================
    // ✅ OPTIMIZED QUERY
    // ============================================

    const { data: receiptsResponse, isLoading } = useOptimizedQuery({
        queryKey: ["gso-fuel-receipts"],
        queryFn: async () => {
            try {
                const response = await gsoAPI.getFuelReceipts();
                const receipts = response?.data?.data;
                return Array.isArray(receipts) ? receipts : [];
            } catch (error) {
                console.error('Error fetching fuel receipts:', error);
                toast.error('Failed to load fuel receipts');
                return [];
            }
        },
        staleTime: 5 * 60 * 1000,
        keepPreviousData: true,
    });

    const receipts = useMemo(() => extractReceiptsArray(receiptsResponse), [receiptsResponse]);

    const filteredReceipts = useMemo(() => {
        const safeReceipts = Array.isArray(receipts) ? receipts : [];
        if (!searchTerm) return safeReceipts;
        const search = searchTerm.toLowerCase();
        return safeReceipts.filter((receipt) =>
            receipt?.ticket_number?.toLowerCase().includes(search) ||
            receipt?.plate_number?.toLowerCase().includes(search) ||
            receipt?.driver_name?.toLowerCase().includes(search) ||
            receipt?.vehicle_model?.toLowerCase().includes(search)
        );
    }, [receipts, searchTerm]);

    const connectionStatus = isConnected ? "🟢 Live" : "🔴 Offline";
    const isRealTime = isConnected;

    const stats = useMemo(() => {
        const safeReceipts = Array.isArray(receipts) ? receipts : [];
        return [
            {
                title: 'Total Receipts',
                value: safeReceipts.length,
                icon: Receipt,
                color: 'from-blue-500 to-blue-600',
                subtitle: `${filteredReceipts.length} shown`,
                trend: safeReceipts.length > 0 ? 8 : 0,
            },
            {
                title: 'Pending',
                value: safeReceipts.filter(r => r?.status === 'pending').length,
                icon: Clock,
                color: 'from-yellow-500 to-yellow-600',
                subtitle: 'Awaiting verification',
                trend: 0,
            },
            {
                title: 'Verified',
                value: safeReceipts.filter(r => r?.status === 'verified' || r?.status === 'approved').length,
                icon: CheckCircle,
                color: 'from-green-500 to-emerald-600',
                subtitle: 'Approved receipts',
                trend: 0,
            },
            {
                title: 'Discrepancy',
                value: safeReceipts.filter(r => r?.status === 'discrepancy' || r?.status === 'rejected').length,
                icon: AlertTriangle,
                color: 'from-red-500 to-rose-600',
                subtitle: 'Needs attention',
                trend: 0,
            },
        ];
    }, [receipts, filteredReceipts]);

    // ============================================
    // ✅ OPEN MODAL
    // - If receipt already has liters (> 0): show as read-only with Edit button
    // - If no liters yet: enter edit mode immediately
    // ============================================

    const handleOpenModal = useCallback((receipt) => {
        setSelectedReceipt(receipt);
        const existing = parseFloat(receipt.liters || receipt.liters_availed || 0);
        const hasLiters = existing > 0;

        setModalLiters(hasLiters ? String(existing) : '');
        setIsEditingLiters(!hasLiters); // ✅ auto-edit if no value yet
        setShowReceiptDialog(true);
    }, []);

    // ============================================
    // ✅ TOGGLE EDIT MODE
    // ============================================

    const handleStartEdit = useCallback(() => {
        if (!selectedReceipt) return;
        const existing = parseFloat(selectedReceipt.liters || selectedReceipt.liters_availed || 0);
        setModalLiters(existing > 0 ? String(existing) : '');
        setIsEditingLiters(true);
    }, [selectedReceipt]);

    const handleCancelEdit = useCallback(() => {
        if (!selectedReceipt) return;
        const existing = parseFloat(selectedReceipt.liters || selectedReceipt.liters_availed || 0);
        setModalLiters(existing > 0 ? String(existing) : '');
        setIsEditingLiters(false);
    }, [selectedReceipt]);

    // ============================================
    // ✅ SAVE LITERS — updates cache, no refetch
    // ============================================

    const handleSaveModalLiters = useCallback(async () => {
        if (!selectedReceipt) return;

        const id = selectedReceipt.id || selectedReceipt.fuel_receipt_id;
        const parsed = parseFloat(modalLiters);

        if (modalLiters === '' || isNaN(parsed) || parsed <= 0) {
            toast.error('Please enter a valid liters value (positive number)');
            return;
        }

        setIsSavingModal(true);
        try {
            const res = await gsoAPI.updateFuelReceiptLiters(id, parsed);
            const updated = res?.data?.data || {};

            // ✅ Update cache in place — no refetch
            queryClient.setQueryData(['gso-fuel-receipts'], (old) => {
                if (!Array.isArray(old)) return old;
                return old.map(r => {
                    const rid = r.id || r.fuel_receipt_id;
                    if (rid === id) {
                        return {
                            ...r,
                            liters: updated.liters_availed ?? parsed,
                            unit_price: updated.unit_price ?? r.unit_price,
                        };
                    }
                    return r;
                });
            });

            // ✅ Update selected receipt
            setSelectedReceipt(prev => prev ? {
                ...prev,
                liters: updated.liters_availed ?? parsed,
                unit_price: updated.unit_price ?? prev.unit_price,
            } : prev);

            // ✅ Lock the field back down — no longer editable until Edit clicked
            setModalLiters(String(updated.liters_availed ?? parsed));
            setIsEditingLiters(false);
            toast.success('Liters saved');
        } catch (err) {
            console.error('Save liters error:', err);
            toast.error(err?.response?.data?.message || 'Failed to save liters');
        } finally {
            setIsSavingModal(false);
        }
    }, [selectedReceipt, modalLiters, queryClient]);

    // ============================================
    // LOADING STATE
    // ============================================

    if (isLoading && !receiptsResponse) {
        return <LoadingSkeleton />;
    }

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="space-y-6 p-4 md:p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
                        <Receipt className="h-6 w-6 text-blue-600" />
                        Fuel Receipts
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        View and manage driver uploaded fuel receipts
                        <span className="ml-2 text-xs opacity-70">{connectionStatus}</span>
                        {isRealTime && (
                            <span className="ml-2 text-xs text-emerald-400 animate-pulse">
                                ● Auto-refresh
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                    <StatsCard key={index} {...stat} />
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                    placeholder="Search by ticket number, plate number, driver name, or vehicle model..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-11 h-12 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl shadow-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Receipts Table */}
            <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
                <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                                <Receipt className="h-5 w-5 text-blue-500" />
                                All Fuel Receipts
                            </CardTitle>
                            <CardDescription className="dark:text-slate-400">
                                {filteredReceipts.length} receipt(s) found
                                {filteredReceipts.length !== receipts.length && ` (filtered from ${receipts.length} total)`}
                                {isRealTime && (
                                    <span className="ml-2 text-xs text-emerald-500 animate-pulse">
                                        ● Live updates
                                    </span>
                                )}
                            </CardDescription>
                        </div>
                        {filteredReceipts.length > 0 && (
                            <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                                <Zap className="h-3 w-3 mr-1" />
                                {filteredReceipts.length} records
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    {filteredReceipts.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                                <Receipt className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">
                                No fuel receipts found
                            </p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                {receipts.length === 0
                                    ? 'Drivers will upload receipts here after fuel purchases'
                                    : 'Try adjusting your search terms'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Ticket #
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Vehicle
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Driver
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Trip Date
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {filteredReceipts.map((receipt) => (
                                        <tr
                                            key={receipt.id || receipt.fuel_receipt_id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                        >
                                            <td className="px-4 py-3">
                                                <span className="font-mono font-semibold text-slate-800 dark:text-white">
                                                    {receipt.ticket_number || receipt.trip_ticket_number || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                                        {receipt.plate_number || 'N/A'}
                                                    </span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                        {receipt.vehicle_model || 'N/A'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="text-slate-700 dark:text-slate-300">
                                                        {receipt.driver_name || 'N/A'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                    {formatDateShort(receipt.trip_date)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={receipt.status || receipt.reconciliation_status || 'pending'} />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleOpenModal(receipt)}
                                                    className="h-8 px-3 text-xs dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                                                >
                                                    View
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Receipt Detail Dialog */}
            <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto dark:bg-slate-800 dark:border-slate-700">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                                <Receipt className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-slate-800 dark:text-white">
                                    Fuel Receipt Details
                                </DialogTitle>
                                <DialogDescription className="dark:text-slate-400">
                                    {selectedReceipt?.ticket_number || selectedReceipt?.trip_ticket_number} • {formatDate(selectedReceipt?.uploaded_at)}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {selectedReceipt && (
                        <div className="space-y-6">
                            {/* Receipt Image */}
                            <ReceiptImage receipt={selectedReceipt} />

                            {/* Status Bar */}
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                <div className="flex-1">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Current Status</p>
                                    <div className="mt-1">
                                        <StatusBadge status={selectedReceipt.status || selectedReceipt.reconciliation_status || 'pending'} />
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Uploaded</p>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {formatTimeAgo(selectedReceipt.uploaded_at)}
                                    </p>
                                </div>
                            </div>

                            {/* Receipt Info Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Ticket Number</p>
                                    <p className="font-mono font-semibold text-slate-800 dark:text-white mt-0.5">
                                        {selectedReceipt.ticket_number || selectedReceipt.trip_ticket_number || 'N/A'}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Vehicle</p>
                                    <p className="font-semibold text-slate-800 dark:text-white mt-0.5 flex items-center gap-1.5">
                                        <Truck className="h-3.5 w-3.5 text-slate-400" />
                                        {selectedReceipt.plate_number || 'N/A'}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {selectedReceipt.vehicle_model || 'N/A'}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Driver</p>
                                    <p className="font-semibold text-slate-800 dark:text-white mt-0.5 flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5 text-slate-400" />
                                        {selectedReceipt.driver_name || 'N/A'}
                                    </p>
                                </div>

                                {/* ✅ LITERS — read-only by default, Edit button reveals input */}
                                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 md:col-span-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                                            Fuel Loaded (Liters) *
                                        </p>
                                        {!isEditingLiters && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={handleStartEdit}
                                                className="h-6 px-2 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/40"
                                            >
                                                <Pencil className="h-3 w-3 mr-1" />
                                                Edit
                                            </Button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 mt-1.5">
                                        <Fuel className="h-3.5 w-3.5 text-blue-500" />

                                        {isEditingLiters ? (
                                            <>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    autoComplete="off"
                                                    autoFocus
                                                    value={modalLiters}
                                                    disabled={isSavingModal}
                                                    onChange={(e) => {
                                                        const cleaned = sanitizeDecimalInput(e.target.value, 2);
                                                        setModalLiters(cleaned);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSaveModalLiters();
                                                        }
                                                        if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            handleCancelEdit();
                                                        }
                                                    }}
                                                    placeholder="0.00"
                                                    className="h-9 w-28 px-3 text-sm font-semibold rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">L</span>

                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleCancelEdit}
                                                    disabled={isSavingModal}
                                                    className="h-8 px-2 text-xs dark:border-slate-600 dark:text-slate-300"
                                                >
                                                    Cancel
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-base font-semibold text-slate-900 dark:text-white">
                                                    {modalLiters ? `${modalLiters} L` : '— not set —'}
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-1">
                                        {isEditingLiters
                                            ? 'Numbers only • Press Enter to save or Esc to cancel'
                                            : modalLiters
                                                ? 'Click Edit to change'
                                                : 'Click Edit to enter liters'}
                                    </p>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Trip Date</p>
                                    <p className="font-semibold text-slate-800 dark:text-white mt-0.5 flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                        {formatDate(selectedReceipt.trip_date)}
                                    </p>
                                </div>
                            </div>

                            {/* Distance Details */}
                            {selectedReceipt.gps_distance_km && (
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                        <Gauge className="h-4 w-4 text-blue-500" />
                                        Distance Details
                                    </h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">GPS Distance</p>
                                            <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                                                {selectedReceipt.gps_distance_km} km
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowReceiptDialog(false)}
                                    className="dark:border-slate-700 dark:text-slate-300"
                                >
                                    Close
                                </Button>
                                {isEditingLiters && (
                                    <Button
                                        onClick={handleSaveModalLiters}
                                        disabled={isSavingModal || modalLiters === ''}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                                    >
                                        {isSavingModal ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Save Liters
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FuelReceipts;
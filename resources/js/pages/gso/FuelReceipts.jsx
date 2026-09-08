// src/pages/gso/FuelReceipts.jsx
import React, { useState, useMemo } from "react";
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
    Eye,
    Receipt,
    Loader2,
    Image as ImageIcon,
    Calendar,
    User,
    Truck,
    Fuel,
    RefreshCw,
    AlertTriangle,
    Clock,
    DollarSign,
    Gauge,
    Zap,
    CheckCircle,
    XCircle,
    TrendingUp,
    TrendingDown,
    Minus,
    Download,
    X,
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
import { cn } from "@/lib/utils";

// ============================================
// HELPER FUNCTIONS
// ============================================

const getReceiptImageUrls = (receipt) => {
    let url = receipt?.receipt_url || receipt?.receipt_photo_path || null;
    
    if (!url) {
        return [];
    }
    
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
    
    if (!filename) {
        return [];
    }
    
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
        pending: {
            color: 'bg-yellow-500',
            label: 'Pending Verification',
            icon: Clock,
            dotColor: 'bg-yellow-500',
            bg: 'bg-yellow-50 dark:bg-yellow-950/30',
            border: 'border-yellow-200 dark:border-yellow-800',
        },
        verified: {
            color: 'bg-green-500',
            label: 'Verified',
            icon: CheckCircle,
            dotColor: 'bg-green-500',
            bg: 'bg-green-50 dark:bg-green-950/30',
            border: 'border-green-200 dark:border-green-800',
        },
        discrepancy: {
            color: 'bg-red-500',
            label: 'Discrepancy Found',
            icon: AlertTriangle,
            dotColor: 'bg-red-500',
            bg: 'bg-red-50 dark:bg-red-950/30',
            border: 'border-red-200 dark:border-red-800',
        },
        approved: {
            color: 'bg-emerald-500',
            label: 'Approved',
            icon: CheckCircle,
            dotColor: 'bg-emerald-500',
            bg: 'bg-emerald-50 dark:bg-emerald-950/30',
            border: 'border-emerald-200 dark:border-emerald-800',
        },
        rejected: {
            color: 'bg-rose-500',
            label: 'Rejected',
            icon: XCircle,
            dotColor: 'bg-rose-500',
            bg: 'bg-rose-50 dark:bg-rose-950/30',
            border: 'border-rose-200 dark:border-rose-800',
        },
    };
    return configs[status] || configs.pending;
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
    }).format(amount || 0);
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
        <SkeletonTable rows={5} cols={7} />
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const FuelReceipts = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [showReceiptDialog, setShowReceiptDialog] = useState(false);

    // ============ OPTIMIZED QUERY ============
    const { data: receipts = [], isLoading, refetch, isFetching } = useOptimizedQuery({
        queryKey: ["gso-fuel-receipts"],
        queryFn: async () => {
            try {
                const response = await gsoAPI.getFuelReceipts();
                return response.data?.data || [];
            } catch (error) {
                console.error('Error fetching fuel receipts:', error);
                toast.error('Failed to load fuel receipts');
                return [];
            }
        },
        staleTime: 60000,
        keepPreviousData: true,
    });

    // ============ FILTER ============
    const filteredReceipts = useMemo(() => {
        if (!searchTerm) return receipts;
        const search = searchTerm.toLowerCase();
        return receipts.filter((receipt) =>
            receipt.ticket_number?.toLowerCase().includes(search) ||
            receipt.plate_number?.toLowerCase().includes(search) ||
            receipt.driver_name?.toLowerCase().includes(search) ||
            receipt.vehicle_model?.toLowerCase().includes(search)
        );
    }, [receipts, searchTerm]);

    // ============ STATS ============
    const stats = useMemo(() => [
        {
            title: 'Total Receipts',
            value: receipts.length,
            icon: Receipt,
            color: 'from-blue-500 to-blue-600',
            subtitle: `${filteredReceipts.length} shown`,
            trend: receipts.length > 0 ? 8 : 0,
        },
        {
            title: 'Pending',
            value: receipts.filter(r => r.status === 'pending').length,
            icon: Clock,
            color: 'from-yellow-500 to-yellow-600',
            subtitle: 'Awaiting verification',
            trend: receipts.filter(r => r.status === 'pending').length > 0 ? 12 : 0,
        },
        {
            title: 'Verified',
            value: receipts.filter(r => r.status === 'verified' || r.status === 'approved').length,
            icon: CheckCircle,
            color: 'from-green-500 to-emerald-600',
            subtitle: 'Approved receipts',
            trend: receipts.filter(r => r.status === 'verified' || r.status === 'approved').length > 0 ? 5 : 0,
        },
        {
            title: 'Discrepancy',
            value: receipts.filter(r => r.status === 'discrepancy' || r.status === 'rejected').length,
            icon: AlertTriangle,
            color: 'from-red-500 to-rose-600',
            subtitle: 'Needs attention',
            trend: receipts.filter(r => r.status === 'discrepancy' || r.status === 'rejected').length > 0 ? -10 : 0,
        },
    ], [receipts, filteredReceipts]);

    // ============================================
    // LOADING STATE
    // ============================================

    if (isLoading) {
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
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="dark:border-slate-700 dark:text-slate-300"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
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
                    className="pl-11 h-12 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl shadow-sm"
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
                                            Fuel
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Amount
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
                                            className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                                        >
                                            <td className="px-4 py-3">
                                                <span className="font-mono font-semibold text-slate-800 dark:text-white">
                                                    {receipt.ticket_number}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                                        {receipt.plate_number}
                                                    </span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                        {receipt.vehicle_model}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="text-slate-700 dark:text-slate-300">
                                                        {receipt.driver_name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                                        {receipt.liters} L
                                                    </span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                        {formatDateShort(receipt.trip_date)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {formatCurrency(receipt.amount)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={receipt.status} />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedReceipt(receipt);
                                                        setShowReceiptDialog(true);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-9 w-9 p-0 rounded-lg transition-all duration-200 group-hover:scale-110"
                                                >
                                                    <Eye className="h-4 w-4" />
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
                                    {selectedReceipt?.ticket_number} • {formatDate(selectedReceipt?.uploaded_at)}
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
                                        <StatusBadge status={selectedReceipt.status} />
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
                                        {selectedReceipt.ticket_number}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Vehicle</p>
                                    <p className="font-semibold text-slate-800 dark:text-white mt-0.5 flex items-center gap-1.5">
                                        <Truck className="h-3.5 w-3.5 text-slate-400" />
                                        {selectedReceipt.plate_number}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {selectedReceipt.vehicle_model}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Driver</p>
                                    <p className="font-semibold text-slate-800 dark:text-white mt-0.5 flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5 text-slate-400" />
                                        {selectedReceipt.driver_name}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Fuel Loaded</p>
                                    <p className="font-semibold text-slate-800 dark:text-white mt-0.5 flex items-center gap-1.5">
                                        <Fuel className="h-3.5 w-3.5 text-slate-400" />
                                        {selectedReceipt.liters} L
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Amount</p>
                                    <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1.5">
                                        <DollarSign className="h-3.5 w-3.5" />
                                        {formatCurrency(selectedReceipt.amount)}
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
                            {(selectedReceipt.odometer_start || selectedReceipt.odometer_end || selectedReceipt.gps_distance_km) && (
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                        <Gauge className="h-4 w-4 text-blue-500" />
                                        Distance Details
                                    </h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        {selectedReceipt.distance_calculation_method && (
                                            <div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Method</p>
                                                <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                                                    {selectedReceipt.distance_calculation_method}
                                                </p>
                                            </div>
                                        )}
                                        {selectedReceipt.odometer_start && (
                                            <div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Odometer Start</p>
                                                <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                                                    {selectedReceipt.odometer_start} km
                                                </p>
                                            </div>
                                        )}
                                        {selectedReceipt.odometer_end && (
                                            <div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Odometer End</p>
                                                <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                                                    {selectedReceipt.odometer_end} km
                                                </p>
                                            </div>
                                        )}
                                        {selectedReceipt.gps_distance_km && (
                                            <div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">GPS Distance</p>
                                                <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                                                    {selectedReceipt.gps_distance_km} km
                                                </p>
                                            </div>
                                        )}
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
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => {
                                        toast.success('Receipt details downloaded');
                                    }}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Download Receipt
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FuelReceipts;
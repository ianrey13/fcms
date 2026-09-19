// src/pages/mayor/MayorReceiptVerification.jsx
import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import { mayorsOfficeAPI } from "../../services/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Receipt,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Eye,
  Image as ImageIcon,
  User,
  Truck,
  Fuel,
  DollarSign,
  Clock,
  Building2,
  Edit,
  X,
  AlertCircle,
  Calculator,
  FileText,
  Calendar,
  ArrowLeft,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  History,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ============================================
// HELPER FUNCTIONS - PRIORITIZE PUBLIC FOLDER
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
                <p className="text-slate-600 dark:text-slate-400 font-medium">No receipt image uploaded</p>
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
        </div>
    );
};

// ============================================
// STATS CARD
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
                <Minus className="h-3 w-3 text-slate-400" />
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
// STATUS BADGE
// ============================================

const StatusBadge = ({ status }) => {
  const configs = {
    verified: { color: "bg-green-500", label: "Verified", icon: CheckCircle },
    pending: { color: "bg-yellow-500", label: "Pending", icon: Clock },
    discrepancy: { color: "bg-red-500", label: "Discrepancy", icon: AlertCircle },
    rejected: { color: "bg-rose-500", label: "Rejected", icon: X },
  };
  const config = configs[status] || configs.pending;
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

// ============================================
// FORMATTING HELPERS
// ============================================

const formatDate = (date) => {
  if (!date) return "N/A";
  try {
    return format(new Date(date), "MMM dd, yyyy hh:mm a");
  } catch {
    return "N/A";
  }
};

const formatCurrency = (amount) => {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount === 0) return "₱0.00";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(numAmount);
};

// ============================================
// LOADING SKELETON
// ============================================

const LoadingSkeleton = () => (
  <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="h-12 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-28 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
      ))}
    </div>
    <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const MayorReceiptVerification = () => {
  const queryClient = useQueryClient();
  const { isConnected } = useRealtime();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "verified"
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    invoice_number: "",
    amount_on_receipt: "",
    unit_price: "",
    liters_availed: "",
  });

  // ============================================
  // QUERIES
  // ============================================

  // Pending receipts
  const {
    data: pendingReceipts = [],
    isLoading: isLoadingPending,
    isFetching: isFetchingPending,
  } = useQuery({
    queryKey: ["mayor-receipt-verification", "pending"],
    queryFn: async () => {
      const response = await mayorsOfficeAPI.getReceiptsForVerification();
      return response.data?.data || [];
    },
  });

  // Verified receipts (new endpoint)
  const {
    data: verifiedReceipts = [],
    isLoading: isLoadingVerified,
    isFetching: isFetchingVerified,
  } = useQuery({
    queryKey: ["mayor-receipt-verification", "verified"],
    queryFn: async () => {
      const response = await mayorsOfficeAPI.getVerifiedReceipts();
      return response.data?.data || [];
    },
  });

  // ============================================
  // AUTO-REFRESH
  // ============================================

  useAutoRefresh(
    ["mayor-trip-updated", "new-notification", "trip-completed"],
    () => {
      queryClient.invalidateQueries({ queryKey: ["mayor-receipt-verification"] });
    }
  );

  // ============================================
  // MUTATION
  // ============================================

  const verifyMutation = useMutation({
    mutationFn: async ({ receiptId, data }) => {
      const response = await mayorsOfficeAPI.verifyReceipt(receiptId, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Receipt verified and updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["mayor-receipt-verification"] });
      setShowReceiptModal(false);
      setSelectedReceipt(null);
      setIsEditing(false);
    },
    onError: (error) => {
      let message = "Failed to verify receipt";
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        if (typeof errors === 'object') {
          message = Object.values(errors).flat().join('\n');
        }
      } else if (error.response?.data?.message) {
        message = error.response.data.message;
      }
      toast.error(message);
    },
  });

  // ============================================
  // HANDLERS
  // ============================================

  const openReceiptModal = (receipt) => {
    setSelectedReceipt(receipt);
    setEditData({
      invoice_number: receipt.invoice_number || "",
      amount_on_receipt: receipt.amount || "",
      unit_price: receipt.unit_price || "",
      liters_availed: receipt.liters || "",
    });
    setIsEditing(false);
    setShowReceiptModal(true);
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setEditData({
        invoice_number: selectedReceipt?.invoice_number || "",
        amount_on_receipt: selectedReceipt?.amount || "",
        unit_price: selectedReceipt?.unit_price || "",
        liters_availed: selectedReceipt?.liters || "",
      });
    }
    setIsEditing(!isEditing);
  };

  const handleInputChange = useCallback((field, value) => {
    if (value === '' || value === null || value === undefined) {
      setEditData(prev => ({ ...prev, [field]: '' }));
      return;
    }

    const updatedData = { ...editData, [field]: value };

    if (field === 'amount_on_receipt' || field === 'unit_price') {
      const amount = parseFloat(field === 'amount_on_receipt' ? value : updatedData.amount_on_receipt);
      const unitPrice = parseFloat(field === 'unit_price' ? value : updatedData.unit_price);

      if (!isNaN(amount) && !isNaN(unitPrice) && amount > 0 && unitPrice > 0) {
        const calculatedLiters = amount / unitPrice;
        updatedData.liters_availed = calculatedLiters.toFixed(2);
      }
    }

    setEditData(updatedData);
  }, [editData]);

  const handleVerify = () => {
    const amount = parseFloat(editData.amount_on_receipt) || 0;
    const unitPrice = parseFloat(editData.unit_price) || 0;
    const liters = parseFloat(editData.liters_availed) || 0;

    if (!editData.amount_on_receipt || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!editData.unit_price || unitPrice <= 0) {
      toast.error("Please enter a valid unit price");
      return;
    }
    if (!editData.liters_availed || liters <= 0) {
      toast.error("Liters calculation failed. Please check amount and unit price.");
      return;
    }

    const payload = {
      invoice_number: editData.invoice_number || null,
      amount_on_receipt: amount,
      unit_price: unitPrice,
      liters_availed: liters,
    };

    verifyMutation.mutate({
      receiptId: selectedReceipt.id || selectedReceipt.fuel_receipt_id,
      data: payload,
    });
  };

  // ============================================
  // DERIVED
  // ============================================

  // Active list depends on tab
  const activeList = activeTab === "pending" ? pendingReceipts : verifiedReceipts;

  const filteredReceipts = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return activeList.filter((receipt) => {
      return (
        receipt.ticket_number?.toLowerCase().includes(search) ||
        receipt.driver_name?.toLowerCase().includes(search) ||
        receipt.plate_number?.toLowerCase().includes(search) ||
        receipt.department_name?.toLowerCase().includes(search)
      );
    });
  }, [activeList, searchTerm]);

  const pendingCount = pendingReceipts.length;
  const verifiedCount = verifiedReceipts.length;
  const totalCount = pendingCount + verifiedCount;
  const totalAmount = useMemo(
    () =>
      [...pendingReceipts, ...verifiedReceipts].reduce(
        (sum, r) => sum + parseFloat(r.amount || 0),
        0
      ),
    [pendingReceipts, verifiedReceipts]
  );

  const connectionStatus = isConnected ? "🟢 Live" : "🔴 Offline";
  const isRealTime = isConnected;

  const stats = [
    {
      title: "Total Receipts",
      value: totalCount,
      icon: Receipt,
      color: "from-blue-500 to-blue-600",
      subtitle: "Pending + verified",
      trend: totalCount > 0 ? 5 : 0,
    },
    {
      title: "Pending",
      value: pendingCount,
      icon: Clock,
      color: "from-yellow-500 to-yellow-600",
      subtitle: "Awaiting verification",
      trend: pendingCount > 0 ? 8 : 0,
    },
    {
      title: "Verified",
      value: verifiedCount,
      icon: CheckCircle,
      color: "from-green-500 to-emerald-600",
      subtitle: "Approved receipts",
      trend: verifiedCount > 0 ? 12 : 0,
    },
    {
      title: "Total Amount",
      value: formatCurrency(totalAmount),
      icon: DollarSign,
      color: "from-purple-500 to-purple-600",
      subtitle: "All fuel cost",
      trend: totalAmount > 0 ? 3 : 0,
    },
  ];

  const isLoading =
    (activeTab === "pending" && isLoadingPending) ||
    (activeTab === "verified" && isLoadingVerified);

  if (isLoading && activeList.length === 0) {
    return <LoadingSkeleton />;
  }

  const isVerifiedView = activeTab === "verified";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="space-y-6 p-4 md:p-6 animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.back()}
              className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20">
                  <Receipt className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    Receipt Verification
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Verify and edit driver uploaded fuel receipts
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
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              activeTab === "pending"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Clock className="h-4 w-4" />
            Pending
            {pendingCount > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-0 text-[10px] h-5 px-1.5">
                {pendingCount}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("verified")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              activeTab === "verified"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <History className="h-4 w-4" />
            Verified
            {verifiedCount > 0 && (
              <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-0 text-[10px] h-5 px-1.5">
                {verifiedCount}
              </Badge>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by ticket number, driver, plate, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-12 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl shadow-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Receipts Table */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                  {isVerifiedView ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Verified Receipts History
                    </>
                  ) : (
                    <>
                      <Receipt className="h-5 w-5 text-green-500" />
                      Fuel Receipts for Verification
                    </>
                  )}
                </CardTitle>
                <CardDescription className="dark:text-slate-400">
                  {filteredReceipts.length} receipt{filteredReceipts.length !== 1 ? 's' : ''} found
                  {filteredReceipts.length !== activeList.length && ` (filtered from ${activeList.length} total)`}
                  {isRealTime && (
                    <span className="ml-2 text-xs text-emerald-500 animate-pulse">
                      ● Live updates
                    </span>
                  )}
                </CardDescription>
              </div>
              {filteredReceipts.length > 0 && (
                <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
                  <Zap className="h-3 w-3 mr-1" />
                  {filteredReceipts.length} records
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6 p-0">
            {filteredReceipts.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  {isVerifiedView ? (
                    <History className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                  ) : (
                    <Receipt className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">
                  {isVerifiedView ? "No verified receipts yet" : "No receipts found"}
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  {searchTerm
                    ? 'Try adjusting your search'
                    : isVerifiedView
                      ? 'Verified receipts will appear here'
                      : 'Receipts will appear here when uploaded'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        Ticket #
                      </TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        Driver
                      </TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        Vehicle
                      </TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        Department
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        Liters
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        Amount
                      </TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        {isVerifiedView ? "Verified On" : "Status"}
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceipts.map((receipt) => (
                      <TableRow
                        key={receipt.id || receipt.fuel_receipt_id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
                        onClick={() => openReceiptModal(receipt)}
                      >
                        <TableCell className="font-mono font-semibold text-slate-800 dark:text-white">
                          {receipt.ticket_number}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                              {receipt.driver_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Truck className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-700 dark:text-slate-300">{receipt.plate_number}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                              {receipt.department_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-700 dark:text-slate-300">
                          {receipt.liters} L
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(receipt.amount)}
                        </TableCell>
                        <TableCell>
                          {isVerifiedView ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-slate-600 dark:text-slate-400">
                                {formatDate(receipt.verified_at)}
                              </span>
                              {receipt.verified_by_name && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                  by {receipt.verified_by_name}
                                </span>
                              )}
                            </div>
                          ) : (
                            <StatusBadge status={receipt.status} />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant={isVerifiedView ? "outline" : "default"}
                              onClick={(e) => {
                                e.stopPropagation();
                                openReceiptModal(receipt);
                              }}
                              className={cn(
                                "h-8 px-3 rounded-lg shadow-sm transition-all duration-200 hover:scale-105 active:scale-95",
                                !isVerifiedView &&
                                  "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-emerald-500/20"
                              )}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              {isVerifiedView ? "View" : "Review"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt Detail Modal */}
        <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-slate-800 dark:border-slate-700">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-green-500/10">
                    <Receipt className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-slate-900 dark:text-white">
                      Fuel Receipt Details
                    </DialogTitle>
                    <DialogDescription className="dark:text-slate-400">
                      {selectedReceipt?.ticket_number} • {formatDate(selectedReceipt?.trip_date)}
                    </DialogDescription>
                  </div>
                </div>
                {/* Only show Edit button on pending receipts */}
                {selectedReceipt?.status !== "verified" && !isVerifiedView && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditToggle}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {isEditing ? (
                      <>
                        <X className="h-4 w-4 mr-1" />
                        Cancel Edit
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </>
                    )}
                  </Button>
                )}
              </div>
            </DialogHeader>

            {selectedReceipt && (
              <div className="space-y-4">
                {/* Status Bar */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Current Status</p>
                    <div className="mt-1">
                      <StatusBadge status={selectedReceipt.status} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedReceipt.status === "verified" && selectedReceipt.verified_at
                        ? "Verified On"
                        : "Uploaded"}
                    </p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {selectedReceipt.status === "verified" && selectedReceipt.verified_at
                        ? formatDate(selectedReceipt.verified_at)
                        : formatDate(selectedReceipt.uploaded_at)}
                    </p>
                    {selectedReceipt.status === "verified" && selectedReceipt.verified_by_name && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        by {selectedReceipt.verified_by_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Receipt Image */}
                <ReceiptImage receipt={selectedReceipt} />

                {/* Receipt Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Ticket Number</p>
                    <p className="font-medium text-slate-800 dark:text-white flex items-center gap-1">
                      <FileText className="h-3 w-3 text-slate-400" />
                      {selectedReceipt.ticket_number}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Driver</p>
                    <p className="font-medium text-slate-800 dark:text-white flex items-center gap-1">
                      <User className="h-3 w-3 text-slate-400" />
                      {selectedReceipt.driver_name}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Vehicle</p>
                    <p className="font-medium text-slate-800 dark:text-white flex items-center gap-1">
                      <Truck className="h-3 w-3 text-slate-400" />
                      {selectedReceipt.plate_number}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Department</p>
                    <p className="font-medium text-slate-800 dark:text-white flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-slate-400" />
                      {selectedReceipt.department_name}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Fuel Type</p>
                    <p className="font-medium text-slate-800 dark:text-white flex items-center gap-1">
                      <Fuel className="h-3 w-3 text-slate-400" />
                      {selectedReceipt.fuel_type || "N/A"}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Trip Date</p>
                    <p className="font-medium text-slate-800 dark:text-white flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      {formatDate(selectedReceipt.trip_date)}
                    </p>
                  </div>
                </div>

                {/* Editable / Read-only Fields */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Invoice Number</p>
                    {isEditing && !isVerifiedView ? (
                      <Input
                        value={editData.invoice_number}
                        onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                        className="mt-1 dark:bg-slate-900 dark:border-slate-700 h-9 text-sm dark:text-white"
                        placeholder="Invoice #"
                      />
                    ) : (
                      <p className="font-medium text-slate-800 dark:text-white text-sm">
                        {selectedReceipt.invoice_number || "N/A"}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Amount (₱)</p>
                    {isEditing && !isVerifiedView ? (
                      <div className="relative mt-1">
                        <span className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">₱</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editData.amount_on_receipt}
                          onChange={(e) => handleInputChange('amount_on_receipt', e.target.value)}
                          className="pl-6 dark:bg-slate-900 dark:border-slate-700 h-9 text-sm dark:text-white"
                          placeholder="0.00"
                        />
                      </div>
                    ) : (
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatCurrency(selectedReceipt.amount)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Unit Price (₱/L)</p>
                    {isEditing && !isVerifiedView ? (
                      <div className="relative mt-1">
                        <span className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">₱</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editData.unit_price}
                          onChange={(e) => handleInputChange('unit_price', e.target.value)}
                          className="pl-6 dark:bg-slate-900 dark:border-slate-700 h-9 text-sm dark:text-white"
                          placeholder="0.00"
                        />
                      </div>
                    ) : (
                      <p className="font-medium text-slate-800 dark:text-white text-sm">
                        {formatCurrency(selectedReceipt.unit_price)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Liters (L)
                      {isEditing && !isVerifiedView && (
                        <span className="ml-1 text-blue-500" title="Auto-calculated">
                          <Calculator className="h-3 w-3 inline" />
                        </span>
                      )}
                    </p>
                    {isEditing && !isVerifiedView ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editData.liters_availed}
                        className="mt-1 h-9 text-sm bg-slate-50 dark:bg-slate-800 cursor-not-allowed text-slate-500 dark:text-slate-400"
                        placeholder="Auto-calc"
                        disabled={true}
                      />
                    ) : (
                      <p className="font-medium text-slate-800 dark:text-white text-sm">
                        {selectedReceipt.liters} L
                      </p>
                    )}
                  </div>
                </div>

                {/* Edit Help */}
                {isEditing && !isVerifiedView && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Info className="h-4 w-4 inline mr-1 text-blue-500 dark:text-blue-400" />
                    Enter the <strong>Amount (₱)</strong> and <strong>Unit Price (₱/L)</strong>.
                    Liters will be auto-calculated using: <strong>Liters = Amount ÷ Unit Price</strong>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between pt-4 border-t dark:border-slate-700 gap-3">
                  <div className="flex items-center gap-2">
                    {isEditing && !isVerifiedView && (
                      <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">
                        <Edit className="h-3 w-3 mr-1" />
                        Editing
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {isEditing && !isVerifiedView && (
                      <Button
                        variant="outline"
                        onClick={handleEditToggle}
                        className="dark:border-slate-600 dark:text-slate-300"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    )}

                    {!isVerifiedView && selectedReceipt.status !== "verified" && (
                      <Button
                        onClick={handleVerify}
                        className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-white"
                        disabled={verifyMutation.isPending}
                      >
                        {verifyMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            {isEditing ? 'Saving & Verifying...' : 'Verifying...'}
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {isEditing ? 'Save & Verify' : 'Verify Receipt'}
                          </>
                        )}
                      </Button>
                    )}

                    {isVerifiedView && (
                      <Button variant="outline" disabled className="dark:border-slate-700 dark:text-slate-400">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                        Already Verified
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
          <p>FCMS - Mayor's Office • Receipt Verification</p>
          <p className="mt-0.5">
            {totalCount} total receipts • {verifiedCount} verified • {pendingCount} pending
          </p>
        </div>
      </div>
    </div>
  );
};

export default MayorReceiptVerification;
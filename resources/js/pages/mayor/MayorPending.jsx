// src/pages/mayor/MayorPending.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { mayorsOfficeAPI } from "../../services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Clock,
  DollarSign,
  Eye,
  RefreshCw,
  Loader2,
  MapPin,
  Truck,
  User,
  XCircle,
  Info,
  AlertCircle,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  Receipt,
  Image as ImageIcon,
  Search,
  X,
  AlertTriangle,
  HelpCircle,
  Calendar,
  CalendarCheck,
  CalendarDays,
  ArrowLeft,
  Zap,
  Shield,
  Gauge,
  Fuel,
  TrendingUp,
  TrendingDown,
  Minus,
  Calculator,
  Printer,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import GasSlipView from "../../pages/mayor/reports/GasSlipView";

// ============================================================
// STATS CARD COMPONENT
// ============================================================

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

// ============================================================
// TRIP DATE BADGE COMPONENT
// ============================================================

const TripDateBadge = ({ ticket }) => {
  if (!ticket?.trip_date) return null;
  
  const tripDate = new Date(ticket.trip_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  tripDate.setHours(0, 0, 0, 0);
  
  const isToday = tripDate.getTime() === today.getTime();
  const isPast = tripDate.getTime() < today.getTime();
  const isFuture = tripDate.getTime() > today.getTime();
  const isTripFriday = tripDate.getDay() === 5;
  
  const daysUntil = Math.ceil((tripDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  let label = '';
  let color = '';
  let icon = Calendar;
  
  if (isToday) {
    label = 'Today';
    color = 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
    icon = CalendarCheck;
  } else if (isPast) {
    label = 'Past Trip';
    color = 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
    icon = CalendarDays;
  } else if (isFuture && isTripFriday) {
    label = `Friday (${daysUntil}d)`;
    color = 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800';
    icon = Calendar;
  } else if (isFuture && daysUntil === 1) {
    label = '⚠️ Tomorrow';
    color = 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
    icon = AlertTriangle;
  } else if (isFuture && daysUntil <= 7) {
    label = `📅 ${daysUntil}d`;
    color = 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
    icon = AlertCircle;
  } else if (isFuture) {
    label = `📅 ${daysUntil}d`;
    color = 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    icon = AlertTriangle;
  } else {
    label = 'N/A';
    color = 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    icon = Clock;
  }
  
  const Icon = icon;
  return (
    <Badge variant="outline" className={`${color} text-xs font-medium flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
};

// ============================================================
// RECEIPT VERIFICATION MODAL
// ============================================================

const ReceiptVerificationModal = ({
  isOpen,
  onClose,
  receipt,
  onVerify,
  onRefresh,
}) => {
  const [verifying, setVerifying] = useState(false);

  if (!isOpen || !receipt) return null;

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await onVerify(receipt.id);
      toast.success("Receipt verified successfully!");
      onClose();
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to verify receipt");
    } finally {
      setVerifying(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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

  const isVerified = receipt.status === "verified";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-slate-800 dark:border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <div className="p-2 rounded-xl bg-green-500/10">
              <Receipt className="h-5 w-5 text-green-600" />
            </div>
            Fuel Receipt Verification
          </DialogTitle>
          <DialogDescription className="dark:text-slate-400">
            Review the uploaded fuel receipt for {receipt.ticket_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Receipt Image */}
          {receipt.receipt_url ? (
            <div className="border rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/50">
              <img
                src={receipt.receipt_url}
                alt="Fuel Receipt"
                className="w-full max-h-64 object-contain"
                onError={(e) => {
                  e.target.src = "/placeholder-receipt.png";
                  e.target.alt = "Receipt image not available";
                }}
              />
            </div>
          ) : (
            <div className="border rounded-xl p-8 text-center bg-slate-50 dark:bg-slate-900/50">
              <ImageIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">
                No receipt image uploaded
              </p>
            </div>
          )}

          {/* Receipt Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400">Ticket Number</p>
              <p className="font-medium text-slate-900 dark:text-white">{receipt.ticket_number}</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400">Driver</p>
              <p className="font-medium text-slate-900 dark:text-white">{receipt.driver_name}</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400">Vehicle</p>
              <p className="font-medium text-slate-900 dark:text-white">{receipt.plate_number}</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400">Liters</p>
              <p className="font-medium text-slate-900 dark:text-white">{receipt.liters} L</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400">Amount</p>
              <p className="font-medium text-green-600 dark:text-green-400">{formatCurrency(receipt.amount)}</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400">Trip Date</p>
              <p className="font-medium text-slate-900 dark:text-white">{formatDate(receipt.trip_date)}</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
              <Badge className={isVerified ? "bg-green-500" : "bg-yellow-500"}>
                {isVerified ? "Verified" : "Pending"}
              </Badge>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400">Fuel Type</p>
              <p className="font-medium text-slate-900 dark:text-white">{receipt.fuel_type || "N/A"}</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400">Uploaded</p>
              <p className="font-medium text-slate-900 dark:text-white">{formatDate(receipt.uploaded_at)}</p>
            </div>
          </div>

          {/* Distance Details */}
          {(receipt.odometer_start || receipt.odometer_end || receipt.gps_distance_km) && (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-medium mb-2 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-blue-500" />
                Distance Details
              </h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Method</p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {receipt.distance_calculation_method || "N/A"}
                  </p>
                </div>
                {receipt.odometer_start && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Odometer Start</p>
                    <p className="font-medium text-slate-900 dark:text-white">{receipt.odometer_start} km</p>
                  </div>
                )}
                {receipt.odometer_end && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Odometer End</p>
                    <p className="font-medium text-slate-900 dark:text-white">{receipt.odometer_end} km</p>
                  </div>
                )}
                {receipt.gps_distance_km && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">GPS Distance</p>
                    <p className="font-medium text-slate-900 dark:text-white">{receipt.gps_distance_km} km</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t dark:border-slate-700">
            <Button
              onClick={handleVerify}
              disabled={isVerified || verifying}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {isVerified ? "Already Verified" : "Verify Receipt"}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 dark:border-slate-700 dark:text-slate-300"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const MayorPending = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [amountReleased, setAmountReleased] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  // ✅ Gas Slip State
  const [showGasSlip, setShowGasSlip] = useState(false);
  const [selectedGasSlipTicket, setSelectedGasSlipTicket] = useState(null);

  const [isCrossDepartment, setIsCrossDepartment] = useState(false);
  const [crossDepartmentReason, setCrossDepartmentReason] = useState("");
  const [showCrossDepartmentWarning, setShowCrossDepartmentWarning] = useState(false);

  const [tripDateValidation, setTripDateValidation] = useState(null);
  const [isForceApprove, setIsForceApprove] = useState(false);
  const [forceApproveReason, setForceApproveReason] = useState("");

  const [chargeToDepartmentId, setChargeToDepartmentId] = useState("");
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  // ✅ Calculate estimated cost from ticket
  const getEstimatedCost = (ticket) => {
    if (!ticket) return 0;
    return ticket.estimated_cost || 
           (ticket.estimated_fuel_liters ? ticket.estimated_fuel_liters * 88 : 0);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await mayorsOfficeAPI.getPendingTickets();
      const ticketsData = response.data?.data || response.data || [];
      setTickets(Array.isArray(ticketsData) ? ticketsData : []);
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTickets();
    toast.success("Tickets refreshed");
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDepartmentFilter("all");
  };

  const uniqueDepartments = [
    ...new Map(
      tickets.map((ticket) => [ticket.department_id, ticket.department_name]),
    ).entries(),
  ].map(([id, name]) => ({ department_id: id, department_name: name }));

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      searchTerm === "" ||
      ticket.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.trip_ticket_number
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      ticket.destination?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.department_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDepartment =
      departmentFilter === "all" ||
      ticket.department_id?.toString() === departmentFilter;

    return matchesSearch && matchesDepartment;
  });

  // ============================================================
  // STATS
  // ============================================================

  const stats = [
    {
      title: "Total Pending",
      value: tickets.length,
      icon: Clock,
      color: "from-yellow-500 to-yellow-600",
      subtitle: "Awaiting approval",
      trend: tickets.length > 0 ? 5 : 0,
    },
    {
      title: "Today's Trips",
      value: tickets.filter(t => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tripDate = new Date(t.trip_date);
        tripDate.setHours(0, 0, 0, 0);
        return tripDate.getTime() === today.getTime();
      }).length,
      icon: CalendarCheck,
      color: "from-green-500 to-green-600",
      subtitle: "Can be released today",
    },
    {
      title: "Past Trips",
      value: tickets.filter(t => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tripDate = new Date(t.trip_date);
        tripDate.setHours(0, 0, 0, 0);
        return tripDate.getTime() < today.getTime();
      }).length,
      icon: CalendarDays,
      color: "from-blue-500 to-blue-600",
      subtitle: "Past due trips",
    },
    {
      title: "Future Trips",
      value: tickets.filter(t => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tripDate = new Date(t.trip_date);
        tripDate.setHours(0, 0, 0, 0);
        return tripDate.getTime() > today.getTime();
      }).length,
      icon: Calendar,
      color: "from-purple-500 to-purple-600",
      subtitle: "Scheduled ahead",
    },
  ];

  // ============================================================
  // HELPERS
  // ============================================================

  const checkTripDateValidation = (ticket) => {
    if (!ticket?.trip_date) return null;
    
    const tripDate = new Date(ticket.trip_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    tripDate.setHours(0, 0, 0, 0);
    
    const isToday = tripDate.getTime() === today.getTime();
    const isPast = tripDate.getTime() < today.getTime();
    const isFuture = tripDate.getTime() > today.getTime();
    const isTripFriday = tripDate.getDay() === 5;
    
    const daysUntil = Math.ceil((tripDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    let category = 'today';
    let canApprove = true;
    
    if (isToday) {
      category = 'today';
      canApprove = true;
    } else if (isPast) {
      category = 'past';
      canApprove = true;
    } else if (isFuture && isTripFriday) {
      category = 'future_friday';
      canApprove = true;
    } else if (isFuture && daysUntil === 1) {
      category = 'tomorrow';
      canApprove = false;
    } else if (isFuture && daysUntil <= 7) {
      category = 'this_week';
      canApprove = false;
    } else if (isFuture) {
      category = 'future_long';
      canApprove = false;
    }
    
    return {
      category,
      canApprove,
      isToday,
      isPast,
      isFuture,
      isTripFriday,
      tripDate,
      daysUntil,
      dayName: tripDate.toLocaleDateString('en-US', { weekday: 'long' }),
      formattedDate: tripDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }),
    };
  };

  // ============================================================
  // FETCH ALL DEPARTMENTS
  // ============================================================
  
  const fetchAllDepartments = useCallback(async () => {
    setLoadingDepartments(true);
    try {
      const response = await mayorsOfficeAPI.getAllDepartmentsForSelector();
      const depts = response.data?.data || [];
      
      if (depts.length > 0) {
        setAvailableDepartments(depts);
      } else {
        const uniqueDepts = [
          ...new Map(
            tickets.map((ticket) => [ticket.department_id, ticket.department_name]),
          ).entries(),
        ].map(([id, name]) => ({ department_id: id, department_name: name }));
        setAvailableDepartments(uniqueDepts);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
      const uniqueDepts = [
        ...new Map(
          tickets.map((ticket) => [ticket.department_id, ticket.department_name]),
        ).entries(),
      ].map(([id, name]) => ({ department_id: id, department_name: name }));
      setAvailableDepartments(uniqueDepts);
    } finally {
      setLoadingDepartments(false);
    }
  }, [tickets]);

  // ============================================================
  // ✅ HANDLE VIEW GAS SLIP
  // ============================================================
  
  const handleViewGasSlip = (ticket) => {
    const ticketWithDriver = {
      ...ticket,
      driver_name: ticket.driver?.full_name || ticket.driver_name || "N/A",
    };
    setSelectedGasSlipTicket(ticketWithDriver);
    setShowGasSlip(true);
  };

  // ============================================================
  // OPEN APPROVE DIALOG
  // ============================================================
  
  const openApproveDialog = async (ticket) => {
    setSelectedTicket(ticket);
    setAmountReleased("");
    
    setIsCrossDepartment(false);
    setCrossDepartmentReason("");
    setShowCrossDepartmentWarning(false);
    setIsForceApprove(false);
    setForceApproveReason("");

    const validation = checkTripDateValidation(ticket);
    setTripDateValidation(validation);
    
    if (validation && !validation.canApprove) {
      toast.error(`This trip is scheduled for ${validation.formattedDate}.`, { duration: 6000 });
    }

    const requestingDeptId = ticket.department_id?.toString() ||
      ticket.department?.id?.toString() ||
      ticket.department?.department_id?.toString();

    setChargeToDepartmentId(requestingDeptId || "");
    
    await fetchAllDepartments();
    setShowApproveDialog(true);
  };

  const openReceiptModal = (ticket) => {
    const fuelLog = ticket.fuel_log || ticket.fuelLog || null;

    if (!fuelLog) {
      toast.info("No fuel receipt found for this trip");
      return;
    }

    const receipt = {
      id: fuelLog.fuel_log_id || fuelLog.id,
      ticket_number: ticket.ticket_number || ticket.trip_ticket_number,
      driver_name: ticket.driver?.full_name || ticket.driver_name || "N/A",
      plate_number: ticket.vehicle?.plate_number || "N/A",
      liters: fuelLog.liters_availed || 0,
      amount: fuelLog.amount_on_receipt || 0,
      receipt_url: fuelLog.receipt_photo_path || fuelLog.receipt_url,
      trip_date: ticket.trip_date,
      status: fuelLog.reconciliation_status || "pending",
      fuel_type: ticket.vehicle?.fuel_type || "N/A",
      uploaded_at: fuelLog.receipt_uploaded_at || fuelLog.created_at,
      odometer_start: fuelLog.odometer_start,
      odometer_end: fuelLog.odometer_end,
      gps_distance_km: fuelLog.gps_distance_km,
      distance_calculation_method: fuelLog.distance_calculation_method,
    };

    setReceiptData(receipt);
    setShowReceiptModal(true);
  };

  const handleVerifyReceipt = async (receiptId) => {
    try {
      await mayorsOfficeAPI.verifyReceipt(receiptId);
      return Promise.resolve();
    } catch (error) {
      console.error("Failed to verify receipt:", error);
      return Promise.reject(error);
    }
  };

  // ============================================================
  // HANDLE APPROVE
  // ============================================================
  
  const handleApprove = async () => {
    if (!selectedTicket) {
      toast.error("No ticket selected");
      return;
    }

    if (!amountReleased || parseFloat(amountReleased) <= 0) {
      toast.error("Please enter a valid amount to release");
      return;
    }

    if (isForceApprove && !forceApproveReason.trim()) {
      toast.error("Please provide a reason for early fund release");
      return;
    }

    let finalChargeDeptId = chargeToDepartmentId;
    if (!finalChargeDeptId && selectedTicket?.department_id) {
      finalChargeDeptId = selectedTicket.department_id;
    }

    if (!finalChargeDeptId) {
      toast.error("Please select which department to charge");
      return;
    }

    if (isCrossDepartment && finalChargeDeptId === selectedTicket?.department_id?.toString()) {
      toast.error("❌ Cross-Department usage selected but same department is chosen. Please select a different department or uncheck the Cross-Department option.");
      return;
    }

    if (isCrossDepartment && !crossDepartmentReason.trim()) {
      toast.error("Please provide a reason for cross-department fuel usage");
      return;
    }

    setSubmitting(true);
    try {
      const response = await mayorsOfficeAPI.approveTicket(
        selectedTicket.id || selectedTicket.trip_ticket_id,
        {
          amount_released: parseFloat(amountReleased),
          charge_to_department_id: finalChargeDeptId,
          review_note: null,
          is_cross_department: isCrossDepartment,
          cross_department_reason: crossDepartmentReason || null,
          force_approve: isForceApprove,
          force_approve_reason: forceApproveReason || null,
        },
      );

      if (response.data.success) {
        let successMessage = response.data.message || "Funds released successfully!";
        if (isForceApprove) {
          successMessage = "⚠️ Funds released EARLY!\n\n" +
            "Trip Date: " + selectedTicket.trip_date + "\n" +
            "Reason: " + forceApproveReason + "\n\n" +
            "✅ This action has been recorded in the audit log.";
        }
        toast.success(successMessage);
        
        setShowApproveDialog(false);
        setSelectedTicket(null);
        setAmountReleased("");
        setChargeToDepartmentId("");
        setIsCrossDepartment(false);
        setCrossDepartmentReason("");
        setIsForceApprove(false);
        setForceApproveReason("");
        fetchTickets();
      }
    } catch (error) {
      console.error("API Error:", error);
      const errorMessage = error.response?.data?.message || "Failed to release funds";
      toast.error(errorMessage);
      
      if (error.response?.data?.budget_info) {
        const budgetInfo = error.response.data.budget_info;
        toast.error(
          `Budget insufficient: ₱${budgetInfo.remaining?.toLocaleString()} remaining, ₱${budgetInfo.requested?.toLocaleString()} requested`,
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedTicket) return;
    if (!rejectionNote.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setSubmitting(true);
    try {
      await mayorsOfficeAPI.rejectTicket(
        selectedTicket.id || selectedTicket.trip_ticket_id,
        rejectionNote,
      );
      setShowRejectDialog(false);
      setSelectedTicket(null);
      setRejectionNote("");
      fetchTickets();
      toast.success("Ticket rejected and returned to department");
    } catch (error) {
      console.error("Failed to reject ticket:", error);
      toast.error(error.response?.data?.message || "Failed to reject ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (hasInsufficientBudget) => {
    if (hasInsufficientBudget) {
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
          ⚠️ Insufficient Budget
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-500 text-white dark:bg-yellow-600">
        Pending Fund Release
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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

  const hasFuelReceipt = (ticket) => {
    const fuelLog = ticket.fuel_log || ticket.fuelLog;
    return (
      fuelLog && (fuelLog.liters_availed > 0 || fuelLog.amount_on_receipt > 0)
    );
  };

  const hasActiveFilters = searchTerm !== "" || departmentFilter !== "all";

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-500/20">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading pending tickets...</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Please wait while we fetch your data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="space-y-6 p-4 md:p-6 animate-fade-in-up">
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
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-lg shadow-yellow-500/20">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    Pending Fund Release
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Review and approve trip tickets awaiting fund release
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
              className="dark:border-slate-700 dark:text-slate-300"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>

        {/* Filters */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <div
            className="px-6 py-4 border-b dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl"
            onClick={() => setShowFilters(!showFilters)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Filters
                </span>
                {hasActiveFilters && (
                  <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                    Active
                  </Badge>
                )}
              </div>
              {showFilters ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </div>
          </div>

          {showFilters && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search tickets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  />
                </div>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white"
                >
                  <option value="all">All Departments</option>
                  {uniqueDepartments.map((dept) => (
                    <option key={dept.department_id} value={dept.department_id}>
                      {dept.department_name}
                    </option>
                  ))}
                </select>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Tickets Table */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  Pending Tickets
                </CardTitle>
                <CardDescription className="dark:text-slate-400">
                  {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} found
                  {filteredTickets.length !== tickets.length && ` (filtered from ${tickets.length} total)`}
                </CardDescription>
              </div>
              {filteredTickets.length > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
                  <Zap className="h-3 w-3 mr-1" />
                  {filteredTickets.length} records
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6 p-0">
            {filteredTickets.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-10 w-10 text-emerald-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No pending tickets</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  {hasActiveFilters ? 'Try adjusting your filters' : 'All tickets have been processed'}
                </p>
                {hasActiveFilters && (
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Ticket #</TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Date</TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Destination</TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Department</TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Vehicle</TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Driver</TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Trip Date</TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.map((ticket, index) => (
                      <TableRow
                        key={ticket.id || ticket.trip_ticket_id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                      >
                        <TableCell className="font-mono text-sm font-semibold text-slate-800 dark:text-white">
                          {ticket.ticket_number || ticket.trip_ticket_number}
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">
                          {formatDate(ticket.trip_date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-600 dark:text-slate-400">
                              {ticket.destination}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-600 dark:text-slate-400">
                              {ticket.department_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Truck className="h-3 w-3 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-600 dark:text-slate-400">
                              {ticket.vehicle?.plate_number || "N/A"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-600 dark:text-slate-400">
                              {ticket.driver?.full_name || "N/A"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TripDateBadge ticket={ticket} />
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(ticket.has_insufficient_budget)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* View Details */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const ticketId = ticket.id || ticket.trip_ticket_id;
                                navigate(`/mayor/trip-ticket/${ticketId}`);
                              }}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-9 w-9 p-0 rounded-lg transition-all duration-200 group-hover:scale-110"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {/* View Receipt */}
                            {hasFuelReceipt(ticket) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openReceiptModal(ticket)}
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-950/30 h-9 w-9 p-0 rounded-lg transition-all duration-200 group-hover:scale-110"
                                title="View Fuel Receipt"
                              >
                                <Receipt className="h-4 w-4" />
                              </Button>
                            )}

                            {/* ✅ View Gas Slip */}
                            {ticket.gas_slip && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewGasSlip(ticket)}
                                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-950/30 h-9 w-9 p-0 rounded-lg transition-all duration-200 group-hover:scale-110"
                                title="View Gas Slip"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Release Fund */}
                            <Button
                              size="sm"
                              onClick={() => openApproveDialog(ticket)}
                              className={`h-9 px-4 rounded-lg shadow-md transition-all duration-200 hover:scale-105 active:scale-95 ${
                                checkTripDateValidation(ticket)?.canApprove
                                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white'
                                  : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white'
                              }`}
                            >
                              <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                              Release
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

        {/* ============================================================ */}
        {/* APPROVE DIALOG */}
        {/* ============================================================ */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-slate-800 dark:border-slate-700 p-6">
            <DialogHeader className="pb-3">
              <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white text-lg">
                <div className="p-1.5 rounded-xl bg-green-500/10">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                Release Funds
              </DialogTitle>
              <DialogDescription className="dark:text-slate-400 text-sm">
                {selectedTicket?.has_insufficient_budget
                  ? "Select which department's budget to charge. The requesting department has insufficient budget."
                  : "Funds will be deducted from the selected department's budget."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                  <span className="text-xs text-blue-700 dark:text-blue-300">
                    Charge to <strong>SELECTED department</strong>
                  </span>
                </div>
              </div>

              {/* Budget Warning */}
              {selectedTicket?.has_insufficient_budget && (
                <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                    <span className="text-xs text-yellow-700 dark:text-yellow-300">
                      Insufficient Budget. Shortage: <strong>{formatCurrency(selectedTicket?.budget_shortage)}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Trip Date Validation */}
              {tripDateValidation && (
                <div className="flex items-center gap-2">
                  {tripDateValidation.category === 'today' && (
                    <Badge className="bg-green-500 text-white">Today's Trip</Badge>
                  )}
                  {tripDateValidation.category === 'past' && (
                    <Badge className="bg-blue-500 text-white">Past Trip</Badge>
                  )}
                  {(tripDateValidation.category === 'future_friday' || tripDateValidation.category === 'future_friday_today') && (
                    <Badge className="bg-purple-500 text-white">Friday Trip</Badge>
                  )}
                  {tripDateValidation.category === 'tomorrow' && (
                    <Badge className="bg-orange-500 text-white">⚠️ Tomorrow</Badge>
                  )}
                  {tripDateValidation.category === 'this_week' && (
                    <Badge className="bg-yellow-500 text-white">⚠️ This Week</Badge>
                  )}
                  {tripDateValidation.category === 'future_long' && (
                    <Badge className="bg-red-500 text-white">⚠️ Future Trip</Badge>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {tripDateValidation.formattedDate}
                  </span>
                </div>
              )}

              {/* Force Approve */}
              {tripDateValidation && !tripDateValidation.canApprove && (
                <div className="border-t dark:border-slate-700 pt-3 mt-1">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="force-approve"
                      checked={isForceApprove}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsForceApprove(checked);
                        if (!checked) setForceApproveReason("");
                      }}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700"
                    />
                    <div className="flex-1">
                      <Label htmlFor="force-approve" className="text-sm font-medium cursor-pointer flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Force Approve
                        <span className="text-[10px] px-1.5 py-0.5 border border-orange-500 text-orange-500 rounded-full">Override</span>
                      </Label>
                      {isForceApprove && (
                        <Textarea
                          placeholder="Reason for early release..."
                          value={forceApproveReason}
                          onChange={(e) => setForceApproveReason(e.target.value)}
                          rows={2}
                          className="mt-1.5 text-sm resize-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Ticket Info */}
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-1.5 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Ticket #</p>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                      {selectedTicket?.ticket_number || selectedTicket?.trip_ticket_number}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Dept</p>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                      {selectedTicket?.department_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Destination</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                      {selectedTicket?.destination}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Driver</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                      {selectedTicket?.driver?.full_name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Vehicle</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                      {selectedTicket?.vehicle?.plate_number || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Trip Date</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                      {selectedTicket?.trip_date ? formatDate(selectedTicket.trip_date) : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Department Selector */}
              <div>
                <Label htmlFor="charge_to_department" className="text-sm text-slate-700 dark:text-slate-300">
                  Charge To Department <span className="text-red-500">*</span>
                </Label>
                <select
                  id="charge_to_department"
                  value={chargeToDepartmentId}
                  onChange={(e) => setChargeToDepartmentId(e.target.value)}
                  disabled={!isCrossDepartment}
                  className={cn(
                    "w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white text-sm",
                    isCrossDepartment 
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700" 
                      : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-not-allowed opacity-60"
                  )}
                >
                  <option value="">Select Department</option>
                  {selectedTicket?.department_id && (
                    <option value={selectedTicket.department_id}>
                      {selectedTicket.department_name} (Requesting)
                    </option>
                  )}
                  {isCrossDepartment && availableDepartments
                    .filter((dept) => dept.department_id?.toString() !== selectedTicket?.department_id?.toString())
                    .map((dept) => (
                      <option key={dept.department_id} value={dept.department_id}>
                        {dept.department_name}
                      </option>
                    ))}
                </select>

                {isCrossDepartment && chargeToDepartmentId === selectedTicket?.department_id?.toString() && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    ⚠️ Please select a DIFFERENT department for cross-department usage
                  </p>
                )}

                {!isCrossDepartment && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Check "Cross-Department Usage" to select another department
                  </p>
                )}
                {isCrossDepartment && availableDepartments.length === 0 && !loadingDepartments && (
                  <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    No departments available. Please refresh.
                  </p>
                )}
                {loadingDepartments && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading departments...
                  </p>
                )}
              </div>

              {/* Cross-Department */}
              <div className="border-t dark:border-slate-700 pt-3">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="cross-department"
                    checked={isCrossDepartment}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsCrossDepartment(checked);
                      if (!checked) {
                        setCrossDepartmentReason("");
                        if (selectedTicket?.department_id) {
                          setChargeToDepartmentId(selectedTicket.department_id.toString());
                        }
                      }
                    }}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700"
                  />
                  <div className="flex-1">
                    <Label htmlFor="cross-department" className="text-sm font-medium cursor-pointer flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Cross-Department Usage
                      <span className="text-[10px] px-1.5 py-0.5 border border-orange-500 text-orange-500 rounded-full">Check to enable</span>
                    </Label>
                    {isCrossDepartment && (
                      <Textarea
                        placeholder="Reason for cross-department usage..."
                        value={crossDepartmentReason}
                        onChange={(e) => setCrossDepartmentReason(e.target.value)}
                        rows={2}
                        className="mt-1.5 text-sm resize-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div>
                <Label htmlFor="amount" className="text-sm text-slate-700 dark:text-slate-300">Amount (₱)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="Enter amount"
                  value={amountReleased}
                  onChange={(e) => setAmountReleased(e.target.value)}
                  className="mt-1 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                />
                {selectedTicket && getEstimatedCost(selectedTicket) > 0 && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Calculator className="h-3.5 w-3.5 text-blue-400" />
                      <span>Suggested:</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {formatCurrency(getEstimatedCost(selectedTicket))}
                      </span>
                    </div>
                    {selectedTicket.estimated_fuel_liters && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        ({selectedTicket.estimated_fuel_liters} L × ₱88)
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30"
                      onClick={() => {
                        const estimated = getEstimatedCost(selectedTicket);
                        if (estimated > 0) {
                          setAmountReleased(estimated.toString());
                          toast.success("Suggested amount applied");
                        }
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Enter the amount to release. The suggested amount is based on estimated fuel consumption.
                </p>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="gap-3 pt-4 border-t dark:border-slate-700 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowApproveDialog(false);
                  setIsCrossDepartment(false);
                  setCrossDepartmentReason("");
                  setIsForceApprove(false);
                  setForceApproveReason("");
                }}
                className="dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </Button>
              <Button
                className={`${
                  tripDateValidation?.canApprove
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800'
                    : isForceApprove
                    ? 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800'
                    : 'bg-slate-400 cursor-not-allowed'
                } text-white`}
                onClick={handleApprove}
                disabled={
                  submitting || 
                  (!tripDateValidation?.canApprove && !isForceApprove) ||
                  (isCrossDepartment && chargeToDepartmentId === selectedTicket?.department_id?.toString())
                }
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                {isForceApprove ? "Force Approve" : tripDateValidation?.canApprove ? "Release Funds" : "Restricted"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent className="dark:bg-slate-800 dark:border-slate-700">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <XCircle className="h-5 w-5 text-red-600" />
                Reject Trip Ticket
              </DialogTitle>
              <DialogDescription className="dark:text-slate-400">
                Please provide a reason for rejection. This will be sent back to
                the department.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <strong>Ticket:</strong>{" "}
                  {selectedTicket?.ticket_number ||
                    selectedTicket?.trip_ticket_number}
                  <br />
                  <strong>Department:</strong> {selectedTicket?.department_name}
                  <br />
                  <strong>Destination:</strong> {selectedTicket?.destination}
                </p>
              </div>
              <Textarea
                placeholder="Enter rejection reason..."
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                rows={4}
                className="resize-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              />
            </div>
            <DialogFooter className="gap-3">
              <Button
                variant="outline"
                onClick={() => setShowRejectDialog(false)}
                className="dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </Button>
              <Button
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                onClick={handleReject}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Reject Ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Receipt Verification Modal */}
        <ReceiptVerificationModal
          isOpen={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            setReceiptData(null);
          }}
          receipt={receiptData}
          onVerify={handleVerifyReceipt}
          onRefresh={fetchTickets}
        />

        {/* Gas Slip Modal */}
        {showGasSlip && selectedGasSlipTicket && (
          <GasSlipView 
            ticket={selectedGasSlipTicket} 
            onClose={() => {
              setShowGasSlip(false);
              setSelectedGasSlipTicket(null);
            }} 
          />
        )}
      </div>
    </div>
  );
};

export default MayorPending;
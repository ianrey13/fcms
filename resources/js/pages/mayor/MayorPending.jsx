// src/pages/mayor/MayorPending.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { mayorsOfficeAPI } from "../../services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// ============================================================
// 1. RECEIPT VERIFICATION MODAL
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
            <Receipt className="h-5 w-5 text-green-600" />
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

          {/* Receipt Details */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ticket Number
              </p>
              <p className="font-medium text-slate-900 dark:text-white">
                {receipt.ticket_number}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Driver
              </p>
              <p className="font-medium text-slate-900 dark:text-white">
                {receipt.driver_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Vehicle
              </p>
              <p className="font-medium text-slate-900 dark:text-white">
                {receipt.plate_number}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Liters
              </p>
              <p className="font-medium text-slate-900 dark:text-white">
                {receipt.liters} L
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Amount
              </p>
              <p className="font-medium text-green-600 dark:text-green-400">
                {formatCurrency(receipt.amount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Trip Date
              </p>
              <p className="font-medium text-slate-900 dark:text-white">
                {formatDate(receipt.trip_date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Status
              </p>
              <Badge className={isVerified ? "bg-green-500" : "bg-yellow-500"}>
                {isVerified ? "Verified" : "Pending"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fuel Type
              </p>
              <p className="font-medium text-slate-900 dark:text-white">
                {receipt.fuel_type || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Uploaded
              </p>
              <p className="font-medium text-slate-900 dark:text-white">
                {formatDate(receipt.uploaded_at)}
              </p>
            </div>
          </div>

          {/* Distance Details */}
          {(receipt.odometer_start ||
            receipt.odometer_end ||
            receipt.gps_distance_km) && (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
              <h4 className="text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                Distance Details
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Method
                  </p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {receipt.distance_calculation_method || "N/A"}
                  </p>
                </div>
                {receipt.odometer_start && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Odometer Start
                    </p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {receipt.odometer_start} km
                    </p>
                  </div>
                )}
                {receipt.odometer_end && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Odometer End
                    </p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {receipt.odometer_end} km
                    </p>
                  </div>
                )}
                {receipt.gps_distance_km && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      GPS Distance
                    </p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {receipt.gps_distance_km} km
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
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
// 2. MAIN COMPONENT (MayorPending)
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

  // Cross-Department State
  const [isCrossDepartment, setIsCrossDepartment] = useState(false);
  const [crossDepartmentReason, setCrossDepartmentReason] = useState("");
  const [showCrossDepartmentWarning, setShowCrossDepartmentWarning] = useState(false);

  // Department Selector State
  const [chargeToDepartmentId, setChargeToDepartmentId] = useState("");
  const [availableDepartments, setAvailableDepartments] = useState([]);

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

  // Get unique departments for filter
  const uniqueDepartments = [
    ...new Map(
      tickets.map((ticket) => [ticket.department_id, ticket.department_name]),
    ).entries(),
  ].map(([id, name]) => ({ department_id: id, department_name: name }));

  // Filter tickets
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

  // Fetch all departments for the selector
 const fetchAllDepartments = useCallback(async () => {
  try {
    // ✅ Get all departments with their budget info
    const response = await mayorsOfficeAPI.getAllDepartmentsWithBudget();
    const departments = response.data?.data || [];
    
    // ✅ Filter departments that have budget and are not the requesting department
    const availableDepts = departments.filter(dept => 
      dept.has_budget && 
      dept.remaining_amount > 0 &&
      dept.department_id?.toString() !== selectedTicket?.department_id?.toString()
    );
    
    setAvailableDepartments(availableDepts);
  } catch (error) {
    console.error("Failed to fetch departments:", error);
    // Fallback: use unique departments from tickets
    const uniqueDepts = [
      ...new Map(
        tickets.map((ticket) => [ticket.department_id, ticket.department_name]),
      ).entries(),
    ].map(([id, name]) => ({ 
      department_id: id, 
      department_name: name,
      has_budget: true,
      remaining_amount: 0
    }));
    setAvailableDepartments(uniqueDepts);
  }
}, [tickets, selectedTicket]);

const openApproveDialog = async (ticket) => {
  console.log("Opening approve dialog for ticket:", ticket);
  setSelectedTicket(ticket);
  setAmountReleased("0");
  
  // Reset cross-department state
  setIsCrossDepartment(false);
  setCrossDepartmentReason("");
  setShowCrossDepartmentWarning(false);

  const requestingDeptId =
    ticket.department_id?.toString() ||
    ticket.department?.id?.toString() ||
    ticket.department?.department_id?.toString();

  setChargeToDepartmentId(requestingDeptId || "");
  
  // ✅ Fetch departments with budget
  try {
    // ✅ Use the API to get all departments with budget
    const response = await mayorsOfficeAPI.getAllDepartmentsWithBudget();
    const departments = response.data?.data || [];
    
    // ✅ Filter departments with budget, excluding the requesting department
    const availableDepts = departments.filter(dept => 
      dept.has_budget && 
      dept.remaining_amount > 0 &&
      dept.department_id?.toString() !== requestingDeptId
    );
    
    // ✅ Also include the requesting department (with its remaining budget)
    const requestingDept = departments.find(dept => 
      dept.department_id?.toString() === requestingDeptId
    );
    
    if (requestingDept) {
      // Add requesting department at the top
      setAvailableDepartments([requestingDept, ...availableDepts]);
    } else {
      setAvailableDepartments(availableDepts);
    }
  } catch (error) {
    console.error("Failed to fetch departments:", error);
    // Fallback: use unique departments from tickets
    const uniqueDepts = [
      ...new Map(
        tickets.map((ticket) => [ticket.department_id, ticket.department_name]),
      ).entries(),
    ].map(([id, name]) => ({ 
      department_id: id, 
      department_name: name,
      has_budget: true,
      remaining_amount: 0
    }));
    setAvailableDepartments(uniqueDepts);
  }
  
  setShowApproveDialog(true);
};
  // Open Receipt Verification Modal
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

  // Verify Receipt Handler
  const handleVerifyReceipt = async (receiptId) => {
    try {
      await mayorsOfficeAPI.verifyReceipt(receiptId);
      return Promise.resolve();
    } catch (error) {
      console.error("Failed to verify receipt:", error);
      return Promise.reject(error);
    }
  };

  const handleApprove = async () => {
    if (!selectedTicket) {
      toast.error("No ticket selected");
      return;
    }

    if (!amountReleased || parseFloat(amountReleased) <= 0) {
      toast.error("Please enter a valid amount to release");
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

    // If cross-department, require a reason
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
        },
      );

      if (response.data.success) {
        let successMessage = response.data.message || "Funds released successfully!";
        if (isCrossDepartment) {
          successMessage = "✅ Funds released successfully (Cross-Department Usage)\n\n" +
            "⚠️ This fuel will be recorded under the selected department's budget.\n" +
            "No budget transfer was made. This is for recording purposes only.";
        }
        toast.success(successMessage);
        
        setShowApproveDialog(false);
        setSelectedTicket(null);
        setAmountReleased("");
        setChargeToDepartmentId("");
        setIsCrossDepartment(false);
        setCrossDepartmentReason("");
        fetchTickets();
      }
    } catch (error) {
      console.error("API Error:", error);
      const errorData = error.response?.data;
      
      // Check if it's a budget error with suggestions
      if (errorData?.budget_info) {
        const budgetInfo = errorData.budget_info;
        const availableDepartments = errorData.available_departments || [];
        
        // Build detailed error message
        let errorMsg = `⚠️ Insufficient Budget!\n\n`;
        errorMsg += `Requested: ₱${budgetInfo.requested?.toLocaleString()}\n`;
        
        if (budgetInfo.weekly_remaining !== undefined) {
          errorMsg += `Weekly Remaining: ₱${budgetInfo.weekly_remaining?.toLocaleString()}\n`;
          errorMsg += `Shortage: ₱${budgetInfo.shortage?.toLocaleString()}\n\n`;
        } else if (budgetInfo.annual_remaining !== undefined) {
          errorMsg += `Annual Remaining: ₱${budgetInfo.annual_remaining?.toLocaleString()}\n`;
          errorMsg += `Shortage: ₱${budgetInfo.shortage?.toLocaleString()}\n\n`;
        }
        
        // Show available departments if any
        if (availableDepartments && availableDepartments.length > 0) {
          errorMsg += `📋 Departments with available budget:\n`;
          availableDepartments.forEach((dept, index) => {
            errorMsg += `  ${index + 1}. ${dept.department_name} (${dept.department_code}) - ₱${dept.weekly_remaining?.toLocaleString()} remaining\n`;
          });
          errorMsg += `\n👉 Please select one of these departments from the dropdown above.`;
        } else {
          errorMsg += `💡 Suggestions:\n`;
          if (budgetInfo.weekly_remaining !== undefined) {
            errorMsg += `• Reduce the amount to ₱${budgetInfo.weekly_remaining?.toLocaleString()}\n`;
            errorMsg += `• Mark as cross-department usage (for recording only)\n`;
            errorMsg += `• Wait for next week's allocation`;
          } else {
            errorMsg += `• Add more budget to annual allocation\n`;
            errorMsg += `• Reduce the amount to ₱${budgetInfo.annual_remaining?.toLocaleString()}`;
          }
        }
        
        toast.error(errorMsg, {
          duration: 8000,
          style: {
            whiteSpace: 'pre-line',
            maxWidth: '500px',
          },
        });
        
      } else {
        const errorMessage = errorData?.message || "Failed to release funds";
        toast.error(errorMessage);
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

  // ============================================================
  // 3. RENDER
  // ============================================================
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const hasActiveFilters = searchTerm !== "" || departmentFilter !== "all";

  return (
    <div className="space-y-6">
      {/* ========== HEADER ========== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Pending Fund Release
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Review and approve trip tickets awaiting fund release
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          className="dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* ========== FILTERS ========== */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700 overflow-hidden">
        <div
          className="px-6 py-4 border-b dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          onClick={() => setShowFilters(!showFilters)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Filters
              </span>
              {hasActiveFilters && (
                <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                  Active
                </span>
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
                  className="pl-10 dark:bg-slate-900 dark:border-slate-700"
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

      {/* ========== TICKETS TABLE ========== */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700 overflow-hidden">
        <CardHeader className="border-b dark:border-slate-700">
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Clock className="h-5 w-5 text-yellow-500" />
            Pending Tickets
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
              ({filteredTickets.length}{" "}
              {filteredTickets.length === 1 ? "ticket" : "tickets"})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">
                No pending tickets
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
                    <TableHead className="font-semibold">Ticket #</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Destination</TableHead>
                    <TableHead className="font-semibold">Department</TableHead>
                    <TableHead className="font-semibold">Vehicle</TableHead>
                    <TableHead className="font-semibold">Driver</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket, index) => (
                    <TableRow
                      key={ticket.id || ticket.trip_ticket_id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <TableCell className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
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
                        {getStatusBadge(ticket.has_insufficient_budget)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Details */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const ticketId =
                                ticket.id || ticket.trip_ticket_id;
                              navigate(`/mayor/trip-ticket/${ticketId}`);
                            }}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-8 w-8 p-0"
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
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/30 h-8 w-8 p-0"
                              title="View Fuel Receipt"
                            >
                              <Receipt className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Release Fund */}
                          <Button
                            size="sm"
                            onClick={() => openApproveDialog(ticket)}
                            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-md h-8 px-3"
                          >
                            <DollarSign className="h-3 w-3 mr-1" />
                            Release
                          </Button>

                          {/* Reject - Commented Out */}
                          {/* <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setShowRejectDialog(true);
                            }}
                            className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30 h-8 px-3"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button> */}
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

      {/* ========== APPROVE DIALOG ========== */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-lg dark:bg-slate-800 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <DollarSign className="h-5 w-5 text-green-600" />
              Release Funds
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              {selectedTicket?.has_insufficient_budget
                ? "⚠️ The requesting department has insufficient budget. Please select which department to charge."
                : "Funds will be deducted from the selected department's budget."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* ============================================================ */}
            {/* ✅ TICKET SUMMARY */}
            {/* ============================================================ */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Ticket #</p>
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">
                    {selectedTicket?.ticket_number || selectedTicket?.trip_ticket_number}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Requesting Dept</p>
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">
                    {selectedTicket?.department_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Destination</p>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    {selectedTicket?.destination}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Driver</p>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    {selectedTicket?.driver?.full_name || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* ✅ BUDGET INFO (Weekly + Annual) */}
            {/* ============================================================ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800 text-center">
                <p className="text-xs text-blue-600 dark:text-blue-400">Weekly Remaining</p>
                <p className={`text-lg font-bold ${
                  (selectedTicket?.weekly_remaining || 0) < (selectedTicket?.estimated_cost || 0) 
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {formatCurrency(selectedTicket?.weekly_remaining || 0)}
                </p>
                {(selectedTicket?.weekly_remaining || 0) < (selectedTicket?.estimated_cost || 0) && (
                  <p className="text-xs text-red-500">⚠️ Insufficient</p>
                )}
              </div>
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 border border-green-200 dark:border-green-800 text-center">
                <p className="text-xs text-green-600 dark:text-green-400">Annual Remaining</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(selectedTicket?.remaining_budget || 0)}
                </p>
              </div>
            </div>

            {/* ============================================================ */}
{/* ✅ DEPARTMENT SELECTOR - MAKITA KUNG ASA I-CHARGE */}
{/* ============================================================ */}
<div>
  <Label htmlFor="charge_to_department" className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
    <Building2 className="h-4 w-4" />
    Charge To Department <span className="text-red-500">*</span>
  </Label>
  <select
    id="charge_to_department"
    value={chargeToDepartmentId}
    onChange={(e) => setChargeToDepartmentId(e.target.value)}
    className="w-full mt-1.5 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white"
  >
    <option value="">Select Department</option>
    {availableDepartments.length > 0 ? (
      availableDepartments.map((dept) => {
        const isRequesting = dept.department_id?.toString() === selectedTicket?.department_id?.toString();
        return (
          <option 
            key={dept.department_id} 
            value={dept.department_id}
            className={isRequesting ? "font-medium text-blue-600" : ""}
          >
            {isRequesting ? "📍 " : "🏛️ "} {dept.department_name} 
            {dept.department_code ? ` (${dept.department_code})` : ''}
            {dept.remaining_amount !== undefined && dept.remaining_amount > 0 && (
              ` - ₱${dept.remaining_amount.toLocaleString()} remaining`
            )}
            {isRequesting ? " (Requesting)" : ""}
          </option>
        );
      })
    ) : (
      <option value="" disabled>No departments available</option>
    )}
  </select>
  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
    <AlertCircle className="h-3 w-3" />
    Select which department's budget will cover this trip.
  </p>
</div>

            {/* ============================================================ */}
            {/* ✅ CROSS-DEPARTMENT SECTION */}
            {/* ============================================================ */}
            <div className="border-t dark:border-slate-700 pt-4 mt-2">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="cross-department"
                  checked={isCrossDepartment}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsCrossDepartment(checked);
                    if (checked) {
                      setShowCrossDepartmentWarning(true);
                    } else {
                      setShowCrossDepartmentWarning(false);
                      setCrossDepartmentReason("");
                    }
                  }}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800"
                />
                <div>
                  <Label
                    htmlFor="cross-department"
                    className="text-sm font-medium cursor-pointer flex items-center gap-2 text-slate-700 dark:text-slate-300"
                  >
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Mark as Cross-Department Usage
                    <span className="text-[10px] px-2 py-0.5 border border-orange-500 text-orange-500 rounded-full font-normal">
                      For Recording Only
                    </span>
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Use this if fuel is being used by a different department.
                    <span className="text-orange-500 font-medium"> No budget transfer will be made.</span>
                  </p>
                </div>
              </div>

              {/* Cross-Department Warning */}
              {isCrossDepartment && (
                <div className="mt-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                        ⚠️ Cross-Department Usage Notice
                      </p>
                      <ul className="text-xs text-orange-600 dark:text-orange-400 mt-1 space-y-1 list-disc list-inside">
                        <li>This fuel will be recorded under <strong>{selectedTicket?.department_name}</strong>'s budget</li>
                        <li>An asterisk (*) will appear on the gas slip</li>
                        <li className="font-semibold text-orange-700 dark:text-orange-300">No budget transfer will be made</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Cross-Department Reason */}
              {isCrossDepartment && (
                <div className="mt-3 animate-slide-down">
                  <Label
                    htmlFor="cross_reason"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"
                  >
                    Reason for Cross-Department Usage <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="cross_reason"
                    placeholder="e.g., Emergency response, vehicle breakdown, temporary assignment, etc."
                    value={crossDepartmentReason}
                    onChange={(e) => setCrossDepartmentReason(e.target.value)}
                    rows={2}
                    className="mt-1.5 resize-none dark:bg-slate-900 dark:border-slate-700"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    This reason will be recorded for tracking and audit purposes.
                  </p>
                </div>
              )}
            </div>

            {/* ============================================================ */}
            {/* ✅ AMOUNT INPUT */}
            {/* ============================================================ */}
            <div>
              <Label htmlFor="amount" className="text-slate-700 dark:text-slate-300">
                Amount to Release (₱)
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter amount"
                value={amountReleased}
                onChange={(e) => setAmountReleased(e.target.value)}
                className="mt-1.5 dark:bg-slate-900 dark:border-slate-700"
              />
              
              {/* Suggested Amount */}
              {selectedTicket?.estimated_cost && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Suggested:</span>
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    {formatCurrency(selectedTicket.estimated_cost)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAmountReleased(selectedTicket.estimated_cost.toString())}
                    className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                  >
                    Use suggested
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/* ✅ FOOTER */}
          {/* ============================================================ */}
          <DialogFooter className="gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowApproveDialog(false);
                setIsCrossDepartment(false);
                setCrossDepartmentReason("");
                setAmountReleased("");
              }}
              className="dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </Button>
            <Button
              className={`${
                isCrossDepartment 
                  ? 'bg-orange-600 hover:bg-orange-700' 
                  : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
              } text-white shadow-md`}
              onClick={handleApprove}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <DollarSign className="h-4 w-4 mr-2" />
              )}
              {isCrossDepartment ? "Release (Cross-Dept)" : "Release Funds"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== REJECT DIALOG ========== */}
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

      {/* ========== RECEIPT VERIFICATION MODAL ========== */}
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
    </div>
  );
};

export default MayorPending;
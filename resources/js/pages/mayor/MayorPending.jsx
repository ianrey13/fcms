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
    const uniqueDepts = [
      ...new Map(
        tickets.map((ticket) => [ticket.department_id, ticket.department_name]),
      ).entries(),
    ].map(([id, name]) => ({ department_id: id, department_name: name }));
    setAvailableDepartments(uniqueDepts);
  }, [tickets]);

  const openApproveDialog = async (ticket) => {
    console.log("Opening approve dialog for ticket:", ticket);
    setSelectedTicket(ticket);
    setAmountReleased(ticket.estimated_cost?.toString() || "");

    const requestingDeptId =
      ticket.department_id?.toString() ||
      ticket.department?.id?.toString() ||
      ticket.department?.department_id?.toString();

    setChargeToDepartmentId(requestingDeptId || "");
    await fetchAllDepartments();
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

    setSubmitting(true);
    try {
      const response = await mayorsOfficeAPI.approveTicket(
        selectedTicket.id || selectedTicket.trip_ticket_id,
        {
          amount_released: parseFloat(amountReleased),
          charge_to_department_id: finalChargeDeptId,
          review_note: null,
        },
      );

      if (response.data.success) {
        toast.success(response.data.message || "Funds released successfully!");
        setShowApproveDialog(false);
        setSelectedTicket(null);
        setAmountReleased("");
        setChargeToDepartmentId("");
        fetchTickets();
      }
    } catch (error) {
      console.error("API Error:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to release funds";
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
        <DialogContent className="max-w-md dark:bg-slate-800 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <DollarSign className="h-5 w-5 text-green-600" />
              Release Funds
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              {selectedTicket?.has_insufficient_budget
                ? "Select which department's budget to charge. The requesting department has insufficient budget."
                : "Funds will be deducted from the selected department's budget."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <p>
                    Funds will be deducted from the{" "}
                    <strong>SELECTED department's budget</strong>.
                  </p>
                  <p className="mt-1">
                    The requesting department's budget will NOT be affected.
                  </p>
                </div>
              </div>
            </div>

            {/* Budget Warning */}
            {selectedTicket?.has_insufficient_budget && (
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    <p className="font-medium">Insufficient Budget Notice</p>
                    <p className="text-xs mt-1">
                      Shortage:{" "}
                      <strong>
                        {formatCurrency(selectedTicket?.budget_shortage)}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Ticket Info */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Ticket #
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {selectedTicket?.ticket_number ||
                      selectedTicket?.trip_ticket_number}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Requesting Dept
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {selectedTicket?.department_name}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Destination
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">
                    {selectedTicket?.destination}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Driver
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">
                    {selectedTicket?.driver?.full_name || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Department Selector */}
            {selectedTicket?.has_insufficient_budget && (
              <div>
                <Label
                  htmlFor="charge_to_department"
                  className="flex items-center gap-2 text-slate-700 dark:text-slate-300"
                >
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
                  <option value={selectedTicket?.department_id}>
                    📍 {selectedTicket?.department_name} (Requesting)
                  </option>
                  {availableDepartments
                    .filter(
                      (dept) =>
                        dept.department_id?.toString() !==
                        selectedTicket?.department_id?.toString(),
                    )
                    .map((dept) => (
                      <option
                        key={dept.department_id}
                        value={dept.department_id}
                      >
                        🏛️ {dept.department_name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Select which department's budget will cover this trip.
                </p>
              </div>
            )}

            {/* Amount Input */}
            <div>
              <Label
                htmlFor="amount"
                className="text-slate-700 dark:text-slate-300"
              >
                Amount to Release (₱)
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="Enter amount"
                value={amountReleased}
                onChange={(e) => setAmountReleased(e.target.value)}
                className="mt-1.5 dark:bg-slate-900 dark:border-slate-700"
              />
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              className="dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
              onClick={handleApprove}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <DollarSign className="h-4 w-4 mr-2" />
              )}
              Release Funds
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
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import { mayorsOfficeAPI } from "../../services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock, DollarSign, RefreshCw, Loader2, Truck, XCircle, Info, 
  AlertCircle, Building2, CheckCircle, Filter, Receipt, Image as ImageIcon, 
  Search, X, AlertTriangle, Calendar, ArrowLeft, Wallet, Ban, Sparkles, 
  Brain, TrendingUp as TrendingUpIcon, CircleDollarSign, ChevronDown, 
  ChevronUp, Eye, Printer, FileText, Check, ArrowRight
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import GasSlipView from "../../pages/mayor/reports/GasSlipView";

// ============================================
// HELPERS
// ============================================

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

const formatCurrency = (amount) => {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount === 0) return "₱0.00";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(numAmount);
};

const safeAmount = (amount) => {
  if (typeof amount === "number") return amount;
  if (typeof amount === "string") return parseFloat(amount) || 0;
  return 0;
};

const FormField = ({ label, icon: Icon, required, error, touched, helper, children, className }) => {
  const hasError = touched && error;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="flex items-center gap-2 text-sm font-medium text-slate-300">
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="relative">
        {React.cloneElement(children, {
          className: cn(children.props.className, hasError && "border-red-500 ring-red-500 focus:ring-red-500 bg-red-950/10"),
        })}
        {hasError && <div className="absolute right-3 top-1/2 -translate-y-1/2"><AlertCircle className="h-4 w-4 text-red-500 animate-pulse" /></div>}
      </div>
      {hasError && <p className="text-red-500 text-xs flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3 flex-shrink-0" />{error}</p>}
      {helper && !hasError && <p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><Info className="h-3 w-3" />{helper}</p>}
    </div>
  );
};

const NumberInput = ({ value, onChange, placeholder, className, ...props }) => {
  const handleChange = (e) => {
    const val = e.target.value;
    if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) onChange(e);
  };
  return <Input type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" value={value} onChange={handleChange} placeholder={placeholder} className={cn(className, "no-spinner")} {...props} />;
};

// ============================================
// CUSTOM STATUS BADGE
// ============================================

const StatusPill = ({ status }) => {
  let label = "Pending";
  let color = "bg-orange-500/20 text-orange-400 border-orange-500/30";
  let Icon = Clock;

  if (status === "funds_issued") {
    label = "Funds Issued";
    color = "bg-blue-500/20 text-blue-400 border-blue-500/30";
    Icon = CheckCircle;
  } else if (status === "acknowledged") {
    label = "Received";
    color = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    Icon = CheckCircle;
  } else if (status === "in_transit") {
    label = "For Verification";
    color = "bg-purple-500/20 text-purple-400 border-purple-500/30";
    Icon = Truck;
  } else if (["completed", "closed", "pending_gso_validation", "pending_reconciliation"].includes(status)) {
    label = "Verified";
    color = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    Icon = CheckCircle;
  } else if (status === "rejected") {
    label = "Rejected";
    color = "bg-red-500/20 text-red-400 border-red-500/30";
    Icon = XCircle;
  }

  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide flex items-center gap-1.5 w-fit ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};

// ============================================
// RECEIPT VERIFICATION MODAL
// ============================================

const ReceiptVerificationModal = ({ isOpen, onClose, receipt, onVerify, onRefresh }) => {
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

  const isVerified = receipt.status === "verified";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#121829] border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <div className="p-2 rounded-xl bg-emerald-500/20"><Receipt className="h-5 w-5 text-emerald-400" /></div>
            Fuel Receipt Verification
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {receipt.receipt_url ? (
            <div className="border border-slate-700 rounded-xl overflow-hidden bg-[#0b101c]">
              <img src={receipt.receipt_url} alt="Fuel Receipt" className="w-full max-h-64 object-contain" />
            </div>
          ) : (
            <div className="border border-slate-700 rounded-xl p-8 text-center bg-[#0b101c]">
              <ImageIcon className="h-12 w-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">No receipt image uploaded</p>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="p-2 rounded-lg bg-[#0b101c]"><p className="text-xs text-slate-500">Ticket</p><p className="font-medium text-white">{receipt.ticket_number}</p></div>
            <div className="p-2 rounded-lg bg-[#0b101c]"><p className="text-xs text-slate-500">Liters</p><p className="font-medium text-white">{receipt.liters} L</p></div>
            <div className="p-2 rounded-lg bg-[#0b101c]"><p className="text-xs text-slate-500">Amount</p><p className="font-medium text-emerald-400">{formatCurrency(receipt.amount)}</p></div>
          </div>
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <Button onClick={handleVerify} disabled={isVerified || verifying} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {isVerified ? "Already Verified" : "Verify Receipt"}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1 border-slate-700 text-slate-300">Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const MayorPending = () => {
  const navigate = useNavigate();
  const { isConnected } = useRealtime();
  const queryClient = useQueryClient();
  const toastIdRef = useRef(null);

  const [activeTab, setActiveTab] = useState("pending");
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Right panel state
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showRightPanel, setShowRightPanel] = useState(false);
  
  // Dialog states
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [amountReleased, setAmountReleased] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [showGasSlip, setShowGasSlip] = useState(false);
  const [selectedGasSlipTicket, setSelectedGasSlipTicket] = useState(null);

  const [isCrossDepartment, setIsCrossDepartment] = useState(false);
  const [crossDepartmentReason, setCrossDepartmentReason] = useState("");
  const [requestingDeptBalance, setRequestingDeptBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [tripDateValidation, setTripDateValidation] = useState(null);
  const [isForceApprove, setIsForceApprove] = useState(false);
  const [forceApproveReason, setForceApproveReason] = useState("");
  const [chargeToDepartmentId, setChargeToDepartmentId] = useState("");
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [approveErrors, setApproveErrors] = useState({});
  const [approveTouched, setApproveTouched] = useState({});
  
  const [releasedTickets, setReleasedTickets] = useState([]);
  const [loadingReleased, setLoadingReleased] = useState(false);
  const [showWeeklyWarning, setShowWeeklyWarning] = useState(false);
  const [pendingApprovePayload, setPendingApprovePayload] = useState(null);

  const fetchTicketsRef = useRef(null);
  const fetchReleasedTicketsRef = useRef(null);

  const CANCELLABLE_STATUSES = ["pending_mayors_office", "returned_for_revision"];
  const canCancelTicket = (status) => CANCELLABLE_STATUSES.includes(status);

  const fetchAllData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["mayor-pending-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["mayor-approved-tickets"] });
    fetchTicketsRef.current?.();
    if (activeTab === "released") fetchReleasedTicketsRef.current?.();
  }, [queryClient, activeTab]);

  useAutoRefresh(["mayor-trip-updated", "mayor-new-pending", "gso-funds-released", "trip-completed"], fetchAllData);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await mayorsOfficeAPI.getPendingTickets();
      setTickets(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error) { toast.error("Failed to load tickets"); } 
    finally { setLoading(false); }
  }, []);

  const fetchReleasedTickets = useCallback(async () => {
    setLoadingReleased(true);
    try {
      const response = await mayorsOfficeAPI.getApprovedTickets();
      setReleasedTickets(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error) {} 
    finally { setLoadingReleased(false); }
  }, []);

  useEffect(() => { fetchTicketsRef.current = fetchTickets; }, [fetchTickets]);
  useEffect(() => { fetchReleasedTicketsRef.current = fetchReleasedTickets; }, [fetchReleasedTickets]);
  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { if (activeTab === "released") fetchReleasedTickets(); }, [activeTab, fetchReleasedTickets]);

  // Derived Data
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      return searchTerm === "" || 
        ticket.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.destination?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.department_name?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [tickets, searchTerm]);

  const releasedFiltered = useMemo(() => {
    return releasedTickets.filter(t => t.department_name?.toLowerCase().includes(searchTerm.toLowerCase()) || t.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [releasedTickets, searchTerm]);

  // Status Counts
  const counts = useMemo(() => {
    return {
      pending: filteredTickets.length,
      funds_issued: releasedFiltered.filter(t => t.status === 'funds_issued').length,
      for_verification: releasedFiltered.filter(t => t.status === 'in_transit' && !t.actual_fuel_cost).length,
      verified: releasedFiltered.filter(t => ["completed", "closed", "pending_gso_validation"].includes(t.status) || t.actual_fuel_cost > 0).length,
      rejected: releasedFiltered.filter(t => t.status === 'rejected').length,
    };
  }, [filteredTickets, releasedFiltered]);

  // Tab click handler
  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setSearchTerm("");
    setSelectedTicket(null);
    setShowRightPanel(false);
  };

  // Filtered based on active tab
  const currentDisplayList = useMemo(() => {
    if (activeTab === "pending") return filteredTickets;
    if (activeTab === "funds_issued") return releasedFiltered.filter(t => t.status === 'funds_issued');
    if (activeTab === "for_verification") return releasedFiltered.filter(t => t.status === 'in_transit' && !t.actual_fuel_cost);
    if (activeTab === "verified") return releasedFiltered.filter(t => ["completed", "closed", "pending_gso_validation"].includes(t.status) || t.actual_fuel_cost > 0);
    if (activeTab === "rejected") return releasedFiltered.filter(t => t.status === 'rejected');
    return [];
  }, [activeTab, filteredTickets, releasedFiltered]);

  // Right Panel Handlers
  const handleRowClick = async (ticket) => {
    setSelectedTicket(ticket);
    setShowRightPanel(true);
    setAmountReleased("");
    setIsCrossDepartment(false);
    setCrossDepartmentReason("");
    setIsForceApprove(false);
    setForceApproveReason("");
    
    // Fetch balance if it's a pending tab
    if (activeTab === "pending") {
      const requestingDeptId = ticket.department_id?.toString();
      setChargeToDepartmentId(requestingDeptId || "");
      await Promise.all([fetchDepartmentBalance(ticket.department_id), fetchAllDepartments()]);
    }
  };

  const fetchDepartmentBalance = useCallback(async (departmentId) => {
    if (!departmentId) return setRequestingDeptBalance(null);
    setLoadingBalance(true);
    try {
      const response = await mayorsOfficeAPI.getDepartmentBudgetSummary(departmentId);
      const d = response.data?.data;
      if (d) {
        setRequestingDeptBalance({
          department_name: d.department_name,
          department_code: d.department_code,
          allocated: d.allocated ?? 0,
          remaining: d.remaining_amount ?? 0,
          weekly_suggested: d.weekly_suggested ?? 0,
          weekly_used: d.weekly_used ?? 0,
        });
      } else { setRequestingDeptBalance(null); }
    } catch (error) { setRequestingDeptBalance(null); } 
    finally { setLoadingBalance(false); }
  }, []);

  const fetchAllDepartments = useCallback(async () => {
    try {
      const response = await mayorsOfficeAPI.getAllDepartmentsForSelector();
      setAvailableDepartments(response.data?.data || []);
    } catch (error) {}
  }, []);

  const handleApprove = async () => {
    if (!amountReleased || parseFloat(amountReleased) <= 0) {
      return toast.error("Please enter a valid amount");
    }
    const amount = parseFloat(amountReleased);
    const annualAmount = requestingDeptBalance?.allocated || 0;
    const weeklySuggested = annualAmount > 0 ? annualAmount / 52 : 0;
    const weeklyUsed = requestingDeptBalance?.weekly_used || 0;
    const weeklyRemaining = Math.max(0, weeklySuggested - weeklyUsed);
    const exceedsWeekly = !isCrossDepartment && weeklySuggested > 0 && amount > weeklyRemaining;

    const payload = {
      amount_released: amount,
      charge_to_department_id: chargeToDepartmentId || selectedTicket.department_id,
      is_cross_department: isCrossDepartment,
      cross_department_reason: crossDepartmentReason || null,
      force_approve: isForceApprove,
      force_approve_reason: forceApproveReason || null,
      is_weekly_override: exceedsWeekly,
      weekly_override_reason: exceedsWeekly ? `Released ₱${amount.toFixed(2)} against suggested ₱${weeklySuggested.toFixed(2)}` : null,
    };

    if (exceedsWeekly) {
      setPendingApprovePayload(payload);
      setShowWeeklyWarning(true);
      return;
    }
    submitApprove(payload);
  };

  const submitApprove = async (payload) => {
    setSubmitting(true);
    try {
      const response = await mayorsOfficeAPI.approveTicket(selectedTicket.id || selectedTicket.trip_ticket_id, payload);
      toast.success(response.data.message || "Funds released successfully!");
      setShowWeeklyWarning(false);
      setShowRightPanel(false);
      fetchTickets();
      fetchReleasedTickets();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to release funds");
    } finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!rejectionNote.trim()) return toast.error("Please provide a reason");
    setSubmitting(true);
    try {
      await mayorsOfficeAPI.rejectTicket(selectedTicket.id || selectedTicket.trip_ticket_id, rejectionNote);
      toast.success("Ticket rejected");
      setShowRejectDialog(false);
      setShowRightPanel(false);
      fetchTickets();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reject ticket");
    } finally { setSubmitting(false); }
  };

  const openReceiptModal = (ticket) => {
    const fuelLog = ticket.fuel_log || ticket.fuelLog || null;
    if (!fuelLog) return toast.info("No receipt found");
    setReceiptData({
      id: fuelLog.fuel_log_id || fuelLog.id,
      ticket_number: ticket.ticket_number,
      liters: fuelLog.liters_availed || 0,
      amount: fuelLog.amount_on_receipt || 0,
      receipt_url: fuelLog.receipt_photo_path,
      status: fuelLog.reconciliation_status || "pending",
    });
    setShowReceiptModal(true);
  };

  const selectedTicketId = selectedTicket?.id || selectedTicket?.trip_ticket_id;

  // ✅ Fetch Suggestion
  const { data: suggestionResponse, isLoading: loadingSuggestion } = useQuery({
    queryKey: ["suggest-release", selectedTicketId],
    queryFn: () => mayorsOfficeAPI.getSuggestedRelease(selectedTicketId),
    enabled: !!selectedTicketId && showRightPanel && activeTab === "pending",
    staleTime: 60_000,
    retry: 1,
  });

  const suggestion = suggestionResponse?.data?.data;

  return (
    <div className="min-h-screen bg-[#090e1a] p-4 md:p-6 font-sans text-slate-200 flex flex-col">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="p-4 rounded-full bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]">
          <ArrowRight className="h-8 w-8 text-white -rotate-45" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Disbursement Approval</h1>
          <p className="text-slate-400 mt-1">Review and approve trip tickets for fund release.</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={() => handleTabClick("pending")} className={cn("flex items-center justify-between px-5 py-3 rounded-xl border flex-1 transition-all", activeTab === "pending" ? "bg-blue-600/20 border-blue-500 text-blue-400" : "bg-[#121829] border-slate-800 text-slate-300 hover:bg-[#1a2235]")}>
          <div className="flex items-center gap-2"><Clock className="h-5 w-5" /><span className="font-semibold">Pending Release</span></div>
          <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md text-xs font-bold">{counts.pending}</span>
        </button>
        <button onClick={() => handleTabClick("funds_issued")} className={cn("flex items-center justify-between px-5 py-3 rounded-xl border flex-1 transition-all", activeTab === "funds_issued" ? "bg-emerald-600/20 border-emerald-500 text-emerald-400" : "bg-[#121829] border-slate-800 text-slate-300 hover:bg-[#1a2235]")}>
          <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5" /><span className="font-semibold">Funds Issued</span></div>
          <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md text-xs font-bold">{counts.funds_issued}</span>
        </button>
        <button onClick={() => handleTabClick("for_verification")} className={cn("flex items-center justify-between px-5 py-3 rounded-xl border flex-1 transition-all", activeTab === "for_verification" ? "bg-orange-600/20 border-orange-500 text-orange-400" : "bg-[#121829] border-slate-800 text-slate-300 hover:bg-[#1a2235]")}>
          <div className="flex items-center gap-2"><Clock className="h-5 w-5" /><span className="font-semibold">For Verification</span></div>
          <span className="bg-orange-600 text-white px-2 py-0.5 rounded-md text-xs font-bold">{counts.for_verification}</span>
        </button>
        <button onClick={() => handleTabClick("verified")} className={cn("flex items-center justify-between px-5 py-3 rounded-xl border flex-1 transition-all", activeTab === "verified" ? "bg-emerald-600/20 border-emerald-500 text-emerald-400" : "bg-[#121829] border-slate-800 text-slate-300 hover:bg-[#1a2235]")}>
          <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5" /><span className="font-semibold">Verified</span></div>
          <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md text-xs font-bold">{counts.verified}</span>
        </button>
        <button onClick={() => handleTabClick("rejected")} className={cn("flex items-center justify-between px-5 py-3 rounded-xl border flex-1 transition-all", activeTab === "rejected" ? "bg-red-600/20 border-red-500 text-red-400" : "bg-[#121829] border-slate-800 text-slate-300 hover:bg-[#1a2235]")}>
          <div className="flex items-center gap-2"><XCircle className="h-5 w-5" /><span className="font-semibold">Rejected</span></div>
          <span className="bg-red-600 text-white px-2 py-0.5 rounded-md text-xs font-bold">{counts.rejected}</span>
        </button>
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1">
        
        {/* Left Panel: Table */}
        <div className={cn("bg-[#121829] border border-slate-800 rounded-2xl shadow-lg flex flex-col transition-all duration-300", showRightPanel ? "w-full lg:w-3/5" : "w-full")}>
          
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-800 flex justify-between items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input placeholder="Search by Trip Ticket No., Department, or Vehicle..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-[#0b101c] border-slate-700 text-white placeholder:text-slate-500 rounded-xl h-10" />
            </div>
            <Button variant="outline" size="icon" onClick={() => fetchTickets()} className="border-slate-700 text-slate-400 bg-[#0b101c] hover:bg-slate-800 rounded-xl h-10 w-10 flex-shrink-0">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-[#0b101c] text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-medium">Date</th>
                  <th className="px-4 py-4 font-medium">Trip Ticket No.</th>
                  <th className="px-4 py-4 font-medium">Department</th>
                  <th className="px-4 py-4 font-medium">Vehicle</th>
                  <th className="px-4 py-4 font-medium">Purpose</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {currentDisplayList.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-500">No tickets found for this status.</td></tr>
                ) : currentDisplayList.map((ticket) => (
                  <tr key={ticket.id || ticket.trip_ticket_id} onClick={() => handleRowClick(ticket)} className={cn("cursor-pointer hover:bg-[#1a2235] transition-colors", selectedTicket?.id === ticket.id && "bg-[#1a2235]")}>
                    <td className="px-4 py-4 whitespace-nowrap">{formatDate(ticket.trip_date)}</td>
                    <td className="px-4 py-4 font-mono font-medium text-white">{ticket.ticket_number}</td>
                    <td className="px-4 py-4">{ticket.department_name}</td>
                    <td className="px-4 py-4">{ticket.vehicle?.plate_number || 'N/A'}</td>
                    <td className="px-4 py-4 truncate max-w-[150px]">{ticket.purpose || ticket.destination}</td>
                    <td className="px-4 py-4"><StatusPill status={activeTab === 'pending' ? 'pending' : ticket.status} /></td>
                    <td className="px-4 py-4 text-right">
                      <Button size="sm" className={cn("rounded-lg h-8 px-4", activeTab === 'pending' ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}>
                        {activeTab === 'pending' ? "Review" : "View"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel: Details */}
        {showRightPanel && selectedTicket && (
          <div className="bg-[#121829] border border-slate-800 rounded-2xl shadow-lg w-full lg:w-2/5 flex flex-col flex-shrink-0 animate-in slide-in-from-right-4">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><FileText className="h-5 w-5 text-blue-500" /> Trip Ticket Details</h2>
              <button onClick={() => setShowRightPanel(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-6">
              
              {/* Basic Info Box */}
              <div className="bg-[#0b101c] rounded-xl p-4 border border-slate-800 text-sm">
                <div className="grid grid-cols-3 gap-y-3">
                  <span className="text-slate-500">Date</span><span className="col-span-2 text-white">: {formatDate(selectedTicket.trip_date)}</span>
                  <span className="text-slate-500">Name</span><span className="col-span-2 text-white">: {selectedTicket.passenger_name || selectedTicket.driver_name || selectedTicket.driver?.full_name || "N/A"}</span>
                  <span className="text-slate-500">Trip Ticket No.</span><span className="col-span-2 text-white">: {selectedTicket.ticket_number}</span>
                  <span className="text-slate-500">Department</span><span className="col-span-2 text-white">: {selectedTicket.department_name}</span>
                  <span className="text-slate-500">Vehicle</span><span className="col-span-2 text-white">: {selectedTicket.vehicle?.plate_number}</span>
                  <span className="text-slate-500">Purpose</span><span className="col-span-2 text-white">: {selectedTicket.purpose}</span>
                  <span className="text-slate-500">Destination</span><span className="col-span-2 text-white">: {selectedTicket.destination}</span>
                </div>
              </div>

              {/* Fund Release Section (Only for pending) */}
              {activeTab === 'pending' && (
                <div className="space-y-4">
                  <h3 className="text-md font-bold text-white flex items-center gap-2"><Wallet className="h-4 w-4 text-emerald-500" /> Fund Release</h3>
                  
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Department Balance</p>
                    <p className="text-2xl font-bold text-emerald-400">{formatCurrency(requestingDeptBalance?.remaining || 0)}</p>
                  </div>

                  {/* ✅ Added Suggestion Card here */}
                  {loadingSuggestion && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                      <span className="text-xs text-slate-400">Analyzing trip history…</span>
                    </div>
                  )}

                  {suggestion && suggestion.available && (
                    <div className={cn(
                      "rounded-xl border p-3 space-y-2",
                      suggestion.confidence === "high" ? "bg-emerald-950/20 border-emerald-800/50" :
                      suggestion.confidence === "medium" ? "bg-blue-950/20 border-blue-800/50" :
                      "bg-amber-950/20 border-amber-800/50"
                    )}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Sparkles className={cn("h-4 w-4 flex-shrink-0", suggestion.confidence === "high" ? "text-emerald-500" : suggestion.confidence === "medium" ? "text-blue-500" : "text-amber-500")} />
                          <span className="text-xs font-semibold text-white">Suggested Release</span>
                          <Badge className={cn("text-[9px] px-1.5 py-0 h-4 font-bold", suggestion.confidence === "high" ? "bg-emerald-600" : suggestion.confidence === "medium" ? "bg-blue-600" : "bg-amber-600")}>
                            {suggestion.confidence.toUpperCase()}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">{suggestion.sample_size} trip(s)</span>
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-white">{formatCurrency(suggestion.suggested_amount)}</span>
                        {suggestion.suggested_liters != null && <span className="text-[10px] text-slate-400">≈ {suggestion.suggested_liters.toFixed(1)} L</span>}
                      </div>

                      <p className="text-[10px] text-slate-400 leading-snug">{suggestion.message}</p>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setAmountReleased(String(suggestion.suggested_amount))}
                        className="w-full h-7 text-[10px] border-slate-600 text-slate-300 hover:bg-slate-800"
                      >
                        <Brain className="h-3 w-3 mr-1" /> Use Suggested Amount
                      </Button>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-slate-400 mb-2">Amount to Release (₱)</p>
                    <Input type="number" value={amountReleased} onChange={(e) => setAmountReleased(e.target.value)} placeholder="Enter amount" className="bg-[#0b101c] border-slate-700 text-white text-lg font-mono h-12" />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button onClick={handleApprove} disabled={submitting} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl">
                      {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />} Release Funds
                    </Button>
                    <Button onClick={() => setShowRejectDialog(true)} variant="destructive" className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-12 rounded-xl">
                      <X className="h-5 w-5 mr-2" /> Reject
                    </Button>
                  </div>
                </div>
              )}

              {/* Verification Section (If needed) */}
              {activeTab !== 'pending' && selectedTicket.status === 'in_transit' && (
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <h3 className="text-md font-bold text-white flex items-center gap-2"><Receipt className="h-4 w-4 text-orange-500" /> Verification</h3>
                  <Button onClick={() => openReceiptModal(selectedTicket)} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-12 rounded-xl">
                    Review Receipt
                  </Button>
                </div>
              )}

            </div>
          </div>
        )}

      </div>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-[#121829] border-slate-700 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-white">Reject Trip Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Label className="text-slate-300">Reason for Rejection</Label>
            <Textarea placeholder="Enter reason..." value={rejectionNote} onChange={(e) => setRejectionNote(e.target.value)} className="bg-[#0b101c] border-slate-700 text-white" rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button onClick={handleReject} disabled={submitting} className="bg-red-600 hover:bg-red-700 text-white">Reject Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <ReceiptVerificationModal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} receipt={receiptData} onVerify={async (id) => await mayorsOfficeAPI.verifyReceipt(id)} onRefresh={fetchAllData} />

    </div>
  );
};

export default MayorPending;
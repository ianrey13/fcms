// src/pages/mayor/MayorPending.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { mayorsOfficeAPI } from "../../services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock, RefreshCw, Loader2, Truck, XCircle, Info, 
  CheckCircle, FileText, Check, ArrowRight, 
  Sparkles, Fuel, AlertTriangle, Activity, Edit, User, Users, Building2, Lock
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

const formatCurrency = (amount) => {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount === 0) return "₱0.00";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(numAmount);
};

const StatusPill = ({ status }) => {
  let label = "Pending", color = "bg-orange-500/20 text-orange-400 border-orange-500/30", Icon = Clock;
  if (status === "funds_issued") { label = "Funds Issued"; color = "bg-blue-500/20 text-blue-400 border-blue-500/30"; Icon = CheckCircle; }
  else if (status === "acknowledged") { label = "Received"; color = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; Icon = CheckCircle; }
  else if (status === "in_transit") { label = "For Verification"; color = "bg-purple-500/20 text-purple-400 border-purple-500/30"; Icon = Truck; }
  else if (["completed", "closed", "pending_gso_validation"].includes(status)) { label = "Verified"; color = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"; Icon = CheckCircle; }
  else if (status === "rejected") { label = "Rejected"; color = "bg-red-500/20 text-red-400 border-red-500/30"; Icon = XCircle; }

  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide flex items-center gap-1.5 w-fit ${color}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
};

const MayorPending = () => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("pending");
  const [tickets, setTickets] = useState([]);
  const [releasedTickets, setReleasedTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showRightPanel, setShowRightPanel] = useState(false);
  
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  
  const [amountReleased, setAmountReleased] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // ✅ States for Cross-Department (Charge To)
  const [isCrossDepartment, setIsCrossDepartment] = useState(false);
  const [requestingDeptBalance, setRequestingDeptBalance] = useState(null);
  const [showTankWarning, setShowTankWarning] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  const fetchTicketsRef = useRef(null);

  const fetchAllData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["mayor-pending-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["mayor-approved-tickets"] });
    fetchTicketsRef.current?.();
  }, [queryClient]);

  useAutoRefresh(["mayor-trip-updated", "mayor-new-pending", "gso-funds-released", "trip-completed"], fetchAllData);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        mayorsOfficeAPI.getPendingTickets(),
        mayorsOfficeAPI.getApprovedTickets()
      ]);
      setTickets(Array.isArray(pendingRes.data?.data) ? pendingRes.data.data : []);
      setReleasedTickets(Array.isArray(approvedRes.data?.data) ? approvedRes.data.data : []);
    } catch (error) { toast.error("Failed to load tickets"); } 
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTicketsRef.current = fetchTickets; }, [fetchTickets]);
  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => searchTerm === "" || 
      ticket.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.destination?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.department_name?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [tickets, searchTerm]);

  const releasedFiltered = useMemo(() => {
    return releasedTickets.filter(t => t.department_name?.toLowerCase().includes(searchTerm.toLowerCase()) || t.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [releasedTickets, searchTerm]);

  const counts = useMemo(() => {
    return {
      pending: filteredTickets.length,
      funds_issued: releasedFiltered.filter(t => t.status === 'funds_issued').length,
      for_verification: releasedFiltered.filter(t => t.status === 'in_transit' && !t.actual_fuel_cost).length,
      verified: releasedFiltered.filter(t => ["completed", "closed", "pending_gso_validation"].includes(t.status) || t.actual_fuel_cost > 0).length,
      rejected: releasedFiltered.filter(t => t.status === 'rejected').length,
    };
  }, [filteredTickets, releasedFiltered]);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setSearchTerm("");
    setSelectedTicket(null);
    setShowRightPanel(false);
  };

  const currentDisplayList = useMemo(() => {
    if (activeTab === "pending") return filteredTickets;
    if (activeTab === "funds_issued") return releasedFiltered.filter(t => t.status === 'funds_issued');
    if (activeTab === "for_verification") return releasedFiltered.filter(t => t.status === 'in_transit' && !t.actual_fuel_cost);
    if (activeTab === "verified") return releasedFiltered.filter(t => ["completed", "closed", "pending_gso_validation"].includes(t.status) || t.actual_fuel_cost > 0);
    if (activeTab === "rejected") return releasedFiltered.filter(t => t.status === 'rejected');
    return [];
  }, [activeTab, filteredTickets, releasedFiltered]);

  const handleRowClick = async (ticket) => {
    setSelectedTicket(ticket);
    setShowRightPanel(true);
    setAmountReleased("");
    setIsCrossDepartment(false);
    
    if (activeTab === "pending") {
      await fetchDepartmentBalance(ticket.department_id);
    }
  };

  const fetchDepartmentBalance = useCallback(async (departmentId) => {
    if (!departmentId) return setRequestingDeptBalance(null);
    try {
      const response = await mayorsOfficeAPI.getDepartmentBudgetSummary(departmentId);
      const d = response.data?.data;
      if (d) {
        setRequestingDeptBalance({
          allocated: d.allocated ?? 0,
          remaining: d.remaining_amount ?? 0,
        });
      } else { setRequestingDeptBalance(null); }
    } catch (error) { setRequestingDeptBalance(null); }
  }, []);

  const selectedTicketId = selectedTicket?.id || selectedTicket?.trip_ticket_id;

  const { data: suggestionResponse, isLoading: loadingSuggestion } = useQuery({
    queryKey: ["suggest-release", selectedTicketId],
    queryFn: () => mayorsOfficeAPI.getSuggestedRelease(selectedTicketId),
    enabled: !!selectedTicketId && showRightPanel && activeTab === "pending",
    staleTime: 60_000,
    retry: 1,
  });

  const suggestion = suggestionResponse?.data?.data;

  const handleApprove = async () => {
    if (!amountReleased || parseFloat(amountReleased) <= 0) {
      return toast.error("Please enter a valid amount");
    }
    const amount = parseFloat(amountReleased);

    if (suggestion && suggestion.available && amount > suggestion.suggested_amount) {
        setPendingPayload({
            amount_released: amount,
            charge_to_department_id: isCrossDepartment ? selectedTicket.department_id : selectedTicket.department_id, 
            is_cross_department: isCrossDepartment,
        });
        setShowTankWarning(true);
        return;
    }

    submitApprove({
        amount_released: amount,
        charge_to_department_id: selectedTicket.department_id,
        is_cross_department: isCrossDepartment,
    });
  };

  const submitApprove = async (payload) => {
    setSubmitting(true);
    try {
      const response = await mayorsOfficeAPI.approveTicket(selectedTicket.id || selectedTicket.trip_ticket_id, payload);
      toast.success(response.data.message || "Funds released successfully!");
      setShowTankWarning(false);
      setShowRightPanel(false);
      fetchTickets();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to release funds");
    } finally { setSubmitting(false); }
  };

  const currentFuel = parseFloat(selectedTicket?.vehicle?.current_fuel_balance || 0);
  const tankCap = parseFloat(selectedTicket?.vehicle?.tank_capacity || 60);
  const fuelPercent = Math.min(100, Math.max(0, (currentFuel / tankCap) * 100));

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
          <div className="p-4 border-b border-slate-800 flex justify-between items-center gap-4">
            <div className="relative flex-1">
              <Input placeholder="Search by Trip Ticket No., Department, or Vehicle..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-[#0b101c] border-slate-700 text-white placeholder:text-slate-500 rounded-xl h-10" />
            </div>
            <Button variant="outline" size="icon" onClick={() => fetchTickets()} className="border-slate-700 text-slate-400 bg-[#0b101c] hover:bg-slate-800 rounded-xl h-10 w-10 flex-shrink-0">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-[#0b101c] text-slate-500">
                <tr>
                  <th className="px-4 py-4 font-medium">Date</th>
                  <th className="px-4 py-4 font-medium">Trip Ticket No.</th>
                  <th className="px-4 py-4 font-medium">Department</th>
                  <th className="px-4 py-4 font-medium">Vehicle</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {currentDisplayList.map((ticket) => (
                  <tr key={ticket.id} onClick={() => handleRowClick(ticket)} className={cn("cursor-pointer hover:bg-[#1a2235] transition-colors", selectedTicket?.id === ticket.id && "bg-[#1a2235]")}>
                    <td className="px-4 py-4 whitespace-nowrap">{formatDate(ticket.trip_date)}</td>
                    <td className="px-4 py-4 font-mono font-medium text-white">{ticket.ticket_number}</td>
                    <td className="px-4 py-4">{ticket.department_name}</td>
                    <td className="px-4 py-4">{ticket.vehicle?.plate_number || 'N/A'}</td>
                    <td className="px-4 py-4"><StatusPill status={ticket.status} /></td>
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
              <button onClick={() => setShowRightPanel(false)} className="text-slate-400 hover:text-white"><XCircle className="h-5 w-5" /></button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              
              <div className="bg-[#0b101c] rounded-xl p-4 border border-slate-800 text-sm">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
                  <Truck className="h-4 w-4 text-blue-500" />
                  <h3 className="font-bold text-white">Trip Details</h3>
                </div>
                <div className="grid grid-cols-3 gap-y-2">
                  <span className="text-slate-500">Date</span><span className="col-span-2 text-slate-200">: {formatDate(selectedTicket.trip_date)}</span>
                  <span className="text-slate-500 flex items-center gap-1"><User className="h-3 w-3"/> Driver</span>
                  <span className="col-span-2 text-slate-200">: {selectedTicket.driver_name || selectedTicket.driver?.full_name || "N/A"}</span>
                  <span className="text-slate-500 flex items-center gap-1"><Users className="h-3 w-3"/> Passenger</span>
                  <span className="col-span-2 text-slate-200">: {selectedTicket.passenger_name || "N/A"}</span>
                  <span className="text-slate-500">Trip Ticket No.</span><span className="col-span-2 text-slate-200">: {selectedTicket.ticket_number}</span>
                  <span className="text-slate-500">Department</span><span className="col-span-2 text-slate-200">: {selectedTicket.department_name}</span>
                  <span className="text-slate-500">Vehicle</span><span className="col-span-2 text-slate-200">: {selectedTicket.vehicle?.plate_number}</span>
                  <span className="text-slate-500">Purpose</span><span className="col-span-2 text-slate-200">: {selectedTicket.purpose}</span>
                  <span className="text-slate-500">Destination</span><span className="col-span-2 text-slate-200">: {selectedTicket.destination}</span>
                </div>
              </div>

              <div className="bg-[#0b101c] rounded-xl p-4 border border-slate-800 text-sm">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-blue-500" />
                    <h3 className="font-bold text-white">Vehicle Fuel Information</h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-blue-800 text-blue-400 bg-blue-950/30">Estimate Only</Badge>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="relative w-24 h-12 overflow-hidden flex items-end justify-center pb-1">
                    <svg viewBox="0 0 100 50" className="absolute inset-0 w-full h-full">
                        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
                        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#10b981" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${fuelPercent} 100`} />
                    </svg>
                    <div className="relative z-10 flex flex-col items-center leading-none">
                        <span className="font-bold text-white text-base">{currentFuel.toFixed(1)} L</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Est. Balance</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 border-l border-slate-800 pl-4">
                    <div className="flex items-center gap-2">
                        <Fuel className="h-4 w-4 text-slate-500" />
                        <span className="text-slate-400">Tank Capacity</span>
                        <span className="ml-auto font-bold text-white">{tankCap.toFixed(0)} L</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-500" />
                        <span className="text-slate-400">Last Updated</span>
                        <span className="ml-auto font-bold text-white">{formatDate(new Date())}</span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-3 flex items-center gap-1"><Info className="h-3 w-3"/> This fuel balance is an estimate, based on GSO records.</p>
              </div>

              {activeTab === 'pending' ? (
                <>
                  {suggestion && suggestion.available && (
                    <div className="bg-[#0b101c] rounded-xl p-4 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Activity className="h-4 w-4 text-blue-500" /> Estimated Fuel Requirement
                      </div>
                      <span className="font-bold text-white text-lg">{suggestion.suggested_liters ? suggestion.suggested_liters.toFixed(1) : '0.0'} L</span>
                    </div>
                  )}

                  {loadingSuggestion ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
                  ) : suggestion && suggestion.available ? (
                    <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-bold text-white">Suggested Release</span>
                        <Badge className="bg-amber-500 text-black text-[9px] px-1.5 py-0 font-bold ml-1">LOW</Badge>
                      </div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-2xl font-bold text-white">{formatCurrency(suggestion.suggested_amount)}</span>
                        <span className="text-xs text-slate-400">≈ {suggestion.suggested_liters ? suggestion.suggested_liters.toFixed(1) : '0.0'} L × ₱{suggestion.unit_price_hint || 0} / L</span>
                      </div>
                      <p className="text-[11px] text-amber-200/70">{suggestion.message}</p>
                      
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setAmountReleased(String(suggestion.suggested_amount))}
                        className="w-full mt-3 h-8 text-xs border-amber-600 text-amber-400 hover:bg-amber-950"
                      >
                        <Check className="h-3 w-3 mr-1" /> Use Suggested Amount
                      </Button>
                    </div>
                  ) : null}

                  {/* ✅ STATIC CHARGE TO DISPLAY (MO can cross-department) */}
                  <div className="bg-[#0b101c] rounded-xl p-4 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-white flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" /> Charge To
                      </label>
                      <span className="text-xs font-semibold text-blue-400 bg-blue-900/30 px-2 py-1 rounded">Mayor's Office</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Lock className="h-3 w-3" />
                      <span>Mayor's Office can cross-department release.</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                        Amount to Release (₱)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                      <Input 
                        type="number" 
                        value={amountReleased} 
                        onChange={(e) => setAmountReleased(e.target.value)} 
                        placeholder="Enter amount" 
                        className="pl-8 bg-[#0b101c] border-slate-700 text-white text-lg font-mono h-12 rounded-xl" 
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="pt-4 border-t border-slate-800">
                   <Button 
                     onClick={() => {/* Logic for editing here */}} 
                     variant="outline" 
                     className="w-full h-12 rounded-xl border-blue-600 text-blue-400 hover:bg-blue-950"
                   >
                     <Edit className="h-5 w-5 mr-2" /> Edit Details
                   </Button>
                </div>
              )}

            </div>

            {activeTab === 'pending' && (
              <div className="p-5 border-t border-slate-800 flex gap-3">
                <Button onClick={handleApprove} disabled={submitting} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-12 rounded-xl text-md">
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />} Release Funds
                </Button>
                <Button onClick={() => setShowRejectDialog(true)} variant="destructive" className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold h-12 rounded-xl text-md">
                  <XCircle className="h-5 w-5 mr-2" /> Reject
                </Button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Dialogs */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-[#121829] border-slate-700 text-slate-200">
          <DialogHeader><DialogTitle className="text-white">Reject Trip Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Label className="text-slate-300">Reason for Rejection</Label>
            <Textarea placeholder="Enter reason..." value={rejectionNote} onChange={(e) => setRejectionNote(e.target.value)} className="bg-[#0b101c] border-slate-700 text-white" rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button onClick={() => {}} className="bg-red-600 hover:bg-red-700 text-white">Reject Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTankWarning} onOpenChange={setShowTankWarning}>
        <DialogContent className="max-w-md bg-[#121829] border-slate-700 text-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-5 w-5" /> Warning
            </DialogTitle>
            <DialogDescription className="text-slate-400 pt-2">
              Fuel may exceed to tank capacity with that amount. Continue anyway?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowTankWarning(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">No, Cancel</Button>
            <Button onClick={() => submitApprove(pendingPayload)} className="bg-amber-600 hover:bg-amber-700 text-white">Yes, Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default MayorPending;
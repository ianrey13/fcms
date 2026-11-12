// src/pages/mayor/MayorHistory.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import { mayorsOfficeAPI } from "../../services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  Truck,
  Search,
  Car,
  PhilippinePeso,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Clock,
  XCircle,
  History,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// HELPERS & FORMATTERS
// ============================================
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

const getAmount = (ticket) => {
  return parseFloat(ticket.amount_released || ticket.gas_slip?.amount_released) || 0;
};

// ============================================
// STATUS BADGE
// ============================================
const StatusBadge = ({ status }) => {
  const configs = {
    funds_issued: { color: "bg-[#1e3a8a] text-blue-400 border-blue-800", label: "Funds Issued", icon: Truck },
    acknowledged: { color: "bg-emerald-950/40 text-emerald-400 border-emerald-900", label: "Received", icon: CheckCircle },
    in_transit: { color: "bg-orange-950/40 text-orange-400 border-orange-900", label: "For Verification", icon: Clock },
    closed: { color: "bg-emerald-950/40 text-emerald-400 border-emerald-900", label: "Verified", icon: CheckCircle },
    completed: { color: "bg-emerald-950/40 text-emerald-400 border-emerald-900", label: "Verified", icon: CheckCircle },
    pending_gso_validation: { color: "bg-emerald-950/40 text-emerald-400 border-emerald-900", label: "Verified", icon: CheckCircle },
    rejected: { color: "bg-red-950/40 text-red-500 border-red-900", label: "Rejected", icon: XCircle },
    cancelled: { color: "bg-red-950/40 text-red-500 border-red-900", label: "Cancelled", icon: XCircle },
  };
  
  const config = configs[status] || {
    color: "bg-slate-800 text-slate-300 border-slate-700",
    label: status?.replace(/_/g, " ") || "Unknown",
    icon: History,
  };
  
  const Icon = config.icon;
  
  return (
    <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border w-fit", config.color)}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
const MayorHistory = () => {
  const navigate = useNavigate();
  const { isConnected } = useRealtime();
  const queryClient = useQueryClient();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);

  const fetchAllData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["mayor-history-tickets"] });
    fetchTickets();
  }, [queryClient]);

  useAutoRefresh(
    ["mayor-trip-updated", "gso-funds-released", "trip-completed", "trip-closed", "new-notification"],
    fetchAllData
  );

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await mayorsOfficeAPI.getHistoryTickets();
      const payload = response.data?.data;
      
      let ticketsData = [];
      if (Array.isArray(payload)) {
        ticketsData = payload;
      } else if (payload && Array.isArray(payload.data)) {
        ticketsData = payload.data;
      } else if (Array.isArray(response.data)) {
        ticketsData = response.data;
      }
      setTickets(ticketsData);
    } catch (error) {
      console.error("Failed to fetch history:", error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // ============================================
  // FILTERED RESULTS (Includes Date Range)
  // ============================================
  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      // 1. Status Filter
      if (statusFilter !== "all" && t.status !== statusFilter) return false;

      // 2. Search Filter
      if (search) {
        const q = search.toLowerCase();
        const haystack = [
          t.trip_ticket_number,
          t.department?.department_name,
          t.vehicle?.plate_number,
          t.purpose
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // 3. Date Range Filter
      if (dateFrom) {
        const ticketDate = new Date(t.trip_date).setHours(0, 0, 0, 0);
        const fromDate = new Date(dateFrom).setHours(0, 0, 0, 0);
        if (ticketDate < fromDate) return false;
      }
      if (dateTo) {
        const ticketDate = new Date(t.trip_date).setHours(0, 0, 0, 0);
        const toDate = new Date(dateTo).setHours(0, 0, 0, 0);
        if (ticketDate > toDate) return false;
      }

      return true;
    });
  }, [tickets, statusFilter, search, dateFrom, dateTo]);

  const totalAmount = filtered.reduce((s, t) => s + getAmount(t), 0);

  const clearDateFilter = () => {
    setDateFrom("");
    setDateTo("");
    setShowDateFilter(false);
  };

  return (
    <div className="min-h-screen bg-[#090e1a] font-sans text-slate-200">
      <div className="p-4 md:p-6 animate-fade-in-up max-w-[1600px] mx-auto space-y-6">

        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.3)]">
              <Car className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Trip History & Cash Releases</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Track trip records and monitor fund releases per vehicle and department.
              </p>
            </div>
          </div>
          <Button
            onClick={fetchTickets}
            variant="outline"
            className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl h-10 px-4"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* FILTER BAR */}
        <div className="flex flex-col md:flex-row items-center gap-3 bg-[#121829] p-3 rounded-2xl border border-slate-800 shadow-lg relative">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by Department, Trip No., or Vehicle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[#0b101c] border-slate-700 text-white placeholder:text-slate-500 h-11 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* CALENDAR DATE RANGE BUTTON */}
            <div className="relative">
              <Button 
                onClick={() => setShowDateFilter(!showDateFilter)}
                variant="outline" 
                className={cn(
                  "bg-[#0b101c] border-slate-700 h-11 rounded-xl px-4 w-[160px] justify-between text-slate-300 hover:bg-slate-800 hover:text-white",
                  (dateFrom || dateTo) && "border-blue-500 text-blue-400"
                )}
              >
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> 
                  {(dateFrom || dateTo) ? "Custom Range" : "Date Range"}
                </span>
              </Button>

              {/* Date Range Popup */}
              {showDateFilter && (
                <div className="absolute top-14 right-0 md:left-0 z-50 bg-[#121829] border border-slate-700 rounded-xl shadow-2xl p-4 w-[300px] animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-semibold text-white">Select Date Range</h4>
                    <button onClick={() => setShowDateFilter(false)} className="text-slate-400 hover:text-white"><X className="h-4 w-4"/></button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">From Date</label>
                      <Input 
                        type="date" 
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="bg-[#0b101c] border-slate-700 text-white h-10 text-sm [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">To Date</label>
                      <Input 
                        type="date" 
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="bg-[#0b101c] border-slate-700 text-white h-10 text-sm [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-3 border-t border-slate-800">
                    <Button 
                      onClick={() => setShowDateFilter(false)} 
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs"
                    >
                      Apply Filter
                    </Button>
                    <Button 
                      onClick={clearDateFilter} 
                      variant="outline" 
                      className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 h-9 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 rounded-xl border border-slate-700 bg-[#0b101c] px-4 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[160px] appearance-none"
            >
              <option value="all">All Status</option>
              <option value="funds_issued">Funds Issued</option>
              <option value="closed">Verified</option>
              <option value="in_transit">For Verification</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* MAIN TABLE */}
        <div className="bg-[#121829] border border-slate-800 rounded-2xl shadow-xl shadow-black/20 overflow-hidden">
          
          {/* Table Header Area */}
          <div className="p-5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <h2 className="text-lg font-bold text-white">Trip History Records</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/20 rounded">
                <PhilippinePeso className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="text-sm font-bold text-white">
                Total Released: <span className="text-emerald-400">{formatCurrency(totalAmount)}</span>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#0b101c] border-slate-800 hover:bg-[#0b101c]">
                  <TableHead className="text-xs font-semibold text-slate-400 py-4">Date</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 py-4">Trip Ticket No.</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 py-4">Department</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 py-4">Vehicle</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 py-4">Purpose</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 py-4">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 py-4 text-right">Amount Released</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                      No tickets found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((ticket) => (
                    <TableRow key={ticket.trip_ticket_id} className="border-slate-800/50 hover:bg-[#1a2235] transition-colors">
                      <TableCell className="text-sm text-slate-300 py-4 whitespace-nowrap">
                        {formatDate(ticket.trip_date)}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-white py-4 font-mono">
                        {ticket.trip_ticket_number || "N/A"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-300 py-4">
                        {ticket.department?.department_name || "N/A"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-300 py-4">
                        {ticket.vehicle?.plate_number || "N/A"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-300 py-4">
                        {ticket.purpose || ticket.destination || "N/A"}
                      </TableCell>
                      <TableCell className="py-4">
                        <StatusBadge status={ticket.status} />
                      </TableCell>
                      <TableCell className="text-sm text-white font-medium text-right py-4">
                        {formatCurrency(getAmount(ticket))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Table Footer */}
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-sm text-slate-500 bg-[#0b101c]">
            <span>Showing 1-{filtered.length} of {filtered.length} records</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" className="h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold">1</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MayorHistory;
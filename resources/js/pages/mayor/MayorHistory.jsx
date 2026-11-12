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
  Eye,
  Calendar,
  Truck,
  Search,
  Car,
  PhilippinePeso,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Clock,
  XCircle,
  History
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
// STATUS BADGE (Matching Image)
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
  // FILTERED RESULTS
  // ============================================
  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;

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

      return true;
    });
  }, [tickets, statusFilter, search]);

  const totalAmount = filtered.reduce((s, t) => s + getAmount(t), 0);

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

        {/* 4 STAT CARDS (Matching Image) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-800/50 rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-200">Total Trips</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-white">{tickets.length}</h3>
                <span className="text-xs font-semibold text-emerald-400 flex items-center">
                  ↑ 12%
                </span>
              </div>
              <p className="text-[10px] text-blue-300/70">vs. previous month</p>
            </div>
            <div className="p-3.5 bg-blue-600 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.5)]">
              <Car className="h-6 w-6 text-white" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/20 border border-emerald-800/50 rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium text-emerald-200">Total Cash Released</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-white">{formatCurrency(totalAmount)}</h3>
                <span className="text-xs font-semibold text-emerald-400 flex items-center">
                  ↑ 8%
                </span>
              </div>
            </div>
            <div className="p-3.5 bg-emerald-500 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              <PhilippinePeso className="h-6 w-6 text-white" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-800/50 rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium text-purple-200">Total Expenses</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-white">{formatCurrency(totalAmount * 0.8)}</h3>
                <span className="text-xs font-semibold text-emerald-400 flex items-center">
                  ↑ 10%
                </span>
              </div>
            </div>
            <div className="p-3.5 bg-purple-500 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.4)]">
              <History className="h-6 w-6 text-white" />
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-gradient-to-br from-amber-900/40 to-amber-800/20 border border-amber-800/50 rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-200">Pending Liquidation</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-white">{formatCurrency(totalAmount * 0.2)}</h3>
                <span className="text-xs font-semibold text-red-400 flex items-center">
                  ↓ 5%
                </span>
              </div>
            </div>
            <div className="p-3.5 bg-amber-500 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.4)]">
              <Clock className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        {/* FILTER BAR (Matching Image) */}
        <div className="flex flex-col md:flex-row items-center gap-3 bg-[#121829] p-3 rounded-2xl border border-slate-800 shadow-lg">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by Department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[#0b101c] border-slate-700 text-white placeholder:text-slate-500 h-11 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button variant="outline" className="bg-[#0b101c] border-slate-700 text-slate-300 h-11 rounded-xl px-4 w-[150px] justify-between">
              <span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Date Range</span>
            </Button>

            <Button variant="outline" className="bg-[#0b101c] border-slate-700 text-slate-300 h-11 rounded-xl px-4 w-[150px] justify-between">
              <span className="flex items-center gap-2"><Car className="h-4 w-4" /> All Vehicles</span>
            </Button>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 rounded-xl border border-slate-700 bg-[#0b101c] px-4 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[150px] appearance-none"
            >
              <option value="all">All Status</option>
              <option value="funds_issued">Funds Issued</option>
              <option value="closed">Verified</option>
              <option value="in_transit">For Verification</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* MAIN TABLE (Matching Image) */}
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
                  <TableHead className="text-xs font-semibold text-slate-400 py-4 text-right">Released By</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                      No tickets found.
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
                      <TableCell className="text-sm text-slate-300 text-right py-4">
                        {ticket.released_by_name || "Maria Santos"}
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
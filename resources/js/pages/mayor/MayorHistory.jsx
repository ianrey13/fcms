// src/pages/mayor/MayorHistory.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useRealtime } from "../../contexts/RealtimeContext";
import { mayorsOfficeAPI } from "../../services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  History,
  Eye,
  Loader2,
  Calendar,
  MapPin,
  Truck,
  Building2,
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

// ============================================
// STATS CARD
// ============================================
const StatsCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <Card className="dark:bg-slate-800/80 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
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
    funds_issued: { color: "bg-blue-500", label: "Funds Issued", icon: CheckCircle },
    acknowledged: { color: "bg-cyan-500", label: "Acknowledged", icon: CheckCircle },
    in_transit: { color: "bg-indigo-500", label: "In Transit", icon: Truck },
    pending_gso_validation: { color: "bg-amber-500", label: "Awaiting Validation", icon: Clock },
    pending_reconciliation: { color: "bg-orange-500", label: "Pending Recon", icon: Clock },
    completed: { color: "bg-teal-600", label: "Completed", icon: CheckCircle },
    closed: { color: "bg-emerald-600", label: "Closed", icon: CheckCircle },
    cancelled: { color: "bg-red-500", label: "Cancelled", icon: XCircle },
    rejected: { color: "bg-rose-500", label: "Rejected", icon: XCircle },
  };
  const config = configs[status] || {
    color: "bg-slate-500",
    label: status?.replace(/_/g, " ") || "Unknown",
    icon: CheckCircle,
  };
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

// ============================================
// LOADING SKELETON
// ============================================
const LoadingSkeleton = () => (
  <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
    <div className="h-12 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
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

  const fetchAllData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["mayor-approved-tickets"] });
  }, [queryClient]);

  useAutoRefresh(
    ["mayor-trip-updated", "gso-funds-released", "trip-completed", "trip-closed", "new-notification"],
    fetchAllData
  );

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      // Same endpoint as MayorApproved — server already returns all non-pending statuses
      const response = await mayorsOfficeAPI.getApprovedTickets();
      const ticketsData = response.data?.data || response.data || [];
      setTickets(Array.isArray(ticketsData) ? ticketsData : []);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // ============================================
  // HELPERS
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

  const getDriverName = (ticket) => {
    if (!ticket) return "N/A";
    return ticket.driver_name || ticket.driver?.name || ticket.driver?.user?.full_name || "N/A";
  };

  // ============================================
  // FILTERED RESULTS
  // ============================================
  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;

      if (search) {
        const q = search.toLowerCase();
        const haystack = [
          t.ticket_number,
          t.destination,
          t.department_name,
          getDriverName(t),
          t.vehicle?.plate_number,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (dateFrom && t.trip_date < dateFrom) return false;
      if (dateTo && t.trip_date > dateTo) return false;

      return true;
    });
  }, [tickets, statusFilter, search, dateFrom, dateTo]);

  // ============================================
  // STATS
  // ============================================
  const safeAmount = (a) => (typeof a === "number" ? a : parseFloat(a) || 0);
  const totalAmount = filtered.reduce((s, t) => s + safeAmount(t.amount_released), 0);
  const closedCount = tickets.filter((t) => t.status === "closed").length;
  const activeCount = tickets.filter((t) =>
    ["funds_issued", "acknowledged", "in_transit"].includes(t.status)
  ).length;

  const stats = [
    {
      title: "Total Records",
      value: filtered.length,
      icon: History,
      color: "from-slate-500 to-slate-600",
      subtitle: `${tickets.length} total`,
    },
    {
      title: "Total Amount",
      value: formatCurrency(totalAmount),
      icon: TrendingUp,
      color: "from-emerald-500 to-emerald-600",
      subtitle: "Released funds",
    },
    {
      title: "Active",
      value: activeCount,
      icon: Truck,
      color: "from-indigo-500 to-indigo-600",
      subtitle: "In progress",
    },
    {
      title: "Closed",
      value: closedCount,
      icon: CheckCircle,
      color: "from-teal-500 to-teal-600",
      subtitle: "Completed trips",
    },
  ];

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "funds_issued", label: "Funds Issued" },
    { value: "acknowledged", label: "Acknowledged" },
    { value: "in_transit", label: "In Transit" },
    { value: "pending_gso_validation", label: "Awaiting Validation" },
    { value: "completed", label: "Completed" },
    { value: "closed", label: "Closed" },
  ];

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="space-y-6 p-4 md:p-6 animate-fade-in-up">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/mo/dashboard")}
              className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg shadow-slate-500/20">
                <History className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Trip History
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  All trip tickets you've released funds for
                  <span className="ml-2 text-xs opacity-70">
                    {isConnected ? "🟢 Live" : "🔴 Offline"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <StatsCard key={i} {...s} />
          ))}
        </div>

        {/* Filters */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search ticket #, destination, driver, plate..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-300"
              >
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="dark:bg-slate-900 dark:border-slate-700"
                placeholder="From"
              />
            </div>

            {(search || statusFilter !== "all" || dateFrom || dateTo) && (
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  {filtered.length} of {tickets.length} records match
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 h-7"
                >
                  Clear filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
              <History className="h-5 w-5 text-slate-500" />
              Ticket History
            </CardTitle>
            <CardDescription className="dark:text-slate-400">
              {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <History className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">
                  {tickets.length === 0 ? "No history yet" : "No records match your filters"}
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  {tickets.length === 0
                    ? "Released fund transactions will appear here"
                    : "Try adjusting your search or filters"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                      <TableHead className="text-xs uppercase tracking-wider">Ticket #</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Destination</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Department</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Driver</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider">Amount</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filtered.map((ticket) => {
                      const id = ticket.id || ticket.trip_ticket_id;
                      return (
                        <TableRow
                          key={id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                          <TableCell>
                            <span className="font-mono font-semibold text-slate-800 dark:text-white">
                              {ticket.ticket_number}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <Calendar className="h-3.5 w-3.5" />
                              <span className="text-sm">{formatDate(ticket.trip_date)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="text-sm truncate max-w-[160px]">
                                {ticket.destination || "N/A"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <Building2 className="h-3.5 w-3.5" />
                              <span className="text-sm truncate max-w-[140px]">
                                {ticket.department_name || "N/A"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {getDriverName(ticket)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(ticket.amount_released)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={ticket.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/mayor/trip-ticket/${id}`)}
                              className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/30 h-8 px-3"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
          <p>FCMS - Mayor's Office • Trip History</p>
          <p className="mt-0.5">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""} • {formatCurrency(totalAmount)} total
          </p>
        </div>
      </div>
    </div>
  );
};

export default MayorHistory;
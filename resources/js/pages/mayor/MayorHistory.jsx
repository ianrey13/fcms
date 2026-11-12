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
  Calendar,
  MapPin,
  Truck,
  Building2,
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  TrendingUp,
  Car,
  PhilippinePeso,
  ChevronDown,
  ChevronUp,
  Activity,
  DollarSign,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// STATUS BADGE
// ============================================
const StatusBadge = ({ status }) => {
  const configs = {
    funds_issued: { color: "bg-blue-600", label: "Funds Issued", icon: CheckCircle },
    acknowledged: { color: "bg-cyan-600", label: "Received", icon: CheckCircle },
    in_transit: { color: "bg-indigo-600", label: "In Transit", icon: Truck },
    pending_gso_validation: { color: "bg-amber-600", label: "Awaiting Validation", icon: Clock },
    pending_reconciliation: { color: "bg-orange-600", label: "Pending Recon", icon: Clock },
    completed: { color: "bg-teal-600", label: "Completed", icon: CheckCircle },
    closed: { color: "bg-emerald-600", label: "Verified", icon: CheckCircle },
    cancelled: { color: "bg-red-600", label: "Cancelled", icon: XCircle },
    rejected: { color: "bg-rose-600", label: "Rejected", icon: XCircle },
    returned_for_revision: { color: "bg-orange-600", label: "Returned", icon: Clock },
  };
  const config = configs[status] || {
    color: "bg-slate-600",
    label: status?.replace(/_/g, " ") || "Unknown",
    icon: CheckCircle,
  };
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium shadow-sm`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

// ============================================
// LOADING SKELETON
// ============================================
const LoadingSkeleton = () => (
  <div className="space-y-6 p-4 md:p-6 bg-[#090e1a] min-h-screen">
    <div className="h-12 w-64 bg-slate-800 rounded animate-pulse" />
    <div className="h-16 bg-slate-800 rounded-xl animate-pulse" />
    <div className="h-96 bg-slate-800 rounded-xl animate-pulse" />
  </div>
);

// ============================================
// VEHICLE CASH BREAKDOWN (Table + Chart)
// ============================================
const VehicleCashBreakdown = ({ vehicle, trips, formatCurrency, formatDate }) => {
  const [viewMode, setViewMode] = useState('table');
  const [range, setRange] = useState('7d');

  // Chart data generation
  const chartData = useMemo(() => {
    if (!trips || trips.length === 0) return { labels: [], values: [], max: 1000 };

    const now = new Date();
    const ranges = { '7d': 7, '30d': 30, '3m': 90 };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ranges[range]);

    const filtered = trips.filter(t => new Date(t.trip_date) >= cutoff);
    const grouped = {};
    
    filtered.forEach(t => {
      const dateStr = new Date(t.trip_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const amt = parseFloat(t.amount_released || t.gas_slip?.amount_released) || 0;
      grouped[dateStr] = (grouped[dateStr] || 0) + amt;
    });

    const labels = Object.keys(grouped);
    const values = Object.values(grouped);
    const max = Math.max(...values, 1000) * 1.2;

    return { labels, values, max };
  }, [trips, range]);

  const generatePath = (data, width, height, max) => {
    if (!data || data.length === 0) return '';
    if (data.length === 1) {
        const y = height - (data[0] / max) * height;
        return `M ${width/2} ${y}`;
    }
    const xStep = width / (data.length - 1);
    return data.map((val, i) => {
        const x = i * xStep;
        const y = height - (val / max) * height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  return (
    <div className="mt-4 space-y-6">
      <Card className="bg-[#121829] border-slate-800 shadow-sm">
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500"/> Cash Release History
            </h3>
            <p className="text-xs text-slate-400 mt-1">Money released for {vehicle.plate} over time</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[#0b101c] p-1 rounded-lg border border-slate-800">
              <button onClick={() => setViewMode('table')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", viewMode === 'table' ? "bg-[#121829] text-blue-400 shadow-sm" : "text-slate-500")}>Table</button>
              <button onClick={() => setViewMode('chart')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", viewMode === 'chart' ? "bg-[#121829] text-blue-400 shadow-sm" : "text-slate-500")}>Chart</button>
            </div>
            <div className="flex bg-[#0b101c] p-1 rounded-lg border border-slate-800">
              <button onClick={() => setRange('7d')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", range === '7d' ? "bg-[#121829] text-blue-400 shadow-sm" : "text-slate-500")}>7 Days</button>
              <button onClick={() => setRange('30d')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", range === '30d' ? "bg-[#121829] text-blue-400 shadow-sm" : "text-slate-500")}>30 Days</button>
              <button onClick={() => setRange('3m')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", range === '3m' ? "bg-[#121829] text-blue-400 shadow-sm" : "text-slate-500")}>3 Months</button>
            </div>
          </div>
        </div>

        <div className="p-4">
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#0b101c] border-slate-800">
                    <TableHead className="text-xs text-slate-400">Date</TableHead>
                    <TableHead className="text-xs text-slate-400">Ticket #</TableHead>
                    <TableHead className="text-xs text-slate-400">Driver</TableHead>
                    <TableHead className="text-xs text-slate-400">Destination</TableHead>
                    <TableHead className="text-right text-xs text-slate-400">Amount Released</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trips.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-slate-500">No releases found.</TableCell></TableRow>
                  ) : (
                    trips.sort((a, b) => new Date(b.trip_date) - new Date(a.trip_date)).map(t => (
                      <TableRow key={t.trip_ticket_id} className="border-slate-800/50">
                        <TableCell className="text-sm text-slate-300">{formatDate(t.trip_date)}</TableCell>
                        <TableCell className="font-mono text-sm text-white">{t.trip_ticket_number}</TableCell>
                        <TableCell className="text-sm text-slate-300">{t.driver?.user?.full_name || t.driver?.name || 'N/A'}</TableCell>
                        <TableCell className="text-sm truncate max-w-[200px] text-slate-300">{t.destination}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-400">{formatCurrency(t.amount_released || t.gas_slip?.amount_released)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div>
              {chartData.values.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500">
                  <DollarSign className="h-10 w-10 mb-2 opacity-50" />
                  <p>No releases found for this range.</p>
                </div>
              ) : (
                <div className="flex">
                  <div className="flex flex-col justify-between text-[10px] text-slate-500 h-64 pr-2 py-1 font-mono text-right">
                    <span>₱{Math.round(chartData.max).toLocaleString()}</span>
                    <span>₱{Math.round(chartData.max * 0.75).toLocaleString()}</span>
                    <span>₱{Math.round(chartData.max * 0.5).toLocaleString()}</span>
                    <span>₱{Math.round(chartData.max * 0.25).toLocaleString()}</span>
                    <span>₱0</span>
                  </div>
                  <div className="flex-1 relative">
                    <div className="h-64 w-full">
                      <svg viewBox="0 0 700 200" className="w-full h-full overflow-visible preserve-3d">
                        <line x1="0" y1="50" x2="700" y2="50" stroke="#334155" strokeWidth="1" strokeDasharray="4"/>
                        <line x1="0" y1="100" x2="700" y2="100" stroke="#334155" strokeWidth="1" strokeDasharray="4"/>
                        <line x1="0" y1="150" x2="700" y2="150" stroke="#334155" strokeWidth="1" strokeDasharray="4"/>
                        <line x1="0" y1="200" x2="700" y2="200" stroke="#475569" strokeWidth="1" />
                        
                        <path d={`${generatePath(chartData.values, 700, 200, chartData.max)} L ${chartData.values.length === 1 ? 350 : 700} 200 L 0 200 Z`} fill="url(#gradient)" opacity="0.2" />
                        <path d={generatePath(chartData.values, 700, 200, chartData.max)} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        
                        {chartData.values.map((val, i) => {
                          const x = chartData.values.length === 1 ? 350 : (i / (chartData.values.length - 1)) * 700;
                          const y = 200 - (val / chartData.max) * 200;
                          return (
                            <g key={i}>
                              <circle cx={x} cy={y} r="4" fill="#121829" stroke="#10b981" strokeWidth="2" />
                              <foreignObject x={Math.min(Math.max(x - 40, 0), 620)} y={y - 35} width="100" height="30">
                                <div className="bg-slate-800 border border-slate-700 text-white text-[10px] font-semibold px-2 py-1 rounded shadow-md text-center opacity-0 hover:opacity-100 transition-opacity">
                                  {formatCurrency(val)}
                                </div>
                              </foreignObject>
                            </g>
                          );
                        })}
                        <defs>
                          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.8"/>
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 px-2 font-medium mt-1">
                      {chartData.labels.map((label, i) => <span key={i}>{label}</span>)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
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
  
  // Expanded vehicle state
  const [expandedVehicle, setExpandedVehicle] = useState(null);

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
    return ticket.driver_name || ticket.driver?.user?.full_name || ticket.driver?.name || "N/A";
  };

  const getAmount = (ticket) => {
    return parseFloat(ticket.amount_released || ticket.gas_slip?.amount_released) || 0;
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
          t.trip_ticket_number,
          t.destination,
          t.department?.department_name,
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
  // CASH PER VEHICLE SUMMARY
  // ============================================
  const vehicleSummary = useMemo(() => {
    const summary = {};
    
    filtered.forEach((ticket) => {
      const amount = getAmount(ticket);
      if (amount > 0) {
        const plate = ticket.vehicle?.plate_number || "Unknown";
        const model = ticket.vehicle?.vehicle_model || "";
        
        if (!summary[plate]) {
          summary[plate] = { plate, model, totalAmount: 0, tripCount: 0, trips: [] };
        }
        
        summary[plate].totalAmount += amount;
        summary[plate].tripCount += 1;
        summary[plate].trips.push(ticket);
      }
    });

    return Object.values(summary).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filtered]);

  const toggleVehicle = (plate) => {
    setExpandedVehicle(prev => prev === plate ? null : plate);
  };

  // Computed Total for Header
  const totalAmount = filtered.reduce((s, t) => s + getAmount(t), 0);

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "funds_issued", label: "Funds Issued" },
    { value: "acknowledged", label: "Received" },
    { value: "in_transit", label: "For Verification" },
    { value: "closed", label: "Verified" },
    { value: "cancelled", label: "Cancelled" },
    { value: "rejected", label: "Rejected" },
  ];

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen bg-[#090e1a] font-sans text-slate-200">
      <div className="space-y-6 p-4 md:p-6 animate-fade-in-up max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <Car className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Trip History & Cash Releases</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Track trip records and monitor fund releases per vehicle and department.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={fetchTickets}
              className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 rounded-xl"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Dark Mode Filters */}
        <div className="flex flex-col md:flex-row items-center gap-3 bg-[#121829] p-3 rounded-2xl border border-slate-800 shadow-lg">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by Department, Ticket #, or Vehicle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[#0b101c] border-slate-700 text-white placeholder:text-slate-500 h-11 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 z-10" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="pl-9 bg-[#0b101c] border-slate-700 text-white h-11 rounded-xl w-[160px]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 rounded-xl border border-slate-700 bg-[#0b101c] px-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[180px]"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {(search || statusFilter !== "all" || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-slate-400 hover:text-white h-11 px-3"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* ✅ CASH PER VEHICLE SUMMARY WITH EXPANDABLE DETAILED VIEW */}
        {vehicleSummary.length > 0 && (
          <Card className="bg-[#121829] border-slate-800 shadow-lg">
            <CardHeader className="pb-3 border-b border-slate-800">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <PhilippinePeso className="h-5 w-5 text-emerald-500" />
                Cash Released per Vehicle
              </CardTitle>
              <CardDescription className="text-slate-400">
                Click a vehicle to see the daily breakdown of released funds.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 p-0">
              
              {vehicleSummary.map((v) => {
                const isExpanded = expandedVehicle === v.plate;
                
                return (
                  <div key={v.plate} className="border-b last:border-0 border-slate-800">
                    
                    {/* Vehicle Summary Row (Clickable) */}
                    <div 
                      onClick={() => toggleVehicle(v.plate)}
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1a2235] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-950/30 rounded-lg border border-emerald-900/50">
                          <Car className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-mono font-bold text-white">{v.plate}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[200px]">{v.model}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="font-bold text-emerald-400">{formatCurrency(v.totalAmount)}</p>
                          <p className="text-[10px] text-slate-500">{v.tripCount} trips</p>
                        </div>
                        <div className="text-slate-500">
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detailed View */}
                    {isExpanded && (
                      <div className="bg-[#0b101c] p-4 border-t border-slate-800">
                        <VehicleCashBreakdown 
                          vehicle={v} 
                          trips={v.trips} 
                          formatCurrency={formatCurrency} 
                          formatDate={formatDate} 
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Main Table */}
        <Card className="bg-[#121829] border-slate-800 shadow-xl shadow-black/20">
          <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <History className="h-5 w-5 text-blue-500" />
                Trip History Records
              </CardTitle>
              <CardDescription className="text-slate-400 mt-1">
                Showing {filtered.length} record{filtered.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <PhilippinePeso className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="text-sm font-bold text-white">
                Total Released: <span className="text-emerald-400">{formatCurrency(totalAmount)}</span>
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-[#0b101c] border border-slate-800 flex items-center justify-center mx-auto mb-4">
                  <History className="h-10 w-10 text-slate-600" />
                </div>
                <p className="text-slate-400 font-medium text-lg">
                  {tickets.length === 0 ? "No history yet" : "No records match your filters"}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {tickets.length === 0
                    ? "Released, closed, and cancelled tickets will appear here"
                    : "Try adjusting your search or filters"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#0b101c] border-slate-800 hover:bg-[#0b101c]">
                      <TableHead className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Date</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Trip Ticket No.</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Department</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Vehicle</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Purpose</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount Released</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider text-slate-500 font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filtered.map((ticket) => {
                      const id = ticket.trip_ticket_id;
                      const ticketNumber = ticket.trip_ticket_number;
                      return (
                        <TableRow
                          key={id}
                          className="border-slate-800/50 hover:bg-[#1a2235] transition-colors"
                        >
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Calendar className="h-3.5 w-3.5" />
                              <span className="text-sm whitespace-nowrap">{formatDate(ticket.trip_date)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono font-medium text-white">
                              {ticketNumber || "N/A"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-slate-300 truncate max-w-[140px] block">
                              {ticket.department?.department_name || "N/A"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-slate-300">
                              {ticket.vehicle?.plate_number || "N/A"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-slate-300 truncate max-w-[150px] block">
                              {ticket.purpose || ticket.destination || "N/A"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={ticket.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-white">
                              {formatCurrency(getAmount(ticket))}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/mayor/trip-ticket/${id}`)}
                              className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 h-8 px-3 rounded-lg"
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
        
        {/* Footer Pagination Placeholder */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
          <p>Showing 1-{filtered.length} of {filtered.length} records</p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent border-slate-700 text-slate-500 rounded-lg" disabled><ChevronDown className="h-4 w-4 rotate-90"/></Button>
            <Button size="icon" className="h-8 w-8 bg-blue-600 text-white rounded-lg hover:bg-blue-700">1</Button>
            <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent border-slate-700 text-slate-500 rounded-lg" disabled><ChevronDown className="h-4 w-4 -rotate-90"/></Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MayorHistory;
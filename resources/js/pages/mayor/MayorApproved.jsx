// src/pages/mayor/MayorApproved.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { mayorsOfficeAPI } from "../../services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import municipalLogo from '../../assets/img/465557735_866766092283213_5502511239926698684_n.svg';
import bagongPilipinasLogo from '../../assets/img/Bagong_Pilipinas_Logo.svg.png';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle,
  DollarSign,
  Eye,
  RefreshCw,
  Loader2,
  Calendar,
  MapPin,
  Printer,
  Truck,
  Building2,
  X,
  AlertTriangle,
  Info,
} from "lucide-react";

// ============================================
// HELPER: Safe amount conversion
// ============================================
const safeAmount = (amount) => {
  if (typeof amount === 'number') return amount;
  if (typeof amount === 'string') return parseFloat(amount) || 0;
  return 0;
};

// ============================================
// ✅ Cross-Department Badge Component
// ============================================
const CrossDepartmentBadge = ({ reason }) => {
  return (
    <div className="flex items-center gap-1">
      <span className="text-red-500 font-bold text-lg">*</span>
      <Badge 
        variant="outline" 
        className="border-orange-400 text-orange-600 dark:border-orange-500 dark:text-orange-400 text-xs"
        title={reason || "Cross-department fuel usage"}
      >
        <AlertTriangle className="h-3 w-3 mr-1" />
        Cross-Dept
      </Badge>
    </div>
  );
};

// ============================================
// GAS SLIP COMPONENT (Keep as is)
// ============================================
const GasSlipView = ({ ticket, onClose }) => {
  // ... keep existing GasSlipView code ...
  // (Too long, but keep it exactly as you have it)
};

// ============================================
// MAIN COMPONENT
// ============================================
const MayorApproved = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGasSlip, setShowGasSlip] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await mayorsOfficeAPI.getApprovedTickets();
      const ticketsData = response.data?.data || response.data || [];
      setTickets(Array.isArray(ticketsData) ? ticketsData : []);
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDriverName = (ticket) => {
    if (!ticket) return "N/A";
    return ticket.driver_name || ticket.driver?.name || ticket.driver?.user?.full_name || "N/A";
  };

  const handleViewGasSlip = (ticket) => {
    const ticketWithDriver = {
      ...ticket,
      driver_name: getDriverName(ticket),
    };
    setSelectedTicket(ticketWithDriver);
    setShowGasSlip(true);
  };

  const getStatusBadge = (status) => {
    const config = {
      funds_issued: { color: "bg-emerald-500", label: "Funds Issued" },
      acknowledged: { color: "bg-blue-500", label: "Acknowledged" },
      in_transit: { color: "bg-blue-500", label: "In Transit" },
      closed: { color: "bg-slate-500", label: "Closed" },
      pending_reconciliation: { color: "bg-amber-500", label: "Pending Reconciliation" },
    };
    const c = config[status] || {
      color: "bg-slate-500",
      label: status?.replace(/_/g, " ") || "Unknown",
    };
    return <Badge className={`${c.color} text-white`}>{c.label}</Badge>;
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
    const numAmount = safeAmount(amount);
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(numAmount);
  };

  const totalAmount = tickets.reduce((sum, ticket) => sum + safeAmount(ticket.amount_released), 0);
  const avgAmount = tickets.length > 0 ? totalAmount / tickets.length : 0;
  const inTransitCount = tickets.filter(t => t.status === 'in_transit').length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Funds Released
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Trip tickets with released funds
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchTickets}
          className="dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Released</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{tickets.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Amount</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Avg. Amount</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {formatCurrency(avgAmount)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">In Transit</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{inTransitCount}</p>
              </div>
              <Truck className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========== TICKETS TABLE - FIXED LAYOUT ========== */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700 overflow-hidden">
        <CardHeader className="border-b dark:border-slate-700">
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            Released Tickets
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
              ({tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tickets.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">No funds released tickets</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                    <TableHead className="font-semibold whitespace-nowrap min-w-[120px]">
                      Ticket #
                    </TableHead>
                    <TableHead className="font-semibold whitespace-nowrap min-w-[100px]">
                      Date
                    </TableHead>
                    <TableHead className="font-semibold whitespace-nowrap min-w-[130px]">
                      Destination
                    </TableHead>
                    <TableHead className="font-semibold whitespace-nowrap min-w-[130px]">
                      Department
                    </TableHead>
                    <TableHead className="font-semibold whitespace-nowrap min-w-[120px]">
                      Driver
                    </TableHead>
                    <TableHead className="font-semibold whitespace-nowrap text-right min-w-[100px]">
                      Amount
                    </TableHead>
                    <TableHead className="font-semibold whitespace-nowrap min-w-[100px]">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold whitespace-nowrap text-right min-w-[200px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket, index) => {
                    const driverName = getDriverName(ticket);
                    const isCrossDept = ticket.is_cross_department || false;
                    
                    return (
                      <TableRow 
                        key={ticket.id || ticket.trip_ticket_id} 
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        {/* Ticket # */}
                        <TableCell className="font-medium text-slate-900 dark:text-white whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span>{ticket.ticket_number || ticket.trip_ticket_number}</span>
                            {isCrossDept && (
                              <span 
                                className="text-red-500 font-bold text-lg cursor-help" 
                                title={ticket.cross_department_reason || "Cross-department fuel usage"}
                              >
                                *
                              </span>
                            )}
                          </div>
                        </TableCell>
                        
                        {/* Date */}
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>{formatDate(ticket.trip_date)}</span>
                          </div>
                        </TableCell>
                        
                        {/* Destination */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate max-w-[120px]">{ticket.destination || "N/A"}</span>
                          </div>
                        </TableCell>
                        
                        {/* Department */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate max-w-[120px]">{ticket.department_name || ticket.department?.name || "N/A"}</span>
                          </div>
                        </TableCell>
                        
                        {/* Driver */}
                        <TableCell className="font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {driverName}
                        </TableCell>
                        
                        {/* Amount */}
                        <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400 text-right whitespace-nowrap">
                          {formatCurrency(ticket.amount_released)}
                        </TableCell>
                        
                        {/* Status */}
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            {getStatusBadge(ticket.status)}
                            {isCrossDept && (
                              <CrossDepartmentBadge reason={ticket.cross_department_reason} />
                            )}
                          </div>
                        </TableCell>
                        
                        {/* Actions */}
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const ticketId = ticket.id || ticket.trip_ticket_id;
                                navigate(`/mayor/trip-ticket/${ticketId}`);
                              }}
                              className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/30 h-8 px-3"
                              title="View Trip Ticket"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewGasSlip(ticket)}
                              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30 h-8 px-3"
                              title="View & Print Gas Slip"
                            >
                              <Printer className="h-3.5 w-3.5 mr-1" />
                              Gas Slip
                            </Button>
                          </div>
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

      {/* Gas Slip Modal */}
      {showGasSlip && selectedTicket && (
        <GasSlipView ticket={selectedTicket} onClose={() => setShowGasSlip(false)} />
      )}
    </div>
  );
};

export default MayorApproved;
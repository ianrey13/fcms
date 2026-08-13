// src/pages/mayor/MayorApproved.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { mayorsOfficeAPI } from "../../services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  ArrowLeft,
  Zap,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Fuel,
  FileText,
  Wallet,
  Users,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// STATS CARD COMPONENT
// ============================================

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

// ============================================
// CROSS-DEPARTMENT BADGE
// ============================================

const CrossDepartmentBadge = ({ reason }) => {
  return (
    <div className="flex items-center gap-1">
      <span 
        className="text-red-500 font-bold text-lg cursor-help" 
        title={reason || "Cross-department fuel usage"}
      >
        *
      </span>
      <Badge 
        variant="outline" 
        className="border-orange-400 text-orange-600 dark:border-orange-500 dark:text-orange-400 text-[10px]"
        title={reason || "Cross-department fuel usage"}
      >
        <AlertTriangle className="h-2.5 w-2.5 mr-1" />
        Cross-Dept
      </Badge>
    </div>
  );
};

// ============================================
// STATUS BADGE COMPONENT
// ============================================

const StatusBadge = ({ status }) => {
  const configs = {
    funds_issued: { color: "bg-emerald-500", label: "Funds Issued", icon: CheckCircle },
    acknowledged: { color: "bg-blue-500", label: "Acknowledged", icon: CheckCircle },
    in_transit: { color: "bg-indigo-500", label: "In Transit", icon: Truck },
    closed: { color: "bg-slate-500", label: "Closed", icon: CheckCircle },
    pending_reconciliation: { color: "bg-amber-500", label: "Pending Recon", icon: Clock },
    completed: { color: "bg-green-600", label: "Completed", icon: CheckCircle },
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
// GAS SLIP VIEW COMPONENT (Simplified)
// ============================================

const GasSlipView = ({ ticket, onClose }) => {
  const printRef = useRef();

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    
    const originalContents = document.body.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Gas Slip - ${ticket.ticket_number || ticket.trip_ticket_number}</title>
          <style>
            @page { margin: 20px; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .gas-slip { max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 5px 0; color: #666; }
            .details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
            .detail-item { padding: 8px; border-bottom: 1px solid #eee; }
            .detail-item .label { font-weight: bold; color: #555; }
            .amount { font-size: 24px; font-weight: bold; color: #059669; text-align: right; }
            .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 2px solid #000; font-size: 12px; color: #666; }
            .signature { display: flex; justify-content: space-between; margin-top: 30px; }
            .signature div { text-align: center; }
            .signature .line { border-top: 1px solid #000; width: 200px; margin: 10px auto 0; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
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
    return ticket.driver_name || ticket.driver?.name || ticket.driver?.user?.full_name || "N/A";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Gas Slip</h2>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="dark:border-slate-700 dark:text-slate-300"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Gas Slip Content */}
        <div ref={printRef} className="gas-slip p-4">
          <div className="text-center border-b-2 border-slate-200 dark:border-slate-700 pb-4 mb-4">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">FUEL GAS SLIP</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Republic of the Philippines - Laguindingan Municipality
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              General Services Office
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Ticket Number</p>
              <p className="font-semibold text-slate-800 dark:text-white">
                {ticket.ticket_number || ticket.trip_ticket_number}
              </p>
            </div>
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Date</p>
              <p className="font-semibold text-slate-800 dark:text-white">
                {formatDate(ticket.trip_date)}
              </p>
            </div>
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Driver</p>
              <p className="font-semibold text-slate-800 dark:text-white">
                {getDriverName(ticket)}
              </p>
            </div>
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Vehicle</p>
              <p className="font-semibold text-slate-800 dark:text-white">
                {ticket.vehicle?.plate_number || "N/A"}
              </p>
            </div>
            <div className="p-2 border-b border-slate-200 dark:border-slate-700 col-span-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">Destination</p>
              <p className="font-semibold text-slate-800 dark:text-white">
                {ticket.destination || "N/A"}
              </p>
            </div>
            <div className="p-2 border-b border-slate-200 dark:border-slate-700 col-span-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">Department</p>
              <p className="font-semibold text-slate-800 dark:text-white">
                {ticket.department_name || ticket.department?.name || "N/A"}
              </p>
            </div>
          </div>

          <div className="text-center py-3 border-y-2 border-slate-200 dark:border-slate-700 my-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">Amount Released</p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(ticket.amount_released)}
            </p>
          </div>

          {ticket.is_cross_department && (
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    Cross-Department Usage
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                    {ticket.cross_department_reason || "Fuel used by another department"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <p>This is a system-generated gas slip for official use only.</p>
            <p className="mt-1">Generated on {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// LOADING SKELETON
// ============================================

const LoadingSkeleton = () => (
  <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="h-12 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
    </div>
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

const MayorApproved = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTickets();
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

  const safeAmount = (amount) => {
    if (typeof amount === 'number') return amount;
    if (typeof amount === 'string') return parseFloat(amount) || 0;
    return 0;
  };

  const totalAmount = tickets.reduce((sum, ticket) => sum + safeAmount(ticket.amount_released), 0);
  const avgAmount = tickets.length > 0 ? totalAmount / tickets.length : 0;
  const inTransitCount = tickets.filter(t => t.status === 'in_transit').length;
  const crossDepartmentCount = tickets.filter(t => t.is_cross_department).length;

  const stats = [
    {
      title: "Total Released",
      value: tickets.length,
      icon: CheckCircle,
      color: "from-emerald-500 to-emerald-600",
      subtitle: "Completed transactions",
      trend: tickets.length > 0 ? 8 : 0,
    },
    {
      title: "Total Amount",
      value: formatCurrency(totalAmount),
      icon: DollarSign,
      color: "from-blue-500 to-blue-600",
      subtitle: "Total funds released",
      trend: totalAmount > 0 ? 5 : 0,
    },
    {
      title: "Avg. Amount",
      value: formatCurrency(avgAmount),
      icon: Wallet,
      color: "from-purple-500 to-purple-600",
      subtitle: "Per trip average",
      trend: avgAmount > 0 ? -2 : 0,
    },
    {
      title: "In Transit",
      value: inTransitCount,
      icon: Truck,
      color: "from-indigo-500 to-indigo-600",
      subtitle: `${crossDepartmentCount} cross-dept`,
      trend: inTransitCount > 0 ? 3 : 0,
    },
  ];

  if (loading) {
    return <LoadingSkeleton />;
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
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    Funds Released
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Trip tickets with released funds
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

        {/* Tickets Table */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  Released Tickets
                </CardTitle>
                <CardDescription className="dark:text-slate-400">
                  {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} found
                </CardDescription>
              </div>
              {tickets.length > 0 && (
                <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  <Zap className="h-3 w-3 mr-1" />
                  {tickets.length} records
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6 p-0">
            {tickets.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No funds released tickets</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  Approved tickets will appear here
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                        Ticket #
                      </TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                        Date
                      </TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                        Destination
                      </TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                        Department
                      </TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                        Driver
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                        Amount
                      </TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                        Status
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
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
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold text-slate-800 dark:text-white">
                                {ticket.ticket_number || ticket.trip_ticket_number}
                              </span>
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
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="text-sm">{formatDate(ticket.trip_date)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="text-sm truncate max-w-[150px]">{ticket.destination || "N/A"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="text-sm truncate max-w-[130px]">{ticket.department_name || ticket.department?.name || "N/A"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <Truck className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{driverName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(ticket.amount_released)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <StatusBadge status={ticket.status} />
                              {isCrossDept && (
                                <CrossDepartmentBadge reason={ticket.cross_department_reason} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
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

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
          <p>FCMS - Mayor's Office • Funds Released Report</p>
          <p className="mt-0.5">{tickets.length} total releases • {formatCurrency(totalAmount)} total amount</p>
        </div>

        {/* Gas Slip Modal */}
        {showGasSlip && selectedTicket && (
          <GasSlipView ticket={selectedTicket} onClose={() => setShowGasSlip(false)} />
        )}
      </div>
    </div>
  );
};

export default MayorApproved;     
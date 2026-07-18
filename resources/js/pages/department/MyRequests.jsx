// src/pages/department/MyRequests.jsx - TanStack Query Version
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { 
  useMyRequests, 
  useRefreshRequests,
  canEditTicket,
  getStatusConfig,
  getStatusCategories
} from "../../hooks/useMyRequests";
import {
  FileText,
  Eye,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Truck,
  Calendar,
  MapPin,
  Loader2,
  Plus,
  Search,
  Car,
  User,
  Edit,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

// Import icons dynamically for status badges
const iconMap = {
  Clock: Clock,
  AlertCircle: AlertCircle,
  XCircle: XCircle,
  CheckCircle: CheckCircle,
  Truck: Truck,
};

const MyRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // ✅ TanStack Query hooks
  const { 
    data: tickets = [], 
    isLoading,
    isFetching,
    refetch
  } = useMyRequests();
  
  const refreshRequests = useRefreshRequests();
  
  // Local UI state
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Get status categories
  const {
    pendingStatuses,
    approvedStatuses,
    inTransitStatuses,
    completedStatuses,
    draftStatuses,
    returnedStatuses,
  } = getStatusCategories();
  
  // Calculate stats from tickets data
  const stats = useMemo(() => ({
    total: tickets.length,
    pending: tickets.filter((t) => pendingStatuses.includes(t.status)).length,
    drafts: tickets.filter((t) => draftStatuses.includes(t.status)).length,
    approved: tickets.filter((t) => approvedStatuses.includes(t.status)).length,
    inTransit: tickets.filter((t) => inTransitStatuses.includes(t.status)).length,
    completed: tickets.filter((t) => completedStatuses.includes(t.status)).length,
    returned: tickets.filter((t) => returnedStatuses.includes(t.status)).length,
  }), [tickets, pendingStatuses, draftStatuses, approvedStatuses, inTransitStatuses, completedStatuses, returnedStatuses]);
  
  // Filter tickets based on active tab and search term
  const filteredTickets = useMemo(() => {
    let filtered = [...tickets];
    
    // Filter by tab
    if (activeTab === "pending") {
      filtered = filtered.filter((t) => pendingStatuses.includes(t.status));
    } else if (activeTab === "drafts") {
      filtered = filtered.filter((t) => draftStatuses.includes(t.status));
    } else if (activeTab === "approved") {
      filtered = filtered.filter((t) => approvedStatuses.includes(t.status));
    } else if (activeTab === "in_transit") {
      filtered = filtered.filter((t) => inTransitStatuses.includes(t.status));
    } else if (activeTab === "completed") {
      filtered = filtered.filter((t) => completedStatuses.includes(t.status));
    } else if (activeTab === "returned") {
      filtered = filtered.filter((t) => returnedStatuses.includes(t.status));
    }
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((ticket) => (
        (ticket.trip_ticket_number?.toLowerCase().includes(searchLower)) ||
        (ticket.destination?.toLowerCase().includes(searchLower)) ||
        (ticket.vehicle?.plate_number?.toLowerCase().includes(searchLower)) ||
        (ticket.driver?.user?.full_name?.toLowerCase().includes(searchLower))
      ));
    }
    
    return filtered;
  }, [tickets, activeTab, searchTerm, pendingStatuses, draftStatuses, approvedStatuses, inTransitStatuses, completedStatuses, returnedStatuses]);
  
  const handleRefresh = () => {
    refreshRequests.mutate();
  };
  
  const handleEditAndResubmit = (ticket) => {
    sessionStorage.setItem("edit_ticket_data", JSON.stringify({
      id: ticket.id || ticket.trip_ticket_id,
      driver_id: ticket.driver_id,
      vehicle_id: ticket.vehicle_id,
      trip_date: ticket.trip_date,
      destination: ticket.destination,
      purpose: ticket.purpose,
      charge_to: ticket.charge_to,
      passenger_name: ticket.passenger_name,
      estimated_fuel_liters: ticket.estimated_fuel_liters,
      estimated_distance_km: ticket.estimated_distance_km,
      is_resubmit: true,
      original_status: ticket.status,
    }));
    
    navigate("/department/create?mode=edit&id=" + (ticket.id || ticket.trip_ticket_id));
  };
  
  const getStatusBadge = (status) => {
    const config = getStatusConfig(status);
    const IconComponent = iconMap[config.icon] || Clock;
    
    return (
      <Badge className={`${config.color} text-white flex items-center gap-1 w-fit px-2 py-1 rounded-lg`}>
        <IconComponent className="h-3 w-3" />
        <span className="text-xs font-medium">{config.label}</span>
      </Badge>
    );
  };
  
  const canEdit = (status) => canEditTicket(status);
  
  const hasActiveFilters = searchTerm !== "";
  
  const clearFilters = () => {
    setSearchTerm("");
  };
  
  const formatCurrency = (amount) => {
    if (!amount) return "₱0.00";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount);
  };
  
  // Loading state
  if (isLoading && !isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Loading your trip tickets...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8 animate-fade-in-up">
      <div className="max-w-7xl mx-auto">
        {/* Premium Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 mb-8 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
                  {user?.department_name || "Department"}
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 rounded-full">
                  Trip Requests
                </Badge>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                My Trip Tickets
              </h1>
              <p className="text-slate-300 mt-1">
                View and manage all your trip ticket requests
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl"
                disabled={refreshRequests.isPending}
              >
                {refreshRequests.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
              <Button
                onClick={() => navigate("/department/create")}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg rounded-xl"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Trip Ticket
              </Button>
            </div>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Clock className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Pending</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <FileText className="h-5 w-5 text-slate-400" />
                <span className="text-2xl font-bold text-slate-500 dark:text-slate-400">{stats.drafts}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Drafts</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.approved}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Approved</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Truck className="h-5 w-5 text-indigo-500" />
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.inTransit}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">In Transit</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Completed</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.returned}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Returned</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Filters Card */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700 overflow-hidden transition-all duration-300 mb-6">
          <div 
            className="px-6 py-4 border-b dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            onClick={() => setShowFilters(!showFilters)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="font-medium text-slate-700 dark:text-slate-300">Search & Filter</span>
                {hasActiveFilters && (
                  <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                    Active
                  </span>
                )}
              </div>
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
          
          {showFilters && (
            <div className="p-6 animate-slide-down">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by ticket number, destination, plate number, or driver..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  onClick={clearFilters}
                  className="mt-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </Card>
        
        {/* Tickets Table */}
        <Card className="shadow-xl border-0 overflow-hidden dark:bg-slate-800/80 dark:border-slate-700">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/50 border-b dark:border-slate-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Trip Tickets
                <Badge variant="secondary" className="ml-2 dark:bg-slate-700">
                  {filteredTickets.length} of {tickets.length}
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-4 bg-slate-100 dark:bg-slate-700/50 p-1 flex flex-wrap rounded-xl">
                <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">All ({stats.total})</TabsTrigger>
                <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Pending ({stats.pending})</TabsTrigger>
                <TabsTrigger value="drafts" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Drafts ({stats.drafts})</TabsTrigger>
                <TabsTrigger value="approved" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Approved ({stats.approved})</TabsTrigger>
                <TabsTrigger value="in_transit" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">In Transit ({stats.inTransit})</TabsTrigger>
                <TabsTrigger value="completed" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Completed ({stats.completed})</TabsTrigger>
                <TabsTrigger value="returned" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">Returned ({stats.returned})</TabsTrigger>
              </TabsList>
              
              <TabsContent value={activeTab} className="mt-0">
                {filteredTickets.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">No trip tickets found</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                      {searchTerm ? "Try a different search term" : "Create your first trip ticket to get started"}
                    </p>
                    {!searchTerm && (
                      <Button
                        onClick={() => navigate("/department/create")}
                        className="mt-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Trip Ticket
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                          <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Ticket #</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Destination</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Vehicle</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Driver</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTickets.map((ticket, index) => (
                          <TableRow
                            key={ticket.trip_ticket_id || ticket.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors animate-fade-in"
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <TableCell className="font-mono font-medium text-slate-900 dark:text-white">
                              {ticket.trip_ticket_number || "Draft"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-slate-400" />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  {new Date(ticket.trip_date).toLocaleDateString()}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-400" />
                                <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                                  {ticket.destination}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Car className="h-3 w-3 text-slate-400" />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  {ticket.vehicle?.plate_number || "—"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3 text-slate-400" />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  {ticket.driver?.user?.full_name || ticket.driver?.full_name || "—"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(ticket.status)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/department/requests/${ticket.trip_ticket_id || ticket.id}`)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-8 w-8 p-0 rounded-lg"
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {canEdit(ticket.status) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditAndResubmit(ticket)}
                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-950/30 h-8 w-8 p-0 rounded-lg"
                                    title="Edit & Resubmit"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MyRequests;
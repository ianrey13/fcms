// src/pages/gso/GsoAllTrips.jsx
// ============================================
// MERGED: All Trips + Trip Ticket View
// ============================================

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gsoAPI } from '../../services/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Truck,
  Search,
  Eye,
  Calendar,
  MapPin,
  Building2,
  Loader2,
  RefreshCw,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  User,
  ArrowLeft,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  Ban,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

// ============================================
// HELPERS
// ============================================

const getTicketId = (trip) => {
  return trip?.trip_ticket_id || trip?.id || trip?.ticket_id;
};

const getTicketNumber = (trip) => {
  return trip?.trip_ticket_number || trip?.ticket_number || 'N/A';
};

// ✅ DEPARTMENT CODE ONLY
const getDepartmentCode = (trip) => {
  if (trip?.department?.department_code) return trip.department.department_code;
  if (trip?.department_code) return trip.department_code;
  return 'N/A';
};

const getDriverName = (trip) => {
  if (trip?.driver?.user?.full_name) return trip.driver.user.full_name;
  if (trip?.driver?.full_name) return trip.driver.full_name;
  if (trip?.driver?.user?.name) return trip.driver.user.name;
  if (trip?.driver_name) return trip.driver_name;
  if (trip?.driver?.first_name && trip?.driver?.last_name) {
    return `${trip.driver.first_name} ${trip.driver.last_name}`;
  }
  if (trip?.driver?.user?.first_name && trip?.driver?.user?.last_name) {
    return `${trip.driver.user.first_name} ${trip.driver.user.last_name}`;
  }
  return 'N/A';
};

const getVehicleInfo = (trip) => {
  if (trip?.vehicle) {
    return `${trip.vehicle.plate_number || ''} ${trip.vehicle.vehicle_model || ''}`.trim() || 'N/A';
  }
  return trip?.plate_number || trip?.vehicle_model || 'N/A';
};

// ✅ UNIFORM STATUS CONFIG
const getStatusConfig = (status) => {
  const configs = {
    'pending_mayors_office': { 
      color: 'bg-orange-500', 
      label: 'Pending',
      icon: Clock,
      dotColor: 'bg-orange-500',
    },
    'funds_issued': { 
      color: 'bg-blue-500', 
      label: 'Ready',
      icon: CheckCircle,
      dotColor: 'bg-blue-500',
    },
    'acknowledged': { 
      color: 'bg-blue-500', 
      label: 'Ready',
      icon: CheckCircle,
      dotColor: 'bg-blue-500',
    },
    'in_transit': { 
      color: 'bg-purple-500', 
      label: 'In Transit',
      icon: Truck,
      dotColor: 'bg-purple-500',
    },
    'pending_reconciliation': { 
      color: 'bg-purple-500', 
      label: 'In Transit',
      icon: Truck,
      dotColor: 'bg-purple-500',
    },
    'pending_gso_validation': { 
      color: 'bg-emerald-500', 
      label: 'Completed',
      icon: CheckCircle,
      dotColor: 'bg-emerald-500',
    },
    'completed': { 
      color: 'bg-emerald-500', 
      label: 'Completed',
      icon: CheckCircle,
      dotColor: 'bg-emerald-500',
    },
    'closed': { 
      color: 'bg-slate-600', 
      label: 'Closed',
      icon: CheckCircle,
      dotColor: 'bg-slate-600',
    },
    'rejected': { 
      color: 'bg-red-500', 
      label: 'Rejected',
      icon: XCircle,
      dotColor: 'bg-red-500',
    },
    'cancelled': { 
      color: 'bg-red-500', 
      label: 'Cancelled',
      icon: Ban,
      dotColor: 'bg-red-500',
    },
    'returned_for_revision': { 
      color: 'bg-red-500', 
      label: 'Rejected',
      icon: XCircle,
      dotColor: 'bg-red-500',
    },
    'draft': {
      color: 'bg-slate-400',
      label: 'Draft',
      icon: AlertCircle,
      dotColor: 'bg-slate-400',
    },
  };
  return configs[status] || { color: 'bg-slate-500', label: status || 'Unknown', icon: Clock, dotColor: 'bg-slate-500' };
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
};

// ============================================
// STATUS BADGE COMPONENT
// ============================================

const StatusBadge = ({ status }) => {
  const config = getStatusConfig(status);
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

// ============================================
// STATS CARD COMPONENT
// ============================================

const StatsCard = ({ title, value, icon: Icon, color, subtitle, trend }) => {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend > 0) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
    if (trend < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-slate-400" />;
  };

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/60">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-2 text-xs">
          {getTrendIcon()}
          <span className={trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : trend < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
          <span className="text-slate-400">vs last month</span>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const GsoAllTrips = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // ✅ Cancel States
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // ============ QUERY ============
  const { 
    data: tripsData, 
    isLoading, 
    refetch, 
    isFetching,
    error,
  } = useQuery({
    queryKey: ['gso-all-trips'],
    queryFn: async () => {
      try {
        const response = await gsoAPI.getAllTrips();
        const rawData = response?.data?.data || response?.data || response || [];
        return Array.isArray(rawData) ? rawData : [];
      } catch (error) {
        console.error('Error fetching trips:', error);
        toast.error('Failed to load trips');
        return [];
      }
    },
  });

  const trips = Array.isArray(tripsData) ? tripsData : [];

    // ✅ CANCEL MUTATION
  const cancelMutation = useMutation({
    mutationFn: async ({ ticketId, reason }) => {
      // Giputos nato ang reason sa object aron mo-match sa backend validation
      const response = await gsoAPI.cancelTrip(ticketId, { reason: reason });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Trip cancelled successfully!");
      queryClient.invalidateQueries({ queryKey: ["gso-all-trips"] });
      setShowCancelDialog(false);
      setSelectedTrip(null);
      setCancelReason("");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || error.message || "Failed to cancel trip");
    },
  });

  const handleCancelSubmit = () => {
    if (!cancelReason.trim() || cancelReason.trim().length < 5) {
      return toast.error("Please provide a reason (at least 5 characters)");
    }
    const ticketId = getTicketId(selectedTrip);
    cancelMutation.mutate({ ticketId, reason: cancelReason });
  };

  // ============ STATS ============
  const stats = useMemo(() => {
    const total = trips.length;
    const pending = trips.filter(t => t?.status === 'pending_mayors_office').length;
    const ready = trips.filter(t => ['funds_issued', 'acknowledged'].includes(t?.status)).length;
    const inTransit = trips.filter(t => t?.status === 'in_transit').length;
    const completed = trips.filter(t => ['completed', 'pending_gso_validation'].includes(t?.status)).length;
    const closed = trips.filter(t => t?.status === 'closed').length;
    const cancelled = trips.filter(t => t?.status === 'cancelled').length;

    return [
      {
        title: 'Total Trips',
        value: total,
        icon: Truck,
        color: 'from-blue-500 to-blue-600',
        subtitle: 'All time',
      },
      {
        title: 'Pending',
        value: pending,
        icon: Clock,
        color: 'from-orange-500 to-orange-600',
        subtitle: 'Waiting for funds',
      },
      {
        title: 'In Transit',
        value: inTransit,
        icon: Truck,
        color: 'from-purple-500 to-purple-600',
        subtitle: 'On the road',
      },
      {
        title: 'Completed',
        value: completed,
        icon: Shield,
        color: 'from-emerald-500 to-emerald-600',
        subtitle: 'Needs closing',
      },
      {
        title: 'Closed',
        value: closed,
        icon: CheckCircle,
        color: 'from-slate-500 to-slate-600',
        subtitle: 'Finished',
      },
    ];
  }, [trips]);

  // ============ FILTER OPTIONS ============
  const departments = useMemo(() => {
    const depts = new Set();
    trips.forEach(t => {
      const code = getDepartmentCode(t);
      if (code && code !== 'N/A') depts.add(code);
    });
    return ['all', ...depts];
  }, [trips]);

  const statuses = useMemo(() => {
    const statusSet = new Set();
    trips.forEach(t => {
      if (t?.status) statusSet.add(t.status);
    });
    return ['all', ...statusSet];
  }, [trips]);

  // ============ FILTERED TRIPS ============
  const filteredTrips = useMemo(() => {
    let filtered = trips;
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
    
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(t => getDepartmentCode(t) === departmentFilter);
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        getTicketNumber(t).toLowerCase().includes(search) ||
        (t.destination || '').toLowerCase().includes(search) ||
        getDepartmentCode(t).toLowerCase().includes(search) ||
        getDriverName(t).toLowerCase().includes(search) ||
        getVehicleInfo(t).toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [trips, statusFilter, departmentFilter, searchTerm]);

  // ============ HANDLERS ============
  const handleViewTrip = (trip) => {
    const ticketId = getTicketId(trip);
    if (!ticketId) {
      toast.error('Invalid trip ID');
      return;
    }
    navigate(`/gso/tickets/${ticketId}`);
  };

  // ✅ OPEN CANCEL DIALOG
  const handleOpenCancelDialog = (trip) => {
    setSelectedTrip(trip);
    setCancelReason("");
    setShowCancelDialog(true);
  };

  const handleExport = () => {
    if (filteredTrips.length === 0) {
      toast.error('No data to export');
      return;
    }
    toast.success('Export functionality coming soon');
  };

  const handleRefresh = () => {
    refetch();
    toast.success('Refreshing trips...');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDepartmentFilter('all');
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || departmentFilter !== 'all';

  // ============ LOADING STATE ============
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading trips...</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Please wait while we fetch your data</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-red-600 dark:text-red-400 font-medium">Failed to load trips</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{error.message}</p>
          <Button onClick={handleRefresh} className="mt-4 bg-blue-600 hover:bg-blue-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ============ RENDER ============
  return (
    <div className="space-y-6 p-4 md:p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/gso/dashboard')}
            className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
              <Truck className="h-6 w-6 text-blue-600" />
              All Trips
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Complete history of all trip tickets ({trips.length} total)
            </p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button
            variant="outline"
            onClick={handleExport}
            className="flex items-center gap-2 dark:border-slate-700 dark:text-slate-300"
            disabled={filteredTrips.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export ({filteredTrips.length})
          </Button>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isFetching}
            className="flex items-center gap-2 dark:border-slate-700 dark:text-slate-300"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => navigate('/gso/create-trip')}
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Trip
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      {/* Filters */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by ticket #, destination, department, driver, or vehicle..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-white dark:bg-slate-900 dark:border-slate-700 rounded-xl"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="md:w-auto w-full dark:border-slate-700 dark:text-slate-300"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {hasActiveFilters && (
                  <Badge className="ml-2 bg-blue-500 text-white text-[10px] px-1.5 py-0.5">
                    {statusFilter !== 'all' ? 1 : 0 + departmentFilter !== 'all' ? 1 : 0}
                  </Badge>
                )}
                {showFilters ? (
                  <ChevronUp className="h-4 w-4 ml-2" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-2" />
                )}
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="dark:border-slate-700 dark:bg-slate-900">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statuses.filter(s => s !== 'all').map((status) => {
                      const config = getStatusConfig(status);
                      return (
                        <SelectItem key={status} value={status}>
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                            {config.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="dark:border-slate-700 dark:bg-slate-900">
                    <SelectValue placeholder="Filter by department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.filter(d => d !== 'all').map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {filteredTrips.length}
                    </span> trip(s) found
                  </div>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      Clear all
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trips Table */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                <Truck className="h-5 w-5 text-blue-500" />
                Trip Tickets
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                {filteredTrips.length} trip(s) found
                {filteredTrips.length !== trips.length && ` (filtered from ${trips.length} total)`}
              </CardDescription>
            </div>
            {filteredTrips.length > 0 && (
              <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                <Zap className="h-3 w-3 mr-1" />
                {filteredTrips.length} records
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {filteredTrips.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Truck className="h-10 w-10 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">
                No trips found
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                {trips.length === 0 
                  ? 'No trips have been created yet. Create your first trip!'
                  : 'Try adjusting your filters to see more results'}
              </p>
              {trips.length === 0 && (
                <Button 
                  onClick={() => navigate('/gso/create-trip')} 
                  className="mt-6 bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-500/20"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Trip
                </Button>
              )}
              {trips.length > 0 && hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="mt-6 dark:border-slate-700 dark:text-slate-300"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
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
                      Dept.
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                      Driver
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                      Vehicle
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider text-center">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrips.map((trip) => {
                    const ticketId = getTicketId(trip);
                    
                    // ✅ Pwede ra i-cancel kung Pending pa. Dili na pwede kung Ready o pataas.
                    const canCancel = trip.status === 'pending_mayors_office';

                    return (
                      <TableRow 
                        key={ticketId || Math.random()} 
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                      >
                        <TableCell className="font-mono font-semibold text-slate-800 dark:text-white">
                          {getTicketNumber(trip)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {formatDate(trip.trip_date)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                              {trip.destination || 'N/A'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {getDepartmentCode(trip)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {getDriverName(trip)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {getVehicleInfo(trip)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={trip.status} />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Trip Button */}
                            <Button
                              size="sm"
                              onClick={() => handleViewTrip(trip)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 h-8 flex items-center gap-1 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm shadow-blue-500/20"
                              title="View Trip Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="text-xs font-medium">View</span>
                            </Button>

                            {/* ✅ Cancel Button (Only for Pending status) */}
                            {canCancel && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenCancelDialog(trip)}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 h-8 flex items-center gap-1 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm shadow-red-500/20"
                                title="Cancel Trip"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">Cancel</span>
                              </Button>
                            )}
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

      {/* ✅ Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="bg-[#121829] border-slate-700 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-500" /> Cancel Trip Ticket
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This will cancel the trip ticket. It will be removed from the DO's Pending Release list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="text-sm font-medium text-slate-300">Reason for Cancellation</label>
            <Textarea 
              placeholder="Enter reason (at least 5 characters)..." 
              value={cancelReason} 
              onChange={(e) => setCancelReason(e.target.value)} 
              className="bg-[#0b101c] border-slate-700 text-white" 
              rows={4} 
            />
            {cancelReason.trim().length > 0 && cancelReason.trim().length < 5 && (
              <p className="text-xs text-red-400">Reason must be at least 5 characters.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button 
              onClick={handleCancelSubmit} 
              disabled={cancelMutation.isPending || cancelReason.trim().length < 5} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
              Confirm Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GsoAllTrips;
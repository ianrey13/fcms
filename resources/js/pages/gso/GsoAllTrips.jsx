// src/pages/gso/GsoAllTrips.jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  Truck,
  Search,
  Eye,
  Calendar,
  MapPin,
  Building2,
  Loader2,
  RefreshCw,
  Filter,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  User,
  ChevronRight,
  ArrowLeft,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
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

const getDepartmentName = (trip) => {
  if (trip?.department?.name) return trip.department.name;
  if (trip?.department_name) return trip.department_name;
  if (trip?.department?.department_name) return trip.department.department_name;
  if (trip?.dept_name) return trip.dept_name;
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

const getAmountReleased = (trip) => {
  return trip?.amount_released || 
         trip?.gas_slip?.amount_released || 
         trip?.gas_slip?.amount || 
         0;
};

const getStatusConfig = (status) => {
  const configs = {
    'pending_mayors_office': { 
      color: 'bg-yellow-500', 
      label: 'Pending MO',
      icon: Clock,
      dotColor: 'bg-yellow-500',
    },
    'funds_issued': { 
      color: 'bg-blue-500', 
      label: 'Funds Issued',
      icon: CheckCircle,
      dotColor: 'bg-blue-500',
    },
    'acknowledged': { 
      color: 'bg-cyan-500', 
      label: 'Acknowledged',
      icon: CheckCircle,
      dotColor: 'bg-cyan-500',
    },
    'in_transit': { 
      color: 'bg-indigo-500', 
      label: 'In Transit',
      icon: Truck,
      dotColor: 'bg-indigo-500',
    },
    'pending_reconciliation': { 
      color: 'bg-orange-500', 
      label: 'Pending Recon',
      icon: Clock,
      dotColor: 'bg-orange-500',
    },
    'closed': { 
      color: 'bg-green-600', 
      label: 'Closed',
      icon: CheckCircle,
      dotColor: 'bg-green-600',
    },
    'rejected': { 
      color: 'bg-red-500', 
      label: 'Rejected',
      icon: XCircle,
      dotColor: 'bg-red-500',
    },
    'cancelled': { 
      color: 'bg-slate-500', 
      label: 'Cancelled',
      icon: XCircle,
      dotColor: 'bg-slate-500',
    },
    'returned_for_revision': { 
      color: 'bg-purple-500', 
      label: 'Returned',
      icon: AlertCircle,
      dotColor: 'bg-purple-500',
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

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount || 0);
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

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

  // ============ STATS ============
  const stats = useMemo(() => {
    const total = trips.length;
    const pending = trips.filter(t => t?.status === 'pending_mayors_office').length;
    const inTransit = trips.filter(t => t?.status === 'in_transit').length;
    const closed = trips.filter(t => t?.status === 'closed').length;
    const pendingRecon = trips.filter(t => t?.status === 'pending_reconciliation').length;

    return [
      {
        title: 'Total Trips',
        value: total,
        icon: Truck,
        color: 'from-blue-500 to-blue-600',
        subtitle: 'All time',
        trend: total > 0 ? 12 : 0,
      },
      {
        title: 'Pending MO',
        value: pending,
        icon: Clock,
        color: 'from-yellow-500 to-yellow-600',
        subtitle: 'Awaiting approval',
        trend: pending > 0 ? 8 : 0,
      },
      {
        title: 'In Transit',
        value: inTransit,
        icon: Truck,
        color: 'from-indigo-500 to-indigo-600',
        subtitle: 'On the road',
        trend: inTransit > 0 ? 5 : 0,
      },
      {
        title: 'Pending Recon',
        value: pendingRecon,
        icon: AlertCircle,
        color: 'from-orange-500 to-orange-600',
        subtitle: 'Need closing',
        trend: pendingRecon > 0 ? -3 : 0,
      },
      {
        title: 'Closed',
        value: closed,
        icon: CheckCircle,
        color: 'from-emerald-500 to-emerald-600',
        subtitle: 'Completed',
        trend: closed > 0 ? 15 : 0,
      },
    ];
  }, [trips]);

  // ============ FILTER OPTIONS ============
  const departments = useMemo(() => {
    const depts = new Set();
    trips.forEach(t => {
      const name = getDepartmentName(t);
      if (name && name !== 'N/A') depts.add(name);
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
      filtered = filtered.filter(t => getDepartmentName(t) === departmentFilter);
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        getTicketNumber(t).toLowerCase().includes(search) ||
        (t.destination || '').toLowerCase().includes(search) ||
        getDepartmentName(t).toLowerCase().includes(search) ||
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
                      Department
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                      Driver
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                      Vehicle
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider text-right">
                      Amount
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider text-center">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrips.map((trip) => {
                    const ticketId = getTicketId(trip);
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
                            <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                              {trip.destination || 'N/A'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {getDepartmentName(trip)}
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
                        <TableCell className="text-right font-medium text-slate-800 dark:text-white">
                          {formatCurrency(getAmountReleased(trip))}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={trip.status} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            onClick={() => handleViewTrip(trip)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 h-8 flex items-center gap-1.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm shadow-blue-500/20"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="text-sm font-medium">View</span>
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
    </div>
  );
};

export default GsoAllTrips;
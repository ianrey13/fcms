// src/pages/gso/GsoAllTrips.jsx
// ============================================
// MERGED: All Trips + Trip History + Trip Ticket View
// ============================================

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  History,
  Navigation,
  Ruler,
  EyeIcon,
  FileText,
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
    'pending_gso_validation': { 
      color: 'bg-purple-500', 
      label: 'Pending Validation',
      icon: Shield,
      dotColor: 'bg-purple-500',
    },
    'completed': { 
      color: 'bg-indigo-400', 
      label: 'Completed',
      icon: CheckCircle,
      dotColor: 'bg-indigo-400',
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

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
// TRIP HISTORY DETAIL MODAL
// ============================================

const TripHistoryDetailModal = ({ trip, open, onOpenChange, history, loading }) => {
  const [showAllHistory, setShowAllHistory] = useState(false);

  if (!trip) return null;

  const tripHistory = history || [];
  const displayedHistory = showAllHistory ? tripHistory : tripHistory.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] dark:bg-slate-800 dark:border-slate-700 flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
            <History className="h-5 w-5 text-blue-600" />
            Trip History - {getTicketNumber(trip)}
          </DialogTitle>
          <DialogDescription className="dark:text-slate-400">
            All trips made on this ticket
          </DialogDescription>
        </DialogHeader>

        {/* Trip Summary */}
        <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="dark:bg-slate-900/50 dark:border-slate-700">
            <CardContent className="pt-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Destination</p>
                  <p className="font-semibold text-xs truncate max-w-[120px]">{trip.destination || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900/50 dark:border-slate-700">
            <CardContent className="pt-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Trip Date</p>
                  <p className="font-semibold text-xs">{formatDate(trip.trip_date)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900/50 dark:border-slate-700">
            <CardContent className="pt-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                  <Navigation className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Total Trips</p>
                  <p className="font-semibold text-xs">{trip.trip_count || 0} trip(s)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900/50 dark:border-slate-700">
            <CardContent className="pt-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                  <StatusBadge status={trip.status} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trip History Table */}
        <div className="flex-1 min-h-0 mt-3 flex flex-col">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Trip Logs ({tripHistory.length})
              </span>
            </div>
            {tripHistory.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="text-xs"
              >
                {showAllHistory ? 'Show Less' : 'Show All'}
                {showAllHistory ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto border rounded-lg dark:border-slate-700">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : tripHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <History className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p>No trip history available</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900">
                  <TableRow>
                    <TableHead className="text-xs uppercase">#</TableHead>
                    <TableHead className="text-xs uppercase">Start Time</TableHead>
                    <TableHead className="text-xs uppercase">End Time</TableHead>
                    <TableHead className="text-xs uppercase text-right">Distance (km)</TableHead>
                    <TableHead className="text-xs uppercase text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedHistory.map((entry, index) => (
                    <TableRow key={entry.history_id || index} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <TableCell className="font-mono font-medium">
                        #{entry.trip_number || index + 1}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.started_at ? formatDateTime(entry.started_at) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.ended_at ? formatDateTime(entry.ended_at) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {entry.distance_km || 0} km
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={entry.status === 'completed' ? 'bg-emerald-500' : 'bg-yellow-500'}>
                          {entry.status || 'N/A'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [tripHistories, setTripHistories] = useState({});
  const [historyLoading, setHistoryLoading] = useState(false);

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
    const pendingValidation = trips.filter(t => t?.status === 'pending_gso_validation' || t?.status === 'completed').length;

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
        title: 'Pending Validation',
        value: pendingValidation,
        icon: Shield,
        color: 'from-purple-500 to-purple-600',
        subtitle: 'Need GSO closing',
        trend: pendingValidation > 0 ? 3 : 0,
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

  const handleViewHistory = async (trip) => {
    const ticketId = getTicketId(trip);
    if (!ticketId) {
      toast.error('Invalid trip ID');
      return;
    }

    const tripCount = trip.trip_count || 0;
    if (tripCount === 0) {
      toast.error('No history available for this trip');
      return;
    }

    setSelectedTrip(trip);
    setShowHistoryModal(true);
    setHistoryLoading(true);

    try {
      const response = await gsoAPI.getTripHistory(ticketId);
      const history = response?.data?.data?.history || [];
      setTripHistories(prev => ({ ...prev, [ticketId]: history }));
    } catch (error) {
      console.error('Error fetching trip history:', error);
      setTripHistories(prev => ({ ...prev, [ticketId]: [] }));
      toast.error('Failed to load trip history');
    } finally {
      setHistoryLoading(false);
    }
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
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider text-center">
                      Trips
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider text-right">
                      Amount
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
                    const tripCount = trip.trip_count || 0;
                    const hasHistory = tripCount > 0;

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
                        <TableCell className="text-center">
                          <Badge className={cn(
                            "font-mono font-bold",
                            hasHistory ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                          )}>
                            {tripCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-800 dark:text-white">
                          {formatCurrency(getAmountReleased(trip))}
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

                            {/* View History Button */}
                            <Button
                              size="sm"
                              onClick={() => handleViewHistory(trip)}
                              disabled={!hasHistory}
                              className={cn(
                                "px-3 py-1.5 h-8 flex items-center gap-1 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95",
                                hasHistory
                                  ? "bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20"
                                  : "bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500"
                              )}
                              title={hasHistory ? "View Trip History" : "No history available"}
                            >
                              <History className="h-3.5 w-3.5" />
                              <span className="text-xs font-medium">History</span>
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

      {/* History Modal */}
      <TripHistoryDetailModal
        trip={selectedTrip}
        open={showHistoryModal}
        onOpenChange={setShowHistoryModal}
        history={selectedTrip ? tripHistories[getTicketId(selectedTrip)] || [] : []}
        loading={historyLoading}
      />
    </div>
  );
};

export default GsoAllTrips;
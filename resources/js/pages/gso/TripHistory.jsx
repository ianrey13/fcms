// resources/js/pages/gso/TripHistory.jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { gsoAPI } from '../../services/api';
import { cn } from '@/lib/utils';

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
  History,
  Search,
  Eye,
  Calendar,
  MapPin,
  Building2,
  Loader2,
  RefreshCw,
  Filter,
  Download,
  Truck,
  ChevronDown,
  ChevronUp,
  Map,
  Navigation,
  Ruler,
  Clock,
  User,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import TripHistoryTable from '../../components/TripHistoryTable';

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

const getStatusConfig = (status) => {
  const configs = {
    'pending_mayors_office': { color: 'bg-yellow-500', label: 'Pending MO' },
    'funds_issued': { color: 'bg-blue-500', label: 'Funds Issued' },
    'acknowledged': { color: 'bg-cyan-500', label: 'Acknowledged' },
    'in_transit': { color: 'bg-indigo-500', label: 'In Transit' },
    'pending_reconciliation': { color: 'bg-orange-500', label: 'Pending Recon' },
    'pending_gso_validation': { color: 'bg-purple-500', label: 'Pending Validation' },
    'completed': { color: 'bg-indigo-400', label: 'Completed' },
    'closed': { color: 'bg-green-600', label: 'Closed' },
    'rejected': { color: 'bg-red-500', label: 'Rejected' },
    'cancelled': { color: 'bg-slate-500', label: 'Cancelled' },
    'returned_for_revision': { color: 'bg-purple-500', label: 'Returned' },
    'draft': { color: 'bg-slate-400', label: 'Draft' },
  };
  return configs[status] || { color: 'bg-slate-500', label: status || 'Unknown' };
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
  return (
    <Badge className={`${config.color} text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium`}>
      {config.label}
    </Badge>
  );
};

// ============================================
// TRIP HISTORY DETAIL MODAL (SCROLLABLE)
// ============================================

const TripHistoryDetailModal = ({ trip, open, onOpenChange, history }) => {
  const [showAllHistory, setShowAllHistory] = useState(false);

  if (!trip) return null;

  const tripHistory = history || [];

  // Determine which history items to display
  const displayedHistory = showAllHistory ? tripHistory : tripHistory.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] dark:bg-slate-800 dark:border-slate-700 flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
            <History className="h-5 w-5 text-blue-600" />
            Trip History - {getTicketNumber(trip)}
          </DialogTitle>
          <DialogDescription className="dark:text-slate-400">
            All trips made on this ticket
          </DialogDescription>
        </DialogHeader>

        {/* Trip Summary - Fixed */}
        <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="dark:bg-slate-900/50 dark:border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                  <MapPin className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Destination</p>
                  <p className="font-semibold text-sm">{trip.destination}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900/50 dark:border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Trip Date</p>
                  <p className="font-semibold text-sm">{formatDate(trip.trip_date)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900/50 dark:border-slate-700">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/30">
                  <Navigation className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Trips</p>
                  <p className="font-semibold text-sm">{trip.trip_count || 0} trip(s)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trip History Table - Scrollable Area */}
        <div className="flex-1 min-h-0 mt-4 flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
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
            <TripHistoryTable
              history={displayedHistory}
              loading={false}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const TripHistory = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [tripHistories, setTripHistories] = useState({});

  // ============ QUERY ============
  const {
    data: tripsData,
    isLoading,
    refetch,
    isFetching,
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

  // ============ FILTERS ============
  const filteredTrips = useMemo(() => {
    let filtered = trips;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
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
  }, [trips, statusFilter, searchTerm]);

  // ============ HANDLERS ============
  const handleRefresh = () => {
    refetch();
    toast.success('Refreshing...');
  };

  const handleViewHistory = async (trip) => {
    const ticketId = getTicketId(trip);
    if (!ticketId) {
      toast.error('Invalid trip ID');
      return;
    }

    setSelectedTrip(trip);
    setShowDetailModal(true);

    // Fetch trip history
    try {
      const response = await gsoAPI.getTripHistory(ticketId);
      const history = response?.data?.data?.history || [];
      setTripHistories(prev => ({ ...prev, [ticketId]: history }));
    } catch (error) {
      console.error('Error fetching trip history:', error);
      setTripHistories(prev => ({ ...prev, [ticketId]: [] }));
    }
  };

  // ============ UNIQUE STATUSES ============
  const statuses = useMemo(() => {
    const statusSet = new Set();
    trips.forEach(t => {
      if (t?.status) statusSet.add(t.status);
    });
    return ['all', ...statusSet];
  }, [trips]);

  // ============ LOADING ============
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading trip history...</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Please wait while we fetch your data</p>
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
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
            <History className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              Trip History
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              View all trips and their history across all tickets
            </p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isFetching}
            className="dark:border-slate-700 dark:text-slate-300"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => navigate('/gso/all-trips')}
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20"
          >
            <Truck className="h-4 w-4 mr-2" />
            All Trips
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Tickets</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{trips.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                <Truck className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">With History</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {trips.filter(t => (t.trip_count || 0) > 0).length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                <History className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Completed</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {trips.filter(t => t.status === 'closed').length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pending Validation</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {trips.filter(t => t.status === 'pending_gso_validation' || t.status === 'completed').length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardContent className="pt-6">
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px] dark:border-slate-700 dark:bg-slate-900">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.filter(s => s !== 'all').map((status) => {
                  const config = getStatusConfig(status);
                  return (
                    <SelectItem key={status} value={status}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${config.color}`} />
                        {config.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="dark:border-slate-700 dark:text-slate-300"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trip List */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                <History className="h-5 w-5 text-blue-500" />
                Trip Tickets
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                {filteredTrips.length} ticket(s) found
                {filteredTrips.length !== trips.length && ` (filtered from ${trips.length} total)`}
              </CardDescription>
            </div>
            {filteredTrips.length > 0 && (
              <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                {filteredTrips.length} records
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {filteredTrips.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <History className="h-10 w-10 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No trips found</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Try adjusting your filters or create a new trip
              </p>
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
                        <TableCell className="text-center">
                          <Badge className={cn(
                            "font-mono font-bold",
                            hasHistory ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                          )}>
                            {tripCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={trip.status} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            onClick={() => handleViewHistory(trip)}
                            disabled={!hasHistory}
                            className={cn(
                              "px-4 py-1.5 h-8 flex items-center gap-1.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95",
                              hasHistory
                                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500"
                            )}
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

      {/* Detail Modal */}
      <TripHistoryDetailModal
        trip={selectedTrip}
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        history={selectedTrip ? tripHistories[getTicketId(selectedTrip)] || [] : []}
      />
    </div>
  );
};

export default TripHistory;
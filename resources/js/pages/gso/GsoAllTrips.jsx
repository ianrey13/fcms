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
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// ============================================
// HELPERS - FIXED for nested data
// ============================================

const getTicketId = (trip) => {
  return trip?.trip_ticket_id || trip?.id || trip?.ticket_id;
};

const getTicketNumber = (trip) => {
  return trip?.trip_ticket_number || trip?.ticket_number || 'N/A';
};

// ✅ FIXED: Handle nested department data
const getDepartmentName = (trip) => {
  // Check various possible locations for department name
  if (trip?.department?.name) return trip.department.name;
  if (trip?.department_name) return trip.department_name;
  if (trip?.department?.department_name) return trip.department.department_name;
  if (trip?.dept_name) return trip.dept_name;
  return 'N/A';
};

// ✅ FIXED: Handle nested driver data
const getDriverName = (trip) => {
  // Check various possible locations for driver name
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

// ✅ FIXED: Handle nested driver ID
const getDriverId = (trip) => {
  return trip?.driver?.driver_id || trip?.driver_id || null;
};

// ✅ FIXED: Handle nested department ID
const getDepartmentId = (trip) => {
  return trip?.department?.department_id || trip?.department_id || null;
};

// ✅ FIXED: Handle nested vehicle data
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
    },
    'funds_issued': { 
      color: 'bg-blue-500', 
      label: 'Funds Issued',
      icon: CheckCircle,
    },
    'acknowledged': { 
      color: 'bg-cyan-500', 
      label: 'Acknowledged',
      icon: CheckCircle,
    },
    'in_transit': { 
      color: 'bg-indigo-500', 
      label: 'In Transit',
      icon: Truck,
    },
    'pending_reconciliation': { 
      color: 'bg-orange-500', 
      label: 'Pending Recon',
      icon: Clock,
    },
    'closed': { 
      color: 'bg-green-600', 
      label: 'Closed',
      icon: CheckCircle,
    },
    'rejected': { 
      color: 'bg-red-500', 
      label: 'Rejected',
      icon: XCircle,
    },
    'cancelled': { 
      color: 'bg-slate-500', 
      label: 'Cancelled',
      icon: XCircle,
    },
    'returned_for_revision': { 
      color: 'bg-purple-500', 
      label: 'Returned',
      icon: AlertCircle,
    },
    'draft': {
      color: 'bg-slate-400',
      label: 'Draft',
      icon: AlertCircle,
    },
  };
  return configs[status] || { color: 'bg-slate-500', label: status || 'Unknown', icon: Clock };
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
// COMPONENT
// ============================================

const GsoAllTrips = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

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

  // ✅ DEBUG: Log first trip to see structure
  React.useEffect(() => {
    if (trips.length > 0) {
      console.log('🔍 Sample trip data structure:', trips[0]);
      console.log('🔍 Driver data:', trips[0]?.driver);
      console.log('🔍 Department data:', trips[0]?.department);
    }
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

  // ============ STATUS BADGE ============
  const StatusBadge = ({ status }) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white flex items-center gap-1 px-2.5 py-1.5 rounded-lg`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // ============ HANDLERS ============
  const handleViewTrip = (trip) => {
    const ticketId = getTicketId(trip);
    if (!ticketId) {
      toast.error('Invalid trip ID');
      return;
    }
    navigate(`/gso/trip/${ticketId}`);
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

  // ============ LOADING STATE ============
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-500">Loading trips...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center text-red-500">
          <AlertCircle className="h-12 w-12 mx-auto mb-3" />
          <p className="font-medium">Failed to load trips</p>
          <p className="text-sm text-slate-500">{error.message}</p>
          <Button onClick={handleRefresh} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ============ RENDER ============
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="h-6 w-6 text-blue-600" />
            All Trips
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Complete history of all trip tickets ({trips.length} total)
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button
            variant="outline"
            onClick={handleExport}
            className="flex items-center gap-2"
            disabled={filteredTrips.length === 0}
          >
            <Download className="h-4 w-4" />
            Export ({filteredTrips.length})
          </Button>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isFetching}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search trips..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
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

            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger>
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

            <div className="flex items-center justify-between text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span>{filteredTrips.length} trip(s) found</span>
              </div>
              {(searchTerm || statusFilter !== 'all' || departmentFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-slate-400 hover:text-slate-600"
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trips Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-500" />
            Trip Tickets
          </CardTitle>
          <CardDescription>
            {filteredTrips.length} trip(s) found
            {filteredTrips.length !== trips.length && ` (filtered from ${trips.length} total)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTrips.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Truck className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No trips found</p>
              <p className="text-sm">
                {trips.length === 0 
                  ? 'No trips have been created yet. Create your first trip!'
                  : 'Try adjusting your filters'}
              </p>
              {trips.length === 0 && (
                <Button 
                  onClick={() => navigate('/gso/create-trip')} 
                  className="mt-4"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Create First Trip
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                    <TableHead className="font-semibold">Ticket #</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Destination</TableHead>
                    <TableHead className="font-semibold">Department</TableHead>
                    <TableHead className="font-semibold">Driver</TableHead>
                    <TableHead className="font-semibold">Vehicle</TableHead>
                    <TableHead className="font-semibold text-right">Amount</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrips.map((trip) => {
                    const ticketId = getTicketId(trip);
                    return (
                      <TableRow 
                        key={ticketId || Math.random()} 
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
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
                          ₱{getAmountReleased(trip).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={trip.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewTrip(trip)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-8 w-8 p-0"
                            title="View Trip Details"
                          >
                            <Eye className="h-4 w-4" />
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
// src/pages/gso/CompletedTrips.jsx
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { gsoAPI } from "../../services/api";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  CheckCircle,
  Eye,
  Calendar,
  MapPin,
  User,
  Truck,
  DollarSign,
  Loader2,
  RefreshCw,
  AlertCircle,
  Building2,
  Clock,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

// ============================================
// HELPERS
// ============================================

const getTicketId = (trip) => {
  return trip?.trip_ticket_id || trip?.id || trip?.ticket_id;
};

const getTicketNumber = (trip) => {
  return trip?.trip_ticket_number || trip?.ticket_number || 'N/A';
};

const getDriverName = (trip) => {
  return trip?.driver?.user?.full_name || 
         trip?.driver?.full_name || 
         trip?.driver_name || 
         'N/A';
};

const getDepartmentName = (trip) => {
  return trip?.department?.name || 
         trip?.department_name || 
         'N/A';
};

const getAmountReleased = (trip) => {
  return trip?.amount_released || 
         trip?.gas_slip?.amount_released || 
         0;
};

const getStatusConfig = (status) => {
  const configs = {
    'closed': { 
      color: 'bg-green-500', 
      label: 'Closed',
      icon: CheckCircle,
    },
    'pending_reconciliation': { 
      color: 'bg-orange-500', 
      label: 'Pending Reconciliation',
      icon: Clock,
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
    'acknowledged': { 
      color: 'bg-cyan-500', 
      label: 'Acknowledged',
      icon: CheckCircle,
    },
  };
  return configs[status] || { color: 'bg-green-500', label: status || 'Completed', icon: CheckCircle };
};

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  try {
    return format(new Date(dateString), "MMM dd, yyyy");
  } catch {
    return "N/A";
  }
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

// ============================================
// COMPONENT
// ============================================

const CompletedTrips = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  // ============ QUERY ============
  const { 
    data: tripsData = [], 
    isLoading, 
    refetch, 
    isFetching,
    error 
  } = useQuery({
    queryKey: ["gso-completed-trips"],
    queryFn: async () => {
      try {
        const response = await gsoAPI.getCompletedTrips();
        // ✅ Handle different response structures
        const rawData = response?.data?.data || response?.data || response || [];
        return Array.isArray(rawData) ? rawData : [];
      } catch (error) {
        console.error('Error fetching completed trips:', error);
        toast.error('Failed to load completed trips');
        return [];
      }
    },
  });

  // ✅ Ensure trips is always an array
  const trips = Array.isArray(tripsData) ? tripsData : [];

  // ============ FILTERED TRIPS ============
  const filteredTrips = useMemo(() => {
    if (!searchTerm) return trips;
    
    const search = searchTerm.toLowerCase();
    return trips.filter((trip) =>
      getTicketNumber(trip).toLowerCase().includes(search) ||
      (trip.destination || '').toLowerCase().includes(search) ||
      getDriverName(trip).toLowerCase().includes(search) ||
      getDepartmentName(trip).toLowerCase().includes(search)
    );
  }, [trips, searchTerm]);

  // ============ STATS ============
  const stats = useMemo(() => {
    const total = trips.length;
    const totalAmount = trips.reduce((sum, t) => sum + getAmountReleased(t), 0);
    const departments = new Set(trips.map(t => getDepartmentName(t)));
    
    return {
      total,
      totalAmount,
      departments: departments.size,
    };
  }, [trips]);

  // ============ HANDLERS ============
  const handleViewTrip = (trip) => {
    const ticketId = getTicketId(trip);
    if (!ticketId) {
      toast.error('Invalid trip ID');
      return;
    }
    
    // ✅ Try the correct route for your app
    // Option 1: If you have /gso/trip/:id
    navigate(`/gso/trip/${ticketId}`);
    
    // Option 2: If you have /gso/tickets/:id
    // navigate(`/gso/tickets/${ticketId}`);
  };

  const handleRefresh = () => {
    refetch();
    toast.success('Refreshing completed trips...');
  };

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

  // ============ LOADING STATE ============
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Loading completed trips...</p>
        </div>
      </div>
    );
  }

  // ============ ERROR STATE ============
  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center text-red-500">
          <AlertCircle className="h-12 w-12 mx-auto mb-3" />
          <p className="font-medium">Failed to load completed trips</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            Completed Trips
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            View all closed and completed trips ({trips.length} total)
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          className="gap-2"
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by ticket number, destination, driver, or department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchTerm('')}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Completed</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.total}</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Amount Released</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(stats.totalAmount)}
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <DollarSign className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Departments</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.departments}</p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <Building2 className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trips Table */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Completed Trips ({filteredTrips.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTrips.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="font-medium">No completed trips found</p>
              {searchTerm && (
                <p className="text-sm">Try adjusting your search</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Ticket #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Destination</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Driver</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Department</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredTrips.map((trip) => {
                    const ticketId = getTicketId(trip);
                    return (
                      <tr 
                        key={ticketId || Math.random()} 
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-white">
                          {getTicketNumber(trip)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {formatDate(trip.trip_date)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-slate-600 dark:text-slate-400">
                              {trip.destination || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-slate-600 dark:text-slate-400">
                              {getDriverName(trip)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-slate-600 dark:text-slate-400">
                              {getDepartmentName(trip)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(getAmountReleased(trip))}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={trip.status} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewTrip(trip)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-8 w-8 p-0"
                            title="View Trip Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CompletedTrips;
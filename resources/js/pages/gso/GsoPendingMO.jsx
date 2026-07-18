// src/pages/gso/GsoPendingMO.jsx
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
  Clock,
  Search,
  Eye,
  Calendar,
  MapPin,
  Building2,
  Loader2,
  RefreshCw,
  User,
  Truck,
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

const getDepartmentName = (trip) => {
  if (trip?.department?.name) return trip.department.name;
  if (trip?.department_name) return trip.department_name;
  if (trip?.department?.department_name) return trip.department.department_name;
  return 'N/A';
};

const getDriverName = (trip) => {
  if (trip?.driver?.user?.full_name) return trip.driver.user.full_name;
  if (trip?.driver?.full_name) return trip.driver.full_name;
  if (trip?.driver?.user?.name) return trip.driver.user.name;
  if (trip?.driver_name) return trip.driver_name;
  return 'N/A';
};

const getVehicleInfo = (trip) => {
  if (trip?.vehicle) {
    return `${trip.vehicle.plate_number || ''} ${trip.vehicle.vehicle_model || ''}`.trim() || 'N/A';
  }
  return trip?.plate_number || trip?.vehicle_model || 'N/A';
};

const getEstimatedCost = (trip) => {
  return trip?.estimated_cost || 
         trip?.estimated_fuel_liters * 50 || 
         0;
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

const GsoPendingMO = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // ============ QUERY ============
  const { 
    data: ticketsData = [], 
    isLoading, 
    refetch, 
    isFetching,
  } = useQuery({
    queryKey: ['gso-pending-mo'],
    queryFn: async () => {
      try {
        const response = await gsoAPI.getPendingMO();
        const rawData = response?.data?.data || response?.data || [];
        return Array.isArray(rawData) ? rawData : [];
      } catch (error) {
        console.error('Error fetching pending tickets:', error);
        toast.error('Failed to load pending tickets');
        return [];
      }
    },
  });

  const tickets = Array.isArray(ticketsData) ? ticketsData : [];

  // ============ FILTERED TICKETS ============
  const filteredTickets = useMemo(() => {
    if (!searchTerm) return tickets;
    const search = searchTerm.toLowerCase();
    return tickets.filter(t =>
      getTicketNumber(t).toLowerCase().includes(search) ||
      (t.destination || '').toLowerCase().includes(search) ||
      getDepartmentName(t).toLowerCase().includes(search) ||
      getDriverName(t).toLowerCase().includes(search)
    );
  }, [tickets, searchTerm]);

  // ============ HANDLERS ============
  const handleViewTrip = (ticket) => {
    const ticketId = getTicketId(ticket);
    if (!ticketId) {
      toast.error('Invalid ticket ID');
      return;
    }
    navigate(`/gso/trip/${ticketId}`);
  };

  const handleRefresh = () => {
    refetch();
    toast.success('Refreshing pending tickets...');
  };

  // ============ LOADING STATE ============
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-500">Loading pending tickets...</p>
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
            <Clock className="h-6 w-6 text-yellow-500" />
            Pending Mayor's Office
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {tickets.length} trip(s) awaiting fund release from Mayor's Office
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isFetching}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by ticket number, destination, department, or driver..."
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

      {/* Tickets Table */}
      <Card className="dark:bg-slate-800/80 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
            <Clock className="h-5 w-5 text-yellow-500" />
            Awaiting Fund Release
          </CardTitle>
          <CardDescription className="dark:text-slate-400">
            {filteredTickets.length} ticket(s) pending Mayor's Office approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="font-medium">No pending tickets</p>
              <p className="text-sm">All tickets have been processed by Mayor's Office</p>
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
                    <TableHead className="font-semibold text-right">Est. Cost</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => {
                    const ticketId = getTicketId(ticket);
                    return (
                      <TableRow 
                        key={ticketId || Math.random()} 
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <TableCell className="font-mono font-semibold text-slate-800 dark:text-white">
                          {getTicketNumber(ticket)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {formatDate(ticket.trip_date)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                              {ticket.destination || 'N/A'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {getDepartmentName(ticket)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {getDriverName(ticket)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {getVehicleInfo(ticket)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-800 dark:text-white">
                          ₱{getEstimatedCost(ticket).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewTrip(ticket)}
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

export default GsoPendingMO;
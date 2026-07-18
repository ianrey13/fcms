// src/pages/staff/StaffTrips.jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { driverAPI } from "../../services/api";
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
  FileText,
  Search,
  Eye,
  Calendar,
  MapPin,
  Building2,
  Loader2,
  RefreshCw,
} from 'lucide-react';

const StaffTrips = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: trips = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['staff-trips'],
    queryFn: async () => {
      const response = await staffAPI.getMyTrips();
      return response.data || [];
    },
  });

  const filteredTrips = useMemo(() => {
    if (!searchTerm) return trips;
    const search = searchTerm.toLowerCase();
    return trips.filter(t =>
      (t.ticket_number || '').toLowerCase().includes(search) ||
      (t.destination || '').toLowerCase().includes(search)
    );
  }, [trips, searchTerm]);

  const getStatusBadge = (status) => {
    const configs = {
      pending_mayors_office: { color: 'bg-yellow-500', label: 'Pending MO' },
      funds_issued: { color: 'bg-blue-500', label: 'Funds Issued' },
      acknowledged: { color: 'bg-cyan-500', label: 'Acknowledged' },
      in_transit: { color: 'bg-indigo-500', label: 'In Transit' },
      pending_reconciliation: { color: 'bg-orange-500', label: 'Pending Recon' },
      closed: { color: 'bg-green-600', label: 'Closed' },
      rejected: { color: 'bg-red-500', label: 'Rejected' },
      returned_for_revision: { color: 'bg-purple-500', label: 'Returned' },
    };
    const config = configs[status] || { color: 'bg-slate-500', label: status };
    return <Badge className={`${config.color} text-white`}>{config.label}</Badge>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            My Trip Requests
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {trips.length} trip(s) requested
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by ticket number or destination..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            My Trip Tickets
          </CardTitle>
          <CardDescription>
            {filteredTrips.length} trip(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTrips.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>No trips found</p>
              <p className="text-sm">Contact GSO to request a trip</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrips.map((trip) => (
                    <TableRow key={trip.id || trip.trip_ticket_id}>
                      <TableCell className="font-mono font-semibold">
                        {trip.ticket_number || trip.trip_ticket_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {formatDate(trip.trip_date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {trip.destination}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(trip.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/staff/trips/${trip.id || trip.trip_ticket_id}`)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffTrips;
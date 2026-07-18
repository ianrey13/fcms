// src/pages/gso/GsoReturned.jsx
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
  AlertCircle,
  Search,
  Eye,
  Calendar,
  MapPin,
  Building2,
  Loader2,
  RefreshCw,
} from 'lucide-react';

const GsoReturned = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: tickets = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['gso-returned'],
    queryFn: async () => {
      const response = await gsoAPI.getReturnedTickets();
      return response.data?.data || [];
    },
  });

  const filteredTickets = useMemo(() => {
    if (!searchTerm) return tickets;
    const search = searchTerm.toLowerCase();
    return tickets.filter(t =>
      (t.trip_ticket_number || t.ticket_number || '').toLowerCase().includes(search) ||
      (t.destination || '').toLowerCase().includes(search) ||
      (t.department_name || '').toLowerCase().includes(search)
    );
  }, [tickets, searchTerm]);

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
            <AlertCircle className="h-6 w-6 text-purple-500" />
            Returned Trips
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {tickets.length} trip(s) returned for revision
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
          placeholder="Search by ticket number, destination, or department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-purple-500" />
            Returned for Revision
          </CardTitle>
          <CardDescription>
            {filteredTickets.length} ticket(s) need revision
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>No returned tickets</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id || ticket.trip_ticket_id}>
                      <TableCell className="font-mono font-semibold">
                        {ticket.trip_ticket_number || ticket.ticket_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {formatDate(ticket.trip_date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {ticket.destination}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {ticket.department_name || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {ticket.return_reason || ticket.return_note || 'No reason provided'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/gso/tickets/${ticket.id || ticket.trip_ticket_id}`)}
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

export default GsoReturned;
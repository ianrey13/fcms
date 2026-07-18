// src/pages/gso/GsoReconciliation.jsx
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileCheck,
  Search,
  Eye,
  Calendar,
  MapPin,
  Building2,
  Loader2,
  RefreshCw,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const GsoReconciliation = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showReconcileDialog, setShowReconcileDialog] = useState(false);

  const { data: tickets = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['gso-reconciliation'],
    queryFn: async () => {
      const response = await gsoAPI.getPendingReconciliation();
      return response.data?.data || [];
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: async ({ ticketId }) => {
      const response = await gsoAPI.reconcileTrip(ticketId, {});
      return response.data;
    },
    onSuccess: () => {
      toast.success('Trip reconciled and closed successfully!');
      queryClient.invalidateQueries({ queryKey: ['gso-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['gso-all-trips'] });
      setShowReconcileDialog(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to reconcile trip');
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

  const getStatusBadge = (status) => {
    const configs = {
      pending_reconciliation: { color: 'bg-orange-500', label: 'Pending Recon' },
      in_transit: { color: 'bg-indigo-500', label: 'In Transit' },
    };
    const config = configs[status] || { color: 'bg-slate-500', label: status };
    return <Badge className={`${config.color} text-white`}>{config.label}</Badge>;
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
            <FileCheck className="h-6 w-6 text-orange-500" />
            Reconciliation
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {tickets.length} trip(s) pending closure
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by ticket number, destination, or department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-orange-500" />
            Pending Reconciliation
          </CardTitle>
          <CardDescription>
            {filteredTickets.length} trip(s) ready to be closed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileCheck className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>No pending reconciliation</p>
              <p className="text-sm">All trips are up to date</p>
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
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id || ticket.trip_ticket_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
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
                      <TableCell>
                        ₱{ticket.amount_released ? ticket.amount_released.toLocaleString() : '0'}
                      </TableCell>
                      <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/gso/tickets/${ticket.id || ticket.trip_ticket_id}`)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setShowReconcileDialog(true);
                            }}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Reconcile
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reconcile Dialog */}
      <Dialog open={showReconcileDialog} onOpenChange={setShowReconcileDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <FileCheck className="h-5 w-5" />
              Reconcile Trip
            </DialogTitle>
            <DialogDescription>
              Confirm that this trip is complete and ready to be closed.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-blue-50 p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">Trip Details</p>
            <div className="space-y-1 text-sm">
              <p><span className="text-slate-600">Number:</span> {selectedTicket?.trip_ticket_number || selectedTicket?.ticket_number}</p>
              <p><span className="text-slate-600">Destination:</span> {selectedTicket?.destination}</p>
              <p><span className="text-slate-600">Department:</span> {selectedTicket?.department_name}</p>
              <p><span className="text-slate-600">Amount Released:</span> ₱{selectedTicket?.amount_released?.toLocaleString() || '0'}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReconcileDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                reconcileMutation.mutate({
                  ticketId: selectedTicket?.id || selectedTicket?.trip_ticket_id,
                });
              }}
              disabled={reconcileMutation.isPending}
            >
              {reconcileMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Reconcile & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GsoReconciliation;
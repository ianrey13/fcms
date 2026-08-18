// resources/js/components/TripHistoryTable.jsx
import React from 'react';
import { MapPin, Calendar, Navigation, Clock, Ruler } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { gsoAPI } from '../services/api';
const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCoordinates = (lat, lng) => {
  if (!lat || !lng) return 'N/A';
  return `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
};

const TripHistoryTable = ({ history, loading }) => {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="text-sm text-slate-500 mt-2">Loading trip history...</p>
        </div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8">
        <Navigation className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">No trip history available</p>
        <p className="text-sm text-slate-400">Trips will appear here once completed</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
            <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
              Trip #
            </TableHead>
            <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
              Started At
            </TableHead>
            <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
              Start Location
            </TableHead>
            <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
              Ended At
            </TableHead>
            <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
              End Location
            </TableHead>
            <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider text-right">
              Distance
            </TableHead>
            <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
              Status
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((trip) => (
            <TableRow 
              key={trip.history_id || trip.id}
              className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <TableCell>
                <Badge variant="outline" className="font-mono font-semibold">
                  #{trip.trip_number}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">
                    {formatDateTime(trip.started_at)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                    {formatCoordinates(trip.start_lat, trip.start_lng)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">
                    {trip.ended_at ? formatDateTime(trip.ended_at) : 'In Progress'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-red-500" />
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                    {trip.ended_at ? formatCoordinates(trip.end_lat, trip.end_lng) : 'N/A'}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1.5 text-sm">
                  <Ruler className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-700 dark:text-white">
                    {trip.distance_km ? `${parseFloat(trip.distance_km).toFixed(2)} km` : 'N/A'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={trip.status === 'completed' ? 'bg-emerald-500' : 'bg-yellow-500'}>
                  {trip.status === 'completed' ? '✅ Completed' : '⏳ In Progress'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TripHistoryTable;
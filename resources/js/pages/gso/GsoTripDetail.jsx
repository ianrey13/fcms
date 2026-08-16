// resources/js/pages/gso/GsoTripDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { gsoAPI, driverAPI } from '../../services/api';
import TripHistoryTable from '../../components/TripHistoryTable';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Truck, 
  MapPin, 
  Calendar, 
  User, 
  Car,
  History,
  Loader2,
} from 'lucide-react';

const GsoTripDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tripHistory, setTripHistory] = useState([]);

  // Fetch trip details
  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ['gso-trip', id],
    queryFn: async () => {
      const response = await gsoAPI.getTicketById(id);
      return response?.data?.data || response?.data;
    },
  });

  // Fetch trip history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['trip-history', id],
    queryFn: async () => {
      try {
        const response = await driverAPI.getTripHistory(id);
        return response?.data?.data?.history || [];
      } catch (error) {
        console.error('Error fetching trip history:', error);
        return [];
      }
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (historyData) {
      setTripHistory(historyData);
    }
  }, [historyData]);

  if (tripLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Trip not found</p>
        <Button onClick={() => navigate('/gso/all-trips')} className="mt-4">
          Back to Trips
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/gso/all-trips')}
          className="rounded-xl"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="h-6 w-6 text-blue-600" />
            Trip Ticket Details
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {trip.trip_ticket_number}
          </p>
        </div>
        <Badge className="ml-auto bg-blue-500">
          {trip.status}
        </Badge>
      </div>

      {/* Trip Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Destination</p>
                <p className="font-semibold">{trip.destination}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                <Calendar className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Trip Date</p>
                <p className="font-semibold">
                  {new Date(trip.trip_date).toLocaleDateString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/30">
                <History className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Trips</p>
                <p className="font-semibold">
                  {trip.trip_count || 0} trip(s)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trip History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            Trip History
          </CardTitle>
          <CardDescription>
            All trips made on this ticket (#{trip.trip_count || 0} total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TripHistoryTable 
            history={tripHistory} 
            loading={historyLoading} 
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default GsoTripDetail;
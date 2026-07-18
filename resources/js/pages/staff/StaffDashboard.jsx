// src/pages/staff/StaffDashboard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { driverAPI } from "../../services/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  FileText,
  Truck,
  Building2,
  DollarSign,
  Loader2,
  Eye,
} from 'lucide-react';

const StaffDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ✅ FIX: Add proper staleTime and refetchOnWindowFocus: false
  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ['staff-trips'],
    queryFn: async () => {
      const response = await staffAPI.getMyTrips();
      return response.data || [];
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  const { data: budget = {}, isLoading: budgetLoading } = useQuery({
    queryKey: ['staff-budget'],
    queryFn: async () => {
      const response = await staffAPI.getDepartmentBudget();
      return response.data?.data || {};
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // ✅ Calculate stats from trips data
  const stats = React.useMemo(() => {
    const total = trips.length;
    const active = trips.filter(t => 
      t.status === 'in_transit' || t.status === 'funds_issued' || t.status === 'acknowledged'
    ).length;
    const completed = trips.filter(t => 
      t.status === 'closed' || t.status === 'pending_reconciliation'
    ).length;
    return { total_trips: total, active_trips: active, completed_trips: completed };
  }, [trips]);

  const isLoading = tripsLoading || budgetLoading;

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
            <LayoutDashboard className="h-6 w-6 text-blue-600" />
            Staff Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Welcome back, {user?.first_name}! View your trip requests and department information.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Building2 className="h-4 w-4" />
          {user?.department_name || 'No department assigned'}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">My Trips</p>
                <p className="text-2xl font-bold">{stats.total_trips || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Remaining Budget</p>
                <p className="text-2xl font-bold">₱{budget.remaining_budget?.toLocaleString() || '0'}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Active Trips</p>
                <p className="text-2xl font-bold">{stats.active_trips || 0}</p>
              </div>
              <Truck className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Completed</p>
                <p className="text-2xl font-bold">{stats.completed_trips || 0}</p>
              </div>
              <Eye className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:shadow-lg transition">
          <CardHeader>
            <CardTitle className="text-lg">View My Trips</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 text-sm mb-4">
              View all your trip requests and their current status.
            </p>
            <Button onClick={() => navigate('/staff/trips')} className="w-full">
              View Trips
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition">
          <CardHeader>
            <CardTitle className="text-lg">Budget Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 text-sm mb-4">
              Check your department's current budget allocation and usage.
            </p>
            <Button variant="outline" className="w-full" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StaffDashboard;
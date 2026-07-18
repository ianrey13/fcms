// src/pages/staff/StaffReports.jsx
import React, { useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  Calendar,
  Download,
  Loader2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const StaffReports = () => {
  const [period, setPeriod] = useState('this_month');

  const { data: reports = {}, isLoading } = useQuery({
    queryKey: ['staff-reports', period],
    queryFn: async () => {
      const response = await staffAPI.getReports({ period });
      return response.data?.data || {};
    },
  });

  const handleExport = () => {
    toast.success('Export functionality coming soon');
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
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Reports
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            View reports for your department trips
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm text-slate-500">Total Trips</p>
              <p className="text-2xl font-bold">{reports.total_trips || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm text-slate-500">Total Fuel Cost</p>
              <p className="text-2xl font-bold">₱{reports.total_fuel_cost?.toLocaleString() || '0'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm text-slate-500">Avg. Distance</p>
              <p className="text-2xl font-bold">{reports.avg_distance || 0} km</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StaffReports;
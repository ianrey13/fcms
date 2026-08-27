// src/pages/gso/reports/WeeklyMonitoring.jsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import WeeklyMonitoringComponent from '../../../components/reports/WeeklyMonitoring';
import { departmentAPI } from '../../../services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Building2, 
  Calendar, 
  RefreshCw,
  ArrowLeft,
  Zap,
  Shield,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Wallet,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

// ============================================
// LOADING SKELETON
// ============================================

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
      ))}
    </div>
    <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const WeeklyMonitoring = () => {
  const navigate = useNavigate();
  const [departmentId, setDepartmentId] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const response = await departmentAPI.getAll();
      setDepartments(response.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    toast.success('Report refreshed');
  };

  const handleDepartmentChange = (value) => {
    setDepartmentId(value);
    setRefreshKey(prev => prev + 1);
  };

  const selectedDepartment = departments.find(
    dept => dept.department_id === parseInt(departmentId)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="p-4 md:p-6 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/gso/dashboard')}
              className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    Weekly Monitoring
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Track weekly budget utilization and trip performance
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Department Filter */}
            <div className="w-64">
              <Select 
                value={departmentId} 
                onValueChange={handleDepartmentChange}
              >
                <SelectTrigger className="bg-white dark:bg-slate-800 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <SelectValue placeholder="Select Department" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      All Departments
                    </div>
                  </SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.department_id} value={dept.department_id.toString()}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {dept.department_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="dark:border-slate-700 dark:text-slate-300"
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </Button>

            {selectedDepartment && departmentId !== 'all' && (
              <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                <Building2 className="h-3 w-3 mr-1" />
                {selectedDepartment.department_name}
              </Badge>
            )}
          </div>
        </div>

        {/* Department Info Card */}
        {departmentId !== 'all' && selectedDepartment && (
          <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Viewing report for: {selectedDepartment.department_name}
                  </p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                    Department Code: {selectedDepartment.department_code || 'N/A'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDepartmentChange('all')}
                  className="ml-auto text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear Filter
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ✅ REMOVED: Quick Stats - Overview Cards (duplicate) */}
        {/* The child component already shows these stats with correct data */}

        {/* Main Report Component */}
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <WeeklyMonitoringComponent 
            key={refreshKey}
            departmentId={departmentId} 
          />
        )}
      </div>
    </div>
  );
};

export default WeeklyMonitoring;
// src/pages/AdminDashboard.jsx - TanStack Query Version
import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Building2, Car, Users as UsersIcon,
  Activity, FileText, Settings, RefreshCw, Loader2, Zap, 
  Wallet, Fuel, CalendarDays, TrendingUp, TrendingDown
} from 'lucide-react';
import { useDashboardData, useRecentActivities } from '../hooks/useDashboardData';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell,
  BarChart, Bar, Legend
} from 'recharts';
import { toast } from 'react-hot-toast';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // ✅ Use TanStack Query hooks instead of useState + useEffect
  const { 
    data: dashboardData, 
    isLoading, 
    isFetching, 
    refetch 
  } = useDashboardData();
  
  const { 
    data: activitiesData = [], 
    isLoading: activitiesLoading 
  } = useRecentActivities();

  // Process dashboard data with useMemo for performance
  const stats = useMemo(() => {
    if (!dashboardData) return [];

    const { departments, vehicles, users, budgetStatus, fuelReport } = dashboardData;
    
    // Process departments
    const departmentsCount = Array.isArray(departments) ? departments.length : 0;
    
    // Process vehicles
    const vehiclesCount = Array.isArray(vehicles) ? vehicles.length : 0;
    const activeVehiclesCount = Array.isArray(vehicles) 
      ? vehicles.filter(v => v.status === 'active').length : 0;
    
    // Process users
    const totalUsersCount = Array.isArray(users) ? users.length : 0;
    const activeUsersCount = Array.isArray(users) 
      ? users.filter(u => u.status === 'active').length : 0;
    
    // Process budget data
    let totalBudget = 0;
    let totalSpent = 0;
    let budgetUtilization = 0;
    
    if (Array.isArray(budgetStatus)) {
      budgetStatus.forEach(item => {
        totalBudget += parseFloat(item.allocated_amount || 0);
        totalSpent += parseFloat(item.spent_amount || 0);
      });
      budgetUtilization = totalBudget > 0 ? ((totalSpent / totalBudget) * 100) : 0;
    }
    
    // Process fuel data
    let totalFuel = 0;
    if (Array.isArray(fuelReport)) {
      totalFuel = fuelReport.reduce((sum, item) => sum + (parseFloat(item.liters_availed) || 0), 0);
    }

    return [
      { 
        title: 'Departments', 
        value: departmentsCount, 
        icon: Building2, 
        gradient: 'from-blue-500 to-blue-600',
        subtitle: `${departmentsCount} active departments`,
        trend: `${departmentsCount} total`,
        trendUp: true,
        onClick: () => navigate('/admin/departments')
      },
      { 
        title: 'Vehicles', 
        value: vehiclesCount, 
        icon: Car, 
        gradient: 'from-emerald-500 to-emerald-600',
        subtitle: `${activeVehiclesCount} active`,
        trend: `${activeVehiclesCount}/${vehiclesCount}`,
        trendUp: true,
        onClick: () => navigate('/admin/vehicles')
      },
      { 
        title: 'Active Users', 
        value: activeUsersCount, 
        icon: UsersIcon, 
        gradient: 'from-purple-500 to-purple-600',
        subtitle: `${totalUsersCount} total users`,
        trend: `${activeUsersCount} active`,
        trendUp: true,
        onClick: () => navigate('/admin/users')
      },
      { 
        title: 'Budget Used', 
        value: `${budgetUtilization.toFixed(1)}%`, 
        icon: Wallet, 
        gradient: 'from-amber-500 to-amber-600',
        subtitle: `₱${(totalSpent/1000).toFixed(0)}K / ₱${(totalBudget/1000).toFixed(0)}K`,
        trend: budgetUtilization > 70 ? 'High Usage' : 'Normal',
        trendUp: budgetUtilization > 70,
        onClick: () => navigate('/admin/budget-policies')
      },
      { 
        title: 'Fuel Consumed', 
        value: totalFuel.toLocaleString(), 
        icon: Fuel, 
        gradient: 'from-cyan-500 to-cyan-600',
        subtitle: 'Total Liters',
        trend: totalFuel > 0 ? `${totalFuel}L` : 'No data',
        trendUp: true,
        onClick: () => navigate('/admin/reports')
      },
    ];
  }, [dashboardData, navigate]);

  // Process chart data
  const chartData = useMemo(() => {
    if (!dashboardData?.tripReport) return [];
    
    const tripData = Array.isArray(dashboardData.tripReport) ? dashboardData.tripReport : [];
    const monthlyMap = new Map();
    
    tripData.forEach(trip => {
      if (trip.trip_date) {
        const date = new Date(trip.trip_date);
        const monthKey = date.toLocaleString('default', { month: 'short' });
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, { trips: 0, fuel: 0 });
        }
        monthlyMap.get(monthKey).trips++;
        monthlyMap.get(monthKey).fuel += trip.estimated_fuel_liters || 0;
      }
    });
    
    let result = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      trips: data.trips,
      fuel: Math.round(data.fuel)
    })).slice(-6);
    
    if (result.length === 0) {
      result = [
        { month: 'Jan', trips: 0, fuel: 0 },
        { month: 'Feb', trips: 0, fuel: 0 },
        { month: 'Mar', trips: 0, fuel: 0 },
        { month: 'Apr', trips: 0, fuel: 0 },
        { month: 'May', trips: 0, fuel: 0 },
        { month: 'Jun', trips: 0, fuel: 0 },
      ];
    }
    return result;
  }, [dashboardData?.tripReport]);

  // Process budget chart data
  const budgetChartData = useMemo(() => {
    if (!dashboardData?.budgetStatus) return [{ name: 'No Data', allocated: 0, spent: 0, remaining: 0 }];
    
    const budgetData = Array.isArray(dashboardData.budgetStatus) ? dashboardData.budgetStatus : [];
    if (budgetData.length === 0) return [{ name: 'No Data', allocated: 0, spent: 0, remaining: 0 }];
    
    return budgetData.map(item => ({
      name: item.department_name || item.department_code || 'Unknown',
      allocated: parseFloat(item.allocated_amount || 0),
      spent: parseFloat(item.spent_amount || 0),
      remaining: parseFloat(item.remaining_amount || 0)
    })).slice(0, 6);
  }, [dashboardData?.budgetStatus]);

  // Process trip trend data
  const tripTrendData = useMemo(() => {
    if (!dashboardData?.tripReport) return [];
    
    const tripData = Array.isArray(dashboardData.tripReport) ? dashboardData.tripReport : [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyMap = new Map();
    daysOfWeek.forEach(day => dailyMap.set(day, { completed: 0, pending: 0, inTransit: 0 }));
    
    tripData.forEach(trip => {
      if (trip.trip_date) {
        const date = new Date(trip.trip_date);
        const dayName = daysOfWeek[date.getDay()];
        const current = dailyMap.get(dayName) || { completed: 0, pending: 0, inTransit: 0 };
        
        if (trip.status === 'closed' || trip.status === 'completed') {
          current.completed++;
        } else if (trip.status === 'pending_head_approval' || trip.status === 'pending_gso_review' || trip.status === 'pending_mayors_office') {
          current.pending++;
        } else if (trip.status === 'in_transit') {
          current.inTransit++;
        }
        dailyMap.set(dayName, current);
      }
    });
    
    let result = daysOfWeek.map(day => ({
      day,
      ...dailyMap.get(day)
    }));
    
    if (result.every(d => d.completed === 0 && d.pending === 0 && d.inTransit === 0)) {
      result = [
        { day: 'Mon', completed: 0, pending: 0, inTransit: 0 },
        { day: 'Tue', completed: 0, pending: 0, inTransit: 0 },
        { day: 'Wed', completed: 0, pending: 0, inTransit: 0 },
        { day: 'Thu', completed: 0, pending: 0, inTransit: 0 },
        { day: 'Fri', completed: 0, pending: 0, inTransit: 0 },
        { day: 'Sat', completed: 0, pending: 0, inTransit: 0 },
        { day: 'Sun', completed: 0, pending: 0, inTransit: 0 },
      ];
    }
    return result;
  }, [dashboardData?.tripReport]);

  // Process recent activities
  const recentActivities = useMemo(() => {
    if (!Array.isArray(activitiesData) || activitiesData.length === 0) return [];
    
    const formatRelativeTime = (timestamp) => {
      if (!timestamp) return 'Unknown';
      try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } catch (e) {
        return 'Unknown';
      }
    };

    return activitiesData.slice(0, 5).map(log => ({
      id: log.log_id || log.id || Math.random(),
      action: `${log.event_name || 'Budget Reset'} - ${log.status || 'completed'}`,
      user: 'System',
      time: formatRelativeTime(log.run_at || log.created_at),
      type: log.status === 'success' ? 'success' : log.status === 'error' ? 'warning' : 'info'
    }));
  }, [activitiesData]);

  const handleRefresh = () => {
    refetch(); // ✅ TanStack Query handles refetching
    toast.success('Dashboard refreshed');
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

  // ✅ Use TanStack Query's built-in loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section - same as before */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 rounded-2xl p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                Live Data
              </Badge>
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                v2.0.0
              </Badge>
            </div>
            <h1 className="text-3xl font-bold">Welcome back, {user?.full_name?.split(' ')[0] || 'Admin'}!</h1>
            <p className="text-slate-300 mt-1">Here's what's happening with your system today.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm text-slate-300">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              <p className="text-xs text-slate-400">{new Date().toLocaleTimeString()}</p>
            </div>
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 dark:bg-white/5 dark:hover:bg-white/15"
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid - same JSX but data from useMemo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="transform transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer"
            onClick={stat.onClick}
          >
            <Card className="relative overflow-hidden group dark:bg-slate-800/80 dark:border-slate-700">
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.gradient} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500`} />
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-medium ${stat.trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {stat.trend}
                    </span>
                    {stat.trendUp ? (
                      <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{stat.title}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{stat.subtitle}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Charts Section - same JSX but with useMemo data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trip & Fuel Trends */}
        <Card className="overflow-hidden dark:bg-slate-800/80 dark:border-slate-700">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold dark:text-white">Trip & Fuel Trends</CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Monthly overview (Real data from database)</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTrips" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-slate-700" />
                <XAxis dataKey="month" stroke="#9ca3af" className="dark:stroke-slate-500" />
                <YAxis yAxisId="left" stroke="#3b82f6" />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#1e293b' }}
                />
                <Area type="monotone" dataKey="trips" stroke="#3b82f6" fill="url(#colorTrips)" yAxisId="left" name="Trips" />
                <Area type="monotone" dataKey="fuel" stroke="#10b981" fill="url(#colorFuel)" yAxisId="right" name="Fuel (L)" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Budget Utilization - same but with useMemo data */}
        <Card className="overflow-hidden dark:bg-slate-800/80 dark:border-slate-700">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold dark:text-white">Budget Utilization</CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Department budget allocation (Real data)</p>
              </div>
              <Badge variant="outline" className="text-blue-600 dark:text-blue-400 dark:border-slate-600">Current Period</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {budgetChartData[0]?.name !== 'No Data' ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <RePieChart>
                    <Pie
                      data={budgetChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="allocated"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {budgetChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => `₱${value.toLocaleString()}`}
                      contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {budgetChartData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                      <span className="text-xs text-slate-600 dark:text-slate-400">{item.name}</span>
                      <span className="text-xs font-semibold dark:text-white">₱{(item.allocated/1000).toFixed(0)}K</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Wallet className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400">No budget data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Trip Trends - same but with useMemo data */}
      <div>
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold dark:text-white">Daily Trip Performance</CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Real data from your trip tickets</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tripTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-slate-700" />
                <XAxis dataKey="day" stroke="#9ca3af" className="dark:stroke-slate-500" />
                <YAxis stroke="#9ca3af" className="dark:stroke-slate-500" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" fill="#f59e0b" name="Pending" radius={[4, 4, 0, 0]} />
                <Bar dataKey="inTransit" fill="#3b82f6" name="In Transit" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions - same but with useMemo data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 dark:bg-slate-800/80 dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold dark:text-white">Recent Activity</CardTitle>
            <button 
              onClick={() => navigate('/admin/event-logs')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              View All →
            </button>
          </CardHeader>
          <CardContent>
            {recentActivities.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Activity className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p>No recent activity to display</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between py-3 border-b dark:border-slate-700 last:border-0 transition-all hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg px-2">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${
                        activity.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                        activity.type === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                      }`}>
                        <Activity className={`h-4 w-4 ${
                          activity.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
                          activity.type === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{activity.action}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">by {activity.user}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{activity.time}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions - same as before */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg font-semibold dark:text-white">Quick Actions</CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Common tasks and shortcuts</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { title: 'Add Department', icon: Building2, color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30', href: '/admin/departments' },
                { title: 'Register Vehicle', icon: Car, color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30', href: '/admin/vehicles' },
                { title: 'Create User', icon: UsersIcon, color: 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30', href: '/admin/users' },
                { title: 'Set Budget', icon: Wallet, color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30', href: '/admin/budget-policies' },
                { title: 'View Reports', icon: FileText, color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/30', href: '/admin/reports' },
                { title: 'Settings', icon: Settings, color: 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700', href: '/admin/settings' },
              ].map((action, index) => (
                <button
                  key={index}
                  onClick={() => navigate(action.href)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${action.color} hover:shadow-md transform hover:scale-105`}
                >
                  <action.icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{action.title}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Information Footer */}
      <div>
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Data Source: Database</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Live Data</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Auto-refresh on load</span>
                </div>
              </div>
              <div className="text-sm text-slate-400 dark:text-slate-500">
                FCMS v2.0.0 
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
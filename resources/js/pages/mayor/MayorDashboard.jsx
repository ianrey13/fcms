// src/pages/mayor/MayorDashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { mayorsOfficeAPI } from "../../services/api";
import { toast } from "react-hot-toast";
import echo from "../../services/echo";
import eventBus from "../../utils/eventBus";

import {
  LayoutDashboard,
  Clock,
  CheckCircle,
  DollarSign,
  RefreshCw,
  Loader2,
  Eye,
  Calendar,
  MapPin,
  Building2,
  TrendingUp,
  Wallet,
  FileText,
  BarChart3,
  ArrowRight,
  AlertCircle,
  Zap,
  Shield,
  Target,
  Award,
  Activity,
  PieChart,
  ChevronRight,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const MayorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingTickets, setPendingTickets] = useState([]);
  const [approvedTickets, setApprovedTickets] = useState([]);
  const [departmentBudgets, setDepartmentBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentReleases, setRecentReleases] = useState([]);
  const [newNotificationCount, setNewNotificationCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState(null);
  const [isMounted, setIsMounted] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [stats, setStats] = useState({
    pendingCount: 0,
    releasedCount: 0,
    totalAmount: 0,
    avgUtilization: 0,
    criticalDepartments: 0,
  });

  // Use refs to prevent stale closures
  const fetchAllDataRef = useRef();
  const fetchPendingTicketsRef = useRef();
  const fetchDepartmentBudgetsRef = useRef();

  // ✅ FETCH FUNCTIONS - Wrapped with useCallback
  const fetchPendingTickets = useCallback(async () => {
    try {
      const response = await mayorsOfficeAPI.getPendingTickets();
      const ticketsData = response.data?.data || response.data || [];
      if (isMounted) {
        setPendingTickets(Array.isArray(ticketsData) ? ticketsData : []);
        setStats((prev) => ({
          ...prev,
          pendingCount: ticketsData.length || 0,
        }));
        console.log("✅ Pending tickets updated:", ticketsData.length);
      }
    } catch (error) {
      console.error("Failed to fetch pending tickets:", error);
      if (isMounted) setPendingTickets([]);
    }
  }, [isMounted]);

  const fetchApprovedTickets = useCallback(async () => {
    try {
      const response = await mayorsOfficeAPI.getApprovedTickets();
      const ticketsData = response.data?.data || response.data || [];
      if (isMounted) {
        setApprovedTickets(Array.isArray(ticketsData) ? ticketsData : []);

        const total = ticketsData.reduce((sum, t) => {
          let amount = 0;
          if (t.amount_released) amount = parseFloat(t.amount_released);
          else if (t.gas_slip?.amount_released)
            amount = parseFloat(t.gas_slip.amount_released);
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0);

        setStats((prev) => ({
          ...prev,
          releasedCount: ticketsData.length || 0,
          totalAmount: total,
        }));

        setRecentReleases(
          Array.isArray(ticketsData) ? ticketsData.slice(0, 5) : [],
        );
        console.log("✅ Approved tickets updated:", ticketsData.length);
      }
    } catch (error) {
      console.error("Failed to fetch approved tickets:", error);
      if (isMounted) {
        setApprovedTickets([]);
        setRecentReleases([]);
      }
    }
  }, [isMounted]);

  const fetchDepartmentBudgets = useCallback(async () => {
    try {
      const response = await mayorsOfficeAPI.getBudgetOverview();
      const budgetData = response.data?.data || response.data || [];
      if (isMounted) {
        const formatted = budgetData.map((dept) => ({
          department_id: dept.department_id,
          department_name: dept.department_name,
          allocated: parseFloat(dept.allocated_amount) || 0,
          spent: parseFloat(dept.spent_amount) || 0,
          remaining: parseFloat(dept.remaining_amount) || 0,
          utilization:
            dept.allocated_amount > 0
              ? ((dept.spent_amount / dept.allocated_amount) * 100).toFixed(1)
              : 0,
        }));

        formatted.sort(
          (a, b) => parseFloat(b.utilization) - parseFloat(a.utilization),
        );
        setDepartmentBudgets(formatted);

        const avgUtil =
          formatted.reduce((sum, d) => sum + parseFloat(d.utilization), 0) /
          (formatted.length || 1);
        setStats((prev) => ({
          ...prev,
          avgUtilization: avgUtil.toFixed(1),
          criticalDepartments: formatted.filter(
            (d) => parseFloat(d.utilization) >= 80,
          ).length,
        }));
        console.log("✅ Budget data updated:", formatted.length);
      }
    } catch (error) {
      console.error("Failed to fetch department budgets:", error);
      if (isMounted) setDepartmentBudgets([]);
    }
  }, [isMounted]);

  // ✅ MAIN FETCH FUNCTION
  const fetchAllData = useCallback(async () => {
    console.log("🔄 Fetching all dashboard data...");
    setLoading(true);
    try {
      await Promise.all([
        fetchPendingTickets(),
        fetchApprovedTickets(),
        fetchDepartmentBudgets(),
      ]);
      console.log("✅ All data fetched successfully");
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      if (isMounted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    fetchPendingTickets,
    fetchApprovedTickets,
    fetchDepartmentBudgets,
    isMounted,
  ]);

  // Store refs for event listeners
  useEffect(() => {
    fetchAllDataRef.current = fetchAllData;
    fetchPendingTicketsRef.current = fetchPendingTickets;
    fetchDepartmentBudgetsRef.current = fetchDepartmentBudgets;
  }, [fetchAllData, fetchPendingTickets, fetchDepartmentBudgets]);

  // ============================================
  // ✅ SETUP REAL-TIME NOTIFICATIONS - NO TOASTS
  // ============================================

  const setupRealtimeNotifications = () => {
    if (!user) return;

    console.log("🔔 Setting up real-time notifications for Mayor Dashboard:", user.user_id);

    if (!echo.connector || !echo.connector.pusher) {
      console.warn("⚠️ Echo connector not available, retrying in 2s...");
      setTimeout(setupRealtimeNotifications, 2000);
      return;
    }

    const connection = echo.connector.pusher.connection;

    const subscribeToPrivateChannel = () => {
      try {
        const channel = echo.private(`notifications.${user.user_id}`);
        
        // ✅ SINGLE listener for all notifications
        channel.listen('.notification.new', (data) => {
          console.log('🔔 Mayor: Private notification received:', data);
          
          // Update notification count
          setNewNotificationCount(prev => prev + 1);
          setLatestNotification(data);

          // ✅ Emit to event bus for NotificationBell (it will show toast)
          eventBus.emit('notification-received', data);

          // ✅ Handle notification by type (REFRESH ONLY - NO TOAST)
          handleNotificationByType(data);
        });

        channel.subscribed(() => {
          console.log(`✅ Subscribed to PRIVATE notifications.${user.user_id}`);
        });

        channel.error((error) => {
          console.error('❌ Private channel subscription error:', error);
        });

      } catch (error) {
        console.error('⚠️ Error subscribing to private channel:', error);
      }
    };

    const handleNotificationByType = (data) => {
      const type = data.notification_type;
      const refreshDelay = 500;
      
      // ✅ ONLY REFRESH DATA - NO TOASTS HERE
      // NotificationBell handles all toasts
      
      if (type === 'trip_created' || type === 'trip_submitted') {
        console.log('🔄 Refreshing dashboard due to new trip notification');
        setTimeout(() => {
          fetchAllDataRef.current?.();
          setForceUpdate(prev => prev + 1);
        }, refreshDelay);
      }

      if (type === 'fund_issued' || type === 'fund_released') {
        console.log('🔄 Refreshing budget data due to fund release');
        setTimeout(() => {
          fetchPendingTicketsRef.current?.();
          fetchDepartmentBudgetsRef.current?.();
          setForceUpdate(prev => prev + 1);
        }, refreshDelay);
      }

      if (type === 'trip_completed' || type === 'trip_started') {
        console.log(`🔄 Refreshing due to ${type}`);
        setTimeout(() => {
          fetchAllDataRef.current?.();
          setForceUpdate(prev => prev + 1);
        }, refreshDelay);
      }
    };

    if (connection.state === "connected") {
      console.log("✅ Already connected, subscribing to private channel...");
      subscribeToPrivateChannel();
    } else {
      connection.bind("connected", () => {
        console.log("✅ WebSocket connected!");
        subscribeToPrivateChannel();
      });
      
      if (connection.state === "disconnected" || connection.state === "unavailable") {
        console.log("🔄 Attempting to connect...");
        connection.connect();
      }
    }
  };

  // ============================================
  // ✅ SETUP - Runs once on mount
  // ============================================

  useEffect(() => {
    setIsMounted(true);
    fetchAllData();
    
    // ✅ Setup real-time notifications
    if (user) {
      setupRealtimeNotifications();
    }

    // ✅ Cleanup on unmount
    return () => {
      setIsMounted(false);
      // Leave private channel
      try {
        if (user) {
          echo.leave(`notifications.${user.user_id}`);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [user]); // ✅ Only runs when user changes

  const handleRefresh = () => {
    setRefreshing(true);
    setNewNotificationCount(0);
    fetchAllData();
    toast.success("Dashboard refreshed");
  };

  // ============================================
  // HELPERS
  // ============================================

  const getUtilizationColor = (utilization) => {
    const percent = parseFloat(utilization);
    if (percent >= 80) return "text-red-600 dark:text-red-400";
    if (percent >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
  };

  const getProgressColor = (utilization) => {
    const percent = parseFloat(utilization);
    if (percent >= 80) return "bg-gradient-to-r from-red-500 to-red-600";
    if (percent >= 60) return "bg-gradient-to-r from-amber-500 to-amber-600";
    return "bg-gradient-to-r from-emerald-500 to-emerald-600";
  };

  const getStatusIcon = (utilization) => {
    const percent = parseFloat(utilization);
    if (percent >= 80) return <AlertCircle className="h-4 w-4 text-red-500" />;
    if (percent >= 60) return <Activity className="h-4 w-4 text-amber-500" />;
    return <CheckCircle className="h-4 w-4 text-emerald-500" />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount === 0) return "₱0";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(numAmount);
  };

  const formatCompactCurrency = (amount) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return "₱0";
    if (numAmount >= 1000000) return `₱${(numAmount / 1000000).toFixed(1)}M`;
    if (numAmount >= 1000) return `₱${(numAmount / 1000).toFixed(1)}K`;
    return `₱${numAmount.toFixed(0)}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // ============================================
  // QUICK LINK CARD
  // ============================================

  const QuickLinkCard = ({
    title,
    description,
    icon: Icon,
    href,
    color,
    count,
  }) => (
    <button
      onClick={() => navigate(href)}
      className="group relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 p-4 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border border-slate-100 dark:border-slate-700"
    >
      <div
        className={`absolute right-0 top-0 h-20 w-20 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br ${color} opacity-10 transition-transform duration-300 group-hover:scale-150`}
      />
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <div
            className={`inline-flex rounded-lg ${color.replace("from-", "bg-").replace("to-", "bg-")}/10 p-2.5`}
          >
            <Icon
              className={`h-5 w-5 ${color.replace("from-", "text-").split(" ")[0]}`}
            />
          </div>
          <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
          {count !== undefined && (
            <div className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
              <span>{count} items</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          )}
        </div>
        <ChevronRight className="mt-1 h-4 w-4 text-slate-400 transition-transform duration-300 group-hover:translate-x-1" />
      </div>
    </button>
  );

  const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 dark:bg-slate-800/80">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
              {value}
            </p>
            {subtitle && (
              <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
            )}
            {trend && (
              <div className="mt-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  {trend}
                </span>
              </div>
            )}
          </div>
          <div className={`rounded-xl ${color} p-3 shadow-lg`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const topDepartments = departmentBudgets.slice(0, 6);

  // ============================================
  // LOADING
  // ============================================

  if (loading) {
    return (
      <div className="space-y-6 p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <div className="h-32 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="space-y-6 p-6 animate-fade-in-up">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
          <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge className="border-green-500/30 bg-green-500/20 text-green-300">
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  Mayor's Office
                </Badge>
                <Badge className="border-blue-500/30 bg-blue-500/20 text-blue-300">
                  {new Date().toLocaleDateString("en-PH", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </Badge>
                {newNotificationCount > 0 && (
                  <Badge className="border-red-500/30 bg-red-500/20 text-red-300 animate-pulse">
                    <Bell className="mr-1 h-3 w-3" />
                    {newNotificationCount} new
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {getGreeting()}, {user?.first_name || "Mayor"}
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                Monitor fund releases and department budget utilization
              </p>
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="border-white/20 bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20"
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {newNotificationCount > 0
                ? `Refresh (${newNotificationCount} new)`
                : "Refresh Data"}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Pending Release"
            value={stats.pendingCount}
            icon={Clock}
            color="bg-gradient-to-r from-amber-500 to-amber-600"
            subtitle="Awaiting fund release"
          />
          <StatCard
            title="Total Released"
            value={stats.releasedCount}
            icon={CheckCircle}
            color="bg-gradient-to-r from-emerald-500 to-emerald-600"
            subtitle="Completed transactions"
          />
          <StatCard
            title="Total Amount"
            value={formatCompactCurrency(stats.totalAmount)}
            icon={Wallet}
            color="bg-gradient-to-r from-blue-500 to-blue-600"
            subtitle={formatCurrency(stats.totalAmount)}
          />
          <StatCard
            title="Avg Utilization"
            value={`${stats.avgUtilization}%`}
            icon={Target}
            color="bg-gradient-to-r from-purple-500 to-purple-600"
            subtitle={`${stats.criticalDepartments} departments >80%`}
            trend="Across all departments"
          />
        </div>

        {/* Department Budget Section */}
        <Card className="border-0 shadow-sm overflow-hidden dark:bg-slate-800/80">
          <CardHeader className="border-b border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/30 p-2.5">
                  <PieChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                    Department Budget Utilization
                  </CardTitle>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Real-time budget consumption across departments
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/mo/reports")}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View Detailed Report
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {topDepartments.length === 0 ? (
              <div className="py-12 text-center">
                <Building2 className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
                <p className="mt-3 text-slate-500 dark:text-slate-400">
                  No budget data available
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {topDepartments.map((dept) => (
                  <div key={dept.department_id} className="group">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {dept.department_name}
                        </span>
                        {getStatusIcon(dept.utilization)}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          ₱{dept.spent.toLocaleString()} / ₱
                          {dept.allocated.toLocaleString()}
                        </span>
                        <span
                          className={`text-sm font-semibold ${getUtilizationColor(dept.utilization)}`}
                        >
                          {dept.utilization}%
                        </span>
                      </div>
                    </div>
                    <div className="relative">
                      <Progress
                        value={parseFloat(dept.utilization)}
                        className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700"
                      />
                      <div
                        className={`absolute top-0 left-0 h-2.5 rounded-full transition-all duration-500 ${getProgressColor(dept.utilization)}`}
                        style={{
                          width: `${Math.min(parseFloat(dept.utilization), 100)}%`,
                        }}
                      />
                    </div>
                    {parseFloat(dept.utilization) >= 80 && (
                      <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Approaching or exceeding budget limit
                      </p>
                    )}
                  </div>
                ))}
                {departmentBudgets.length > 6 && (
                  <div className="pt-3 text-center">
                    <Button
                      variant="link"
                      onClick={() => navigate("/mo/reports")}
                      className="text-blue-600 dark:text-blue-400"
                    >
                      View all {departmentBudgets.length} departments
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Releases */}
          <Card className="border-0 shadow-sm overflow-hidden dark:bg-slate-800/80">
            <CardHeader className="border-b border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/30 p-2.5">
                  <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                    Recent Fund Releases
                  </CardTitle>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Last 5 transactions
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {recentReleases.length === 0 ? (
                <div className="py-12 text-center">
                  <DollarSign className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
                  <p className="mt-3 text-slate-500 dark:text-slate-400">
                    No funds released yet
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {recentReleases.map((ticket, idx) => (
                    <div
                      key={ticket.id || ticket.trip_ticket_id}
                      className="group flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                            {ticket.ticket_number || ticket.trip_ticket_number}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-xs dark:border-slate-600 dark:text-slate-400"
                          >
                            {formatDate(ticket.trip_date)}
                          </Badge>
                          {ticket.is_mo_funded && (
                            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs">
                              MO Funded
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {ticket.department_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {ticket.destination?.length > 30
                              ? `${ticket.destination.substring(0, 30)}...`
                              : ticket.destination}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(ticket.amount_released)}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate(
                              `/mo/tickets/${ticket.id || ticket.trip_ticket_id}`,
                            )
                          }
                          className="mt-1 h-7 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                  {approvedTickets.length > 5 && (
                    <div className="pt-3 text-center">
                      <Button
                        variant="link"
                        onClick={() => navigate("/mo/approved")}
                        className="text-blue-600 dark:text-blue-400"
                      >
                        View all {approvedTickets.length} releases
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card className="border-0 shadow-sm overflow-hidden dark:bg-slate-800/80">
            <CardHeader className="border-b border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-purple-50 dark:bg-purple-900/30 p-2.5">
                  <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                    Quick Navigation
                  </CardTitle>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Access key management features
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <QuickLinkCard
                  title="Pending Fund Release"
                  description="Review and release funds"
                  icon={Clock}
                  href="/mo/pending"
                  color="from-amber-500 to-amber-600"
                  count={stats.pendingCount}
                />
                <QuickLinkCard
                  title="Financial Reports"
                  description="Budget vs Actual analysis"
                  icon={BarChart3}
                  href="/mo/reports"
                  color="from-blue-500 to-blue-600"
                />
                <QuickLinkCard
                  title="Released Tickets"
                  description="View all released funds"
                  icon={CheckCircle}
                  href="/mo/approved"
                  color="from-purple-500 to-purple-600"
                  count={stats.releasedCount}
                />
              </div>

              {/* Quick Stats Footer */}
              <div className="mt-6 rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-slate-800 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-blue-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Department Performance
                    </span>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {
                          departmentBudgets.filter(
                            (d) => parseFloat(d.utilization) < 60,
                          ).length
                        }
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Good Standing
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                        {
                          departmentBudgets.filter(
                            (d) =>
                              parseFloat(d.utilization) >= 60 &&
                              parseFloat(d.utilization) < 80,
                          ).length
                        }
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Warning
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600 dark:text-red-400">
                        {
                          departmentBudgets.filter(
                            (d) => parseFloat(d.utilization) >= 80,
                          ).length
                        }
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Critical
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MayorDashboard;
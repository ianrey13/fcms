// src/pages/gso/users/UserManagement.jsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
import { useRealtime } from "../../../contexts/RealtimeContext";
import { useAuth } from "../../../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Edit,
  Trash2,
  Search,
  RefreshCw,
  UserPlus,
  Loader2,
  Building2,
  Mail,
  CheckCircle,
  XCircle,
  BadgeCheck,
  IdCard,
  ArrowLeft,
  Zap,
  Shield,
  Filter,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  MoreHorizontal,
  Eye,
  EyeOff,
  AlertTriangle,
  X,
} from "lucide-react";
import { useUsers, useDeleteUser, useToggleUserStatus } from "../../../hooks/useUserManagement";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

// ============================================
// STATS CARD COMPONENT
// ============================================

const StatsCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <Card className="dark:bg-slate-800/80 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ============================================
// ROLE BADGE COMPONENT (Updated - No "Staff")
// ============================================

const RoleBadge = ({ role }) => {
  const configs = {
    gso_office: {
      color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      icon: Shield,
      label: "GSO Office",
    },
    mayors_office: {
      color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      icon: BadgeCheck,
      label: "Disbursing Officer",
    },
    driver: {
      color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
      icon: User,
      label: "Driver",
    },
  };
  const config = configs[role] || { 
    color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
    icon: User,
    label: role || "Unknown",
  };
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

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

const UserManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isConnected } = useRealtime();
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  
  const { data: users = [], isLoading, refetch } = useUsers();
  const deleteUser = useDeleteUser();
  const toggleStatus = useToggleUserStatus();

  // ============================================
  // ✅ AUTO-REFRESH - No manual refresh needed
  // ============================================

  useAutoRefresh(
    [
      "gso-trip-updated",
      "new-notification",
    ],
    () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  );

  // ============ STATS ============
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.status === "active").length;
    const inactive = users.filter(u => u.status === "inactive").length;
    const drivers = users.filter(u => u.role === "driver").length;
    const gso = users.filter(u => u.role === "gso_office").length;
    const mayor = users.filter(u => u.role === "mayors_office").length;
    
    return [
      {
        title: "Total Users",
        value: total,
        icon: Users,
        color: "from-blue-500 to-blue-600",
        subtitle: `${active} active • ${inactive} inactive`,
      },
      {
        title: "Active Users",
        value: active,
        icon: CheckCircle,
        color: "from-emerald-500 to-emerald-600",
        subtitle: `${total > 0 ? Math.round((active / total) * 100) : 0}% of total`,
      },
      {
        title: "Drivers",
        value: drivers,
        icon: User,
        color: "from-cyan-500 to-cyan-600",
        subtitle: "Can drive vehicles",
      },
      {
        title: "GSO Staff",
        value: gso + mayor,
        icon: Shield,
        color: "from-purple-500 to-purple-600",
        subtitle: `${gso} GSO • ${mayor} Mayor's Office`,
      },
    ];
  }, [users]);

  // ============ FILTERS ============
  const filteredUsers = useMemo(() => {
    let filtered = users;
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((user) =>
        user.email?.toLowerCase().includes(search) ||
        user.first_name?.toLowerCase().includes(search) ||
        user.last_name?.toLowerCase().includes(search) ||
        user.employee_number?.toLowerCase().includes(search) ||
        user.department_name?.toLowerCase().includes(search)
      );
    }
    
    // Role filter - ✅ Only 3 roles: gso_office, mayors_office, driver
    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }
    
    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((user) => user.status === statusFilter);
    }
    
    return filtered;
  }, [users, searchTerm, roleFilter, statusFilter]);

  // ============ HANDLERS ============
  const handleToggleStatus = (userId, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    toggleStatus.mutate(
      { userId, status: newStatus },
      {
        onSuccess: () => {
          toast.success(`User ${newStatus === "active" ? "activated" : "deactivated"}!`);
          queryClient.invalidateQueries({ queryKey: ["users"] });
        },
        onError: () => toast.error("Failed to update status"),
      }
    );
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to deactivate "${name}"?`)) {
      deleteUser.mutate(id, {
        onSuccess: () => {
          toast.success("User deactivated!");
          queryClient.invalidateQueries({ queryKey: ["users"] });
        },
        onError: () => toast.error("Failed to deactivate user"),
      });
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  const hasActiveFilters = searchTerm || roleFilter !== "all" || statusFilter !== "all";

  // Connection status
  const connectionStatus = isConnected ? "🟢 Live" : "🔴 Offline";
  const isRealTime = isConnected;

  // ============================================
  // RENDER
  // ============================================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="p-4 md:p-6 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin/dashboard')}
              className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    User Management
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Manage system users, roles, and permissions
                    <span className="ml-2 text-xs opacity-70">{connectionStatus}</span>
                    {isRealTime && (
                      <span className="ml-2 text-xs text-emerald-400 animate-pulse">
                        ● Auto-refresh
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => navigate("/admin/users/add")}
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add New User
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>

        {/* Search and Filters */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, email, employee number, or department..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 bg-white dark:bg-slate-900 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                    className="dark:border-slate-700 dark:text-slate-300"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {hasActiveFilters && (
                      <Badge className="ml-2 bg-blue-500 text-white text-[10px] px-1.5 py-0.5">
                        {Object.values({ roleFilter, statusFilter }).filter(v => v !== "all").length + (searchTerm ? 1 : 0)}
                      </Badge>
                    )}
                    {showFilters ? (
                      <ChevronUp className="h-4 w-4 ml-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-2" />
                    )}
                  </Button>
                  {/* ❌ REFRESH BUTTON REMOVED - Auto-refresh handles everything */}
                </div>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm dark:text-white"
                    >
                      <option value="all">All Roles</option>
                      <option value="gso_office">GSO Office</option>
                      <option value="mayors_office">Disbursing Officer</option>
                      <option value="driver">Driver</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm dark:text-white"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        onClick={clearFilters}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        Clear All Filters
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                  <Users className="h-5 w-5 text-blue-500" />
                  All Users
                </CardTitle>
                <CardDescription className="dark:text-slate-400">
                  {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
                  {filteredUsers.length !== users.length && ` (filtered from ${users.length} total)`}
                  {isRealTime && (
                    <span className="ml-2 text-xs text-emerald-500 animate-pulse">
                      ● Live updates
                    </span>
                  )}
                </CardDescription>
              </div>
              {filteredUsers.length > 0 && (
                <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                  <Zap className="h-3 w-3 mr-1" />
                  {filteredUsers.length} records
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No users found</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  {users.length === 0 
                    ? 'Create your first user to get started'
                    : 'Try adjusting your search or filters'}
                </p>
                {users.length === 0 && (
                  <Button 
                    onClick={() => navigate("/admin/users/add")} 
                    className="mt-4 bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-500/20"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add First User
                  </Button>
                )}
                {users.length > 0 && hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="mt-4 dark:border-slate-700 dark:text-slate-300"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Employee #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {filteredUsers.map((user) => (
                      <tr 
                        key={user.user_id} 
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                              <span className="text-white text-sm font-bold">
                                {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {user.first_name} {user.last_name}
                              </span>
                              {user.can_drive && (
                                <Badge className="ml-2 bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 text-[10px]">
                                  🚗 Driver
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <IdCard className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                              {user.employee_number || "N/A"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {user.email}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {user.department_name || "N/A"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <RoleBadge role={user.role} />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleStatus(user.user_id, user.status)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all duration-200",
                              "hover:scale-105 active:scale-95",
                              user.status === "active"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                                : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                            )}
                          >
                            {user.status === "active" ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {user.status === "active" ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/admin/users/edit/${user.user_id}`)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-9 w-9 p-0 rounded-lg transition-all duration-200 group-hover:scale-110"
                              title="Edit User"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {user.user_id !== currentUser?.user_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(user.user_id, `${user.first_name} ${user.last_name}`)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30 h-9 w-9 p-0 rounded-lg transition-all duration-200 group-hover:scale-110"
                                title="Deactivate User"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
          <p>FCMS - User Management • Laguindingan Municipality</p>
          <p className="mt-0.5">{users.length} total users • {users.filter(u => u.status === "active").length} active</p>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
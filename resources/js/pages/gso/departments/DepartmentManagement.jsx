// src/pages/mayor/departments/DepartmentManagement.jsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAutoRefresh } from "../../../hooks/useAutoRefresh";
import { useRealtime } from "../../../contexts/RealtimeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Search,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Code,
  User,
  Users,
  ArrowLeft,
  Zap,
  Shield,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  MoreHorizontal,
  AlertTriangle,
  Calendar,
  Mail,
  Phone,
  MapPin,
  X,
} from "lucide-react";
import { useDepartments, useDeleteDepartment, useToggleDepartmentStatus } from "../../../hooks/useDepartmentManagement";
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
// LOADING SKELETON
// ============================================

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
      ))}
    </div>
    <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const DepartmentManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isConnected } = useRealtime();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  
  const { data: departments = [], isLoading, refetch } = useDepartments();
  const deleteDepartment = useDeleteDepartment();
  const toggleStatus = useToggleDepartmentStatus();

  // ============================================
  // ✅ AUTO-REFRESH - No manual refresh needed
  // ============================================

  useAutoRefresh(
    [
      "mayor-trip-updated",
      "new-notification",
    ],
    () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    }
  );

  // ============ STATS ============
  const stats = useMemo(() => {
    const total = departments.length;
    const active = departments.filter(d => d.is_active).length;
    const inactive = departments.filter(d => !d.is_active).length;
    
    return [
      {
        title: "Total Departments",
        value: total,
        icon: Building2,
        color: "from-blue-500 to-blue-600",
        subtitle: `${active} active • ${inactive} inactive`,
      },
      {
        title: "Active",
        value: active,
        icon: CheckCircle,
        color: "from-emerald-500 to-emerald-600",
        subtitle: `${total > 0 ? Math.round((active / total) * 100) : 0}% of total`,
      },
      {
        title: "Inactive",
        value: inactive,
        icon: XCircle,
        color: "from-red-500 to-red-600",
        subtitle: `${total > 0 ? Math.round((inactive / total) * 100) : 0}% of total`,
      },
    ];
  }, [departments]);

  // ============ FILTERS ============
  const filteredDepartments = useMemo(() => {
    let filtered = departments;
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((dept) =>
        dept.department_name?.toLowerCase().includes(search) ||
        dept.department_code?.toLowerCase().includes(search) ||
        dept.head_of_office?.toLowerCase().includes(search) ||
        dept.email?.toLowerCase().includes(search)
      );
    }
    
    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((dept) =>
        statusFilter === "active" ? dept.is_active : !dept.is_active
      );
    }
    
    return filtered;
  }, [departments, searchTerm, statusFilter]);

  // ============ HANDLERS ============
  const handleToggleStatus = (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    const action = newStatus === "active" ? "activate" : "deactivate";
    
    if (window.confirm(`Are you sure you want to ${action} this department?`)) {
      toggleStatus.mutate(
        { id, status: newStatus },
        {
          onSuccess: () => {
            toast.success(`Department ${action}d successfully!`);
            queryClient.invalidateQueries({ queryKey: ["departments"] });
          },
          onError: () => toast.error(`Failed to ${action} department`),
        }
      );
    }
  };

  const handleAddClick = () => {
    navigate("/admin/departments/add");
  };

  const handleEditClick = (id) => {
    navigate(`/admin/departments/edit/${id}`);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const hasActiveFilters = searchTerm || statusFilter !== "all";

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
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    Department Management
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Manage system departments and their heads
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
              onClick={handleAddClick}
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    placeholder="Search by name, code, or head of office..."
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
                        {statusFilter !== "all" ? 1 : 0 + (searchTerm ? 1 : 0)}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
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
                        <X className="h-4 w-4 mr-1.5" />
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
                  <Building2 className="h-5 w-5 text-blue-500" />
                  All Departments
                </CardTitle>
                <CardDescription className="dark:text-slate-400">
                  {filteredDepartments.length} department{filteredDepartments.length !== 1 ? 's' : ''} found
                  {filteredDepartments.length !== departments.length && ` (filtered from ${departments.length} total)`}
                  {isRealTime && (
                    <span className="ml-2 text-xs text-emerald-500 animate-pulse">
                      ● Live updates
                    </span>
                  )}
                </CardDescription>
              </div>
              {filteredDepartments.length > 0 && (
                <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                  <Zap className="h-3 w-3 mr-1" />
                  {filteredDepartments.length} records
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {filteredDepartments.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No departments found</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  {departments.length === 0 
                    ? 'Create your first department to get started'
                    : 'Try adjusting your search or filters'}
                </p>
                {departments.length === 0 && (
                  <Button 
                    onClick={handleAddClick} 
                    className="mt-4 bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-500/20"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Department
                  </Button>
                )}
                {departments.length > 0 && hasActiveFilters && (
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
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Department Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Head of Office
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
                    {filteredDepartments.map((dept) => (
                      <tr 
                        key={dept.department_id} 
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                              <Code className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="font-mono font-bold text-sm text-slate-800 dark:text-white">
                              {dept.department_code}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-slate-400" />
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {dept.department_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            <span className={cn(
                              "font-medium",
                              dept.head_of_office 
                                ? "text-slate-700 dark:text-slate-300" 
                                : "text-slate-400 dark:text-slate-500 italic"
                            )}>
                              {dept.head_of_office || "Not set"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleStatus(dept.department_id, dept.is_active ? "active" : "inactive")}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all duration-200",
                              "hover:scale-105 active:scale-95",
                              dept.is_active
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                                : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                            )}
                          >
                            {dept.is_active ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {dept.is_active ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(dept.department_id)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-9 w-9 p-0 rounded-lg transition-all duration-200 group-hover:scale-110"
                              title="Edit Department"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
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
          <p>FCMS - Department Management • Laguindingan Municipality</p>
          <p className="mt-0.5">{departments.length} total departments • {departments.filter(d => d.is_active).length} active</p>
        </div>
      </div>
    </div>
  );
};

export default DepartmentManagement;
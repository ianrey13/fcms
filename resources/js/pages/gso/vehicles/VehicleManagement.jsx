// src/pages/gso/vehicles/VehicleManagement.jsx
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Car,
  Plus,
  Edit,
  Trash2,
  Search,
  RefreshCw,
  Fuel,
  Loader2,
  Building2,
  CheckCircle,
  XCircle,
  Wrench,
  Check,
  ArrowLeft,
  Zap,
  Shield,
  Filter,
  ChevronDown,
  ChevronUp,
  Gauge,
  Calendar,
  AlertTriangle,
  Eye,
  MoreHorizontal,
  Users,
  Clock,
  MapPin,
  X,
  AlertCircle,
} from "lucide-react";
import { useVehicles, useDeleteVehicle, useToggleVehicleStatus } from "../../../hooks/useVehicleManagement";
import { useQuery } from "@tanstack/react-query";
import { adminDepartmentAPI } from "../../../services/api";
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
// STATUS BADGE COMPONENT
// ============================================

const StatusBadge = ({ status, maintenanceFlag }) => {
  let displayStatus = "Serviceable";
  let color = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
  let icon = CheckCircle;

  if (status === "inactive") {
    displayStatus = "Unserviceable";
    color = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
    icon = XCircle;
  } else if (maintenanceFlag) {
    displayStatus = "Under Maintenance";
    color = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
    icon = Wrench;
  }

  const Icon = icon;
  return (
    <Badge className={`${color} flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium`}>
      <Icon className="h-3 w-3" />
      {displayStatus}
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

const VehicleManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isConnected } = useRealtime();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fuelFilter, setFuelFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // ✅ Modal state for status change confirmation
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    vehicleId: null,
    vehicleLabel: "",
    currentStatus: null,
    maintenanceFlag: false,
    action: "",
    newStatus: "active",
    newMaintenanceFlag: false,
    actionIcon: null,
    actionColor: "",
  });

  const { data: vehicles = [], isLoading, refetch } = useVehicles();
  const deleteVehicle = useDeleteVehicle();
  const toggleStatus = useToggleVehicleStatus();

  // ============================================
  // AUTO-REFRESH
  // ============================================

  useAutoRefresh(
    ["gso-trip-updated", "new-notification"],
    () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    }
  );

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      try {
        const response = await adminDepartmentAPI.getAll();
        const data = response.data?.data || response.data || [];
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching departments:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // ============ STATS ============
  const stats = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter(v => v.status === "active" && !v.maintenance_flag).length;
    const underMaintenance = vehicles.filter(v => v.maintenance_flag).length;
    const inactive = vehicles.filter(v => v.status === "inactive").length;

    return [
      {
        title: "Total Vehicles",
        value: total,
        icon: Car,
        color: "from-blue-500 to-blue-600",
        subtitle: `${active} serviceable • ${underMaintenance} maintenance`,
      },
      {
        title: "Serviceable",
        value: active,
        icon: CheckCircle,
        color: "from-emerald-500 to-emerald-600",
        subtitle: `${total > 0 ? Math.round((active / total) * 100) : 0}% of fleet`,
      },
      {
        title: "Under Maintenance",
        value: underMaintenance,
        icon: Wrench,
        color: "from-yellow-500 to-yellow-600",
        subtitle: `Needs attention`,
      },
      {
        title: "Unserviceable",
        value: inactive,
        icon: XCircle,
        color: "from-red-500 to-red-600",
        subtitle: `Not operational`,
      },
    ];
  }, [vehicles]);

  // ============ HELPERS ============
  const getDepartmentName = (departmentId) => {
    if (!departmentId) return "N/A";
    const dept = departments.find(d => d.department_id === parseInt(departmentId));
    return dept?.department_name || dept?.name || "N/A";
  };

  const getDepartmentColor = (departmentId) => {
    const colors = {
      1: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
      2: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      3: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
      4: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      5: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      6: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    };
    return colors[departmentId] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  };

  const getFuelTypeColor = (fuelType) => {
  if (fuelType === "diesel") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
  if (fuelType === "premium") return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
  return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"; // regular
};

  // ============ FILTERS ============
  const filteredVehicles = useMemo(() => {
    let filtered = vehicles;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((v) =>
        v.vehicle_model?.toLowerCase().includes(search) ||
        v.plate_number?.toLowerCase().includes(search) ||
        v.vehicle_type?.toLowerCase().includes(search) ||
        getDepartmentName(v.department_id).toLowerCase().includes(search)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((v) => {
        if (statusFilter === "serviceable") return v.status === "active" && !v.maintenance_flag;
        if (statusFilter === "maintenance") return v.maintenance_flag;
        if (statusFilter === "unserviceable") return v.status === "inactive";
        return true;
      });
    }

    if (fuelFilter !== "all") {
      filtered = filtered.filter((v) => v.fuel_type === fuelFilter);
    }

    return filtered;
  }, [vehicles, searchTerm, statusFilter, fuelFilter, departments]);

  // ============ HANDLERS ============
  const handleToggleStatus = (id, currentStatus, maintenanceFlag, vehicleLabel) => {
    // Cycle through statuses: Serviceable -> Under Maintenance -> Unserviceable -> Serviceable
    let newStatus = "active";
    let newMaintenanceFlag = false;
    let action = "";
    let actionIcon = null;
    let actionColor = "";

    if (currentStatus === "active" && !maintenanceFlag) {
      // Serviceable -> Under Maintenance
      newStatus = "active";
      newMaintenanceFlag = true;
      action = "put under maintenance";
      actionIcon = Wrench;
      actionColor = "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400";
    } else if (currentStatus === "active" && maintenanceFlag) {
      // Under Maintenance -> Unserviceable
      newStatus = "inactive";
      newMaintenanceFlag = false;
      action = "mark as unserviceable";
      actionIcon = XCircle;
      actionColor = "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400";
    } else if (currentStatus === "inactive") {
      // Unserviceable -> Serviceable
      newStatus = "active";
      newMaintenanceFlag = false;
      action = "reactivate";
      actionIcon = CheckCircle;
      actionColor = "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400";
    }

    // Open confirmation modal instead of window.confirm
    setConfirmDialog({
      open: true,
      vehicleId: id,
      vehicleLabel,
      currentStatus,
      maintenanceFlag,
      action,
      newStatus,
      newMaintenanceFlag,
      actionIcon,
      actionColor,
    });
  };

  const confirmStatusChange = () => {
    const { vehicleId, newStatus, newMaintenanceFlag, action } = confirmDialog;

    toggleStatus.mutate(
      {
        vehicleId,
        status: newStatus,
        maintenance_flag: newMaintenanceFlag,
      },
      {
        onSuccess: () => {
          const successMessages = {
            "put under maintenance": "Vehicle placed under maintenance!",
            "mark as unserviceable": "Vehicle marked as unserviceable!",
            "reactivate": "Vehicle reactivated!",
          };
          toast.success(successMessages[action] || "Vehicle updated successfully!");
          queryClient.invalidateQueries({ queryKey: ["vehicles"] });
          setConfirmDialog(prev => ({ ...prev, open: false }));
        },
        onError: (error) => {
  const backendMessage = error.response?.data?.message;
  const validationErrors = error.response?.data?.errors;

  if (validationErrors) {
    const firstError = Object.values(validationErrors)[0];
    toast.error(Array.isArray(firstError) ? firstError[0] : firstError, { duration: 5000 });
  } else if (backendMessage) {
    toast.error(backendMessage, { duration: 5000 });
  } else {
    toast.error(`Failed to ${action} vehicle`);
  }
},
      }
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setFuelFilter("all");
  };

  const hasActiveFilters = searchTerm || statusFilter !== "all" || fuelFilter !== "all";
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

  // Modal content config
  const ActionIcon = confirmDialog.actionIcon;

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
                  <Car className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    Vehicle Management
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Manage fleet vehicles, track status, and maintenance
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
              onClick={() => navigate("/admin/vehicles/add")}
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              Register Vehicle
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
                    placeholder="Search by model, plate, type, or department..."
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
                        {Object.values({ statusFilter, fuelFilter }).filter(v => v !== "all").length + (searchTerm ? 1 : 0)}
                      </Badge>
                    )}
                    {showFilters ? (
                      <ChevronUp className="h-4 w-4 ml-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-2" />
                    )}
                  </Button>
                </div>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm dark:text-white"
                    >
                      <option value="all">All Statuses</option>
                      <option value="serviceable">Serviceable</option>
                      <option value="maintenance">Under Maintenance</option>
                      <option value="unserviceable">Unserviceable</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fuel Type</label>
                    <select
                      value={fuelFilter}
                      onChange={(e) => setFuelFilter(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm dark:text-white"
                    >
                     <option value="all">All Fuel Types</option>
<option value="diesel">Diesel</option>
<option value="regular">Regular</option>
<option value="premium">Premium</option>
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
                  <Car className="h-5 w-5 text-blue-500" />
                  Fleet Vehicles
                </CardTitle>
                <CardDescription className="dark:text-slate-400">
                  {filteredVehicles.length} vehicle{filteredVehicles.length !== 1 ? 's' : ''} found
                  {filteredVehicles.length !== vehicles.length && ` (filtered from ${vehicles.length} total)`}
                  {isRealTime && (
                    <span className="ml-2 text-xs text-emerald-500 animate-pulse">
                      ● Live updates
                    </span>
                  )}
                </CardDescription>
              </div>
              {filteredVehicles.length > 0 && (
                <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                  <Zap className="h-3 w-3 mr-1" />
                  {filteredVehicles.length} records
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {filteredVehicles.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <Car className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No vehicles found</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  {vehicles.length === 0
                    ? 'Register your first vehicle to get started'
                    : 'Try adjusting your search or filters'}
                </p>
                {vehicles.length === 0 && (
                  <Button
                    onClick={() => navigate("/admin/vehicles/add")}
                    className="mt-4 bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-500/20"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Register First Vehicle
                  </Button>
                )}
                {vehicles.length > 0 && hasActiveFilters && (
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
                        Vehicle
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Plate #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Fuel
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
                    {filteredVehicles.map((vehicle) => {
                      const deptName = getDepartmentName(vehicle.department_id);
                      const deptColor = getDepartmentColor(vehicle.department_id);
                      const fuelColor = getFuelTypeColor(vehicle.fuel_type);
                      return (
                        <tr
                          key={vehicle.vehicle_id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <Car className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {vehicle.vehicle_model}
                                </span>
                                {vehicle.vehicle_type && (
                                  <p className="text-xs text-slate-400 dark:text-slate-500">
                                    {vehicle.vehicle_type}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white">
                              {vehicle.plate_number}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-slate-400" />
                              <Badge className={`${deptColor} text-[10px] font-medium`}>
                                {deptName}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`${fuelColor} flex items-center gap-1 text-[10px] font-medium`}>
                              <Fuel className="h-3 w-3" />
                              {vehicle.fuel_type || "N/A"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() =>
                                handleToggleStatus(
                                  vehicle.vehicle_id,
                                  vehicle.status,
                                  vehicle.maintenance_flag,
                                  `${vehicle.vehicle_model} (${vehicle.plate_number})`
                                )
                              }
                              className="hover:scale-105 active:scale-95 transition-all duration-200"
                            >
                              <StatusBadge status={vehicle.status} maintenanceFlag={vehicle.maintenance_flag} />
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/admin/vehicles/edit/${vehicle.vehicle_id}`)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/30 h-9 w-9 p-0 rounded-lg transition-all duration-200 group-hover:scale-110"
                                title="Edit Vehicle"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
          <p>FCMS - Vehicle Management • Laguindingan Municipality</p>
          <p className="mt-0.5">
            {vehicles.length} total vehicles •
            {vehicles.filter(v => v.status === "active" && !v.maintenance_flag).length} serviceable •
            {vehicles.filter(v => v.maintenance_flag).length} maintenance •
            {vehicles.filter(v => v.status === "inactive").length} unserviceable
          </p>
        </div>
      </div>

      {/* ✅ Confirmation Modal */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md dark:bg-slate-800 dark:border-slate-700">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              {ActionIcon && (
                <div className={`p-2.5 rounded-xl ${confirmDialog.actionColor}`}>
                  <ActionIcon className="h-5 w-5" />
                </div>
              )}
              <DialogTitle className="text-lg font-bold text-slate-800 dark:text-white">
                Confirm Status Change
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              You are about to <strong>{confirmDialog.action}</strong> this vehicle:
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Car className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-white">
                  {confirmDialog.vehicleLabel}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Current status: {
                    confirmDialog.currentStatus === "inactive"
                      ? "Unserviceable"
                      : confirmDialog.maintenanceFlag
                      ? "Under Maintenance"
                      : "Serviceable"
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              This action will change the vehicle's operational status. You can reverse it by clicking the status badge again.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
              disabled={toggleStatus.isPending}
              className="dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmStatusChange}
              disabled={toggleStatus.isPending}
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
            >
              {toggleStatus.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VehicleManagement;
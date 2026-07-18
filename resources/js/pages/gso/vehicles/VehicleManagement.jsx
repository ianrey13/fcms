// src/pages/gso/vehicles/VehicleManagement.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { useVehicles, useDeleteVehicle, useToggleVehicleStatus } from "../../../hooks/useVehicleManagement";
import { useQuery } from "@tanstack/react-query";
import { adminDepartmentAPI } from "../../../services/api";
import { toast } from "react-hot-toast";

const VehicleManagement = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: vehicles = [], isLoading, refetch } = useVehicles();
  const deleteVehicle = useDeleteVehicle();
  const toggleStatus = useToggleVehicleStatus();

  // ✅ Fetch departments to map department_id to department_name
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

  // ✅ Get department name from department_id
  const getDepartmentName = (departmentId) => {
    if (!departmentId) return "N/A";
    const dept = departments.find(d => d.department_id === parseInt(departmentId));
    return dept?.department_name || dept?.name || "N/A";
  };

  // ✅ Get department color
  const getDepartmentColor = (departmentId) => {
    const colors = {
      1: "bg-purple-100 text-purple-700",
      2: "bg-blue-100 text-blue-700",
      3: "bg-orange-100 text-orange-700",
      4: "bg-green-100 text-green-700",
      5: "bg-red-100 text-red-700",
      6: "bg-indigo-100 text-indigo-700",
    };
    return colors[departmentId] || "bg-gray-100 text-gray-700";
  };

  const filteredVehicles = vehicles.filter((vehicle) =>
    vehicle.vehicle_model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.plate_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteVehicle.mutate(id, {
        onSuccess: () => toast.success("Vehicle deleted!"),
        onError: () => toast.error("Failed to delete vehicle"),
      });
    }
  };

  const handleToggleStatus = (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    toggleStatus.mutate(
      { vehicleId: id, status: newStatus },
      {
        onSuccess: () => toast.success(`Vehicle ${newStatus === "active" ? "activated" : "deactivated"}!`),
        onError: () => toast.error("Failed to update status"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Vehicle Management</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage fleet vehicles, track status, and maintenance</p>
        </div>
        <Button onClick={() => navigate("/admin/vehicles/add")} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Register Vehicle
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by model or plate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => refetch()} className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Fleet Vehicles ({filteredVehicles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredVehicles.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No vehicles found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Vehicle</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Plate #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Fuel</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredVehicles.map((vehicle) => {
                    const deptName = getDepartmentName(vehicle.department_id);
                    return (
                      <tr key={vehicle.vehicle_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                              <Car className="h-4 w-4 text-white" />
                            </div>
                            <span className="font-semibold">{vehicle.vehicle_model}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">{vehicle.plate_number}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            <span className={`text-sm px-2 py-0.5 rounded-full ${getDepartmentColor(vehicle.department_id)}`}>
                              {deptName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Fuel className="h-3 w-3" />
                            <span className="text-sm capitalize">{vehicle.fuel_type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleStatus(vehicle.vehicle_id, vehicle.status)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                              vehicle.status === "active"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : "bg-red-100 text-red-700 hover:bg-red-200"
                            }`}
                          >
                            {vehicle.status === "active" ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {vehicle.status === "active" ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/admin/vehicles/edit/${vehicle.vehicle_id}`)}
                              className="text-blue-600 hover:bg-blue-50 h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {/* <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(vehicle.vehicle_id, vehicle.vehicle_model)}
                              className="text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button> */}
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
    </div>
  );
};

export default VehicleManagement;
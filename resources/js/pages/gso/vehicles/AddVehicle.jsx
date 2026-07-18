// src/pages/gso/vehicles/AddVehicle.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Car, Truck, Fuel, Building2, Wrench, Loader2 } from "lucide-react";
import { useCreateVehicle, useDepartmentsForVehicles } from "../../../hooks/useVehicleManagement";
import { toast } from "react-hot-toast";

const AddVehicle = () => {
  const navigate = useNavigate();
  const createVehicle = useCreateVehicle();
  const { data: departments = [], isLoading: loadingDepartments } = useDepartmentsForVehicles();
  const [formData, setFormData] = useState({
    department_id: "",
    vehicle_model: "",
    plate_number: "",
    fuel_type: "diesel",
    status: "active",
    maintenance_flag: false,
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.department_id) newErrors.department_id = "Department is required";
    if (!formData.vehicle_model.trim()) newErrors.vehicle_model = "Vehicle model is required";
    if (!formData.plate_number.trim()) newErrors.plate_number = "Plate number is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    createVehicle.mutate(
      {
        department_id: parseInt(formData.department_id),
        vehicle_model: formData.vehicle_model.trim(),
        plate_number: formData.plate_number.trim().toUpperCase(),
        fuel_type: formData.fuel_type,
        status: formData.status,
        maintenance_flag: formData.maintenance_flag,
      },
      {
        onSuccess: () => {
          toast.success("Vehicle registered!");
          navigate("/admin/vehicles");
        },
        onError: (error) => {
          console.error("Create vehicle error:", error);
          toast.error(error.response?.data?.message || "Failed to register vehicle");
        },
      }
    );
  };

  return (
    <div className="max-w-10xl mx-auto">
      <Button variant="ghost" onClick={() => navigate("/admin/vehicles")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Vehicles
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Register New Vehicle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Department *
              </Label>
              {loadingDepartments ? (
                <div className="flex items-center gap-2 mt-1.5 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading departments...
                </div>
              ) : (
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className={`w-full mt-1.5 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.department_id ? "border-red-500" : ""}`}
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.department_id} value={dept.department_id}>
                      {dept.department_name}
                    </option>
                  ))}
                </select>
              )}
              {errors.department_id && <p className="text-red-500 text-xs mt-1">{errors.department_id}</p>}
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                Vehicle Model *
              </Label>
              <Input
                value={formData.vehicle_model}
                onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                placeholder="e.g., Toyota Hilux, Mitsubishi L300"
                className={`mt-1.5 ${errors.vehicle_model ? "border-red-500" : ""}`}
              />
              {errors.vehicle_model && <p className="text-red-500 text-xs mt-1">{errors.vehicle_model}</p>}
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Plate Number *
              </Label>
              <Input
                value={formData.plate_number}
                onChange={(e) => setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })}
                placeholder="e.g., ABC-1234"
                className={`mt-1.5 font-mono ${errors.plate_number ? "border-red-500" : ""}`}
              />
              {errors.plate_number && <p className="text-red-500 text-xs mt-1">{errors.plate_number}</p>}
              <p className="text-xs text-slate-400 mt-1">Unique identifier for the vehicle</p>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Fuel className="h-4 w-4" />
                Fuel Type *
              </Label>
              <select
                value={formData.fuel_type}
                onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                className="w-full mt-1.5 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="diesel">Diesel</option>
                <option value="premium">Premium</option>
                <option value="regular">Regular</option>
              </select>
            </div>

            <div>
              <Label>Status</Label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full mt-1.5 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
              <Label className="flex items-center gap-2 cursor-pointer font-medium">
                <Wrench className="h-4 w-4" />
                Under Maintenance
              </Label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, maintenance_flag: !formData.maintenance_flag })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.maintenance_flag ? "bg-red-600" : "bg-slate-300"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.maintenance_flag ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={createVehicle.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {createVehicle.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Register Vehicle
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/admin/vehicles")} className="flex-1">
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddVehicle;
// src/pages/gso/vehicles/EditVehicle.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Car, Truck, Fuel, Building2, Wrench, Loader2 } from "lucide-react";
import { useVehicles, useUpdateVehicle, useDepartmentsForVehicles } from "../../../hooks/useVehicleManagement";
import { toast } from "react-hot-toast";

const EditVehicle = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: departments = [] } = useDepartmentsForVehicles();
  const updateVehicle = useUpdateVehicle();
  const [formData, setFormData] = useState({
    department_id: "",
    vehicle_model: "",
    plate_number: "",
    fuel_type: "diesel",
    status: "active",
    odometer_status: "functional",
    maintenance_flag: false,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (vehicles.length > 0) {
      const vehicle = vehicles.find((v) => v.vehicle_id === parseInt(id));
      if (vehicle) {
        setFormData({
          department_id: vehicle.department_id,
          vehicle_model: vehicle.vehicle_model,
          plate_number: vehicle.plate_number,
          fuel_type: vehicle.fuel_type,
          status: vehicle.status,
          odometer_status: vehicle.odometer_status,
          maintenance_flag: vehicle.maintenance_flag,
        });
      }
    }
  }, [vehicles, id]);

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

    updateVehicle.mutate(
      {
        vehicleId: parseInt(id),
        vehicleData: {
          department_id: parseInt(formData.department_id),
          vehicle_model: formData.vehicle_model.trim(),
          plate_number: formData.plate_number.trim().toUpperCase(),
          fuel_type: formData.fuel_type,
          status: formData.status,
          odometer_status: formData.odometer_status,
          maintenance_flag: formData.maintenance_flag,
        },
      },
      {
        onSuccess: () => {
          toast.success("Vehicle updated!");
          navigate("/admin/vehicles");
        },
        onError: () => toast.error("Failed to update vehicle"),
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
    <div className="max-w-10xl mx-auto">
      <Button variant="ghost" onClick={() => navigate("/admin/vehicles")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Vehicles
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Edit Vehicle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Department *
              </Label>
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
                className={`mt-1.5 font-mono ${errors.plate_number ? "border-red-500" : ""}`}
              />
              {errors.plate_number && <p className="text-red-500 text-xs mt-1">{errors.plate_number}</p>}
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

            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <Label>Odometer</Label>
                <select
                  value={formData.odometer_status}
                  onChange={(e) => setFormData({ ...formData, odometer_status: e.target.value })}
                  className="w-full mt-1.5 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="functional">Functional</option>
                  <option value="non_functional">Non-Functional</option>
                </select>
              </div>
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
              <Button type="submit" disabled={updateVehicle.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {updateVehicle.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Update Vehicle
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

export default EditVehicle;
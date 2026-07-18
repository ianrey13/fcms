// src/pages/gso/users/EditUser.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Edit, Building2, Mail, Loader2, IdCard, Car } from "lucide-react";
import { useUsers, useUpdateUser, useDepartments } from "../../../hooks/useUserManagement";
import { toast } from "react-hot-toast";

const EditUser = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: users = [], isLoading } = useUsers();
  const { data: departments = [] } = useDepartments();
  const updateUser = useUpdateUser();
  const [formData, setFormData] = useState({
    email: "",
    employee_number: "", // ✅ Added
    first_name: "",
    last_name: "",
    middle_name: "",
    department_id: "",
    role: "",
    can_drive: false, // ✅ Added
    password: "",
    password_confirmation: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (users.length > 0) {
      const user = users.find((u) => u.user_id === parseInt(id));
      if (user) {
        setFormData({
          email: user.email,
          employee_number: user.employee_number || "", // ✅ Added
          first_name: user.first_name,
          last_name: user.last_name,
          middle_name: user.middle_name || "",
          department_id: user.department_id,
          role: user.role,
          can_drive: user.can_drive || false, // ✅ Added
          password: "",
          password_confirmation: "",
        });
      }
    }
  }, [users, id]);

  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.first_name) newErrors.first_name = "First name is required";
    if (!formData.last_name) newErrors.last_name = "Last name is required";
    if (!formData.department_id) newErrors.department_id = "Department is required";
    if (!formData.role) newErrors.role = "Role is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const updateData = { ...formData };
    if (!updateData.password) {
      delete updateData.password;
      delete updateData.password_confirmation;
    }

    updateUser.mutate(
      { userId: parseInt(id), userData: updateData },
      {
        onSuccess: () => {
          toast.success("User updated!");
          navigate("/admin/users");
        },
        onError: () => toast.error("Failed to update user"),
      }
    );
  };

  // ✅ Show can_drive only for staff or driver roles
  const showCanDrive = formData.role === "staff" || formData.role === "driver";

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Button variant="ghost" onClick={() => navigate("/admin/users")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Users
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email *
                </Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`mt-1.5 ${errors.email ? "border-red-500" : ""}`}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <IdCard className="h-4 w-4" />
                  Employee Number
                </Label>
                <Input
                  placeholder="EMP-0001"
                  value={formData.employee_number}
                  onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className={`mt-1.5 ${errors.first_name ? "border-red-500" : ""}`}
                />
                {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className={`mt-1.5 ${errors.last_name ? "border-red-500" : ""}`}
                />
                {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
              </div>
            </div>

            <div>
              <Label>Middle Name</Label>
              <Input
                value={formData.middle_name}
                onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                className="mt-1.5"
              />
            </div>

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
              <Label>Role *</Label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className={`w-full mt-1.5 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.role ? "border-red-500" : ""}`}
              >
                <option value="">Select Role</option>
                <option value="gso_office">GSO Office</option>
                <option value="mayors_office">Mayor's Office</option>
                <option value="driver">Driver</option>
              </select>
              {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
            </div>

            {/* ✅ Added can_drive toggle */}
            {showCanDrive && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <Car className="h-5 w-5 text-blue-600" />
                <div className="flex items-center gap-3">
                  <Label className="cursor-pointer">Can Drive?</Label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, can_drive: !formData.can_drive })}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      formData.can_drive ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                        formData.can_drive ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.can_drive ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            )}

            <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl">
              <p className="text-sm text-amber-800 dark:text-amber-400">Leave password blank to keep current password</p>
            </div>

            <div>
              <Label>New Password (Optional)</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={formData.password_confirmation}
                onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={updateUser.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {updateUser.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Update User
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/admin/users")} className="flex-1">
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditUser;
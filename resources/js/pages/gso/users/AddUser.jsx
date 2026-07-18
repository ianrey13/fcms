// src/pages/gso/users/AddUser.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserPlus, Building2, Mail, Loader2 } from "lucide-react";
import { useCreateUser } from "../../../hooks/useUserManagement";
import { adminDepartmentAPI } from "../../../services/api";
import { toast } from "react-hot-toast";

const AddUser = () => {
  const navigate = useNavigate();
  const createUser = useCreateUser();
  const [departments, setDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    middle_name: "",
    department_id: "",
    role: "",
    password: "",
    password_confirmation: "",
  });
  const [errors, setErrors] = useState({});

  // ✅ Fetch departments from Admin API
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setLoadingDepartments(true);
        const response = await adminDepartmentAPI.getSelector();
        setDepartments(response.data.data || []);
      } catch (error) {
        console.error("Error fetching departments:", error);
        toast.error("Failed to load departments");
      } finally {
        setLoadingDepartments(false);
      }
    };
    fetchDepartments();
  }, []);

  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.first_name) newErrors.first_name = "First name is required";
    if (!formData.last_name) newErrors.last_name = "Last name is required";
    if (!formData.department_id) newErrors.department_id = "Department is required";
    if (!formData.role) newErrors.role = "Role is required";
    if (!formData.password) newErrors.password = "Password is required";
    if (formData.password !== formData.password_confirmation) {
      newErrors.password_confirmation = "Passwords do not match";
    }
    if (formData.password && formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    createUser.mutate(formData, {
      onSuccess: () => {
        toast.success("User created!");
        navigate("/admin/users");
      },
      onError: (error) => {
        console.error("Create user error:", error);
        toast.error(error.response?.data?.message || "Failed to create user");
      },
    });
  };

  return (
    <div className="max-w-10xl mx-auto">
      <Button variant="ghost" onClick={() => navigate("/admin/users")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Users
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add New User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email *
              </Label>
              <Input
                name="email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`mt-1.5 ${errors.email ? "border-red-500" : ""}`}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input
                  name="first_name"
                  placeholder="First name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className={`mt-1.5 ${errors.first_name ? "border-red-500" : ""}`}
                />
                {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input
                  name="last_name"
                  placeholder="Last name"
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
                name="middle_name"
                placeholder="Middle name (optional)"
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
              {loadingDepartments ? (
                <div className="flex items-center gap-2 mt-1.5 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading departments...
                </div>
              ) : (
                <select
                  name="department_id"
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
              <Label>Role *</Label>
              <select
                name="role"
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

            <div>
              <Label>Password *</Label>
              <Input
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`mt-1.5 ${errors.password ? "border-red-500" : ""}`}
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <div>
              <Label>Confirm Password *</Label>
              <Input
                name="password_confirmation"
                type="password"
                placeholder="••••••••"
                value={formData.password_confirmation}
                onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                className={`mt-1.5 ${errors.password_confirmation ? "border-red-500" : ""}`}
              />
              {errors.password_confirmation && <p className="text-red-500 text-xs mt-1">{errors.password_confirmation}</p>}
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={createUser.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create User
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

export default AddUser;
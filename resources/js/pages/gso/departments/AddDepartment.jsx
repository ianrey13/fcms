// src/pages/mayor/departments/AddDepartment.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Building2, Code, Loader2 } from "lucide-react";
import { useCreateDepartment } from "../../../hooks/useDepartmentManagement";
import { toast } from "react-hot-toast";

const AddDepartment = () => {
  const navigate = useNavigate();
  const createDepartment = useCreateDepartment();
  const [formData, setFormData] = useState({
    department_name: "",
    department_code: "",
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.department_name.trim()) {
      newErrors.department_name = "Department name is required";
    }
    if (!formData.department_code.trim()) {
      newErrors.department_code = "Department code is required";
    }
    if (formData.department_code.trim() && formData.department_code.length > 20) {
      newErrors.department_code = "Code must be 20 characters or less";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    createDepartment.mutate(
      {
        department_name: formData.department_name.trim(),
        department_code: formData.department_code.trim().toUpperCase(),
      },
      {
        onSuccess: () => {
          toast.success("Department created successfully!");
          navigate("/admin/departments"); // ✅ Correct path
        },
        onError: (error) => {
          const message = error.response?.data?.message || "Failed to create department";
          toast.error(message);
        },
      }
    );
  };

  return (
    <div className="max-w-10xl mx-auto p-6">
      <Button 
        variant="ghost" 
        onClick={() => navigate("/mo/departments")} 
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Departments
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Add New Department
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Department Code *
              </Label>
              <Input
                placeholder="e.g., ENGR"
                value={formData.department_code}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  department_code: e.target.value.toUpperCase() 
                })}
                className={`mt-1.5 font-mono uppercase ${errors.department_code ? "border-red-500" : ""}`}
                maxLength={20}
              />
              {errors.department_code && (
                <p className="text-red-500 text-xs mt-1">{errors.department_code}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Short, unique identifier (max 20 characters)</p>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Department Name *
              </Label>
              <Input
                placeholder="e.g., Engineering Office"
                value={formData.department_name}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  department_name: e.target.value 
                })}
                className={`mt-1.5 ${errors.department_name ? "border-red-500" : ""}`}
              />
              {errors.department_name && (
                <p className="text-red-500 text-xs mt-1">{errors.department_name}</p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="submit" 
                disabled={createDepartment.isPending} 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {createDepartment.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Create Department
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/mo/departments")} 
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddDepartment;
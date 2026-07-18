// src/pages/mayor/departments/DepartmentManagement.jsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { useDepartments, useDeleteDepartment, useToggleDepartmentStatus } from "../../../hooks/useDepartmentManagement";
import { toast } from "react-hot-toast";

const DepartmentManagement = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: departments = [], isLoading, refetch } = useDepartments();
  const deleteDepartment = useDeleteDepartment();
  const toggleStatus = useToggleDepartmentStatus();

  const filteredDepartments = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return departments.filter((dept) =>
      dept.department_name?.toLowerCase().includes(search) ||
      dept.department_code?.toLowerCase().includes(search)
    );
  }, [departments, searchTerm]);

  const handleToggleStatus = (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    const action = newStatus === "active" ? "activate" : "deactivate";
    
    if (window.confirm(`Are you sure you want to ${action} this department?`)) {
      toggleStatus.mutate(
        { id, status: newStatus },
        {
          onSuccess: () => toast.success(`Department ${action}d successfully!`),
          onError: () => toast.error(`Failed to ${action} department`),
        }
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const handleAddClick = () => {
    navigate("/admin/departments/add");
  };

  const handleEditClick = (id) => {
    navigate(`/admin/departments/edit/${id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Department Management</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage system departments</p>
        </div>
        <Button onClick={handleAddClick} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Department
        </Button>
      </div>

      {/* Search and Refresh */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search departments by name or code..."
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

      {/* Table Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Departments ({filteredDepartments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDepartments.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No departments found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Department Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredDepartments.map((dept) => (
                    <tr key={dept.department_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Code className="h-4 w-4 text-slate-400" />
                          <span className="font-mono font-bold text-sm">{dept.department_code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          <span className="font-medium">{dept.department_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(dept.department_id, dept.is_active ? "active" : "inactive")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                            dept.is_active
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-red-100 text-red-700 hover:bg-red-200"
                          }`}
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
                            className="text-blue-600 hover:bg-blue-50 h-8 w-8 p-0"
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
    </div>
  );
};

export default DepartmentManagement;
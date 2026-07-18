// src/pages/gso/users/UserManagement.jsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  BadgeCheck, // ✅ Added
  IdCard, // ✅ Added for employee number
} from "lucide-react";
import { useUsers, useDeleteUser, useToggleUserStatus } from "../../../hooks/useUserManagement";
import { toast } from "react-hot-toast";

const UserManagement = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: users = [], isLoading, refetch } = useUsers();
  const deleteUser = useDeleteUser();
  const toggleStatus = useToggleUserStatus();

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const search = searchTerm.toLowerCase();
      return (
        user.email?.toLowerCase().includes(search) ||
        user.first_name?.toLowerCase().includes(search) ||
        user.last_name?.toLowerCase().includes(search) ||
        user.employee_number?.toLowerCase().includes(search) || // ✅ Added
        user.department_name?.toLowerCase().includes(search)
      );
    });
  }, [users, searchTerm]);

  const getRoleBadgeColor = (role) => {
    const colors = {
      gso_office: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      mayors_office: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      staff: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      driver: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  const getRoleLabel = (role) => {
    const labels = {
      gso_office: "GSO Office",
      mayors_office: "Mayor's Office",
      staff: "Staff",
      driver: "Driver",
    };
    return labels[role] || role;
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to deactivate "${name}"?`)) {
      deleteUser.mutate(id, {
        onSuccess: () => toast.success("User deactivated!"),
        onError: () => toast.error("Failed to deactivate user"),
      });
    }
  };

  const handleToggleStatus = (userId, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    toggleStatus.mutate(
      { userId, status: newStatus },
      {
        onSuccess: () => toast.success(`User ${newStatus === "active" ? "activated" : "deactivated"}!`),
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">User Management</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage system users, roles, and permissions</p>
        </div>
        <Button onClick={() => navigate("/admin/users/add")} className="bg-blue-600 hover:bg-blue-700">
          <UserPlus className="h-4 w-4 mr-2" />
          Add New User
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, email, employee number..."
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
            <Users className="h-5 w-5" />
            Users ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Employee #</th> {/* ✅ Added */}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredUsers.map((user) => (
                    <tr key={user.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                            </span>
                          </div>
                          <span className="font-semibold">{user.first_name} {user.last_name}</span>
                          {user.can_drive && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                              🚗
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono">{user.employee_number || "N/A"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span className="text-sm">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          <span className="text-sm">{user.department_name || "N/A"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(user.user_id, user.status)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                            user.status === "active"
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                          }`}
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
                            className="text-blue-600 hover:bg-blue-50 h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {user.user_id !== currentUser?.user_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(user.user_id, `${user.first_name} ${user.last_name}`)}
                              className="text-red-600 hover:bg-red-50 h-8 w-8 p-0"
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
    </div>
  );
};

export default UserManagement;
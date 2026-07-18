// src/components/DynamicRedirect.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const DynamicRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // ✅ Map roles to their dashboards
  const roleRedirects = {
    gso_office: '/gso/dashboard',
    mayors_office: '/mo/dashboard',
    staff: '/staff/dashboard',
    driver: '/driver/dashboard',
    // Backward compatibility for old roles
    superadmin: '/gso/dashboard',
    gso_staff: '/gso/dashboard',
    dept_office: '/staff/dashboard',
    head_of_office: '/staff/dashboard',
  };

  const redirectPath = roleRedirects[user?.role] || '/unauthorized';
  return <Navigate to={redirectPath} replace />;
};

export default DynamicRedirect;
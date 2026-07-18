// src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// ✅ Updated Role Constants for 4-Role System
export const USER_ROLES = {
  GSO_OFFICE: 'gso_office',      // Superadmin equivalent
  MAYORS_OFFICE: 'mayors_office',
  DRIVER: 'driver',
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('fcms_token'));

  useEffect(() => {
    // Check if user is logged in on mount
    const storedUser = localStorage.getItem('fcms_user');
    const storedToken = localStorage.getItem('fcms_token');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log('Loaded user:', parsedUser);
        console.log('User role:', parsedUser?.role);
        setUser(parsedUser);
      } catch (e) {
        console.error('Failed to parse stored user:', e);
        localStorage.removeItem('fcms_token');
        localStorage.removeItem('fcms_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password, 'web');
      
      console.log('Login response:', response.data);
      
      if (response.data && response.data.success && response.data.data) {
        const { user: userData, token: accessToken, token_type } = response.data.data;
        
        console.log('User role from API:', userData?.role);
        
        // Format token
        let fullToken = accessToken;
        if (token_type === 'Bearer' && !accessToken.startsWith('Bearer ')) {
          fullToken = `Bearer ${accessToken}`;
        } else if (!accessToken.startsWith('Bearer ') && !accessToken.startsWith('bearer ')) {
          fullToken = `Bearer ${accessToken}`;
        }
        
        localStorage.setItem('fcms_token', fullToken);
        localStorage.setItem('fcms_user', JSON.stringify(userData));
        
        setToken(fullToken);
        setUser(userData);
        
        return { success: true, user: userData };
      } else {
        console.error('Unexpected response structure:', response.data);
        return { 
          success: false, 
          message: response.data?.message || 'Invalid response from server' 
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed. Please check your credentials.'
      };
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await authAPI.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('fcms_token');
      localStorage.removeItem('fcms_user');
      setToken(null);
      setUser(null);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await authAPI.changePassword(currentPassword, newPassword);
      return { success: true, message: response.data?.message || 'Password changed successfully' };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to change password'
      };
    }
  };

  // ✅ Updated getDashboardRoute for new roles
  const getDashboardRoute = () => {
    if (!user) return '/login';
    switch (user.role) {
      case USER_ROLES.GSO_OFFICE:
        return '/gso/dashboard';
      case USER_ROLES.MAYORS_OFFICE:
        return '/mo/dashboard';
  
      case USER_ROLES.DRIVER:
        return '/driver/dashboard';
      default:
        return '/dashboard';
    }
  };

  // ✅ Updated role check helpers
  const value = {
    user,
    token,
    loading,
    login,
    logout,
    changePassword,
    getDashboardRoute,
    isAuthenticated: !!user,
    // Role check helpers
    isGsoOffice: user?.role === USER_ROLES.GSO_OFFICE,
    isMayorsOffice: user?.role === USER_ROLES.MAYORS_OFFICE,
    isDriver: user?.role === USER_ROLES.DRIVER,
    // Additional helpers
    hasRole: (role) => user?.role === role,
    hasAnyRole: (roles) => roles.includes(user?.role),
    // ✅ Backward compatibility (for old code)
    isSuperAdmin: user?.role === USER_ROLES.GSO_OFFICE,
    isGsoStaff: user?.role === USER_ROLES.GSO_OFFICE,
    isDeptOffice: user?.role === USER_ROLES.DRIVER,
    isHeadOfOffice: false, // Removed
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
// src/pages/Profile.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Key, Save, Loader2, ArrowLeft, Mail, Building2 } from "lucide-react";
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
    const { user } = useAuth(); 
    const navigate = useNavigate();
    
    const [isLoading, setIsLoading] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // State para sa Basic Info
    const [formData, setFormData] = useState({
        first_name: user?.first_name || '',
        middle_name: user?.middle_name || '',
        last_name: user?.last_name || '',
        email: user?.email || '',
    });

    // State para sa Password
    const [passwordData, setPasswordData] = useState({
        current_password: '',
        new_password: '',
        confirm_password: '',
    });

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePasswordChange = (e) => {
        setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await authAPI.updateProfile(formData); 
            toast.success('Profile updated successfully!');
            
            // I-reload ang page para makita ang bag-ong ngalan sa header
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update profile');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwordData.new_password !== passwordData.confirm_password) {
            return toast.error("New passwords don't match");
        }
        
        setIsChangingPassword(true);
        try {
            await authAPI.changePassword(passwordData.current_password, passwordData.new_password);
            toast.success('Password changed successfully!');
            setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to change password');
        } finally {
            setIsChangingPassword(false);
        }
    };

    const getInitials = () => {
        return `${user?.first_name?.charAt(0) || ''}${user?.last_name?.charAt(0) || ''}`.toUpperCase() || 'U';
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800">
                    <ArrowLeft className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Profile</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage your personal information and security settings.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Profile Card */}
                <Card className="md:col-span-1 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-lg h-fit">
                    <CardContent className="pt-8 flex flex-col items-center text-center">
                        <div className="h-28 w-28 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-4xl font-bold shadow-xl shadow-blue-500/20 mb-5 ring-4 ring-white dark:ring-slate-800">
                            {getInitials()}
                        </div>
                        
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                            {user?.first_name} {user?.last_name}
                        </h2>
                        <div className="flex items-center justify-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 mb-4">
                            <Mail className="h-3.5 w-3.5" />
                            {user?.email}
                        </div>
                        
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-none uppercase tracking-wider px-4 py-1.5 text-xs">
                            <Shield className="h-3.5 w-3.5 mr-1.5" /> 
                            {user?.role_label || user?.role}
                        </Badge>

                        <div className="w-full mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-5 text-left">
                            {/* Gi-tangtang ang Employee ID dinhi */}
                            
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500">
                                    <Building2 className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</p>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{user?.department_name || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Right Column: Forms */}
                <div className="md:col-span-2 space-y-6">
                    {/* Basic Info Form */}
                    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-lg">
                        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <User className="h-5 w-5 text-blue-500" /> Personal Information
                            </CardTitle>
                            <CardDescription>Update your account's profile information and email address.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleUpdateProfile} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 dark:text-slate-300">First Name <span className="text-red-500">*</span></Label>
                                        <Input 
                                            name="first_name" 
                                            value={formData.first_name} 
                                            onChange={handleInputChange} 
                                            className="dark:bg-slate-950 dark:border-slate-700 h-11" 
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 dark:text-slate-300">Last Name <span className="text-red-500">*</span></Label>
                                        <Input 
                                            name="last_name" 
                                            value={formData.last_name} 
                                            onChange={handleInputChange} 
                                            className="dark:bg-slate-950 dark:border-slate-700 h-11" 
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 dark:text-slate-300">Middle Name</Label>
                                        <Input 
                                            name="middle_name" 
                                            value={formData.middle_name} 
                                            onChange={handleInputChange} 
                                            className="dark:bg-slate-950 dark:border-slate-700 h-11" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 dark:text-slate-300">Email Address <span className="text-red-500">*</span></Label>
                                        <Input 
                                            name="email" 
                                            type="email" 
                                            value={formData.email} 
                                            onChange={handleInputChange} 
                                            className="dark:bg-slate-950 dark:border-slate-700 h-11" 
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4 mt-2">
                                    <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 h-10 px-6 font-semibold">
                                        {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Change Password Form */}
                    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-lg">
                        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Key className="h-5 w-5 text-amber-500" /> Security & Password
                            </CardTitle>
                            <CardDescription>Ensure your account is using a strong, secure password.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleChangePassword} className="space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-slate-700 dark:text-slate-300">Current Password <span className="text-red-500">*</span></Label>
                                    <Input 
                                        name="current_password" 
                                        type="password" 
                                        value={passwordData.current_password} 
                                        onChange={handlePasswordChange} 
                                        className="dark:bg-slate-950 dark:border-slate-700 h-11" 
                                        required 
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 dark:text-slate-300">New Password <span className="text-red-500">*</span></Label>
                                        <Input 
                                            name="new_password" 
                                            type="password" 
                                            value={passwordData.new_password} 
                                            onChange={handlePasswordChange} 
                                            className="dark:bg-slate-950 dark:border-slate-700 h-11" 
                                            required 
                                            minLength={8} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 dark:text-slate-300">Confirm Password <span className="text-red-500">*</span></Label>
                                        <Input 
                                            name="confirm_password" 
                                            type="password" 
                                            value={passwordData.confirm_password} 
                                            onChange={handlePasswordChange} 
                                            className="dark:bg-slate-950 dark:border-slate-700 h-11" 
                                            required 
                                            minLength={8} 
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4 mt-2">
                                    <Button type="submit" disabled={isChangingPassword} className="bg-amber-600 hover:bg-amber-700 text-white h-10 px-6 font-semibold">
                                        {isChangingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
                                        Update Password
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Profile;
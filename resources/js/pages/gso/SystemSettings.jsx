// src/pages/admin/SystemSettings.jsx
// ============================================
// ENHANCED: Improved validation with field highlighting
// No duplicate toasts - single toast with all errors
// Auto-focus first error field
// AUTO-REFRESH: Removed manual refresh button
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from "@tanstack/react-query";
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useRealtime } from '../../contexts/RealtimeContext';
import { useOptimizedQuery } from '../../hooks/useOptimizedQuery';
import {
    SkeletonPage,
    SkeletonCard,
    SkeletonText,
    SkeletonTitle,
} from '../../components/ui/SkeletonCard';
import { settingsAPI } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Settings,
    Save,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    User,
    Fuel,
    MapPin,
    Gauge,
    Clock,
    AlertTriangle,
    Wifi,
    Building2,
    Mail,
    Phone,
    Globe,
    Bell,
    DollarSign,
    Shield,
    Truck,
    Calendar,
    Zap,
    Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

// ============================================
// ✅ ENHANCED: Form Field with error highlighting
// ============================================

const FormField = ({
    label,
    icon: Icon,
    required,
    error,
    touched,
    helper,
    children,
    className,
}) => {
    const hasError = touched && error;
    
    return (
        <div className={cn("space-y-1.5", className)}>
            <Label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                {Icon && <Icon className="h-4 w-4 text-slate-400" />}
                {label}
                {required && <span className="text-red-500">*</span>}
            </Label>
            <div className="relative">
                {React.cloneElement(children, {
                    className: cn(
                        children.props.className,
                        hasError && "border-red-500 ring-red-500 focus:ring-red-500 bg-red-50/50 dark:bg-red-950/10"
                    )
                })}
                {hasError && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
                    </div>
                )}
            </div>
            {hasError && (
                <p className="text-red-500 text-xs flex items-center gap-1 mt-1 animate-fadeIn">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    {error}
                </p>
            )}
            {helper && !hasError && (
                <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1">
                    <Info className="h-3 w-3" />
                    {helper}
                </p>
            )}
        </div>
    );
};

const SystemSettings = () => {
    const queryClient = useQueryClient();
    const { isConnected } = useRealtime();
    const toastIdRef = useRef(null);
    const [settings, setSettings] = useState({});
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [activeTab, setActiveTab] = useState('general');
    
    // ✅ Validation states
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});

    // ============================================
    // ✅ AUTO-REFRESH - No manual refresh needed
    // ============================================

    useAutoRefresh(
        [
            "new-notification",
        ],
        () => {
            queryClient.invalidateQueries({ queryKey: ['system-settings'] });
        }
    );

    // ============================================
    // OPTIMIZED QUERY
    // ============================================

    const {
        data: settingsData,
        isLoading,
        refetch,
        isFetching,
    } = useOptimizedQuery({
        queryKey: ['system-settings'],
        queryFn: async () => {
            try {
                const response = await settingsAPI.getAll();
                return response.data?.data || response.data || {};
            } catch (error) {
                console.error('Failed to fetch settings:', error);
                toast.error(error.response?.data?.message || 'Failed to load settings');
                return {};
            }
        },
        staleTime: 5 * 60 * 1000,
        keepPreviousData: true,
    });

    useEffect(() => {
        if (settingsData && Object.keys(settingsData).length > 0) {
            setSettings(settingsData);
            setErrors({});
            setTouched({});
        }
    }, [settingsData]);

    // ============================================
    // ✅ ENHANCED VALIDATION
    // ============================================

    const validateSettings = () => {
        const newErrors = {};
        const newTouched = {};

        // GPS Ping Interval validation
        const pingInterval = parseInt(settings.gps_ping_interval_seconds);
        if (isNaN(pingInterval) || pingInterval < 5) {
            newErrors.gps_ping_interval_seconds = "GPS ping interval must be at least 5 seconds";
            newTouched.gps_ping_interval_seconds = true;
        } else if (pingInterval > 120) {
            newErrors.gps_ping_interval_seconds = "GPS ping interval cannot exceed 120 seconds";
            newTouched.gps_ping_interval_seconds = true;
        }

        // GPS Accuracy Threshold validation
        const accuracyThreshold = parseInt(settings.gps_accuracy_threshold_meters);
        if (isNaN(accuracyThreshold) || accuracyThreshold < 10) {
            newErrors.gps_accuracy_threshold_meters = "Accuracy threshold must be at least 10 meters";
            newTouched.gps_accuracy_threshold_meters = true;
        } else if (accuracyThreshold > 200) {
            newErrors.gps_accuracy_threshold_meters = "Accuracy threshold cannot exceed 200 meters";
            newTouched.gps_accuracy_threshold_meters = true;
        }

        // Minimum GPS Pings validation
        const minPings = parseInt(settings.minimum_gps_pings_threshold);
        if (isNaN(minPings) || minPings < 2) {
            newErrors.minimum_gps_pings_threshold = "Minimum GPS pings must be at least 2";
            newTouched.minimum_gps_pings_threshold = true;
        } else if (minPings > 50) {
            newErrors.minimum_gps_pings_threshold = "Minimum GPS pings cannot exceed 50";
            newTouched.minimum_gps_pings_threshold = true;
        }

        // GPS vs Odometer Tolerance validation
        const tolerance = parseInt(settings.gps_distance_odometer_tolerance_pct);
        if (isNaN(tolerance) || tolerance < 5) {
            newErrors.gps_distance_odometer_tolerance_pct = "Tolerance must be at least 5%";
            newTouched.gps_distance_odometer_tolerance_pct = true;
        } else if (tolerance > 50) {
            newErrors.gps_distance_odometer_tolerance_pct = "Tolerance cannot exceed 50%";
            newTouched.gps_distance_odometer_tolerance_pct = true;
        }

        // Max Trip Duration validation
        const maxDuration = parseInt(settings.max_trip_duration_hours);
        if (isNaN(maxDuration) || maxDuration < 1) {
            newErrors.max_trip_duration_hours = "Max trip duration must be at least 1 hour";
            newTouched.max_trip_duration_hours = true;
        } else if (maxDuration > 72) {
            newErrors.max_trip_duration_hours = "Max trip duration cannot exceed 72 hours";
            newTouched.max_trip_duration_hours = true;
        }

        // Max Idle Time validation
        const maxIdle = parseInt(settings.max_idle_minutes);
        if (isNaN(maxIdle) || maxIdle < 5) {
            newErrors.max_idle_minutes = "Max idle time must be at least 5 minutes";
            newTouched.max_idle_minutes = true;
        } else if (maxIdle > 120) {
            newErrors.max_idle_minutes = "Max idle time cannot exceed 120 minutes";
            newTouched.max_idle_minutes = true;
        }

        // Notification Retention validation
        const retention = parseInt(settings.notification_retention_days);
        if (isNaN(retention) || retention < 7) {
            newErrors.notification_retention_days = "Notification retention must be at least 7 days";
            newTouched.notification_retention_days = true;
        } else if (retention > 365) {
            newErrors.notification_retention_days = "Notification retention cannot exceed 365 days";
            newTouched.notification_retention_days = true;
        }

        // Fuel Prices validation (must be > 0)
        const dieselPrice = parseFloat(settings.diesel_price_per_liter);
        if (dieselPrice !== undefined && !isNaN(dieselPrice) && dieselPrice < 0) {
            newErrors.diesel_price_per_liter = "Diesel price cannot be negative";
            newTouched.diesel_price_per_liter = true;
        }

        const premiumPrice = parseFloat(settings.premium_price_per_liter);
        if (premiumPrice !== undefined && !isNaN(premiumPrice) && premiumPrice < 0) {
            newErrors.premium_price_per_liter = "Premium price cannot be negative";
            newTouched.premium_price_per_liter = true;
        }

        const regularPrice = parseFloat(settings.regular_price_per_liter);
        if (regularPrice !== undefined && !isNaN(regularPrice) && regularPrice < 0) {
            newErrors.regular_price_per_liter = "Regular price cannot be negative";
            newTouched.regular_price_per_liter = true;
        }

        // Email validation (optional)
        if (settings.mayor_office_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.mayor_office_email)) {
            newErrors.mayor_office_email = "Please enter a valid email address";
            newTouched.mayor_office_email = true;
        }

        if (settings.gso_office_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.gso_office_email)) {
            newErrors.gso_office_email = "Please enter a valid email address";
            newTouched.gso_office_email = true;
        }

        setErrors(newErrors);
        setTouched(prev => ({ ...prev, ...newTouched }));

        // ✅ Show single toast with all errors
        if (Object.keys(newErrors).length > 0) {
            const errorMessages = Object.entries(newErrors).map(([field, msg]) => {
                const labels = {
                    gps_ping_interval_seconds: 'GPS Ping Interval',
                    gps_accuracy_threshold_meters: 'GPS Accuracy Threshold',
                    minimum_gps_pings_threshold: 'Minimum GPS Pings',
                    gps_distance_odometer_tolerance_pct: 'GPS vs Odometer Tolerance',
                    max_trip_duration_hours: 'Max Trip Duration',
                    max_idle_minutes: 'Max Idle Time',
                    notification_retention_days: 'Notification Retention',
                    diesel_price_per_liter: 'Diesel Price',
                    premium_price_per_liter: 'Premium Price',
                    regular_price_per_liter: 'Regular Price',
                    mayor_office_email: 'Mayor\'s Office Email',
                    gso_office_email: 'GSO Office Email'
                };
                const label = labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return `• ${label}: ${msg}`;
            });

            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.error(
                <div className="space-y-1">
                    <div className="font-semibold text-red-600 dark:text-red-400">Please fix the following errors:</div>
                    <div className="text-sm text-red-500 dark:text-red-300 space-y-0.5">
                        {errorMessages.map((msg, i) => (
                            <div key={i}>{msg}</div>
                        ))}
                    </div>
                </div>,
                { duration: 5000 }
            );

            const firstField = Object.keys(newErrors)[0];
            if (firstField) {
                const element = document.querySelector(`[name="${firstField}"]`) || 
                                document.getElementById(firstField);
                if (element) {
                    setTimeout(() => element.focus(), 100);
                }
            }
            return false;
        }
        return true;
    };

    // ============================================
    // HANDLERS
    // ============================================

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
        // Clear error for this field
        if (errors[key]) {
            setErrors(prev => ({ ...prev, [key]: "" }));
        }
    };

    const handleBlur = (field) => {
        setTouched(prev => ({ ...prev, [field]: true }));
    };

    const hasError = (field) => touched[field] && errors[field];

    const handleSave = async () => {
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        
        // ✅ Run validation
        if (!validateSettings()) {
            return;
        }

        setSaving(true);
        setSuccessMessage('');
        setErrorMessage('');

        try {
            const updates = Object.entries(settings).map(([key, value]) =>
                settingsAPI.update(key, value)
            );
            await Promise.all(updates);
            
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.success('All settings saved successfully');
            setSuccessMessage('All settings saved successfully');
            setTimeout(() => setSuccessMessage(''), 3000);
            setErrors({});
            setTouched({});
        } catch (error) {
            const msg = error.response?.data?.message || 'Failed to save settings';
            if (toastIdRef.current) toast.dismiss(toastIdRef.current);
            toastIdRef.current = toast.error(msg);
            setErrorMessage(msg);
            setTimeout(() => setErrorMessage(''), 3000);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        refetch();
        setSuccessMessage('Settings reset to saved values');
        toastIdRef.current = toast.success('Settings refreshed');
        setErrors({});
        setTouched({});
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    // Connection status
    const connectionStatus = isConnected ? "🟢 Live" : "🔴 Offline";
    const isRealTime = isConnected;

    const tabs = [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'gps', label: 'GPS Configuration', icon: MapPin },
        { id: 'stations', label: 'Fuel Stations', icon: Fuel },
        { id: 'notifications', label: 'Notifications', icon: Bell },
    ];

    // ============================================
    // LOADING STATE
    // ============================================

    if (isLoading) {
        return (
            <div className="space-y-6 p-4 md:p-6 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                <SkeletonPage />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[1, 2].map((i) => (
                        <SkeletonCard key={i} className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <SkeletonCard className="w-8 h-8 rounded-xl" />
                                <SkeletonTitle width="w-32" className="h-5" />
                            </div>
                            <div className="space-y-4">
                                {[1, 2, 3].map((j) => (
                                    <div key={j}>
                                        <SkeletonText width="w-24" className="h-3" />
                                        <SkeletonCard className="h-10 mt-1" />
                                    </div>
                                ))}
                            </div>
                        </SkeletonCard>
                    ))}
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="space-y-6 p-4 md:p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 min-h-screen">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                        System Settings
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Configure system parameters and preferences
                        <span className="ml-2 text-xs opacity-70">{connectionStatus}</span>
                        {isRealTime && (
                            <span className="ml-2 text-xs text-emerald-400 animate-pulse">
                                ● Auto-refresh
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={isFetching}
                        className="flex items-center gap-2 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                        Reset
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span className="ml-2">Saving...</span>
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Success/Error Messages */}
            {successMessage && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in">
                    <CheckCircle className="h-5 w-5" />
                    {successMessage}
                </div>
            )}
            {errorMessage && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in">
                    <AlertCircle className="h-5 w-5" />
                    {errorMessage}
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="flex space-x-8 overflow-x-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    setErrors({});
                                    setTouched({});
                                }}
                                className={`
                                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 whitespace-nowrap
                                    ${activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:border-slate-300'
                                    }
                                `}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* General Settings Tab */}
            {activeTab === 'general' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Mayor Information */}
                    <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                        <CardHeader className="border-b dark:border-slate-700">
                            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                                    <User className="h-4 w-4 text-white" />
                                </div>
                                Mayor's Office Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <FormField
                                label="Mayor's Name"
                                icon={User}
                            >
                                <Input
                                    id="mayor_name"
                                    name="mayor_name"
                                    value={settings.mayor_name || ''}
                                    onChange={(e) => handleSettingChange('mayor_name', e.target.value)}
                                    onBlur={() => handleBlur('mayor_name')}
                                    placeholder="e.g., Hon. Juan Dela Cruz"
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>
                            <FormField
                                label="Mayor's Office Phone"
                                icon={Phone}
                            >
                                <Input
                                    id="mayor_office_phone"
                                    name="mayor_office_phone"
                                    value={settings.mayor_office_phone || ''}
                                    onChange={(e) => handleSettingChange('mayor_office_phone', e.target.value)}
                                    onBlur={() => handleBlur('mayor_office_phone')}
                                    placeholder="e.g., (02) 8123-4567"
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>
                            <FormField
                                label="Mayor's Office Email"
                                icon={Mail}
                                error={hasError('mayor_office_email') && errors.mayor_office_email}
                                touched={touched.mayor_office_email}
                            >
                                <Input
                                    id="mayor_office_email"
                                    name="mayor_office_email"
                                    type="email"
                                    value={settings.mayor_office_email || ''}
                                    onChange={(e) => handleSettingChange('mayor_office_email', e.target.value)}
                                    onBlur={() => handleBlur('mayor_office_email')}
                                    placeholder="e.g., mayor@fcms.gov.ph"
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>
                        </CardContent>
                    </Card>

                    {/* System Information */}
                    <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                        <CardHeader className="border-b dark:border-slate-700">
                            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                                    <Globe className="h-4 w-4 text-white" />
                                </div>
                                System Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <FormField
                                label="System Name"
                                icon={Settings}
                            >
                                <Input
                                    id="system_name"
                                    name="system_name"
                                    value={settings.system_name || 'FCMS'}
                                    onChange={(e) => handleSettingChange('system_name', e.target.value)}
                                    onBlur={() => handleBlur('system_name')}
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>
                            <div>
                                <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">Timezone</Label>
                                <select
                                    id="system_timezone"
                                    name="system_timezone"
                                    value={settings.system_timezone || 'Asia/Manila'}
                                    onChange={(e) => handleSettingChange('system_timezone', e.target.value)}
                                    onBlur={() => handleBlur('system_timezone')}
                                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                >
                                    <option value="Asia/Manila">Asia/Manila (GMT+8)</option>
                                    <option value="UTC">UTC</option>
                                    <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
                                    <option value="Australia/Sydney">Australia/Sydney (GMT+10)</option>
                                </select>
                            </div>
                            <div>
                                <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">Date Format</Label>
                                <select
                                    id="date_format"
                                    name="date_format"
                                    value={settings.date_format || 'Y-m-d'}
                                    onChange={(e) => handleSettingChange('date_format', e.target.value)}
                                    onBlur={() => handleBlur('date_format')}
                                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                >
                                    <option value="Y-m-d">YYYY-MM-DD</option>
                                    <option value="m/d/Y">MM/DD/YYYY</option>
                                    <option value="d/m/Y">DD/MM/YYYY</option>
                                    <option value="F j, Y">Month DD, YYYY</option>
                                </select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* GSO Information */}
                    <Card className="dark:bg-slate-800/80 dark:border-slate-700 lg:col-span-2">
                        <CardHeader className="border-b dark:border-slate-700">
                            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                                    <Building2 className="h-4 w-4 text-white" />
                                </div>
                                GSO Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    label="GSO Head Name"
                                    icon={User}
                                >
                                    <Input
                                        id="gso_head_name"
                                        name="gso_head_name"
                                        value={settings.gso_head_name || ''}
                                        onChange={(e) => handleSettingChange('gso_head_name', e.target.value)}
                                        onBlur={() => handleBlur('gso_head_name')}
                                        placeholder="e.g., Engr. Maria Santos"
                                        className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                    />
                                </FormField>
                                <FormField
                                    label="GSO Office Phone"
                                    icon={Phone}
                                >
                                    <Input
                                        id="gso_office_phone"
                                        name="gso_office_phone"
                                        value={settings.gso_office_phone || ''}
                                        onChange={(e) => handleSettingChange('gso_office_phone', e.target.value)}
                                        onBlur={() => handleBlur('gso_office_phone')}
                                        placeholder="e.g., (02) 8123-4567"
                                        className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                    />
                                </FormField>
                                <FormField
                                    label="GSO Office Email"
                                    icon={Mail}
                                    error={hasError('gso_office_email') && errors.gso_office_email}
                                    touched={touched.gso_office_email}
                                    className="md:col-span-2"
                                >
                                    <Input
                                        id="gso_office_email"
                                        name="gso_office_email"
                                        type="email"
                                        value={settings.gso_office_email || ''}
                                        onChange={(e) => handleSettingChange('gso_office_email', e.target.value)}
                                        onBlur={() => handleBlur('gso_office_email')}
                                        placeholder="e.g., gso@fcms.gov.ph"
                                        className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                    />
                                </FormField>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* GPS Configuration Tab */}
            {activeTab === 'gps' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                        <CardHeader className="border-b dark:border-slate-700">
                            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                                    <MapPin className="h-4 w-4 text-white" />
                                </div>
                                GPS Tracking Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <FormField
                                label="GPS Ping Interval (seconds)"
                                icon={Clock}
                                error={hasError('gps_ping_interval_seconds') && errors.gps_ping_interval_seconds}
                                touched={touched.gps_ping_interval_seconds}
                                helper="5-120 seconds. Lower = more accurate but more battery drain"
                            >
                                <Input
                                    id="gps_ping_interval_seconds"
                                    name="gps_ping_interval_seconds"
                                    type="number"
                                    min="5"
                                    max="120"
                                    value={settings.gps_ping_interval_seconds || 30}
                                    onChange={(e) => handleSettingChange('gps_ping_interval_seconds', parseInt(e.target.value) || 0)}
                                    onBlur={() => handleBlur('gps_ping_interval_seconds')}
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>

                            <FormField
                                label="GPS Accuracy Threshold (meters)"
                                icon={Gauge}
                                error={hasError('gps_accuracy_threshold_meters') && errors.gps_accuracy_threshold_meters}
                                touched={touched.gps_accuracy_threshold_meters}
                                helper="10-200 meters. Below this, pings are flagged as low accuracy"
                            >
                                <Input
                                    id="gps_accuracy_threshold_meters"
                                    name="gps_accuracy_threshold_meters"
                                    type="number"
                                    min="10"
                                    max="200"
                                    value={settings.gps_accuracy_threshold_meters || 50}
                                    onChange={(e) => handleSettingChange('gps_accuracy_threshold_meters', parseInt(e.target.value) || 0)}
                                    onBlur={() => handleBlur('gps_accuracy_threshold_meters')}
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>

                            <FormField
                                label="Minimum GPS Pings Required"
                                icon={Wifi}
                                error={hasError('minimum_gps_pings_threshold') && errors.minimum_gps_pings_threshold}
                                touched={touched.minimum_gps_pings_threshold}
                                helper="2-50 pings. Minimum required for valid GPS distance calculation"
                            >
                                <Input
                                    id="minimum_gps_pings_threshold"
                                    name="minimum_gps_pings_threshold"
                                    type="number"
                                    min="2"
                                    max="50"
                                    value={settings.minimum_gps_pings_threshold || 5}
                                    onChange={(e) => handleSettingChange('minimum_gps_pings_threshold', parseInt(e.target.value) || 0)}
                                    onBlur={() => handleBlur('minimum_gps_pings_threshold')}
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>
                        </CardContent>
                    </Card>

                    <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                        <CardHeader className="border-b dark:border-slate-700">
                            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center">
                                    <AlertTriangle className="h-4 w-4 text-white" />
                                </div>
                                Anomaly Detection
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <FormField
                                label="GPS vs Odometer Tolerance (%)"
                                icon={Gauge}
                                error={hasError('gps_distance_odometer_tolerance_pct') && errors.gps_distance_odometer_tolerance_pct}
                                touched={touched.gps_distance_odometer_tolerance_pct}
                                helper="5-50%. Variance allowed between GPS distance and odometer reading"
                            >
                                <Input
                                    id="gps_distance_odometer_tolerance_pct"
                                    name="gps_distance_odometer_tolerance_pct"
                                    type="number"
                                    min="5"
                                    max="50"
                                    step="1"
                                    value={settings.gps_distance_odometer_tolerance_pct || 20}
                                    onChange={(e) => handleSettingChange('gps_distance_odometer_tolerance_pct', parseInt(e.target.value) || 0)}
                                    onBlur={() => handleBlur('gps_distance_odometer_tolerance_pct')}
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>

                            <FormField
                                label="Maximum Trip Duration (hours)"
                                icon={Clock}
                                error={hasError('max_trip_duration_hours') && errors.max_trip_duration_hours}
                                touched={touched.max_trip_duration_hours}
                                helper="1-72 hours. Alert if trip exceeds this duration"
                            >
                                <Input
                                    id="max_trip_duration_hours"
                                    name="max_trip_duration_hours"
                                    type="number"
                                    min="1"
                                    max="72"
                                    value={settings.max_trip_duration_hours || 24}
                                    onChange={(e) => handleSettingChange('max_trip_duration_hours', parseInt(e.target.value) || 0)}
                                    onBlur={() => handleBlur('max_trip_duration_hours')}
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>

                            <FormField
                                label="Maximum Idle Time (minutes)"
                                icon={AlertTriangle}
                                error={hasError('max_idle_minutes') && errors.max_idle_minutes}
                                touched={touched.max_idle_minutes}
                                helper="5-120 minutes. Alert if vehicle idles longer than this"
                            >
                                <Input
                                    id="max_idle_minutes"
                                    name="max_idle_minutes"
                                    type="number"
                                    min="5"
                                    max="120"
                                    value={settings.max_idle_minutes || 30}
                                    onChange={(e) => handleSettingChange('max_idle_minutes', parseInt(e.target.value) || 0)}
                                    onBlur={() => handleBlur('max_idle_minutes')}
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Fuel Stations Tab */}
            {activeTab === 'stations' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Contracted Fuel Stations Card */}
                    <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                        <CardHeader className="border-b dark:border-slate-700">
                            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                                    <Fuel className="h-4 w-4 text-white" />
                                </div>
                                Contracted Fuel Stations
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <FormField
                                label="Primary Contracted Station"
                                icon={Fuel}
                            >
                                <Input
                                    id="contracted_station_name"
                                    name="contracted_station_name"
                                    value={settings.contracted_station_name || ''}
                                    onChange={(e) => handleSettingChange('contracted_station_name', e.target.value)}
                                    onBlur={() => handleBlur('contracted_station_name')}
                                    placeholder="e.g., Petron - Main Branch"
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>

                            <FormField
                                label="Station Address"
                                icon={MapPin}
                            >
                                <Input
                                    id="contracted_station_address"
                                    name="contracted_station_address"
                                    value={settings.contracted_station_address || ''}
                                    onChange={(e) => handleSettingChange('contracted_station_address', e.target.value)}
                                    onBlur={() => handleBlur('contracted_station_address')}
                                    placeholder="Full address of the station"
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>

                            <FormField
                                label="Station Contact Number"
                                icon={Phone}
                            >
                                <Input
                                    id="contracted_station_contact"
                                    name="contracted_station_contact"
                                    value={settings.contracted_station_contact || ''}
                                    onChange={(e) => handleSettingChange('contracted_station_contact', e.target.value)}
                                    onBlur={() => handleBlur('contracted_station_contact')}
                                    placeholder="Contact number"
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>
                        </CardContent>
                    </Card>

                    {/* Fuel Price Settings Card */}
                    <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                        <CardHeader className="border-b dark:border-slate-700">
                            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                                    <DollarSign className="h-4 w-4 text-white" />
                                </div>
                                Fuel Price Settings
                            </CardTitle>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Used for trip cost estimation
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                                <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-1.5">
                                    <Fuel className="h-4 w-4 text-emerald-600" />
                                    <span className="font-semibold">Trip Estimation Fuel Price (₱/liter)</span>
                                </Label>
                                <Input
                                    id="fuel_price_per_liter"
                                    name="fuel_price_per_liter"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={settings.fuel_price_per_liter || ''}
                                    onChange={(e) => handleSettingChange('fuel_price_per_liter', parseFloat(e.target.value) || 0)}
                                    onBlur={() => handleBlur('fuel_price_per_liter')}
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white font-medium text-lg"
                                    placeholder="e.g., 75.00"
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    This price is used for auto-calculating trip cost estimates
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 pt-2">
                                <FormField
                                    label="Diesel Price (₱/liter)"
                                    icon={Fuel}
                                    error={hasError('diesel_price_per_liter') && errors.diesel_price_per_liter}
                                    touched={touched.diesel_price_per_liter}
                                >
                                    <Input
                                        id="diesel_price_per_liter"
                                        name="diesel_price_per_liter"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={settings.diesel_price_per_liter || ''}
                                        onChange={(e) => handleSettingChange('diesel_price_per_liter', parseFloat(e.target.value) || 0)}
                                        onBlur={() => handleBlur('diesel_price_per_liter')}
                                        className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                        placeholder="e.g., 55.00"
                                    />
                                </FormField>
                                <FormField
                                    label="Premium Price (₱/liter)"
                                    icon={Fuel}
                                    error={hasError('premium_price_per_liter') && errors.premium_price_per_liter}
                                    touched={touched.premium_price_per_liter}
                                >
                                    <Input
                                        id="premium_price_per_liter"
                                        name="premium_price_per_liter"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={settings.premium_price_per_liter || ''}
                                        onChange={(e) => handleSettingChange('premium_price_per_liter', parseFloat(e.target.value) || 0)}
                                        onBlur={() => handleBlur('premium_price_per_liter')}
                                        className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                        placeholder="e.g., 65.00"
                                    />
                                </FormField>
                                <FormField
                                    label="Regular Price (₱/liter)"
                                    icon={Fuel}
                                    error={hasError('regular_price_per_liter') && errors.regular_price_per_liter}
                                    touched={touched.regular_price_per_liter}
                                >
                                    <Input
                                        id="regular_price_per_liter"
                                        name="regular_price_per_liter"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={settings.regular_price_per_liter || ''}
                                        onChange={(e) => handleSettingChange('regular_price_per_liter', parseFloat(e.target.value) || 0)}
                                        onBlur={() => handleBlur('regular_price_per_liter')}
                                        className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                        placeholder="e.g., 58.00"
                                    />
                                </FormField>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Alternate Station Card */}
                    <Card className="dark:bg-slate-800/80 dark:border-slate-700 lg:col-span-2">
                        <CardHeader className="border-b dark:border-slate-700">
                            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center">
                                    <Truck className="h-4 w-4 text-white" />
                                </div>
                                Alternate Station (Backup)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <FormField
                                label="Alternate Station Name"
                                icon={Truck}
                            >
                                <Input
                                    id="alternate_station_name"
                                    name="alternate_station_name"
                                    value={settings.alternate_station_name || ''}
                                    onChange={(e) => handleSettingChange('alternate_station_name', e.target.value)}
                                    onBlur={() => handleBlur('alternate_station_name')}
                                    placeholder="e.g., Shell - South Branch"
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Used when primary station is unavailable</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <div className="grid grid-cols-1 gap-6">
                    <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                        <CardHeader className="border-b dark:border-slate-700">
                            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                                    <Bell className="h-4 w-4 text-white" />
                                </div>
                                Notification Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-4">
                            {/* Email Notifications Toggle */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">Email Notifications</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                        Send system notifications via email
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSettingChange('email_notifications_enabled', !settings.email_notifications_enabled);
                                        if (errors.email_notifications_enabled) {
                                            setErrors(prev => ({ ...prev, email_notifications_enabled: "" }));
                                        }
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 ${settings.email_notifications_enabled
                                        ? 'bg-emerald-600 shadow-md'
                                        : 'bg-slate-300 dark:bg-slate-600'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${settings.email_notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Push Notifications Toggle */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">Push Notifications</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                        Send push notifications to mobile devices
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSettingChange('push_notifications_enabled', !settings.push_notifications_enabled);
                                        if (errors.push_notifications_enabled) {
                                            setErrors(prev => ({ ...prev, push_notifications_enabled: "" }));
                                        }
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 ${settings.push_notifications_enabled
                                        ? 'bg-emerald-600 shadow-md'
                                        : 'bg-slate-300 dark:bg-slate-600'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${settings.push_notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Notification Retention */}
                            <FormField
                                label="Notification Retention (days)"
                                icon={Calendar}
                                error={hasError('notification_retention_days') && errors.notification_retention_days}
                                touched={touched.notification_retention_days}
                                helper="7-365 days. Number of days to keep notification history"
                            >
                                <Input
                                    id="notification_retention_days"
                                    name="notification_retention_days"
                                    type="number"
                                    min="7"
                                    max="365"
                                    value={settings.notification_retention_days || 30}
                                    onChange={(e) => handleSettingChange('notification_retention_days', parseInt(e.target.value) || 0)}
                                    onBlur={() => handleBlur('notification_retention_days')}
                                    className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                            </FormField>

                            {/* Info Note */}
                            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3">
                                <div className="flex items-start gap-2">
                                    <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                        <strong>Note:</strong> Email notifications require SMTP configuration. Push notifications require Firebase Cloud Messaging setup.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default SystemSettings;
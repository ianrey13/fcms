// src/pages/admin/SystemSettings.jsx
import React, { useState, useEffect } from 'react';
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
  Zap
} from 'lucide-react';

const SystemSettings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getAll();
      const settingsData = response.data?.data || response.data || {};
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to load settings');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        await settingsAPI.update(key, value);
      }
      setSuccessMessage('All settings saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Failed to save settings');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    fetchSettings();
    setSuccessMessage('Settings reset to saved values');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'gps', label: 'GPS Configuration', icon: MapPin },
    { id: 'stations', label: 'Fuel Stations', icon: Fuel },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            System Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Configure system parameters and preferences
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handleReset} 
            className="flex items-center gap-2 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
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
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200
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
              <div>
                <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-1.5">
                  <User className="h-4 w-4" />
                  Mayor's Name
                </Label>
                <Input
                  value={settings.mayor_name || ''}
                  onChange={(e) => handleSettingChange('mayor_name', e.target.value)}
                  placeholder="e.g., Hon. Juan Dela Cruz"
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
                <p className="text-xs text-slate-400 mt-1">Appears on printed gas slips</p>
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-1.5">
                  <Phone className="h-4 w-4" />
                  Mayor's Office Phone
                </Label>
                <Input
                  value={settings.mayor_office_phone || ''}
                  onChange={(e) => handleSettingChange('mayor_office_phone', e.target.value)}
                  placeholder="e.g., (02) 8123-4567"
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-1.5">
                  <Mail className="h-4 w-4" />
                  Mayor's Office Email
                </Label>
                <Input
                  type="email"
                  value={settings.mayor_office_email || ''}
                  onChange={(e) => handleSettingChange('mayor_office_email', e.target.value)}
                  placeholder="e.g., mayor@fcms.gov.ph"
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
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
              <div>
                <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">System Name</Label>
                <Input
                  value={settings.system_name || 'FCMS'}
                  onChange={(e) => handleSettingChange('system_name', e.target.value)}
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">Timezone</Label>
                <select
                  value={settings.system_timezone || 'Asia/Manila'}
                  onChange={(e) => handleSettingChange('system_timezone', e.target.value)}
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
                  value={settings.date_format || 'Y-m-d'}
                  onChange={(e) => handleSettingChange('date_format', e.target.value)}
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
                <div>
                  <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">GSO Head Name</Label>
                  <Input
                    value={settings.gso_head_name || ''}
                    onChange={(e) => handleSettingChange('gso_head_name', e.target.value)}
                    placeholder="e.g., Engr. Maria Santos"
                    className="dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                <div>
                  <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">GSO Office Phone</Label>
                  <Input
                    value={settings.gso_office_phone || ''}
                    onChange={(e) => handleSettingChange('gso_office_phone', e.target.value)}
                    placeholder="e.g., (02) 8123-4567"
                    className="dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">GSO Office Email</Label>
                  <Input
                    type="email"
                    value={settings.gso_office_email || ''}
                    onChange={(e) => handleSettingChange('gso_office_email', e.target.value)}
                    placeholder="e.g., gso@fcms.gov.ph"
                    className="dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
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
              <div>
                <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-1.5">
                  <Clock className="h-4 w-4" />
                  GPS Ping Interval (seconds)
                </Label>
                <Input
                  type="number"
                  value={settings.gps_ping_interval_seconds || 30}
                  onChange={(e) => handleSettingChange('gps_ping_interval_seconds', parseInt(e.target.value))}
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
                <p className="text-xs text-slate-400 mt-1">How often the mobile app sends GPS coordinates</p>
              </div>

              <div>
                <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-1.5">
                  <Gauge className="h-4 w-4" />
                  GPS Accuracy Threshold (meters)
                </Label>
                <Input
                  type="number"
                  value={settings.gps_accuracy_threshold_meters || 50}
                  onChange={(e) => handleSettingChange('gps_accuracy_threshold_meters', parseInt(e.target.value))}
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
                <p className="text-xs text-slate-400 mt-1">Below this accuracy, pings are flagged as low accuracy</p>
              </div>

              <div>
                <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-1.5">
                  <Wifi className="h-4 w-4" />
                  Minimum GPS Pings Required
                </Label>
                <Input
                  type="number"
                  value={settings.minimum_gps_pings_threshold || 5}
                  onChange={(e) => handleSettingChange('minimum_gps_pings_threshold', parseInt(e.target.value))}
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
                <p className="text-xs text-slate-400 mt-1">Minimum pings required for a valid GPS distance calculation</p>
              </div>
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
              <div>
                <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-1.5">
                  <Gauge className="h-4 w-4" />
                  GPS vs Odometer Tolerance (%)
                </Label>
                <Input
                  type="number"
                  step="1"
                  value={settings.gps_distance_odometer_tolerance_pct || 20}
                  onChange={(e) => handleSettingChange('gps_distance_odometer_tolerance_pct', parseInt(e.target.value))}
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
                <p className="text-xs text-slate-400 mt-1">Variance allowed between GPS distance and odometer reading</p>
              </div>

              <div>
                <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">Maximum Trip Duration (hours)</Label>
                <Input
                  type="number"
                  value={settings.max_trip_duration_hours || 24}
                  onChange={(e) => handleSettingChange('max_trip_duration_hours', parseInt(e.target.value))}
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
                <p className="text-xs text-slate-400 mt-1">Alert if trip exceeds this duration</p>
              </div>

              <div>
                <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">Maximum Idle Time (minutes)</Label>
                <Input
                  type="number"
                  value={settings.max_idle_minutes || 30}
                  onChange={(e) => handleSettingChange('max_idle_minutes', parseInt(e.target.value))}
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
                <p className="text-xs text-slate-400 mt-1">Alert if vehicle idles longer than this</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fuel Stations Tab */}
      {activeTab === 'stations' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <div>
                <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">Primary Contracted Station</Label>
                <Input
                  value={settings.contracted_station_name || ''}
                  onChange={(e) => handleSettingChange('contracted_station_name', e.target.value)}
                  placeholder="e.g., Petron - Main Branch"
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
                <p className="text-xs text-slate-400 mt-1">Official fuel station where drivers must fuel</p>
              </div>

              <div>
                <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">Station Address</Label>
                <Input
                  value={settings.contracted_station_address || ''}
                  onChange={(e) => handleSettingChange('contracted_station_address', e.target.value)}
                  placeholder="Full address of the station"
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
              </div>

              <div>
                <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">Station Contact Number</Label>
                <Input
                  value={settings.contracted_station_contact || ''}
                  onChange={(e) => handleSettingChange('contracted_station_contact', e.target.value)}
                  placeholder="Contact number"
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardHeader className="border-b dark:border-slate-700">
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-white" />
                </div>
                Fuel Price Settings (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">Diesel Price (₱/liter)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={settings.diesel_price_per_liter || ''}
                  onChange={(e) => handleSettingChange('diesel_price_per_liter', parseFloat(e.target.value))}
                  className="dark:bg-slate-900 dark:border-slate-700"
                  placeholder="e.g., 55.00"
                />
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">Premium Price (₱/liter)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={settings.premium_price_per_liter || ''}
                  onChange={(e) => handleSettingChange('premium_price_per_liter', parseFloat(e.target.value))}
                  className="dark:bg-slate-900 dark:border-slate-700"
                  placeholder="e.g., 65.00"
                />
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">Regular Price (₱/liter)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={settings.regular_price_per_liter || ''}
                  onChange={(e) => handleSettingChange('regular_price_per_liter', parseFloat(e.target.value))}
                  className="dark:bg-slate-900 dark:border-slate-700"
                  placeholder="e.g., 58.00"
                />
              </div>
            </CardContent>
          </Card>

          {/* Alternate Station */}
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
              <div>
                <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">Alternate Station Name</Label>
                <Input
                  value={settings.alternate_station_name || ''}
                  onChange={(e) => handleSettingChange('alternate_station_name', e.target.value)}
                  placeholder="e.g., Shell - South Branch"
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
                <p className="text-xs text-slate-400 mt-1">Used when primary station is unavailable</p>
              </div>
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
                  onClick={() => handleSettingChange('email_notifications_enabled', !settings.email_notifications_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 ${
                    settings.email_notifications_enabled 
                      ? 'bg-emerald-600 shadow-md' 
                      : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                      settings.email_notifications_enabled ? 'translate-x-6' : 'translate-x-1'
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
                  onClick={() => handleSettingChange('push_notifications_enabled', !settings.push_notifications_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 ${
                    settings.push_notifications_enabled 
                      ? 'bg-emerald-600 shadow-md' 
                      : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                      settings.push_notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Notification Retention */}
              <div className="pt-2">
                <Label className="text-slate-700 dark:text-slate-300 mb-1.5 block">Notification Retention (days)</Label>
                <Input
                  type="number"
                  value={settings.notification_retention_days || 30}
                  onChange={(e) => handleSettingChange('notification_retention_days', parseInt(e.target.value))}
                  className="dark:bg-slate-900 dark:border-slate-700"
                />
                <p className="text-xs text-slate-400 mt-1">Number of days to keep notification history</p>
              </div>

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
<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class SettingsController extends Controller
{
    /**
     * Get all system settings
     */
    public function index()
    {
        try {
            $settings = SystemSetting::all();
            $settingsArray = [];
            
            foreach ($settings as $setting) {
                $settingsArray[$setting->setting_key] = $setting->setting_value;
            }
            
            // Add default values for missing settings
            $defaults = [
                'mayor_name' => '',
                'mayor_office_phone' => '',
                'mayor_office_email' => '',
                'system_name' => 'FCMS',
                'system_timezone' => 'Asia/Manila',
                'date_format' => 'Y-m-d',
                'gso_head_name' => '',
                'gso_office_phone' => '',
                'gso_office_email' => '',
                'gps_ping_interval_seconds' => 30,
                'gps_accuracy_threshold_meters' => 50,
                'minimum_gps_pings_threshold' => 5,
                'gps_distance_odometer_tolerance_pct' => 20,
                'max_trip_duration_hours' => 24,
                'max_idle_minutes' => 30,
                'contracted_station_name' => '',
                'contracted_station_address' => '',
                'contracted_station_contact' => '',
                'alternate_station_name' => '',
                'diesel_price_per_liter' => null,
                'premium_price_per_liter' => null,
                'regular_price_per_liter' => null,
                'email_notifications_enabled' => true,
                'push_notifications_enabled' => true,
                'notification_retention_days' => 30,
            ];
            
            foreach ($defaults as $key => $defaultValue) {
                if (!isset($settingsArray[$key])) {
                    $settingsArray[$key] = $defaultValue;
                }
            }
            
            return response()->json([
                'success' => true,
                'data' => $settingsArray
            ]);
        } catch (\Exception $e) {
            Log::error('Settings index error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch settings: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Update a setting
     */
    public function update(Request $request, $key)
    {
        try {
            // Get the value, convert empty string to null for non-string fields
            $value = $request->input('setting_value');
            
            // Handle specific field types
            // For boolean fields (email_notifications_enabled, push_notifications_enabled)
            if (in_array($key, ['email_notifications_enabled', 'push_notifications_enabled'])) {
                // Convert to boolean (true/false)
                $value = filter_var($value, FILTER_VALIDATE_BOOLEAN);
            }
            // For numeric fields
            elseif (in_array($key, [
                'gps_ping_interval_seconds', 
                'gps_accuracy_threshold_meters', 
                'minimum_gps_pings_threshold',
                'gps_distance_odometer_tolerance_pct',
                'max_trip_duration_hours',
                'max_idle_minutes',
                'notification_retention_days'
            ])) {
                // Convert empty string to null, otherwise cast to int/float
                if ($value === '' || $value === null) {
                    $value = null;
                } elseif ($key === 'gps_distance_odometer_tolerance_pct') {
                    $value = floatval($value);
                } else {
                    $value = intval($value);
                }
            }
            // For string fields, if empty string, store as empty string (not null)
            else {
                // Keep as is, empty strings are fine
                if ($value === null) {
                    $value = '';
                }
            }
            
            // Find or create the setting
            $setting = SystemSetting::where('setting_key', $key)->first();
            
            if ($setting) {
                $setting->setting_value = $value;
                $setting->updated_by = auth()->id();
                $setting->save();
            } else {
                $setting = SystemSetting::create([
                    'setting_key' => $key,
                    'setting_value' => $value,
                    'updated_by' => auth()->id(),
                ]);
            }
            
            return response()->json([
                'success' => true,
                'message' => 'Setting updated successfully',
                'data' => $setting
            ]);
        } catch (\Exception $e) {
            Log::error('Settings update error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update setting: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Bulk update settings
     */
    public function bulkUpdate(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'settings' => 'required|array'
            ]);
            
            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }
            
            foreach ($request->settings as $key => $value) {
                // Process each value
                if (in_array($key, ['email_notifications_enabled', 'push_notifications_enabled'])) {
                    $value = filter_var($value, FILTER_VALIDATE_BOOLEAN);
                } elseif (in_array($key, [
                    'gps_ping_interval_seconds', 
                    'gps_accuracy_threshold_meters', 
                    'minimum_gps_pings_threshold',
                    'max_trip_duration_hours',
                    'max_idle_minutes',
                    'notification_retention_days'
                ])) {
                    $value = $value === '' ? null : intval($value);
                } elseif ($key === 'gps_distance_odometer_tolerance_pct') {
                    $value = $value === '' ? null : floatval($value);
                } else {
                    $value = $value === null ? '' : $value;
                }
                
                $setting = SystemSetting::where('setting_key', $key)->first();
                
                if ($setting) {
                    $setting->setting_value = $value;
                    $setting->updated_by = auth()->id();
                    $setting->save();
                } else {
                    SystemSetting::create([
                        'setting_key' => $key,
                        'setting_value' => $value,
                        'updated_by' => auth()->id(),
                    ]);
                }
            }
            
            return response()->json([
                'success' => true,
                'message' => 'All settings updated successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Settings bulk update error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update settings: ' . $e->getMessage()
            ], 500);
        }
    }
}
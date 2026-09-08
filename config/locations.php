<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class LocationService
{
    protected $nominatimService;
    protected $fallbackService;

    public function __construct(
        NominatimService $nominatimService,
        FallbackLocationService $fallbackService
    ) {
        $this->nominatimService = $nominatimService;
        $this->fallbackService = $fallbackService;
    }

    /**
     * Search for places using Nominatim with fallback
     */
    public function searchPlaces($query, $limit = 10)
    {
        // Try Nominatim first
        $result = $this->nominatimService->searchPlaces($query, $limit);
        
        // If Nominatim returns results, use them
        if ($result['success'] && !empty($result['predictions'])) {
            return $result;
        }
        
        // Otherwise use fallback
        Log::info('Nominatim returned no results, using fallback', ['query' => $query]);
        return $this->fallbackService->searchPlaces($query);
    }

    /**
     * Calculate distance between two locations
     */
    public function calculateDistance($originAddress, $destinationAddress, $vehicleId = null)
    {
        // Try Nominatim first
        $result = $this->nominatimService->calculateDistance($originAddress, $destinationAddress);
        
        if ($result['success']) {
            return $result;
        }
        
        // Fallback to local data
        Log::info('Nominatim distance failed, using fallback', [
            'origin' => $originAddress,
            'destination' => $destinationAddress
        ]);
        return $this->fallbackService->calculateDistance($originAddress, $destinationAddress);
    }

    /**
     * Geocode an address
     */
    public function geocode($address)
    {
        $result = $this->nominatimService->geocode($address);
        
        if ($result['success']) {
            return $result;
        }
        
        return $this->fallbackService->geocode($address);
    }

    /**
     * Reverse geocode coordinates to address
     */
    public function reverseGeocode($lat, $lng)
    {
        $result = $this->nominatimService->reverseGeocode($lat, $lng);
        
        if ($result['success']) {
            return $result;
        }
        
        return [
            'success' => false,
            'message' => 'Reverse geocoding failed'
        ];
    }

    /**
     * Calculate complete trip estimate
     */
    public function calculateTripEstimate($originAddress, $destinationAddress, $vehicleId = null, $roundTrip = true)
    {
        // Try Nominatim first
        $result = $this->nominatimService->calculateTripEstimate(
            $originAddress, 
            $destinationAddress, 
            $vehicleId, 
            $roundTrip
        );
        
        if ($result['success']) {
            return $result;
        }
        
        // Fallback to local calculation
        Log::info('Nominatim trip estimate failed, using fallback', [
            'origin' => $originAddress,
            'destination' => $destinationAddress
        ]);
        
        // Get distance from fallback
        $distanceResult = $this->fallbackService->calculateDistance($originAddress, $destinationAddress);
        
        if (!$distanceResult['success']) {
            return ['success' => false, 'message' => 'Unable to calculate distance'];
        }

        // Get vehicle efficiency
        $efficiency = 10;
        $fuelType = 'regular';
        
        if ($vehicleId) {
            try {
                $vehicle = \App\Models\Vehicle::find($vehicleId);
                if ($vehicle) {
                    $efficiency = $vehicle->fuel_efficiency ?? 10;
                    $fuelType = $vehicle->fuel_type ?? 'regular';
                }
            } catch (\Exception $e) {
                Log::error('Error getting vehicle: ' . $e->getMessage());
            }
        }

        $fuelPrice = $this->getFuelPrice($fuelType);
        $multiplier = $roundTrip ? 2 : 1;
        $distanceKm = $distanceResult['distance_km'] * $multiplier;
        $durationMinutes = $distanceResult['duration_minutes'] * $multiplier;
        $estimatedLiters = round($distanceKm / $efficiency, 2);
        $estimatedCost = round($estimatedLiters * $fuelPrice, 2);

        // Add 10% buffer
        $bufferPercentage = 10;
        $estimatedLitersWithBuffer = round($estimatedLiters * (1 + ($bufferPercentage / 100)), 2);
        $estimatedCostWithBuffer = round($estimatedCost * (1 + ($bufferPercentage / 100)), 2);

        return [
            'success' => true,
            'origin' => $distanceResult['origin'] ?? $originAddress,
            'destination' => $distanceResult['destination'] ?? $destinationAddress,
            'distance_km' => round($distanceKm, 2),
            'duration_minutes' => round($durationMinutes, 1),
            'estimated_liters' => $estimatedLitersWithBuffer,
            'estimated_cost' => $estimatedCostWithBuffer,
            'fuel_efficiency_km_per_liter' => $efficiency,
            'fuel_price_per_liter' => $fuelPrice,
            'fuel_type' => $fuelType,
            'is_round_trip' => $roundTrip,
            'one_way_distance_km' => $distanceResult['distance_km'],
            'one_way_duration_minutes' => $distanceResult['duration_minutes'],
            'round_trip_multiplier' => $multiplier,
            'buffer_percentage' => $bufferPercentage,
            'source' => 'fallback',
        ];
    }

    /**
     * Get fuel price from system settings
     */
    private function getFuelPrice($fuelType = null)
    {
        $fuelPriceMap = [
            'diesel' => 'diesel_price_per_liter',
            'premium' => 'premium_price_per_liter',
            'regular' => 'regular_price_per_liter',
            'gasoline' => 'regular_price_per_liter',
        ];
        
        $settingKey = $fuelPriceMap[strtolower($fuelType)] ?? 'regular_price_per_liter';
        
        try {
            $setting = \App\Models\SystemSetting::where('setting_key', $settingKey)->first();
            return $setting ? (float) $setting->setting_value : 75.00;
        } catch (\Exception $e) {
            Log::error('Error getting fuel price: ' . $e->getMessage());
            return 75.00;
        }
    }
}
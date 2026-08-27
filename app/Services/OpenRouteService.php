<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OpenRouteService
{
    protected $apiKey;
    protected $baseUrl;

    public function __construct()
    {
        $this->apiKey = config('services.ors.api_key');
        $this->baseUrl = config('services.ors.base_url', 'https://api.openrouteservice.org');
        
        if (empty($this->apiKey)) {
            Log::warning('OpenRouteService API key is missing. Please check your .env file.');
        }
    }

    /**
     * Geocode an address to coordinates
     */
    public function geocode($address)
    {
        if (empty($this->apiKey)) {
            return ['success' => false, 'message' => 'OpenRouteService API key is not configured.'];
        }

        try {
            $response = Http::timeout(10)->get("{$this->baseUrl}/geocode/search", [
                'api_key' => $this->apiKey,
                'text' => $address,
                'size' => 5,
                'boundary.country' => 'PH',
            ]);

            if ($response->successful()) {
                $data = $response->json();
                if (!empty($data['features'])) {
                    $feature = $data['features'][0];
                    $coords = $feature['geometry']['coordinates'] ?? [0, 0];
                    $properties = $feature['properties'] ?? [];
                    
                    return [
                        'success' => true,
                        'lat' => $coords[1] ?? 0,
                        'lng' => $coords[0] ?? 0,
                        'display_name' => $properties['label'] ?? $properties['name'] ?? $address,
                        'place_id' => $properties['id'] ?? null,
                    ];
                }
            }

            Log::warning('ORS geocode failed', ['address' => $address, 'status' => $response->status()]);
            return ['success' => false, 'message' => 'Location not found'];

        } catch (\Exception $e) {
            Log::error('ORS geocode error: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Geocoding error: ' . $e->getMessage()];
        }
    }

    /**
     * Search for places (autocomplete)
     */
    public function searchPlaces($query)
    {
        Log::info('ORS searchPlaces called', ['query' => $query]);
        
        if (empty($query)) {
            return ['success' => false, 'message' => 'Search query is required'];
        }

        if (empty($this->apiKey)) {
            return ['success' => false, 'message' => 'OpenRouteService API key is not configured.'];
        }

        try {
            $response = Http::timeout(10)->get("{$this->baseUrl}/geocode/search", [
                'api_key' => $this->apiKey,
                'text' => $query,
                'size' => 10,
                'boundary.country' => 'PH',
            ]);

            Log::info('ORS search response', [
                'query' => $query,
                'status' => $response->status(),
            ]);

            if ($response->successful()) {
                $data = $response->json();
                
                if (!empty($data['features'])) {
                    $predictions = collect($data['features'])->map(function($feature) {
                        $coords = $feature['geometry']['coordinates'] ?? [0, 0];
                        $properties = $feature['properties'] ?? [];
                        
                        return [
                            'description' => $properties['label'] ?? 
                                            $properties['name'] ?? 
                                            $properties['display_name'] ?? 
                                            'Unknown',
                            'place_id' => $properties['id'] ?? null,
                            'lat' => $coords[1] ?? null,
                            'lng' => $coords[0] ?? null,
                            'type' => $properties['type'] ?? 'unknown',
                        ];
                    })->filter(function($item) {
                        return $item['lat'] !== null && $item['lng'] !== null;
                    })->values();

                    return [
                        'success' => true,
                        'predictions' => $predictions,
                        'total' => count($predictions),
                    ];
                }

                return [
                    'success' => true,
                    'predictions' => [],
                    'total' => 0,
                    'message' => 'No results found for: ' . $query
                ];
            }

            Log::error('ORS search failed', [
                'query' => $query,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [
                'success' => false,
                'message' => 'Search failed: ' . ($response->body() ?: 'Unknown error'),
                'status' => $response->status()
            ];

        } catch (\Exception $e) {
            Log::error('ORS search error: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Search error: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Calculate driving distance between two coordinates
     */
    public function getDistance($startLng, $startLat, $endLng, $endLat)
    {
        if (empty($this->apiKey)) {
            return ['success' => false, 'message' => 'OpenRouteService API key is not configured.'];
        }

        try {
            $response = Http::timeout(15)->get("{$this->baseUrl}/v2/directions/driving-car", [
                'api_key' => $this->apiKey,
                'start' => "{$startLng},{$startLat}",
                'end' => "{$endLng},{$endLat}",
                'format' => 'geojson',
            ]);

            if ($response->successful()) {
                $data = $response->json();
                
                if (!empty($data['features'][0]['properties']['segments'][0])) {
                    $segment = $data['features'][0]['properties']['segments'][0];
                    
                    return [
                        'success' => true,
                        'distance_km' => round($segment['distance'] / 1000, 2),
                        'duration_minutes' => round($segment['duration'] / 60, 1),
                        'distance_meters' => $segment['distance'],
                        'duration_seconds' => $segment['duration'],
                    ];
                }
            }

            Log::warning('ORS route failed', ['status' => $response->status()]);
            return ['success' => false, 'message' => 'Route calculation failed'];

        } catch (\Exception $e) {
            Log::error('ORS route error: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Route error: ' . $e->getMessage()];
        }
    }

    /**
     * Complete: Address → Distance (with fuel estimation)
     * ✅ UPDATED: Added $roundTrip parameter
     */
    public function calculateTripEstimate($originAddress, $destinationAddress, $vehicleId = null, $roundTrip = true)
    {
        // 1. Geocode origin
        $origin = $this->geocode($originAddress);
        if (!$origin['success']) {
            return ['success' => false, 'message' => 'Origin not found: ' . ($origin['message'] ?? '')];
        }

        // 2. Geocode destination
        $destination = $this->geocode($destinationAddress);
        if (!$destination['success']) {
            return ['success' => false, 'message' => 'Destination not found: ' . ($destination['message'] ?? '')];
        }

        // 3. Get driving distance (ONE-WAY)
        $route = $this->getDistance(
            $origin['lng'], $origin['lat'],
            $destination['lng'], $destination['lat']
        );

        if (!$route['success']) {
            return $route;
        }

        // ✅ 4. Multiply by 2 for ROUND TRIP (back and forth)
        $multiplier = $roundTrip ? 2 : 1;
        $distanceKm = $route['distance_km'] * $multiplier;
        $durationMinutes = $route['duration_minutes'] * $multiplier;

        // 5. Get vehicle fuel efficiency and fuel type
        $vehicleData = $this->getVehicleData($vehicleId);
        $fuelEfficiency = $vehicleData['efficiency'];
        $fuelType = $vehicleData['fuel_type'];
        
        // 6. Calculate fuel estimate
        $estimatedLiters = round($distanceKm / $fuelEfficiency, 2);
        
        // 7. Get fuel price based on vehicle fuel type
        $fuelPrice = $this->getFuelPrice($fuelType);
        $estimatedCost = round($estimatedLiters * $fuelPrice, 2);

        // ✅ 8. Add buffer for safety (10% by default)
        $bufferPercentage = config('locations.travel.buffer_percentage', 10);
        $estimatedLitersWithBuffer = round($estimatedLiters * (1 + ($bufferPercentage / 100)), 2);
        $estimatedCostWithBuffer = round($estimatedCost * (1 + ($bufferPercentage / 100)), 2);

        return [
            'success' => true,
            'origin' => $origin['display_name'],
            'destination' => $destination['display_name'],
            'distance_km' => round($distanceKm, 2),
            'duration_minutes' => round($durationMinutes, 1),
            'distance_text' => round($distanceKm, 2) . ' km',
            'duration_text' => round($durationMinutes, 1) . ' mins',
            'estimated_liters' => $estimatedLitersWithBuffer,
            'estimated_cost' => $estimatedCostWithBuffer,
            'fuel_efficiency_km_per_liter' => $fuelEfficiency,
            'fuel_price_per_liter' => $fuelPrice,
            'fuel_type' => $fuelType,
            'is_round_trip' => $roundTrip,
            'one_way_distance_km' => $route['distance_km'],
            'one_way_duration_minutes' => $route['duration_minutes'],
            'round_trip_multiplier' => $multiplier,
            'buffer_percentage' => $bufferPercentage,
        ];
    }

    /**
     * Get vehicle fuel efficiency
     */
    private function getVehicleFuelEfficiency($vehicleId)
    {
        if ($vehicleId) {
            $vehicle = \App\Models\Vehicle::find($vehicleId);
            if ($vehicle && $vehicle->fuel_efficiency) {
                return (float) $vehicle->fuel_efficiency;
            }
        }
        return 10; // Default: 10 km/L
    }

    /**
     * Get current fuel price based on fuel type
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
        $setting = \App\Models\SystemSetting::where('setting_key', $settingKey)->first();
        
        return $setting ? (float) $setting->setting_value : 75.00;
    }

    /**
     * Get vehicle data (efficiency and fuel type)
     */
    private function getVehicleData($vehicleId)
    {
        $defaultEfficiency = 10;
        $defaultFuelType = 'regular';
        
        if ($vehicleId) {
            $vehicle = \App\Models\Vehicle::find($vehicleId);
            if ($vehicle) {
                return [
                    'efficiency' => $vehicle->fuel_efficiency ?? $defaultEfficiency,
                    'fuel_type' => $vehicle->fuel_type ?? $defaultFuelType,
                ];
            }
        }
        
        return [
            'efficiency' => $defaultEfficiency,
            'fuel_type' => $defaultFuelType,
        ];
    }
}
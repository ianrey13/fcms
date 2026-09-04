<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OpenRouteService
{
    protected $apiKey;
    protected $baseUrl;
    protected $fallbackService;

    public function __construct(FallbackLocationService $fallbackService)
    {
        $this->apiKey = config('services.ors.api_key');
        $this->baseUrl = config('services.ors.base_url', 'https://api.openrouteservice.org');
        $this->fallbackService = $fallbackService;
        
        if (empty($this->apiKey)) {
            Log::warning('OpenRouteService API key is missing. Using fallback service.');
        }
    }

    public function geocode($address)
    {
        if (empty($this->apiKey)) {
            Log::info('No API key, using fallback geocode');
            return $this->fallbackService->geocode($address);
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
                        'source' => 'ors',
                    ];
                }
            }

            if ($response->status() === 429 || 
                $response->status() === 403 || 
                strpos($response->body(), 'Quota exceeded') !== false) {
                Log::warning('ORS quota exceeded, using fallback geocode');
                return $this->fallbackService->geocode($address);
            }

            Log::warning('ORS geocode failed', ['address' => $address, 'status' => $response->status()]);
            return $this->fallbackService->geocode($address);

        } catch (\Exception $e) {
            Log::error('ORS geocode error: ' . $e->getMessage());
            return $this->fallbackService->geocode($address);
        }
    }

    public function searchPlaces($query)
    {
        Log::info('ORS searchPlaces called', ['query' => $query]);
        
        if (empty($query)) {
            return ['success' => false, 'message' => 'Search query is required', 'predictions' => []];
        }

        if (!empty($this->apiKey)) {
            try {
                $response = Http::timeout(10)->get("{$this->baseUrl}/geocode/search", [
                    'api_key' => $this->apiKey,
                    'text' => $query,
                    'size' => 10,
                    'boundary.country' => 'PH',
                    'sources' => 'osm',
                    'layers' => 'locality,street,address,venue',
                ]);

                if ($response->successful()) {
                    $data = $response->json();
                    
                    if (!empty($data['features'])) {
                        $predictions = collect($data['features'])->map(function($feature) {
                            $coords = $feature['geometry']['coordinates'] ?? [0, 0];
                            $properties = $feature['properties'] ?? [];
                            
                            return [
                                'description' => $properties['label'] ?? $properties['name'] ?? 'Unknown',
                                'place_id' => $properties['id'] ?? null,
                                'lat' => $coords[1] ?? null,
                                'lng' => $coords[0] ?? null,
                                'type' => $properties['type'] ?? 'unknown',
                            ];
                        })->filter(function($item) {
                            return $item['lat'] !== null && $item['lng'] !== null && 
                                   $item['lat'] != 0 && $item['lng'] != 0;
                        })->values();

                        if (count($predictions) > 0) {
                            return [
                                'success' => true,
                                'predictions' => $predictions,
                                'total' => count($predictions),
                                'source' => 'ors',
                            ];
                        }
                    }

                    $responseBody = $response->body();
                    if ($response->status() === 429 || 
                        $response->status() === 403 || 
                        strpos($responseBody, 'Quota exceeded') !== false ||
                        strpos($responseBody, 'quota') !== false) {
                        Log::warning('ORS quota exceeded, using fallback');
                        return $this->fallbackService->searchPlaces($query);
                    }

                    Log::info('ORS search returned no results');
                    return [
                        'success' => true,
                        'predictions' => [],
                        'total' => 0,
                        'source' => 'ors',
                    ];
                }

                Log::warning('ORS search failed with status: ' . $response->status());
                return $this->fallbackService->searchPlaces($query);

            } catch (\Exception $e) {
                Log::error('ORS search error: ' . $e->getMessage());
                return $this->fallbackService->searchPlaces($query);
            }
        }

        Log::info('Using fallback search for query: ' . $query);
        return $this->fallbackService->searchPlaces($query);
    }

    public function getDistance($startLng, $startLat, $endLng, $endLat)
    {
        if (empty($this->apiKey)) {
            Log::info('No API key, using fallback distance calculation');
            return ['success' => false, 'message' => 'API key not configured'];
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
                        'source' => 'ors',
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

    public function calculateTripEstimate($originAddress, $destinationAddress, $vehicleId = null, $roundTrip = true)
    {
        Log::info('Calculating trip estimate', [
            'origin' => $originAddress,
            'destination' => $destinationAddress,
            'vehicle_id' => $vehicleId,
            'round_trip' => $roundTrip
        ]);

        $origin = $this->geocode($originAddress);
        if (!$origin['success']) {
            $origin = $this->fallbackService->geocode($originAddress);
            if (!$origin['success']) {
                return ['success' => false, 'message' => 'Origin not found: ' . ($origin['message'] ?? '')];
            }
        }

        $destination = $this->geocode($destinationAddress);
        if (!$destination['success']) {
            $destination = $this->fallbackService->geocode($destinationAddress);
            if (!$destination['success']) {
                return ['success' => false, 'message' => 'Destination not found: ' . ($destination['message'] ?? '')];
            }
        }

        $route = $this->getDistance(
            $origin['lng'], $origin['lat'],
            $destination['lng'], $destination['lat']
        );

        if (!$route['success']) {
            Log::warning('Route calculation failed, using fallback distance');
            $fallbackResult = $this->fallbackService->calculateDistance($originAddress, $destinationAddress);
            if ($fallbackResult['success']) {
                $route = [
                    'success' => true,
                    'distance_km' => $fallbackResult['distance_km'],
                    'duration_minutes' => $fallbackResult['duration_minutes'],
                    'source' => 'fallback',
                ];
            } else {
                return ['success' => false, 'message' => 'Unable to calculate distance'];
            }
        }

        $multiplier = $roundTrip ? 2 : 1;
        $distanceKm = $route['distance_km'] * $multiplier;
        $durationMinutes = $route['duration_minutes'] * $multiplier;

        $vehicleData = $this->getVehicleData($vehicleId);
        $fuelEfficiency = $vehicleData['efficiency'];
        $fuelType = $vehicleData['fuel_type'];
        
        $estimatedLiters = round($distanceKm / $fuelEfficiency, 2);
        $fuelPrice = $this->getFuelPrice($fuelType);
        $estimatedCost = round($estimatedLiters * $fuelPrice, 2);

        $bufferPercentage = config('locations.travel.buffer_percentage', 10);
        $estimatedLitersWithBuffer = round($estimatedLiters * (1 + ($bufferPercentage / 100)), 2);
        $estimatedCostWithBuffer = round($estimatedCost * (1 + ($bufferPercentage / 100)), 2);

        return [
            'success' => true,
            'origin' => $origin['display_name'] ?? $originAddress,
            'destination' => $destination['display_name'] ?? $destinationAddress,
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
            'source' => $route['source'] ?? 'ors',
        ];
    }

    private function getVehicleFuelEfficiency($vehicleId)
    {
        if ($vehicleId) {
            try {
                $vehicle = \App\Models\Vehicle::find($vehicleId);
                if ($vehicle && $vehicle->fuel_efficiency) {
                    return (float) $vehicle->fuel_efficiency;
                }
            } catch (\Exception $e) {
                Log::error('Error getting vehicle efficiency: ' . $e->getMessage());
            }
        }
        return 10;
    }

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

    private function getVehicleData($vehicleId)
    {
        $defaultEfficiency = 10;
        $defaultFuelType = 'regular';
        
        if ($vehicleId) {
            try {
                $vehicle = \App\Models\Vehicle::find($vehicleId);
                if ($vehicle) {
                    return [
                        'efficiency' => $vehicle->fuel_efficiency ?? $defaultEfficiency,
                        'fuel_type' => $vehicle->fuel_type ?? $defaultFuelType,
                    ];
                }
            } catch (\Exception $e) {
                Log::error('Error getting vehicle data: ' . $e->getMessage());
            }
        }
        
        return [
            'efficiency' => $defaultEfficiency,
            'fuel_type' => $defaultFuelType,
        ];
    }
}
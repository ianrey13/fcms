<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class NominatimService
{
    protected $baseUrl;
    protected $fallbackService;
    protected $userAgent;
    protected $country;
    protected $language;
    protected $enabled;

    public function __construct(FallbackLocationService $fallbackService)
    {
        $this->fallbackService = $fallbackService;
        $this->baseUrl = config('services.nominatim.base_url', 'https://nominatim.openstreetmap.org');
        $this->userAgent = config('services.nominatim.user_agent', 'FCMS/1.0');
        $this->country = config('services.nominatim.country', 'ph');
        $this->language = config('services.nominatim.language', 'en');
        $this->enabled = config('services.nominatim.enabled', true);
    }

    /**
     * Search for places using Nominatim
     */
    public function searchPlaces($query, $limit = 10)
    {
        // If Nominatim is disabled, use fallback immediately
        if (!$this->enabled) {
            Log::info('Nominatim disabled, using fallback');
            return $this->fallbackService->searchPlaces($query);
        }

        if (empty($query) || strlen($query) < 2) {
            return $this->fallbackService->searchPlaces($query);
        }

        // Check cache first (5 minutes)
        $cacheKey = 'nominatim_search_' . md5($query);
        if (Cache::has($cacheKey)) {
            Log::info('Nominatim search from cache', ['query' => $query]);
            return Cache::get($cacheKey);
        }

        try {
            // Rate limiting: 1 request per second
            usleep(1000000);

            $response = Http::timeout(5)->get("{$this->baseUrl}/search", [
                'q' => $query,
                'format' => 'json',
                'limit' => $limit,
                'countrycodes' => $this->country,
                'addressdetails' => 1,
                'extratags' => 1,
                'namedetails' => 1,
                'accept-language' => $this->language,
                'layer' => 'address,poi',
            ]);

            if ($response->successful()) {
                $data = $response->json();
                
                if (!empty($data)) {
                    $predictions = [];
                    
                    foreach ($data as $item) {
                        $lat = $item['lat'] ?? null;
                        $lng = $item['lon'] ?? null;
                        $displayName = $item['display_name'] ?? $item['name'] ?? 'Unknown';
                        
                        if ($lat && $lng) {
                            $predictions[] = [
                                'description' => $displayName,
                                'place_id' => $item['place_id'] ?? null,
                                'lat' => (float) $lat,
                                'lng' => (float) $lng,
                                'type' => $item['type'] ?? $item['category'] ?? 'location',
                                'address' => $item['address'] ?? [],
                                'class' => $item['class'] ?? null,
                                'osm_type' => $item['osm_type'] ?? null,
                                'osm_id' => $item['osm_id'] ?? null,
                            ];
                        }
                    }

                    // Prioritize Misamis Oriental / Mindanao results
                    $predictions = $this->prioritizeLocalResults($predictions, $query);

                    $result = [
                        'success' => true,
                        'predictions' => array_slice($predictions, 0, $limit),
                        'total' => count($predictions),
                        'source' => 'nominatim',
                    ];

                    // Cache for 5 minutes
                    Cache::put($cacheKey, $result, 300);
                    
                    Log::info('Nominatim search successful', [
                        'query' => $query,
                        'results' => count($predictions)
                    ]);

                    return $result;
                }
            }

            Log::warning('Nominatim search returned no results, using fallback', ['query' => $query]);
            return $this->fallbackService->searchPlaces($query);

        } catch (\Exception $e) {
            Log::error('Nominatim search error: ' . $e->getMessage());
            return $this->fallbackService->searchPlaces($query);
        }
    }

    /**
     * Reverse geocode - Get address from coordinates
     */
    public function reverseGeocode($lat, $lng)
    {
        if (!$this->enabled) {
            return ['success' => false, 'message' => 'Nominatim disabled'];
        }

        $cacheKey = 'nominatim_reverse_' . md5($lat . $lng);
        if (Cache::has($cacheKey)) {
            return Cache::get($cacheKey);
        }

        try {
            usleep(1000000);

            $response = Http::timeout(5)->get("{$this->baseUrl}/reverse", [
                'lat' => $lat,
                'lon' => $lng,
                'format' => 'json',
                'zoom' => 18,
                'addressdetails' => 1,
                'accept-language' => $this->language,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                
                if (!empty($data)) {
                    $result = [
                        'success' => true,
                        'address' => $data['display_name'] ?? null,
                        'lat' => $lat,
                        'lng' => $lng,
                        'source' => 'nominatim',
                        'raw' => $data,
                    ];
                    
                    Cache::put($cacheKey, $result, 3600);
                    return $result;
                }
            }

            return ['success' => false, 'message' => 'Reverse geocoding failed'];

        } catch (\Exception $e) {
            Log::error('Nominatim reverse error: ' . $e->getMessage());
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Prioritize results from Misamis Oriental / Mindanao
     */
    private function prioritizeLocalResults($results, $query)
    {
        $priorityKeywords = [
            'misamis oriental', 'misamis', 'laguindingan', 'alubijid', 'gitagum',
            'el salvador', 'opol', 'initao', 'naawan', 'manticao', 'lugait',
            'tagoloan', 'villanueva', 'jasaan', 'claveria', 'balingasag',
            'lagonglong', 'salay', 'sugbongcogon', 'kinoguitan', 'balingoan',
            'talisayan', 'medina', 'libertad', 'cagayan de oro', 'cdo',
            'gingoog', 'davao', 'butuan', 'surigao', 'iligan', 'ozamiz',
            'malaybalay', 'valencia', 'zamboanga', 'cotabato',
        ];

        $mindanaoKeywords = [
            'mindanao', 'davao', 'soccsksargen', 'caraga', 'bangsamoro',
            'zamboanga peninsula', 'northern mindanao', 'bukidnon', 'camiguin',
            'agusan', 'surigao', 'lanao', 'cotabato', 'sarangani',
        ];

        usort($results, function($a, $b) use ($priorityKeywords, $mindanaoKeywords, $query) {
            $scoreA = 0;
            $scoreB = 0;
            
            $descA = strtolower($a['description'] ?? '');
            $descB = strtolower($b['description'] ?? '');
            
            // Highest priority: Exact match with priority keywords
            foreach ($priorityKeywords as $keyword) {
                if (strpos($descA, $keyword) !== false) $scoreA += 100;
                if (strpos($descB, $keyword) !== false) $scoreB += 100;
            }
            
            // High priority: Contains "Misamis Oriental"
            if (strpos($descA, 'misamis oriental') !== false) $scoreA += 80;
            if (strpos($descB, 'misamis oriental') !== false) $scoreB += 80;
            
            // Medium priority: Mindanao
            foreach ($mindanaoKeywords as $keyword) {
                if (strpos($descA, $keyword) !== false) $scoreA += 30;
                if (strpos($descB, $keyword) !== false) $scoreB += 30;
            }
            
            // Bonus: Contains the search query
            if (strpos($descA, strtolower($query)) !== false) $scoreA += 20;
            if (strpos($descB, strtolower($query)) !== false) $scoreB += 20;
            
            // Bonus: Contains "Philippines" (less priority)
            if (strpos($descA, 'philippines') !== false) $scoreA += 10;
            if (strpos($descB, 'philippines') !== false) $scoreB += 10;
            
            return $scoreB <=> $scoreA;
        });

        return $results;
    }

    /**
     * Geocode an address
     */
    public function geocode($address)
    {
        $result = $this->searchPlaces($address, 1);
        
        if ($result['success'] && !empty($result['predictions'])) {
            $first = $result['predictions'][0];
            return [
                'success' => true,
                'lat' => $first['lat'],
                'lng' => $first['lng'],
                'display_name' => $first['description'],
                'place_id' => $first['place_id'],
                'source' => 'nominatim',
            ];
        }

        return $this->fallbackService->geocode($address);
    }

    /**
     * Calculate distance using Haversine formula
     */
    public function calculateDistance($originAddress, $destinationAddress)
    {
        // Get coordinates
        $origin = $this->geocode($originAddress);
        $destination = $this->geocode($destinationAddress);

        if (!$origin['success'] || !$destination['success']) {
            return $this->fallbackService->calculateDistance($originAddress, $destinationAddress);
        }

        // Use Haversine formula
        $distanceKm = $this->haversineDistance(
            $origin['lat'], $origin['lng'],
            $destination['lat'], $destination['lng']
        );

        return [
            'success' => true,
            'distance_km' => round($distanceKm, 2),
            'duration_minutes' => round($distanceKm / 40 * 60, 1),
            'origin' => $origin['display_name'],
            'destination' => $destination['display_name'],
            'source' => 'nominatim_haversine',
        ];
    }

    /**
     * Haversine formula for distance calculation
     */
    private function haversineDistance($lat1, $lon1, $lat2, $lon2)
    {
        $earthRadius = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $earthRadius * $c;
    }

    /**
     * Calculate trip estimate
     */
    public function calculateTripEstimate($originAddress, $destinationAddress, $vehicleId = null, $roundTrip = true)
    {
        $result = $this->calculateDistance($originAddress, $destinationAddress);
        
        if (!$result['success']) {
            return $result;
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
        $distanceKm = $result['distance_km'] * $multiplier;
        $durationMinutes = $result['duration_minutes'] * $multiplier;
        $estimatedLiters = round($distanceKm / $efficiency, 2);
        $estimatedCost = round($estimatedLiters * $fuelPrice, 2);

        // Add 10% buffer
        $bufferPercentage = 10;
        $estimatedLitersWithBuffer = round($estimatedLiters * (1 + ($bufferPercentage / 100)), 2);
        $estimatedCostWithBuffer = round($estimatedCost * (1 + ($bufferPercentage / 100)), 2);

        return [
            'success' => true,
            'origin' => $result['origin'],
            'destination' => $result['destination'],
            'distance_km' => round($distanceKm, 2),
            'duration_minutes' => round($durationMinutes, 1),
            'estimated_liters' => $estimatedLitersWithBuffer,
            'estimated_cost' => $estimatedCostWithBuffer,
            'fuel_efficiency_km_per_liter' => $efficiency,
            'fuel_price_per_liter' => $fuelPrice,
            'fuel_type' => $fuelType,
            'is_round_trip' => $roundTrip,
            'one_way_distance_km' => $result['distance_km'],
            'one_way_duration_minutes' => $result['duration_minutes'],
            'round_trip_multiplier' => $multiplier,
            'buffer_percentage' => $bufferPercentage,
            'source' => 'nominatim',
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
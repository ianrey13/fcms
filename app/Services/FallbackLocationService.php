<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class FallbackLocationService
{
    protected $locations = [];
    protected $priorityMap = [];

    public function __construct()
    {
        // Complete location data with guaranteed coordinates
        $this->locations = [
            // === PRIORITY 1: LAGUINDINGAN BARANGAYS ===
            'laguindingan_municipal_hall' => [
                'name' => 'Laguindingan Municipal Hall',
                'distance_km' => 0,
                'lat' => 8.5731,
                'lng' => 124.4432,
                'type' => 'origin',
                'priority' => 1,
                'region' => 'Laguindingan',
            ],
            'laguindingan' => [
                'name' => 'Laguindingan',
                'distance_km' => 0,
                'lat' => 8.5731,
                'lng' => 124.4432,
                'type' => 'municipality',
                'priority' => 1,
                'region' => 'Laguindingan',
            ],
            'poblacion' => [
                'name' => 'Poblacion, Laguindingan',
                'distance_km' => 0,
                'lat' => 8.5731,
                'lng' => 124.4432,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan',
            ],
            'sinai' => [
                'name' => 'Sinai, Laguindingan',
                'distance_km' => 2.4,
                'lat' => 8.5781,
                'lng' => 124.4282,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan',
            ],
            'gasi' => [
                'name' => 'Gasi, Laguindingan',
                'distance_km' => 3.0,
                'lat' => 8.5858,
                'lng' => 124.4428,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan',
            ],
            'aromahon' => [
                'name' => 'Aromahon, Laguindingan',
                'distance_km' => 2.9,
                'lat' => 8.5679,
                'lng' => 124.4251,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan',
            ],
            'kibaghot' => [
                'name' => 'Kibaghot, Laguindingan',
                'distance_km' => 3.0,
                'lat' => 8.5892,
                'lng' => 124.4525,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan',
            ],
            'lapad' => [
                'name' => 'Lapad, Laguindingan',
                'distance_km' => 2.8,
                'lat' => 8.5523,
                'lng' => 124.4311,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan',
            ],
            'liberty' => [
                'name' => 'Liberty, Laguindingan',
                'distance_km' => 4.6,
                'lat' => 8.5984,
                'lng' => 124.4411,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan',
            ],
            'mauswagon' => [
                'name' => 'Mauswagon, Laguindingan',
                'distance_km' => 5.1,
                'lat' => 8.5996,
                'lng' => 124.4147,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan',
            ],
            'moog' => [
                'name' => 'Moog, Laguindingan',
                'distance_km' => 5.8,
                'lat' => 8.6078,
                'lng' => 124.4693,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan',
            ],
            'tubajon' => [
                'name' => 'Tubajon, Laguindingan',
                'distance_km' => 11.5,
                'lat' => 8.6226,
                'lng' => 124.4628,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan',
            ],
            'laguindingan_airport' => [
                'name' => 'Laguindingan Airport',
                'distance_km' => 5.0,
                'lat' => 8.6100,
                'lng' => 124.4500,
                'type' => 'landmark',
                'priority' => 1,
                'region' => 'Laguindingan',
            ],

            // === PRIORITY 2: MISAMIS ORIENTAL ===
            'alubijid' => [
                'name' => 'Alubijid',
                'distance_km' => 3.9,
                'lat' => 8.5712669,
                'lng' => 124.4744229,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'gitagum' => [
                'name' => 'Gitagum',
                'distance_km' => 5.6,
                'lat' => 8.6000,
                'lng' => 124.4100,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'el_salvador' => [
                'name' => 'El Salvador City',
                'distance_km' => 10.1,
                'lat' => 8.5600,
                'lng' => 124.5300,
                'type' => 'city',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'opol' => [
                'name' => 'Opol',
                'distance_km' => 17.9,
                'lat' => 8.5200,
                'lng' => 124.5800,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'initao' => [
                'name' => 'Initao',
                'distance_km' => 22.3,
                'lat' => 8.5000,
                'lng' => 124.3000,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'cagayan_de_oro' => [
                'name' => 'Cagayan de Oro City',
                'distance_km' => 29.0,
                'lat' => 8.4767,
                'lng' => 124.6439,
                'type' => 'city',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'cagayan' => [
                'name' => 'Cagayan de Oro City',
                'distance_km' => 29.0,
                'lat' => 8.4767,
                'lng' => 124.6439,
                'type' => 'city',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'cdo' => [
                'name' => 'Cagayan de Oro City',
                'distance_km' => 29.0,
                'lat' => 8.4767,
                'lng' => 124.6439,
                'type' => 'city',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'naawan' => [
                'name' => 'Naawan',
                'distance_km' => 31.2,
                'lat' => 8.4300,
                'lng' => 124.2900,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'manticao' => [
                'name' => 'Manticao',
                'distance_km' => 35.1,
                'lat' => 8.4800,
                'lng' => 124.2900,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'lugait' => [
                'name' => 'Lugait',
                'distance_km' => 43.4,
                'lat' => 8.3400,
                'lng' => 124.2600,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'tagoloan' => [
                'name' => 'Tagoloan',
                'distance_km' => 46.0,
                'lat' => 8.5300,
                'lng' => 124.5700,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'villanueva' => [
                'name' => 'Villanueva',
                'distance_km' => 52.2,
                'lat' => 8.5800,
                'lng' => 124.7700,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'jasaan' => [
                'name' => 'Jasaan',
                'distance_km' => 62.1,
                'lat' => 8.6500,
                'lng' => 124.7500,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'claveria' => [
                'name' => 'Claveria',
                'distance_km' => 71.2,
                'lat' => 8.6100,
                'lng' => 124.9000,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'balingasag' => [
                'name' => 'Balingasag',
                'distance_km' => 78.5,
                'lat' => 8.7500,
                'lng' => 124.7700,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'lagonglong' => [
                'name' => 'Lagonglong',
                'distance_km' => 84.6,
                'lat' => 8.8000,
                'lng' => 124.7800,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'salay' => [
                'name' => 'Salay',
                'distance_km' => 98.0,
                'lat' => 8.8600,
                'lng' => 124.8400,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'sugbongcogon' => [
                'name' => 'Sugbongcogon',
                'distance_km' => 103.0,
                'lat' => 8.9500,
                'lng' => 124.9000,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'kinoguitan' => [
                'name' => 'Kinoguitan',
                'distance_km' => 112.0,
                'lat' => 8.9800,
                'lng' => 124.8800,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'balingoan' => [
                'name' => 'Balingoan',
                'distance_km' => 125.0,
                'lat' => 9.0000,
                'lng' => 124.8000,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'talisayan' => [
                'name' => 'Talisayan',
                'distance_km' => 127.0,
                'lat' => 8.8000,
                'lng' => 124.6500,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'medina' => [
                'name' => 'Medina',
                'distance_km' => 139.0,
                'lat' => 8.9000,
                'lng' => 124.9300,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'libertad' => [
                'name' => 'Libertad',
                'distance_km' => 12.1,
                'lat' => 8.9300,
                'lng' => 124.6500,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'gingoog' => [
                'name' => 'Gingoog City',
                'distance_km' => 60.0,
                'lat' => 8.8167,
                'lng' => 125.1000,
                'type' => 'city',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],

            // === PRIORITY 3: REGION 10 / NORTHERN MINDANAO ===
            'iligan' => [
                'name' => 'Iligan City',
                'distance_km' => 88.5,
                'lat' => 8.2280,
                'lng' => 124.2383,
                'type' => 'city',
                'priority' => 3,
                'region' => 'Lanao del Norte',
            ],
            'ozamiz' => [
                'name' => 'Ozamiz City',
                'distance_km' => 118.0,
                'lat' => 8.1455,
                'lng' => 123.8445,
                'type' => 'city',
                'priority' => 3,
                'region' => 'Misamis Occidental',
            ],
            'malaybalay' => [
                'name' => 'Malaybalay City',
                'distance_km' => 123.0,
                'lat' => 8.1567,
                'lng' => 125.1331,
                'type' => 'city',
                'priority' => 3,
                'region' => 'Bukidnon',
            ],
            'valencia' => [
                'name' => 'Valencia City',
                'distance_km' => 154.0,
                'lat' => 7.9044,
                'lng' => 125.0928,
                'type' => 'city',
                'priority' => 3,
                'region' => 'Bukidnon',
            ],

            // === PRIORITY 4: REST OF MINDANAO ===
            'davao' => [
                'name' => 'Davao City',
                'distance_km' => 317.0,
                'lat' => 7.1907,
                'lng' => 125.4553,
                'type' => 'city',
                'priority' => 4,
                'region' => 'Davao',
            ],
            'zamboanga' => [
                'name' => 'Zamboanga City',
                'distance_km' => 465.0,
                'lat' => 6.9127,
                'lng' => 122.0680,
                'type' => 'city',
                'priority' => 4,
                'region' => 'Zamboanga',
            ],
            'butuan' => [
                'name' => 'Butuan City',
                'distance_km' => 202.0,
                'lat' => 8.9475,
                'lng' => 125.5437,
                'type' => 'city',
                'priority' => 4,
                'region' => 'Agusan del Norte',
            ],
            'surigao' => [
                'name' => 'Surigao City',
                'distance_km' => 322.0,
                'lat' => 9.7836,
                'lng' => 125.4955,
                'type' => 'city',
                'priority' => 4,
                'region' => 'Surigao del Norte',
            ],

            // === LANDMARKS IN MISAMIS ORIENTAL ===
            'sm_cdo' => [
                'name' => 'SM City Cagayan de Oro',
                'distance_km' => 30.0,
                'lat' => 8.4900,
                'lng' => 124.6500,
                'type' => 'landmark',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
            'limketkai' => [
                'name' => 'Limketkai Center',
                'distance_km' => 29.5,
                'lat' => 8.4800,
                'lng' => 124.6400,
                'type' => 'landmark',
                'priority' => 2,
                'region' => 'Misamis Oriental',
            ],
        ];
    }

    /**
     * ✅ Enhanced search with priority filtering
     */
    public function searchPlaces($query)
    {
        $query = strtolower(trim($query));
        
        if (empty($query) || strlen($query) < 2) {
            return [
                'success' => true,
                'predictions' => [],
                'total' => 0,
                'source' => 'fallback',
            ];
        }

        $results = [];

        foreach ($this->locations as $key => $location) {
            $name = strtolower($location['name'] ?? '');
            $searchTerms = [$name, $key];
            
            // Add extra search terms
            if (strpos($name, 'city') !== false) {
                $searchTerms[] = str_replace(' city', '', $name);
            }
            if (strpos($name, 'laguindingan') !== false) {
                $searchTerms[] = str_replace('laguindingan', '', $name);
            }
            if (strpos($name, 'municipal') !== false) {
                $searchTerms[] = str_replace(' municipal hall', '', $name);
            }
            
            $matchFound = false;
            foreach ($searchTerms as $term) {
                $term = trim($term);
                if (empty($term)) continue;
                if (strpos($term, $query) !== false || strpos($query, $term) !== false) {
                    $matchFound = true;
                    break;
                }
            }
            
            if ($matchFound) {
                $lat = $location['lat'] ?? null;
                $lng = $location['lng'] ?? null;
                
                if ($lat === null || $lng === null) continue;
                
                $description = $location['name'];
                
                // Add region to description
                if ($location['type'] === 'barangay') {
                    $description .= ', Laguindingan, Misamis Oriental';
                } elseif ($location['type'] === 'municipality' || $location['type'] === 'landmark') {
                    $description .= ', Misamis Oriental';
                } elseif ($location['type'] === 'city') {
                    $description .= ', Philippines';
                } elseif ($location['type'] === 'origin') {
                    $description = 'Laguindingan Municipal Hall';
                }
                
                $results[] = [
                    'description' => $description,
                    'place_id' => 'fallback_' . $key,
                    'lat' => (float) $lat,
                    'lng' => (float) $lng,
                    'type' => $location['type'] ?? 'location',
                    'distance_km' => (float) ($location['distance_km'] ?? 0),
                    'priority' => $location['priority'] ?? 5,
                    'region' => $location['region'] ?? 'Unknown',
                ];
            }
        }

        // ✅ SORT: Priority first, then distance, then relevance
        usort($results, function($a, $b) use ($query) {
            // 1. Priority (1 = highest)
            if ($a['priority'] !== $b['priority']) {
                return $a['priority'] <=> $b['priority'];
            }
            
            // 2. Distance (closer = higher priority)
            $distDiff = ($a['distance_km'] ?? 999) <=> ($b['distance_km'] ?? 999);
            if ($distDiff !== 0) return $distDiff;
            
            // 3. Exact match
            $aExact = strpos(strtolower($a['description'] ?? ''), $query) === 0 ? 1 : 0;
            $bExact = strpos(strtolower($b['description'] ?? ''), $query) === 0 ? 1 : 0;
            return $bExact - $aExact;
        });

        Log::info('Fallback search results', [
            'query' => $query,
            'total' => count($results),
            'priority_breakdown' => [
                'p1_laguindingan' => count(array_filter($results, fn($r) => $r['priority'] === 1)),
                'p2_misamis_oriental' => count(array_filter($results, fn($r) => $r['priority'] === 2)),
                'p3_region10' => count(array_filter($results, fn($r) => $r['priority'] === 3)),
                'p4_mindanao' => count(array_filter($results, fn($r) => $r['priority'] === 4)),
            ],
        ]);

        return [
            'success' => true,
            'predictions' => array_slice($results, 0, 20),
            'total' => count($results),
            'source' => 'fallback',
        ];
    }

    /**
     * Calculate distance between two locations
     */
    public function calculateDistance($origin, $destination)
    {
        Log::info('Fallback calculateDistance', ['origin' => $origin, 'destination' => $destination]);
        
        $originData = $this->findLocation($origin) ?? $this->findLocationByPartialMatch($origin);
        if (!$originData) {
            return [
                'success' => false,
                'message' => 'Origin not found in fallback data'
            ];
        }
        
        $destData = $this->findLocation($destination) ?? $this->findLocationByPartialMatch($destination);
        if (!$destData) {
            return [
                'success' => false,
                'message' => 'Destination not found in fallback data'
            ];
        }

        $distanceKm = $this->haversineDistance(
            $originData['lat'], $originData['lng'],
            $destData['lat'], $destData['lng']
        );
        
        if ($distanceKm < 0.1) {
            $distanceKm = $destData['distance_km'] ?? 35.0;
        }
        
        $durationMinutes = round($distanceKm / 40 * 60, 1);

        return [
            'success' => true,
            'distance_km' => round($distanceKm, 2),
            'duration_minutes' => $durationMinutes,
            'origin' => $originData['name'] ?? 'Laguindingan Municipal Hall',
            'destination' => $destData['name'],
            'source' => 'haversine',
        ];
    }

    /**
     * Haversine formula for accurate distance calculation
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
     * Find a location by partial match
     */
    private function findLocationByPartialMatch($query)
    {
        $query = strtolower(trim($query));
        $bestMatch = null;
        $bestScore = 0;

        foreach ($this->locations as $key => $location) {
            $name = strtolower($location['name'] ?? '');
            $score = 0;
            
            if (strpos($name, $query) !== false) {
                $score = strlen($query) / max(strlen($name), 1) * 100;
            }
            
            if (strpos($query, $name) !== false && strlen($name) > 3) {
                $score = strlen($name) / max(strlen($query), 1) * 100;
            }
            
            if (strpos($key, $query) !== false) {
                $score = max($score, 50);
            }
            
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestMatch = $location;
            }
        }

        return $bestMatch;
    }

    /**
     * Find a location in the fallback data
     */
    private function findLocation($query)
    {
        $query = strtolower(trim($query));

        foreach ($this->locations as $key => $location) {
            $name = strtolower($location['name'] ?? '');
            if (strpos($name, $query) !== false || strpos($key, $query) !== false) {
                return $location;
            }
        }

        return null;
    }

    /**
     * Geocode using fallback data
     */
    public function geocode($address)
    {
        $location = $this->findLocation($address) ?? $this->findLocationByPartialMatch($address);
        
        if ($location) {
            return [
                'success' => true,
                'lat' => $location['lat'],
                'lng' => $location['lng'],
                'display_name' => $location['name'],
                'source' => 'fallback',
            ];
        }

        return [
            'success' => false,
            'message' => 'Location not found in fallback data'
        ];
    }

    /**
     * Calculate complete trip estimate with fuel calculations
     */
    public function calculateTripEstimate($originAddress, $destinationAddress, $vehicleId = null, $roundTrip = true)
    {
        $result = $this->calculateDistance($originAddress, $destinationAddress);
        
        if (!$result['success']) return $result;

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
            return 75.00;
        }
    }
}
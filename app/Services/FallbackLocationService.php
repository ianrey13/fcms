<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class FallbackLocationService
{
    protected $locations = [];

    public function __construct()
    {
        $this->locations = [

            // ==================== ORIGIN ====================
            'laguindingan_municipal_hall' => [
                'name' => 'Laguindingan Municipal Hall',
                'distance_km' => 0,
                'lat' => 8.573217025849702,
                'lng' => 124.44408491080871,
                'type' => 'origin',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['municipal hall', 'laguindingan hall', 'town hall'],
            ],
            'laguindingan' => [
                'name' => 'Laguindingan',
                'distance_km' => 0,
                'lat' => 8.573217025849702,
                'lng' => 124.44408491080871,
                'type' => 'municipality',
                'priority' => 1,
                'region' => 'Misamis Oriental',
                'aliases' => ['laguindingan poblacion', 'poblacion'],
            ],

            // ==================== LAGUINDINGAN BARANGAYS ====================
            'sinai' => [
                'name' => 'Sinai, Laguindingan',
                'distance_km' => 2.1,
                'lat' => 8.579140064923502,
                'lng' => 124.42623233979945,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['sinai barangay hall', 'sinai hall'],
            ],
            'sambulawan' => [
                'name' => 'Sambulawan, Laguindingan',
                'distance_km' => 3.5,
                'lat' => 8.588882207574162,
                'lng' => 124.4198079407003,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['sambulawan barangay hall'],
            ],
            'mauswagon' => [
                'name' => 'Mauswagon, Laguindingan',
                'distance_km' => 5.3,
                'lat' => 8.600695995707298,
                'lng' => 124.41404409447382,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['mauswagon barangay hall'],
            ],
            'kibaghot' => [
                'name' => 'Kibaghot, Laguindingan',
                'distance_km' => 2.4,
                'lat' => 8.590476453445167,
                'lng' => 124.45143455712116,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['kibagot', 'kibaghot barangay hall', 'kibagot barangay hall'],
            ],
            'tubajon' => [
                'name' => 'Tubajon, Laguindingan',
                'distance_km' => 11.4,
                'lat' => 8.621431183919565,
                'lng' => 124.4619632769859,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['tubajon barangay hall'],
            ],
            'moog' => [
                'name' => 'Moog, Laguindingan',
                'distance_km' => 5.8,
                'lat' => 8.60794417988988,
                'lng' => 124.4693180377182,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['mooog', 'moog barangay hall'],
            ],
            'aromahon' => [
                'name' => 'Aromahon, Laguindingan',
                'distance_km' => 2.3,
                'lat' => 8.568188570966955,
                'lng' => 124.42507621024971,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['aromahon barangay hall'],
            ],
            'lapad' => [
                'name' => 'Lapad, Laguindingan',
                'distance_km' => 3.1,
                'lat' => 8.552553257537511,
                'lng' => 124.43029849640729,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['lapad barangay hall'],
            ],
            'gasi' => [
                'name' => 'Gasi, Laguindingan',
                'distance_km' => 3.5,
                'lat' => 8.592385430506832,
                'lng' => 124.43489460847877,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['gasi barangay hall'],
            ],
            'liberty' => [
                'name' => 'Liberty, Laguindingan',
                'distance_km' => 4.7,
                'lat' => 8.605952526998712,
                'lng' => 124.44462029289544,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['liberty barangay hall'],
            ],

            // ==================== MISAMIS ORIENTAL ====================
            'alubijid' => [
                'name' => 'Alubijid',
                'distance_km' => 3.6,
                'lat' => 8.571642437832274,
                'lng' => 124.47303079635617,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
                'aliases' => ['alubijid municipal hall'],
            ],
            'el_salvador' => [
                'name' => 'El Salvador City',
                'distance_km' => 10.1,
                'lat' => 8.562529843533776,
                'lng' => 124.52683585497097,
                'type' => 'city',
                'priority' => 2,
                'region' => 'Misamis Oriental',
                'aliases' => ['elsalvador', 'el salvador', 'el salvador city hall'],
            ],
            'opol' => [
                'name' => 'Opol',
                'distance_km' => 18.1,
                'lat' => 8.524410195364489,
                'lng' => 124.57426905264148,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
                'aliases' => ['opol municipal hall'],
            ],
            'gitagum' => [
                'name' => 'Gitagum',
                'distance_km' => 5.8,
                'lat' => 8.594809298885892,
                'lng' => 124.40570575930317,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
                'aliases' => ['gitagum municipal hall'],
            ],
            'libertad_mo' => [
                'name' => 'Libertad',
                'distance_km' => 13.5,
                'lat' => 8.566789930377434,
                'lng' => 124.3524752476905,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
                'aliases' => ['libertad municipal hall', 'libertad misamis oriental'],
            ],
            'initao' => [
                'name' => 'Initao',
                'distance_km' => 23.8,
                'lat' => 8.500924580259463,
                'lng' => 124.30392001162559,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
                'aliases' => ['initao municipal hall'],
            ],
            'naawan' => [
                'name' => 'Naawan',
                'distance_km' => 32.3,
                'lat' => 8.440138269449958,
                'lng' => 124.29149613187153,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
                'aliases' => ['naawan municipal hall'],
            ],
            'manticao' => [
                'name' => 'Manticao',
                'distance_km' => 36.1,
                'lat' => 8.410951658886399,
                'lng' => 124.28840622722058,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
                'aliases' => ['manticao municipal hall'],
            ],
            'lugait' => [
                'name' => 'Lugait',
                'distance_km' => 44.8,
                'lat' => 8.35476410172233,
                'lng' => 124.26056724906071,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
                'aliases' => ['lugait municipal hall'],
            ],

            // ==================== CAGAYAN DE ORO ====================
            'cdo_city_hall' => [
                'name' => 'Cagayan de Oro City Hall',
                'distance_km' => 29.0,
                'lat' => 8.481725211952732,
                'lng' => 124.64077461100696,
                'type' => 'landmark',
                'priority' => 2,
                'region' => 'Cagayan de Oro, Misamis Oriental',
                'aliases' => ['cdo city hall', 'cagayan de oro city hall'],
            ],
            'cdo_provincial_capitol' => [
                'name' => 'Provincial Capitol',
                'distance_km' => 29.4,
                'lat' => 8.484947954002099,
                'lng' => 124.64840582748698,
                'type' => 'landmark',
                'priority' => 2,
                'region' => 'Cagayan de Oro, Misamis Oriental',
                'aliases' => ['capitol', 'misamis oriental capitol'],
            ],
            'nmmc' => [
                'name' => 'Northern Mindanao Medical Center',
                'distance_km' => 29.2,
                'lat' => 8.486057186358508,
                'lng' => 124.64994047759362,
                'type' => 'landmark',
                'priority' => 2,
                'region' => 'Cagayan de Oro, Misamis Oriental',
                'aliases' => ['nmmc', 'nmmc cdo'],
            ],
            'polymedic' => [
                'name' => 'Cagayan de Oro Polymedic Medical Plaza',
                'distance_km' => 25.5,
                'lat' => 8.498859389869986,
                'lng' => 124.62997864341865,
                'type' => 'landmark',
                'priority' => 2,
                'region' => 'Cagayan de Oro, Misamis Oriental',
                'aliases' => ['polymedic', 'polymedic hospital'],
            ],
            'doctors_sabal' => [
                'name' => "Doctors' Sabal Hospital",
                'distance_km' => 29.0,
                'lat' => 8.48738039407041,
                'lng' => 124.64796674252271,
                'type' => 'landmark',
                'priority' => 2,
                'region' => 'Cagayan de Oro, Misamis Oriental',
                'aliases' => ['doctors sabal', 'sabal hospital'],
            ],

            // ==================== REGION 10 ====================
            'iligan' => [
                'name' => 'Iligan City',
                'distance_km' => 88.5,
                'lat' => 8.2280, 'lng' => 124.2383,
                'type' => 'city', 'priority' => 3, 'region' => 'Lanao del Norte',
                'aliases' => ['iligan city hall'],
            ],
            'ozamiz' => [
                'name' => 'Ozamiz City',
                'distance_km' => 118.0,
                'lat' => 8.1455, 'lng' => 123.8445,
                'type' => 'city', 'priority' => 3, 'region' => 'Misamis Occidental',
                'aliases' => ['ozamiz city hall'],
            ],
            'malaybalay' => [
                'name' => 'Malaybalay City',
                'distance_km' => 123.0,
                'lat' => 8.1567, 'lng' => 125.1331,
                'type' => 'city', 'priority' => 3, 'region' => 'Bukidnon',
                'aliases' => ['malaybalay city hall'],
            ],
            'valencia' => [
                'name' => 'Valencia City',
                'distance_km' => 154.0,
                'lat' => 7.9044, 'lng' => 125.0928,
                'type' => 'city', 'priority' => 3, 'region' => 'Bukidnon',
                'aliases' => ['valencia city hall'],
            ],
            'gingoog' => [
                'name' => 'Gingoog City',
                'distance_km' => 60.0,
                'lat' => 8.8167, 'lng' => 125.1000,
                'type' => 'city', 'priority' => 3, 'region' => 'Misamis Oriental',
                'aliases' => ['gingoog city hall'],
            ],

            // ==================== MINDANAO ====================
            'davao' => [
                'name' => 'Davao City',
                'distance_km' => 317.0,
                'lat' => 7.1907, 'lng' => 125.4553,
                'type' => 'city', 'priority' => 4, 'region' => 'Davao',
                'aliases' => ['davao city hall'],
            ],
            'butuan' => [
                'name' => 'Butuan City',
                'distance_km' => 202.0,
                'lat' => 8.9475, 'lng' => 125.5437,
                'type' => 'city', 'priority' => 4, 'region' => 'Agusan del Norte',
                'aliases' => ['butuan city hall'],
            ],
            'zamboanga' => [
                'name' => 'Zamboanga City',
                'distance_km' => 465.0,
                'lat' => 6.9127, 'lng' => 122.0680,
                'type' => 'city', 'priority' => 4, 'region' => 'Zamboanga',
                'aliases' => ['zamboanga city hall'],
            ],
            'surigao' => [
                'name' => 'Surigao City',
                'distance_km' => 322.0,
                'lat' => 9.7836, 'lng' => 125.4955,
                'type' => 'city', 'priority' => 4, 'region' => 'Surigao del Norte',
                'aliases' => ['surigao city hall'],
            ],
        ];
    }

    /**
     * Search places — always returns success
     */
    public function searchPlaces($query)
    {
        $query = strtolower(trim($query));

        if (empty($query) || strlen($query) < 2) {
            return ['success' => true, 'predictions' => [], 'total' => 0, 'source' => 'fallback'];
        }

        $results = [];

        foreach ($this->locations as $key => $location) {
            $name = strtolower($location['name'] ?? '');
            $aliases = array_map('strtolower', $location['aliases'] ?? []);
            $searchTerms = array_merge([$name, strtolower($key)], $aliases);

            $matchFound = false;
            foreach ($searchTerms as $term) {
                $term = trim($term);
                if (empty($term)) continue;
                if (strpos($term, $query) !== false || strpos($query, $term) !== false) {
                    $matchFound = true;
                    break;
                }
            }
            if (!$matchFound) continue;

            $lat = $location['lat'] ?? null;
            $lng = $location['lng'] ?? null;
            if ($lat === null || $lng === null) continue;

            $name = $location['name'];
            $description = $name;
            $nameLower = strtolower($name);

            if ($location['type'] === 'barangay') {
                if (strpos($nameLower, 'laguindingan') !== false) {
                    $description = $name . ', Misamis Oriental';
                } else {
                    $description = $name . ', Laguindingan, Misamis Oriental';
                }
            } elseif ($location['type'] === 'municipality') {
                if (strpos($nameLower, 'misamis oriental') === false) {
                    $description = $name . ', Misamis Oriental';
                }
            } elseif ($location['type'] === 'landmark') {
                if (strpos($nameLower, 'cagayan de oro') !== false || strpos($nameLower, 'misamis oriental') !== false) {
                    $description = $name;
                } else {
                    $description = $name . ', Misamis Oriental';
                }
            } elseif ($location['type'] === 'city') {
                if (strpos($nameLower, 'philippines') === false) {
                    $description = $name . ', Philippines';
                }
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

        usort($results, function ($a, $b) use ($query) {
            if ($a['priority'] !== $b['priority']) return $a['priority'] <=> $b['priority'];
            $distDiff = ($a['distance_km'] ?? 999) <=> ($b['distance_km'] ?? 999);
            if ($distDiff !== 0) return $distDiff;
            $aExact = strpos(strtolower($a['description']), $query) === 0 ? 1 : 0;
            $bExact = strpos(strtolower($b['description']), $query) === 0 ? 1 : 0;
            return $bExact - $aExact;
        });

        return [
            'success' => true,
            'predictions' => array_slice($results, 0, 20),
            'total' => count($results),
            'source' => 'fallback',
        ];
    }

    /**
     * ✅ FIXED: Use hard-coded distances when available, haversine as last resort
     */
    public function calculateDistance($origin, $destination)
    {
        $originData = $this->findLocation($origin) ?? $this->findLocationByPartialMatch($origin);
        if (!$originData) return ['success' => false, 'message' => 'Origin not found: ' . $origin];

        $destData = $this->findLocation($destination) ?? $this->findLocationByPartialMatch($destination);
        if (!$destData) return ['success' => false, 'message' => 'Destination not found: ' . $destination];

        $distanceKm = 0.0;
        $source = '';

        // ✅ BEST: origin is Laguindingan AND destination has known distance
        if ($this->isOriginLaguindingan($originData) && ($destData['distance_km'] ?? 0) > 0) {
            $distanceKm = (float) $destData['distance_km'];
            $source = 'known_from_laguindingan';
        }
        // ✅ GOOD: both have known distances → difference
        elseif (($destData['distance_km'] ?? 0) > 0 && ($originData['distance_km'] ?? 0) > 0) {
            $distanceKm = abs((float) $destData['distance_km'] - (float) $originData['distance_km']);
            $source = 'known_difference';
        }
        // ⚠️ FALLBACK: haversine with road factor
        else {
            $straightKm = $this->haversineDistance(
                $originData['lat'], $originData['lng'],
                $destData['lat'], $destData['lng']
            );
            $distanceKm = $straightKm * 1.25;
            $source = 'haversine_road_factor';
        }

        if ($distanceKm < 0.1) {
            $distanceKm = 0.1;
        }

        return [
            'success' => true,
            'distance_km' => round($distanceKm, 2),
            'duration_minutes' => $this->estimateDuration($distanceKm, $destData),
            'origin' => $originData['name'],
            'destination' => $destData['name'],
            'source' => $source,
        ];
    }

    /**
     * ✅ NEW: Speed estimation by destination type
     */
    private function estimateDuration($distanceKm, $destination)
    {
        $type = $destination['type'] ?? 'municipality';

        $avgSpeedKmh = match($type) {
            'barangay'     => 30,
            'municipality' => 40,
            'city'         => 25,
            'landmark'     => 25,
            'origin'       => 30,
            default        => 35,
        };

        return round($distanceKm / $avgSpeedKmh * 60, 1);
    }

    /**
     * ✅ NEW: Check if the location is Laguindingan (reference origin)
     */
    private function isOriginLaguindingan($location)
    {
        $name = strtolower($location['name'] ?? '');
        $type = $location['type'] ?? '';

        return $type === 'origin'
            || strpos($name, 'laguindingan municipal') !== false
            || ($type === 'municipality' && strpos($name, 'laguindingan') !== false);
    }

    private function haversineDistance($lat1, $lon1, $lat2, $lon2)
    {
        $earthRadius = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

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
            if (strpos(strtolower($key), $query) !== false) {
                $score = max($score, 50);
            }
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestMatch = $location;
            }
        }

        return $bestMatch;
    }

    private function findLocation($query)
    {
        $query = strtolower(trim($query));

        foreach ($this->locations as $key => $location) {
            $name = strtolower($location['name'] ?? '');
            $aliases = array_map('strtolower', $location['aliases'] ?? []);
            if (strpos($name, $query) !== false || strpos(strtolower($key), $query) !== false) {
                return $location;
            }
            foreach ($aliases as $alias) {
                if (strpos($alias, $query) !== false) return $location;
            }
        }

        $parts = array_map('trim', explode(',', $query));
        if (count($parts) > 1) {
            foreach ($parts as $part) {
                if (strlen($part) < 3) continue;
                foreach ($this->locations as $key => $location) {
                    $name = strtolower($location['name'] ?? '');
                    if (strpos($name, $part) !== false || strpos(strtolower($key), $part) !== false) {
                        return $location;
                    }
                }
            }
        }

        return null;
    }

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
        return ['success' => false, 'message' => 'Location not found in fallback data'];
    }

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

        $estimatedLitersWithBuffer = round($estimatedLiters * 1.1, 2);
        $estimatedCostWithBuffer = round($estimatedCost * 1.1, 2);

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
            'buffer_percentage' => 10,
            'source' => $result['source'],
        ];
    }

    private function getFuelPrice($fuelType = null)
    {
        $map = [
            'diesel' => 'diesel_price_per_liter',
            'premium' => 'premium_price_per_liter',
            'regular' => 'regular_price_per_liter',
            'gasoline' => 'regular_price_per_liter',
        ];
        $key = $map[strtolower($fuelType)] ?? 'regular_price_per_liter';
        try {
            $setting = \App\Models\SystemSetting::where('setting_key', $key)->first();
            return $setting ? (float) $setting->setting_value : 75.00;
        } catch (\Exception $e) {
            return 75.00;
        }
    }
}
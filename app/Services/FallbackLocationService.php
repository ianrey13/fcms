<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class FallbackLocationService
{
    protected $locations = [];

    public function __construct()
    {
        // Complete location data with guaranteed coordinates
        $this->locations = [
            // === ORIGIN / MUNICIPAL HALL ===
            'laguindingan_municipal_hall' => [
                'name' => 'Laguindingan Municipal Hall',
                'distance_km' => 0,
                'lat' => 8.5731,
                'lng' => 124.4432,
                'type' => 'origin'
            ],
            'laguindingan' => [
                'name' => 'Laguindingan',
                'distance_km' => 0,
                'lat' => 8.5731,
                'lng' => 124.4432,
                'type' => 'municipality'
            ],
            'poblacion' => [
                'name' => 'Poblacion, Laguindingan',
                'distance_km' => 0,
                'lat' => 8.5731,
                'lng' => 124.4432,
                'type' => 'barangay'
            ],
            // === MUNICIPALITIES IN MISAMIS ORIENTAL ===
            'alubijid' => [
                'name' => 'Alubijid',
                'distance_km' => 3.9,
                'lat' => 8.5712669, 
                'lng' => 124.4744229,
                'type' => 'municipality'
            ],
            'gitagum' => [
                'name' => 'Gitagum',
                'distance_km' => 5.6,
                'lat' => 8.6000,
                'lng' => 124.4100,
                'type' => 'municipality'
            ],
            'el_salvador' => [
                'name' => 'El Salvador City',
                'distance_km' => 10.1,
                'lat' => 8.5600,
                'lng' => 124.5300,
                'type' => 'city'
            ],
            'opol' => [
                'name' => 'Opol',
                'distance_km' => 17.9,
                'lat' => 8.5200,
                'lng' => 124.5800,
                'type' => 'municipality'
            ],
            'initao' => [
                'name' => 'Initao',
                'distance_km' => 22.3,
                'lat' => 8.5000,
                'lng' => 124.3000,
                'type' => 'municipality'
            ],
            'cagayan_de_oro' => [
                'name' => 'Cagayan de Oro City',
                'distance_km' => 29.0,
                'lat' => 8.4767,
                'lng' => 124.6439,
                'type' => 'city'
            ],
            'cagayan' => [
                'name' => 'Cagayan de Oro City',
                'distance_km' => 29.0,
                'lat' => 8.4767,
                'lng' => 124.6439,
                'type' => 'city'
            ],
            'cdo' => [
                'name' => 'Cagayan de Oro City',
                'distance_km' => 29.0,
                'lat' => 8.4767,
                'lng' => 124.6439,
                'type' => 'city'
            ],
            'naawan' => [
                'name' => 'Naawan',
                'distance_km' => 31.2,
                'lat' => 8.4300,
                'lng' => 124.2900,
                'type' => 'municipality'
            ],
            'manticao' => [
                'name' => 'Manticao',
                'distance_km' => 35.1,
                'lat' => 8.4800,
                'lng' => 124.2900,
                'type' => 'municipality'
            ],
            'lugait' => [
                'name' => 'Lugait',
                'distance_km' => 43.4,
                'lat' => 8.3400,
                'lng' => 124.2600,
                'type' => 'municipality'
            ],
            'tagoloan' => [
                'name' => 'Tagoloan',
                'distance_km' => 46.0,
                'lat' => 8.5300,
                'lng' => 124.5700,
                'type' => 'municipality'
            ],
            'villanueva' => [
                'name' => 'Villanueva',
                'distance_km' => 52.2,
                'lat' => 8.5800,
                'lng' => 124.7700,
                'type' => 'municipality'
            ],
            'jasaan' => [
                'name' => 'Jasaan',
                'distance_km' => 62.1,
                'lat' => 8.6500,
                'lng' => 124.7500,
                'type' => 'municipality'
            ],
            'claveria' => [
                'name' => 'Claveria',
                'distance_km' => 71.2,
                'lat' => 8.6100,
                'lng' => 124.9000,
                'type' => 'municipality'
            ],
            'balingasag' => [
                'name' => 'Balingasag',
                'distance_km' => 78.5,
                'lat' => 8.7500,
                'lng' => 124.7700,
                'type' => 'municipality'
            ],
            'lagonglong' => [
                'name' => 'Lagonglong',
                'distance_km' => 84.6,
                'lat' => 8.8000,
                'lng' => 124.7800,
                'type' => 'municipality'
            ],
            'salay' => [
                'name' => 'Salay',
                'distance_km' => 98.0,
                'lat' => 8.8600,
                'lng' => 124.8400,
                'type' => 'municipality'
            ],
            'sugbongcogon' => [
                'name' => 'Sugbongcogon',
                'distance_km' => 103.0,
                'lat' => 8.9500,
                'lng' => 124.9000,
                'type' => 'municipality'
            ],
            'kinoguitan' => [
                'name' => 'Kinoguitan',
                'distance_km' => 112.0,
                'lat' => 8.9800,
                'lng' => 124.8800,
                'type' => 'municipality'
            ],
            'balingoan' => [
                'name' => 'Balingoan',
                'distance_km' => 125.0,
                'lat' => 9.0000,
                'lng' => 124.8000,
                'type' => 'municipality'
            ],
            'talisayan' => [
                'name' => 'Talisayan',
                'distance_km' => 127.0,
                'lat' => 8.8000,
                'lng' => 124.6500,
                'type' => 'municipality'
            ],
            'medina' => [
                'name' => 'Medina',
                'distance_km' => 139.0,
                'lat' => 8.9000,
                'lng' => 124.9300,
                'type' => 'municipality'
            ],
            'libertad' => [
                'name' => 'Libertad',
                'distance_km' => 12.1,
                'lat' => 8.9300,
                'lng' => 124.6500,
                'type' => 'municipality'
            ],
            // === CITIES ===
            'iligan' => [
                'name' => 'Iligan City',
                'distance_km' => 88.5,
                'lat' => 8.2280,
                'lng' => 124.2383,
                'type' => 'city'
            ],
            'ozamiz' => [
                'name' => 'Ozamiz City',
                'distance_km' => 118.0,
                'lat' => 8.1455,
                'lng' => 123.8445,
                'type' => 'city'
            ],
            'malaybalay' => [
                'name' => 'Malaybalay City',
                'distance_km' => 123.0,
                'lat' => 8.1567,
                'lng' => 125.1331,
                'type' => 'city'
            ],
            'valencia' => [
                'name' => 'Valencia City',
                'distance_km' => 154.0,
                'lat' => 7.9044,
                'lng' => 125.0928,
                'type' => 'city'
            ],
            'gingoog' => [
                'name' => 'Gingoog City',
                'distance_km' => 60.0,
                'lat' => 8.8167,
                'lng' => 125.1000,
                'type' => 'city'
            ],
            'davao' => [
                'name' => 'Davao City',
                'distance_km' => 317.0,
                'lat' => 7.1907,
                'lng' => 125.4553,
                'type' => 'city'
            ],
            'zamboanga' => [
                'name' => 'Zamboanga City',
                'distance_km' => 465.0,
                'lat' => 6.9127,
                'lng' => 122.0680,
                'type' => 'city'
            ],
            'butuan' => [
                'name' => 'Butuan City',
                'distance_km' => 202.0,
                'lat' => 8.9475,
                'lng' => 125.5437,
                'type' => 'city'
            ],
            'surigao' => [
                'name' => 'Surigao City',
                'distance_km' => 322.0,
                'lat' => 9.7836,
                'lng' => 125.4955,
                'type' => 'city'
            ],
            // === BARANGAYS IN LAGUINDINGAN ===
            'sinai' => [
                'name' => 'Sinai, Laguindingan',
                'distance_km' => 2.4,
                'lat' => 8.5781,
                'lng' => 124.4282,
                'type' => 'barangay'
            ],
            'gasi' => [
                'name' => 'Gasi, Laguindingan',
                'distance_km' => 3.0,
                'lat' => 8.5858,
                'lng' => 124.4428,
                'type' => 'barangay'
            ],
            'aromahon' => [
                'name' => 'Aromahon, Laguindingan',
                'distance_km' => 2.9,
                'lat' => 8.5679,
                'lng' => 124.4251,
                'type' => 'barangay'
            ],
            'kibaghot' => [
                'name' => 'Kibaghot, Laguindingan',
                'distance_km' => 3.0,
                'lat' => 8.5892,
                'lng' => 124.4525,
                'type' => 'barangay'
            ],
            'lapad' => [
                'name' => 'Lapad, Laguindingan',
                'distance_km' => 2.8,
                'lat' => 8.5523,
                'lng' => 124.4311,
                'type' => 'barangay'
            ],
            'liberty' => [
                'name' => 'Liberty, Laguindingan',
                'distance_km' => 4.6,
                'lat' => 8.5984,
                'lng' => 124.4411,
                'type' => 'barangay'
            ],
            'mauswagon' => [
                'name' => 'Mauswagon, Laguindingan',
                'distance_km' => 5.1,
                'lat' => 8.5996,
                'lng' => 124.4147,
                'type' => 'barangay'
            ],
            'moog' => [
                'name' => 'Moog, Laguindingan',
                'distance_km' => 5.8,
                'lat' => 8.6078,
                'lng' => 124.4693,
                'type' => 'barangay'
            ],
            'tubajon' => [
                'name' => 'Tubajon, Laguindingan',
                'distance_km' => 11.5,
                'lat' => 8.6226,
                'lng' => 124.4628,
                'type' => 'barangay'
            ],
            // === ADDITIONAL POPULAR PLACES ===
            'laguindingan_airport' => [
                'name' => 'Laguindingan Airport',
                'distance_km' => 5.0,
                'lat' => 8.6100,
                'lng' => 124.4500,
                'type' => 'landmark'
            ],
            'sm_cdo' => [
                'name' => 'SM City Cagayan de Oro',
                'distance_km' => 30.0,
                'lat' => 8.4900,
                'lng' => 124.6500,
                'type' => 'landmark'
            ],
            'limketkai' => [
                'name' => 'Limketkai Center',
                'distance_km' => 29.5,
                'lat' => 8.4800,
                'lng' => 124.6400,
                'type' => 'landmark'
            ],
        ];
    }

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
            
            // Add extra search terms for better matching
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
                if (strpos($term, $query) !== false || strpos($query, $term) !== false) {
                    $matchFound = true;
                    break;
                }
            }
            
            if ($matchFound) {
                $lat = $location['lat'] ?? null;
                $lng = $location['lng'] ?? null;
                
                if ($lat === null || $lng === null) {
                    continue;
                }
                
                $description = $location['name'];
                
                if ($location['type'] === 'barangay') {
                    $description .= ', Laguindingan, Misamis Oriental';
                } elseif ($location['type'] === 'municipality') {
                    $description .= ', Misamis Oriental';
                } elseif ($location['type'] === 'city') {
                    $description .= ', Philippines';
                } elseif ($location['type'] === 'landmark') {
                    $description .= ', Misamis Oriental';
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
                ];
            }
        }

        // Sort by distance (closest first)
        usort($results, function($a, $b) {
            return ($a['distance_km'] ?? 999) <=> ($b['distance_km'] ?? 999);
        });

        Log::info('Fallback search results', [
            'query' => $query,
            'total' => count($results),
            'first_result' => count($results) > 0 ? $results[0]['description'] : null
        ]);

        return [
            'success' => true,
            'predictions' => array_slice($results, 0, 20),
            'total' => count($results),
            'source' => 'fallback',
        ];
    }

    /**
     * Calculate distance between two locations using fallback data
     */
    public function calculateDistance($origin, $destination)
    {
        Log::info('Fallback calculateDistance', ['origin' => $origin, 'destination' => $destination]);
        
        // Find origin
        $originData = $this->findLocation($origin);
        if (!$originData) {
            // Try harder to find origin
            $originData = $this->findLocationByPartialMatch($origin);
            if (!$originData) {
                Log::warning('Origin not found in fallback data', ['origin' => $origin]);
                return [
                    'success' => false,
                    'message' => 'Origin not found in fallback data'
                ];
            }
        }
        
        // Find destination
        $destData = $this->findLocation($destination);
        if (!$destData) {
            $destData = $this->findLocationByPartialMatch($destination);
            if (!$destData) {
                Log::warning('Destination not found in fallback data', ['destination' => $destination]);
                return [
                    'success' => false,
                    'message' => 'Destination not found in fallback data'
                ];
            }
        }

        $distanceKm = $destData['distance_km'] ?? 35.0;
        $durationMinutes = round($distanceKm / 40 * 60, 1);

        Log::info('Fallback distance calculated', [
            'origin' => $originData['name'],
            'destination' => $destData['name'],
            'distance_km' => $distanceKm,
            'duration_minutes' => $durationMinutes
        ]);

        return [
            'success' => true,
            'distance_km' => $distanceKm,
            'duration_minutes' => $durationMinutes,
            'origin' => $originData['name'] ?? 'Laguindingan Municipal Hall',
            'destination' => $destData['name'],
            'source' => 'fallback',
        ];
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
            
            // Check if query is contained in name
            if (strpos($name, $query) !== false) {
                $score = strlen($query) / strlen($name) * 100;
            }
            
            // Check if name is contained in query
            if (strpos($query, $name) !== false) {
                $score = strlen($name) / strlen($query) * 100;
            }
            
            // Check if key matches
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
        Log::info('Fallback geocode', ['address' => $address]);
        
        $location = $this->findLocation($address);
        
        if (!$location) {
            $location = $this->findLocationByPartialMatch($address);
        }
        
        if ($location) {
            Log::info('Geocode found', ['location' => $location['name']]);
            return [
                'success' => true,
                'lat' => $location['lat'],
                'lng' => $location['lng'],
                'display_name' => $location['name'],
                'source' => 'fallback',
            ];
        }

        Log::warning('Geocode not found', ['address' => $address]);
        return [
            'success' => false,
            'message' => 'Location not found in fallback data'
        ];
    }
}
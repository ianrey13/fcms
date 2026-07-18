<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class GraphHopperService
{
    protected $apiKey;
    protected $baseUrl;
    
    // Fixed origin coordinates (LGU Building Laguindingan)
    private $originCoords = [124.4432, 8.5731];
    
    public function __construct()
    {
        $this->apiKey = config('services.graphhopper.key');
        $this->baseUrl = config('services.graphhopper.url', 'https://graphhopper.com/api/1');
    }
    
    /**
     * Calculate route distance using coordinates (more reliable)
     */
    public function getRouteDistance($destination, $vehicle = 'car')
    {
        if (!$this->apiKey) {
            Log::warning('GraphHopper API key not configured');
            return null;
        }
        
        // Try to geocode destination first to get coordinates
        $destCoords = $this->geocode($destination);
        
        if (!$destCoords || !$destCoords['success']) {
            Log::warning('Could not geocode destination', ['destination' => $destination]);
            return null;
        }
        
        try {
            // Use coordinates format: lat,lon (GraphHopper expects lat,lon)
            $originPoint = $this->originCoords[1] . ',' . $this->originCoords[0]; // lat,lon
            $destPoint = $destCoords['lat'] . ',' . $destCoords['lng'];
            
            $response = Http::get($this->baseUrl . '/route', [
                'point' => [$originPoint, $destPoint],
                'vehicle' => $vehicle,
                'key' => $this->apiKey,
                'locale' => 'en',
                'points_encoded' => false,
                'type' => 'json'
            ]);
            
            Log::info('GraphHopper API called', [
                'origin' => $originPoint,
                'destination' => $destPoint,
                'status' => $response->status()
            ]);
            
            if ($response->successful()) {
                $data = $response->json();
                
                if (isset($data['paths'][0])) {
                    $path = $data['paths'][0];
                    return [
                        'distance_km' => round($path['distance'] / 1000, 1),
                        'duration_min' => round($path['time'] / 60000),
                        'success' => true
                    ];
                }
            }
            
            Log::warning('GraphHopper route failed', [
                'status' => $response->status(),
                'response' => $response->body()
            ]);
            return null;
            
        } catch (\Exception $e) {
            Log::error('GraphHopper API error: ' . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Search for places (autocomplete) - uses text search
     */
    public function searchPlaces($query)
    {
        if (!$this->apiKey || strlen($query) < 2) {
            return [];
        }
        
        $cacheKey = "graphhopper_search_" . md5($query);
        
        return Cache::remember($cacheKey, now()->addHours(24), function () use ($query) {
            try {
                $response = Http::get($this->baseUrl . '/geocode', [
                    'q' => $query,
                    'key' => $this->apiKey,
                    'locale' => 'en',
                    'limit' => 10,
                    'country' => 'ph'
                ]);
                
                if ($response->successful()) {
                    $hits = $response->json('hits', []);
                    
                    return array_map(function($hit) {
                        return [
                            'name' => $hit['name'] ?? $hit['fullname'] ?? 'Unknown',
                            'coordinates' => [
                                $hit['point']['lng'] ?? 0,
                                $hit['point']['lat'] ?? 0
                            ],
                            'country' => $hit['country'] ?? 'Philippines',
                            'type' => $hit['osm_key'] ?? 'place',
                        ];
                    }, $hits);
                }
                
                return [];
                
            } catch (\Exception $e) {
                Log::error('GraphHopper search error: ' . $e->getMessage());
                return [];
            }
        });
    }
    
    /**
     * Geocode address to coordinates (uses GraphHopper geocoding)
     */
    public function geocode($address)
    {
        if (!$this->apiKey) {
            return null;
        }
        
        try {
            $response = Http::get($this->baseUrl . '/geocode', [
                'q' => $address,
                'key' => $this->apiKey,
                'locale' => 'en',
                'limit' => 1
            ]);
            
            if ($response->successful()) {
                $hits = $response->json('hits', []);
                
                if (!empty($hits)) {
                    $hit = $hits[0];
                    return [
                        'lat' => $hit['point']['lat'],
                        'lng' => $hit['point']['lng'],
                        'name' => $hit['name'] ?? $address,
                        'formatted_address' => $hit['fullname'] ?? $address,
                        'success' => true
                    ];
                }
            }
            
            return null;
            
        } catch (\Exception $e) {
            Log::error('GraphHopper geocode error: ' . $e->getMessage());
            return null;
        }
    }
}
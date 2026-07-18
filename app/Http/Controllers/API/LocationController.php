<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\LocationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class LocationController extends Controller
{
    protected $locationService;
    
    public function __construct(LocationService $locationService)
    {
        $this->locationService = $locationService;
    }
    
    /**
     * Search for locations
     */
    public function search(Request $request)
    {
        $query = $request->query('query', '');
        
        if (strlen($query) < 2) {
            return response()->json(['data' => []]);
        }
        
        $results = $this->locationService->search($query);
        
        return response()->json([
            'data' => $results,
            'source' => 'local_database'
        ]);
    }
    
    /**
     * Calculate distance and fuel estimate 
     */
    public function calculateDistance(Request $request)
    {
        try {
            $destinationName = trim($request->input('name', ''));
            $vehicleId = $request->input('vehicle_id', null);
            $fuelPrice = $request->input('fuel_price', 55.00);
            $vehicleType = $request->input('vehicle_type', 'car');
            
            if (!$destinationName) {
                return response()->json(['error' => 'Destination required'], 400);
            }
            
            // Get distance from config 
            $distanceData = $this->getDistanceFromConfig($destinationName);
            
            if (!$distanceData || !isset($distanceData['distance_km'])) {
                return response()->json([
                    'data' => $this->manualResponse($destinationName, $fuelPrice)
                ]);
            }
            
            // Get one way and round trip distances
            $oneWayKm = (float) $distanceData['distance_km'];
            $roundTripKm = $oneWayKm * 2;
            
            // Get fuel consumption rate
            $fuelRate = $this->getFuelRate($vehicleId, $vehicleType);
            
            // Calculate fuel estimate for ROUND TRIP
            $fuelLiters = round($roundTripKm * $fuelRate, 1);
            $fuelCost = round($fuelLiters * $fuelPrice, 2);
            
            return response()->json([
                'data' => [
                    'origin' => 'LGU Building Laguindingan (Poblacion)',
                    'destination' => $distanceData['name'],
                    'destination_type' => $distanceData['type'] ?? 'municipality',
                    'one_way_km' => round($oneWayKm, 1),
                    'round_trip_km' => round($roundTripKm, 1),
                    'distance_km' => round($oneWayKm, 1),
                    'total_distance_km' => round($roundTripKm, 1),
                    'distance_text' => round($roundTripKm, 1) . ' km (round trip)',
                    'duration_min' => round($roundTripKm * 1.5),
                    'duration_text' => round($roundTripKm * 1.5) . ' minutes approx.',
                    'estimated_fuel_liters' => $fuelLiters,
                    'estimated_fuel_cost' => $fuelCost,
                    'fuel_price_used' => $fuelPrice,
                    'fuel_rate_used' => $fuelRate,
                    'calculation_method' => 'local_database',
                    'tip' => $this->getFuelTip($destinationName, $oneWayKm, $fuelLiters),
                    'calculated_at' => now()->toDateTimeString(),
                ],
                'source' => 'local_database'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Distance calculation error: ' . $e->getMessage());
            
            return response()->json([
                'data' => $this->manualResponse(
                    $request->input('name', 'Destination'),
                    $request->input('fuel_price', 55.00)
                )
            ]);
        }
    }
    
    /**
     * Get distance from config 
     */
    private function getDistanceFromConfig($destinationName)
    {
        $destinationLower = strtolower($destinationName);
        
        // Check municipalities first
        $municipalities = config('locations.municipalities', []);
        foreach ($municipalities as $key => $value) {
            if (strpos($destinationLower, $key) !== false) {
                // Handle both old and new structure
                if (is_array($value)) {
                    return [
                        'name' => $value['name'] ?? ucfirst($key),
                        'distance_km' => $value['distance_km'] ?? 0,
                        'type' => 'municipality'
                    ];
                } else {
                    return [
                        'name' => ucfirst($key),
                        'distance_km' => $value,
                        'type' => 'municipality'
                    ];
                }
            }
        }
        
        // Check barangays
        $barangays = config('locations.barangays', []);
        foreach ($barangays as $key => $value) {
            if (strpos($destinationLower, $key) !== false) {
                if (is_array($value)) {
                    return [
                        'name' => $value['name'] ?? ucfirst($key),
                        'distance_km' => $value['distance_km'] ?? 0,
                        'type' => 'barangay',
                        'description' => $value['description'] ?? ''
                    ];
                } else {
                    return [
                        'name' => ucfirst($key),
                        'distance_km' => $value,
                        'type' => 'barangay'
                    ];
                }
            }
        }
        
        // Check major cities
        $majorCities = config('locations.major_cities', []);
        foreach ($majorCities as $key => $value) {
            if (strpos($destinationLower, $key) !== false) {
                return [
                    'name' => $value['name'] ?? ucfirst($key),
                    'distance_km' => $value['distance_km'] ?? 0,
                    'type' => 'city',
                    'province' => $value['province'] ?? ''
                ];
            }
        }
        
        return null;
    }
    
    /**
     * Get fuel rate based on vehicle (L/km)
     */
    private function getFuelRate($vehicleId, $vehicleType)
    {
        // Get from config
        $fuelRates = config('locations.fuel_rates', []);
        
        // If vehicle ID provided, try to get from database
        if ($vehicleId) {
            try {
                $vehicle = \App\Models\Vehicle::find($vehicleId);
                if ($vehicle && $vehicle->fuel_type) {
                    $fuelType = strtolower($vehicle->fuel_type);
                    $vehicleFuelRates = [
                        'diesel' => $fuelRates['car_diesel'] ?? 0.12,
                        'regular' => $fuelRates['car_regular'] ?? 0.11,
                        'premium' => $fuelRates['car_premium'] ?? 0.10,
                    ];
                    return $vehicleFuelRates[$fuelType] ?? 0.12;
                }
            } catch (\Exception $e) {
                Log::warning('Could not fetch vehicle: ' . $e->getMessage());
            }
        }
        
        // Fallback to vehicle type
        return $fuelRates[$vehicleType] ?? $fuelRates['default'] ?? 0.12;
    }
    
    /**
     * Get fuel tip based on destination
     */
    private function getFuelTip($destinationName, $oneWayKm, $fuelLiters)
    {
        $destinationLower = strtolower($destinationName);
        
        if (strpos($destinationLower, 'cdo') !== false || strpos($destinationLower, 'cagayan') !== false) {
            return "📍 Cagayan de Oro is {$oneWayKm}km one-way from Laguindingan. Round trip: " . ($oneWayKm * 2) . "km → ≈{$fuelLiters} liters fuel.";
        }
        
        if (strpos($destinationLower, 'alubijid') !== false) {
            return "📍 Alubijid is {$oneWayKm}km one-way → " . ($oneWayKm * 2) . "km round trip → ≈{$fuelLiters} liters fuel.";
        }
        
        if (strpos($destinationLower, 'opol') !== false) {
            return "📍 Opol is {$oneWayKm}km one-way → " . ($oneWayKm * 2) . "km round trip → ≈{$fuelLiters} liters fuel.";
        }
        
        return "💡 Based on LGU records: {$oneWayKm}km one-way, {$fuelLiters} liters estimated for round trip.";
    }
    
    /**
     * Manual entry response
     */
    private function manualResponse($destinationName, $fuelPrice)
    {
        return [
            'origin' => 'LGU Building Laguindingan',
            'destination' => ucwords($destinationName),
            'one_way_km' => null,
            'round_trip_km' => null,
            'distance_km' => null,
            'total_distance_km' => null,
            'distance_text' => 'Manual entry required',
            'duration_min' => null,
            'duration_text' => 'Unknown',
            'estimated_fuel_liters' => null,
            'estimated_fuel_cost' => null,
            'fuel_price_used' => $fuelPrice,
            'calculation_method' => 'manual_required',
            'message' => 'Distance not in database. Please enter manually.',
            'tip' => '📋 Available destinations: Cagayan de Oro, Alubijid, Opol, Tagoloan, Iligan, and all Laguindingan barangays',
            'calculated_at' => now()->toDateTimeString(),
        ];
    }
    
    /**
     * Get all municipalities
     */
    public function getMunicipalities(Request $request)
    {
        $municipalities = config('locations.municipalities', []);
        $formatted = [];
        
        foreach ($municipalities as $key => $value) {
            if (is_array($value)) {
                $formatted[] = [
                    'key' => $key,
                    'name' => $value['name'],
                    'distance_km' => $value['distance_km']
                ];
            } else {
                $formatted[] = [
                    'key' => $key,
                    'name' => ucfirst($key),
                    'distance_km' => $value
                ];
            }
        }
        
        return response()->json([
            'data' => $formatted,
            'total' => count($formatted),
            'source' => 'local_database'
        ]);
    }
    
    /**
     * Get all barangays
     */
    public function getBarangays(Request $request)
    {
        $barangays = config('locations.barangays', []);
        $formatted = [];
        
        foreach ($barangays as $key => $value) {
            if (is_array($value)) {
                $formatted[] = [
                    'key' => $key,
                    'name' => $value['name'],
                    'distance_km' => $value['distance_km'],
                    'description' => $value['description'] ?? ''
                ];
            } else {
                $formatted[] = [
                    'key' => $key,
                    'name' => ucfirst($key),
                    'distance_km' => $value
                ];
            }
        }
        
        return response()->json([
            'data' => $formatted,
            'total' => count($formatted),
            'source' => 'local_database'
        ]);
    }
    
    /**
     * Geocode (simple local lookup)
     */
    public function geocode(Request $request)
    {
        $address = trim($request->input('address', ''));
        
        if (!$address) {
            return response()->json(['error' => 'Address required'], 400);
        }
        
        $distanceData = $this->getDistanceFromConfig($address);
        
        if ($distanceData) {
            return response()->json([
                'data' => [
                    'name' => $distanceData['name'],
                    'distance_km' => $distanceData['distance_km'],
                    'type' => $distanceData['type'],
                    'reference' => 'Distance from LGU Laguindingan'
                ],
                'source' => 'local_database'
            ]);
        }
        
        $municipalities = array_keys(config('locations.municipalities', []));
        $barangays = array_keys(config('locations.barangays', []));
        
        return response()->json([
            'error' => 'Location not found',
            'available_municipalities' => $municipalities,
            'available_barangays' => $barangays
        ], 404);
    }
}
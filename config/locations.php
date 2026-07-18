<?php

return [
    /*
    |--------------------------------------------------------------------------
    | FCMS Location Database
    |--------------------------------------------------------------------------
    | This file contains all pre-calculated distances from LGU Laguindingan
    | Based on actual Excel records and verified routes
    | Last Updated: May 1, 2026
    */
    
    // Origin point (LGU Building Laguindingan - Poblacion)
    'origin' => [
        'name' => 'LGU  Laguindingan',
        'address' => 'Poblacion, Laguindingan, Misamis Oriental',
        'coordinates' => [124.4432, 8.5731], 
        'lat' => 8.5731,
        'lng' => 124.4432,
    ],
    
    // Barangays of Laguindingan with accurate coordinates
    'barangays' => [
        'poblacion' => [
            'name' => 'Poblacion', 
            'distance_km' => 0,
            'coordinates' => [124.4432, 8.5731],
            'lat' => 8.5731,
            'lng' => 124.4432,
            'description' => 'Municipal Hall / Town Center'
        ],
        'sinai' => [
            'name' => 'Sinai', 
            'distance_km' => 2.4,
            'coordinates' => [124.4282, 8.5781],
            'lat' => 8.5781,
            'lng' => 124.4282,
            'description' => 'Western barangay'
        ],
        'gasi' => [
            'name' => 'Gasi', 
            'distance_km' => 3.0,
            'coordinates' => [124.4428, 8.5858],
            'lat' => 8.5858,
            'lng' => 124.4428,
            'description' => 'Northern barangay'
        ],
        'aromahon' => [
            'name' => 'Aromahon', 
            'distance_km' => 2.9,
            'coordinates' => [124.4251, 8.5679],
            'lat' => 8.5679,
            'lng' => 124.4251,
            'description' => 'Southwestern barangay'
        ],
        'kibaghot' => [
            'name' => 'Kibaghot', 
            'distance_km' => 3.0,
            'coordinates' => [124.4525, 8.5892],
            'lat' => 8.5892,
            'lng' => 124.4525,
            'description' => 'Northeastern barangay'
        ],
        'lapad' => [
            'name' => 'Lapad', 
            'distance_km' => 2.8,
            'coordinates' => [124.4311, 8.5523],
            'lat' => 8.5523,
            'lng' => 124.4311,
            'description' => 'Southern barangay'
        ],
        'liberty' => [
            'name' => 'Liberty', 
            'distance_km' => 4.6,
            'coordinates' => [124.4411, 8.5984],
            'lat' => 8.5984,
            'lng' => 124.4411,
            'description' => 'Northern barangay'
        ],
        'mauswagon' => [
            'name' => 'Mauswagon', 
            'distance_km' => 5.1,
            'coordinates' => [124.4147, 8.5996],
            'lat' => 8.5996,
            'lng' => 124.4147,
            'description' => 'Northwestern barangay'
        ],
        'moog' => [
            'name' => 'Moog', 
            'distance_km' => 5.8,
            'coordinates' => [124.4693, 8.6078],
            'lat' => 8.6078,
            'lng' => 124.4693,
            'description' => 'Eastern barangay near airport'
        ],
        'tubajon' => [
            'name' => 'Tubajon', 
            'distance_km' => 11.5,
            'coordinates' => [124.4628, 8.6226],
            'lat' => 8.6226,
            'lng' => 124.4628,
            'description' => 'Farthest barangay, northernmost'
        ],
    ],
    
    // Municipalities with distances (km) from Laguindingan
    'municipalities' => [
        // First District - Closest municipalities
        'alubijid' => ['name' => 'Alubijid', 'distance_km' => 3.7],
        'gitagum' => ['name' => 'Gitagum', 'distance_km' => 5.6],
        'opol' => ['name' => 'Opol', 'distance_km' => 17.9],
        'el salvador' => ['name' => 'El Salvador', 'distance_km' => 10.1],
        'initao' => ['name' => 'Initao', 'distance_km' => 22.3],
        'naawan' => ['name' => 'Naawan', 'distance_km' => 31.2],
        'manticao' => ['name' => 'Manticao', 'distance_km' => 35.1],
        'lugait' => ['name' => 'Lugait', 'distance_km' => 43.4],
        
        // Second District - Municipalities east of Laguindingan
        'cagayan de oro' => ['name' => 'Cagayan de Oro', 'distance_km' => 29.0],
        'cdo' => ['name' => 'Cagayan de Oro', 'distance_km' => 29.0],
        'tagoloan' => ['name' => 'Tagoloan', 'distance_km' => 46.0],
        'villanueva' => ['name' => 'Villanueva', 'distance_km' => 52.2],
        'jasaan' => ['name' => 'Jasaan', 'distance_km' => 62.1],
        'salay' => ['name' => 'Salay', 'distance_km' => 98.0],
        'balingasag' => ['name' => 'Balingasag', 'distance_km' => 78.5],
        'lagonglong' => ['name' => 'Lagonglong', 'distance_km' => 84.6],
        
        // Third District - Municipalities east of Balingasag
        'balingoan' => ['name' => 'Balingoan', 'distance_km' => 125.0],
        'talisayan' => ['name' => 'Talisayan', 'distance_km' =>127.0],
        'kinoguitan' => ['name' => 'Kinoguitan', 'distance_km' => 112.0],
        'medina' => ['name' => 'Medina', 'distance_km' => 139.0],
        'claveria' => ['name' => 'Claveria', 'distance_km' => 71.2],
        'sugbongcogon' => ['name' => 'Sugbongcogon', 'distance_km' => 103.0],
        
        // Other municipalities
        'libertad' => ['name' => 'Libertad', 'distance_km' => 12.1],
        'magsaysay' => ['name' => 'Magsaysay', 'distance_km' => 159.0],
    ],
    
    // Major cities outside Misamis Oriental
    'major_cities' => [
        'butuan' => ['name' => 'Butuan City', 'distance_km' => 202, 'province' => 'Agusan del Norte'],
        'surigao' => ['name' => 'Surigao City', 'distance_km' => 322, 'province' => 'Surigao del Norte'],
        'malaybalay' => ['name' => 'Malaybalay City', 'distance_km' => 123, 'province' => 'Bukidnon'],
        'valencia' => ['name' => 'Valencia City', 'distance_km' => 154, 'province' => 'Bukidnon'],
        'iligan' => ['name' => 'Iligan City', 'distance_km' => 88.5, 'province' => 'Lanao del Norte'],
        'ozamiz' => ['name' => 'Ozamiz City', 'distance_km' => 118, 'province' => 'Misamis Occidental'],
        'cotabato' => ['name' => 'Cotabato City', 'distance_km' => 263, 'province' => 'Maguindanao'],
        'davao' => ['name' => 'Davao City', 'distance_km' => 317, 'province' => 'Davao del Sur'],
        'zamboanga' => ['name' => 'Zamboanga City', 'distance_km' => 465, 'province' => 'Zamboanga del Sur'],
        'gensan' => ['name' => 'General Santos City', 'distance_km' => 395, 'province' => 'South Cotabato'],
    ],
    
    // Fuel consumption rates (L/km) by vehicle type
    'fuel_rates' => [
        // Cars
        'car' => 0.12,
        'car_diesel' => 0.12,
        'car_gasoline' => 0.11,
        'car_premium' => 0.10,
        'car_regular' => 0.11,
        
        // Trucks
        'truck' => 0.15,
        'truck_diesel' => 0.15,
        'cargo_truck' => 0.18,
        'dump_truck' => 0.20,
        
        // Special vehicles
        'motorcycle' => 0.08,
        'van' => 0.13,
        'ambulance' => 0.18,
        'suv' => 0.14,
        'pickup' => 0.13,
        
        // Default
        'default' => 0.12,
    ],
    
    // Travel settings
    'travel' => [
        'average_speed_kmh' => 40,    
        'average_speed_highway_kmh' => 60,  
        'round_trip_default' => true,  
        'buffer_percentage' => 10,     
    ],
    
    // Version tracking for future updates
    'version' => '1.0.0',
    'last_updated' => '2026-05-01',
];
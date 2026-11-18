<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class FallbackLocationService
{
    protected $locations = [];

    public function __construct()
    {
        $this->locations = [
            'laguindingan_municipal_hall' => [
                'name' => 'Laguindingan Municipal Hall',
                'distance_km' => 0,
                'distance_to_municipal_hall_km' => 0,
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
                'distance_to_municipal_hall_km' => 0,
                'lat' => 8.573217025849702,
                'lng' => 124.44408491080871,
                'type' => 'municipality',
                'priority' => 1,
                'region' => 'Misamis Oriental',
                'aliases' => ['laguindingan poblacion'],
            ],
            
            // ============ LAGUINDINGAN BARANGAYS (Updated from JSON) ============
            'aromahon' => [
                'name' => 'Aromahon, Laguindingan',
                'distance_km' => 5.3,
                'distance_to_municipal_hall_km' => 2.5,
                'lat' => 8.5681,
                'lng' => 124.4247,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['aromahon barangay hall'],
            ],
            'gasi' => [
                'name' => 'Gasi, Laguindingan',
                'distance_km' => 4.0,
                'distance_to_municipal_hall_km' => 3.0,
                'lat' => 8.5924,
                'lng' => 124.4352,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['gasi barangay hall'],
            ],
            'kibaghot' => [
                'name' => 'Kibaghot, Laguindingan',
                'distance_km' => 0.8,
                'distance_to_municipal_hall_km' => 3.7,
                'lat' => 8.5905,
                'lng' => 124.4514,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['kibagot', 'kibaghot barangay hall', 'kibagot barangay hall'],
            ],
            'lapad' => [
                'name' => 'Lapad, Laguindingan',
                'distance_km' => 6.1,
                'distance_to_municipal_hall_km' => 2.8,
                'lat' => 8.5504,
                'lng' => 124.4303,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['lapad barangay hall'],
            ],
            'liberty' => [
                'name' => 'Liberty, Laguindingan',
                'distance_km' => 5.0,
                'distance_to_municipal_hall_km' => 4.6,
                'lat' => 8.6048,
                'lng' => 124.4447,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['liberty barangay hall'],
            ],
            'mauswagon' => [
                'name' => 'Mauswagon, Laguindingan',
                'distance_km' => 8.7,
                'distance_to_municipal_hall_km' => 5.3,
                'lat' => 8.6008,
                'lng' => 124.4140,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['mauswagon barangay hall'],
            ],
            'moog' => [
                'name' => 'Moog, Laguindingan',
                'distance_km' => 2.5,
                'distance_to_municipal_hall_km' => 5.7,
                'lat' => 8.6079,
                'lng' => 124.4695,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['mooog', 'moog barangay hall'],
            ],
            'poblacion' => [
                'name' => 'Poblacion, Laguindingan',
                'distance_km' => 3.2,
                'distance_to_municipal_hall_km' => 1.0,
                'lat' => 8.5796,
                'lng' => 124.4445,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['poblacion laguindingan', 'poblacion barangay hall'],
            ],
            'sambulawan' => [
                'name' => 'Sambulawan, Laguindingan',
                'distance_km' => 6.4,
                'distance_to_municipal_hall_km' => 3.4,
                'lat' => 8.5889,
                'lng' => 124.4198,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['sambulawan barangay hall'],
            ],
            'sinai' => [
                'name' => 'Sinai, Laguindingan',
                'distance_km' => 5.1,
                'distance_to_municipal_hall_km' => 2.0,
                'lat' => 8.5786,
                'lng' => 124.4260,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['sinai barangay hall', 'sinai hall'],
            ],
            'tubajon' => [
                'name' => 'Tubajon, Laguindingan',
                'distance_km' => 11.8,
                'distance_to_municipal_hall_km' => 10.9,
                'lat' => 8.6214,
                'lng' => 124.4618,
                'type' => 'barangay',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['tubajon barangay hall'],
            ],

            // ============ SPECIAL GROUPS & LANDMARKS ============
            'all_barangay' => [
                'name' => 'All Barangay',
                'distance_km' => 11.4,
                'distance_to_municipal_hall_km' => 10.9,
                'lat' => 8.621431183919565,
                'lng' => 124.4619632769859,
                'type' => 'group',
                'priority' => 2,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['all barangay', 'all barangays'],
            ],
            'coastal_barangay' => [
                'name' => 'Coastal Barangay',
                'distance_km' => 11.4,
                'distance_to_municipal_hall_km' => 10.9,
                'lat' => 8.621427701784217,
                'lng' => 124.46134992481697,
                'type' => 'group',
                'priority' => 2,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['coastal barangay'],
            ],
            'aor_laguindingan' => [
                'name' => 'AOR Laguindingan',
                'distance_km' => 11.4,
                'distance_to_municipal_hall_km' => 10.9,
                'lat' => 8.624609137625352,
                'lng' => 124.46365073632487,
                'type' => 'group',
                'priority' => 2,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['aor', 'area of responsibility', 'laguindingan aor'],
            ],
            'laguindingan_airport' => [
                'name' => 'Laguindingan Airport',
                'distance_km' => 4.9,
                'distance_to_municipal_hall_km' => 3.0,
                'lat' => 8.610260789398502,
                'lng' => 124.45795811031401,
                'type' => 'landmark',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['airport', 'laguindingan airport terminal'],
            ],
            'gk_heights' => [
                'name' => 'GK Heights',
                'distance_km' => 5.0,
                'distance_to_municipal_hall_km' => 3.0,
                'lat' => 8.6100,
                'lng' => 124.4500,
                'type' => 'landmark',
                'priority' => 1,
                'region' => 'Laguindingan, Misamis Oriental',
                'aliases' => ['gk heights', 'gk', 'gk subdivision'],
            ],

            // ============ ALUBIJID BARANGAYS ============
            'alubijid_baybay' => [
                'name' => 'Baybay, Alubijid',
                'distance_km' => 4.2,
                'distance_to_municipal_hall_km' => 6.0,
                'lat' => 8.5870,
                'lng' => 124.4835,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['baybay alubijid'],
            ],
            'alubijid_benigwayan' => [
                'name' => 'Benigwayan, Alubijid',
                'distance_km' => 5.2,
                'distance_to_municipal_hall_km' => 5.0,
                'lat' => 8.5458,
                'lng' => 124.4457,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['benigwayan alubijid'],
            ],
            'alubijid_calatcat' => [
                'name' => 'Calatcat, Alubijid',
                'distance_km' => 7.0,
                'distance_to_municipal_hall_km' => 7.0,
                'lat' => 8.5507,
                'lng' => 124.4767,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['calatcat alubijid'],
            ],
            'alubijid_lagtang' => [
                'name' => 'Lagtang, Alubijid',
                'distance_km' => 5.4,
                'distance_to_municipal_hall_km' => 6.0,
                'lat' => 8.5657,
                'lng' => 124.4846,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['lagtang alubijid'],
            ],
            'alubijid_lanao' => [
                'name' => 'Lanao, Alubijid',
                'distance_km' => 4.0,
                'distance_to_municipal_hall_km' => 4.0,
                'lat' => 8.5785,
                'lng' => 124.4653,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['lanao alubijid'],
            ],
            'alubijid_loguilo' => [
                'name' => 'Loguilo, Alubijid',
                'distance_km' => 6.9,
                'distance_to_municipal_hall_km' => 8.0,
                'lat' => 8.5754,
                'lng' => 124.4993,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['loguilo alubijid'],
            ],
            'alubijid_lourdes' => [
                'name' => 'Lourdes, Alubijid',
                'distance_km' => 7.5,
                'distance_to_municipal_hall_km' => 8.0,
                'lat' => 8.5232,
                'lng' => 124.4340,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['lourdes alubijid'],
            ],
            'alubijid_lumbo' => [
                'name' => 'Lumbo, Alubijid',
                'distance_km' => 2.1,
                'distance_to_municipal_hall_km' => 2.5,
                'lat' => 8.5719,
                'lng' => 124.4575,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['lumbo alubijid'],
            ],
            'alubijid_molocboloc' => [
                'name' => 'Molocboloc, Alubijid',
                'distance_km' => 4.8,
                'distance_to_municipal_hall_km' => 4.0,
                'lat' => 8.5850,
                'lng' => 124.4657,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['molocboloc alubijid'],
            ],
            'alubijid_poblacion' => [
                'name' => 'Poblacion, Alubijid',
                'distance_km' => 4.2,
                'distance_to_municipal_hall_km' => 4.5,
                'lat' => 8.5745,
                'lng' => 124.4744,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['poblacion alubijid'],
            ],
            'alubijid_sampatulog' => [
                'name' => 'Sampatulog, Alubijid',
                'distance_km' => 9.3,
                'distance_to_municipal_hall_km' => 9.0,
                'lat' => 8.5380,
                'lng' => 124.4586,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['sampatulog alubijid'],
            ],
            'alubijid_sungay' => [
                'name' => 'Sungay, Alubijid',
                'distance_km' => 18.1,
                'distance_to_municipal_hall_km' => 18.0,
                'lat' => 8.4510,
                'lng' => 124.4070,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['sungay alubijid'],
            ],
            'alubijid_talaba' => [
                'name' => 'Talaba, Alubijid',
                'distance_km' => 8.1,
                'distance_to_municipal_hall_km' => 8.0,
                'lat' => 8.5418,
                'lng' => 124.4745,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['talaba alubijid'],
            ],
            'alubijid_taparak' => [
                'name' => 'Taparak, Alubijid',
                'distance_km' => 13.4,
                'distance_to_municipal_hall_km' => 13.0,
                'lat' => 8.4791,
                'lng' => 124.4112,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['taparak alubijid'],
            ],
            'alubijid_tugasnon' => [
                'name' => 'Tugasnon, Alubijid',
                'distance_km' => 14.3,
                'distance_to_municipal_hall_km' => 14.0,
                'lat' => 8.4963,
                'lng' => 124.4558,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['tugasnon alubijid'],
            ],
            'alubijid_tula' => [
                'name' => 'Tula, Alubijid',
                'distance_km' => 20.3,
                'distance_to_municipal_hall_km' => 20.0,
                'lat' => 8.4334,
                'lng' => 124.4167,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'Alubijid, Misamis Oriental',
                'aliases' => ['tula alubijid'],
            ],
            'alubijid_municipality' => [
                'name' => 'Alubijid',
                'distance_km' => 6.1, 
                'distance_to_municipal_hall_km' => 6.0,
                'lat' => 8.571642437832274,
                'lng' => 124.47303079635617,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
                'aliases' => ['alubijid municipal hall'],
            ],

            // ============ NEARBY MUNICIPALITIES / CITIES ============
            'el_salvador' => [
                'name' => 'El Salvador City',
                'distance_km' => 9.5, 
                'distance_to_municipal_hall_km' => 9.5,
                'lat' => 8.562529843533776,
                'lng' => 124.52683585497097,
                'type' => 'city',
                'priority' => 2,
                'region' => 'Misamis Oriental',
                'aliases' => ['elsalvador', 'el salvador', 'el salvador city hall'],
            ],
            'opol' => [
                'name' => 'Opol',
                'distance_km' => 17.7, 
                'distance_to_municipal_hall_km' => 17.7,
                'lat' => 8.524410195364489,
                'lng' => 124.57426905264148,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
                'aliases' => ['opol municipal hall'],
            ],
            'amoros' => [
                'name' => 'Amoros, El Salvador',
                'distance_km' => 16.3, 
                'distance_to_municipal_hall_km' => 16.3,
                'lat' => 8.5380, 
                'lng' => 124.5550,
                'type' => 'barangay',
                'priority' => 2,
                'region' => 'El Salvador, Misamis Oriental',
                'aliases' => ['amoros', 'amoros el salvador'],
            ],
            'initao' => [
                'name' => 'Initao',
                'distance_km' => 23.8,
                'distance_to_municipal_hall_km' => 23.8,
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
                'distance_to_municipal_hall_km' => 32.3,
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
                'distance_to_municipal_hall_km' => 36.1,
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
                'distance_to_municipal_hall_km' => 44.8,
                'lat' => 8.35476410172233,
                'lng' => 124.26056724906071,
                'type' => 'municipality',
                'priority' => 2,
                'region' => 'Misamis Oriental',
                'aliases' => ['lugait municipal hall'],
            ],
            'polymedic' => [
                'name' => 'Cagayan de Oro Polymedic Medical Plaza',
                'distance_km' => 25.5,
                'distance_to_municipal_hall_km' => 25.5,
                'lat' => 8.498859389869986,
                'lng' => 124.62997864341865,
                'type' => 'landmark',
                'priority' => 2,
                'region' => 'Cagayan de Oro, Misamis Oriental',
                'aliases' => ['polymedic', 'polymedic hospital'],
            ],
            'cdo_city_hall' => [
                'name' => 'Cagayan de Oro City',
                'distance_km' => 29.0,
                'distance_to_municipal_hall_km' => 29.0,
                'lat' => 8.481725211952732,
                'lng' => 124.64077461100696,
                'type' => 'landmark',
                'priority' => 2,
                'region' => 'Cagayan de Oro, Misamis Oriental',
                'aliases' => ['cdo city hall', 'cagayan de oro city hall'],
            ],
            'doctors_sabal' => [
                'name' => "Doctors' Sabal Hospital",
                'distance_km' => 29.0,
                'distance_to_municipal_hall_km' => 29.0,
                'lat' => 8.48738039407041,
                'lng' => 124.64796674252271,
                'type' => 'landmark',
                'priority' => 2,
                'region' => 'Cagayan de Oro, Misamis Oriental',
                'aliases' => ['doctors sabal', 'sabal hospital'],
            ],
            'nmmc' => [
                'name' => 'Northern Mindanao Medical Center',
                'distance_km' => 29.2,
                'distance_to_municipal_hall_km' => 29.2,
                'lat' => 8.486057186358508,
                'lng' => 124.64994047759362,
                'type' => 'landmark',
                'priority' => 2,
                'region' => 'Cagayan de Oro, Misamis Oriental',
                'aliases' => ['nmmc', 'nmmc cdo'],
            ],
            'cdo_provincial_capitol' => [
                'name' => 'Provincial Capitol',
                'distance_km' => 29.4,
                'distance_to_municipal_hall_km' => 29.4,
                'lat' => 8.484947954002099,
                'lng' => 124.64840582748698,
                'type' => 'landmark',
                'priority' => 2,
                'region' => 'Cagayan de Oro, Misamis Oriental',
                'aliases' => ['capitol', 'misamis oriental capitol'],
            ],
            'gingoog' => [
                'name' => 'Gingoog City',
                'distance_km' => 60.0,
                'distance_to_municipal_hall_km' => 60.0,
                'lat' => 8.8167,
                'lng' => 125.1000,
                'type' => 'city',
                'priority' => 3,
                'region' => 'Misamis Oriental',
                'aliases' => ['gingoog city hall'],
            ],
            'iligan' => [
                'name' => 'Iligan City',
                'distance_km' => 88.5,
                'distance_to_municipal_hall_km' => 88.5,
                'lat' => 8.2280,
                'lng' => 124.2383,
                'type' => 'city',
                'priority' => 3,
                'region' => 'Lanao del Norte',
                'aliases' => ['iligan city hall'],
            ],
            'ozamiz' => [
                'name' => 'Ozamiz City',
                'distance_km' => 118.0,
                'distance_to_municipal_hall_km' => 118.0,
                'lat' => 8.1455,
                'lng' => 123.8445,
                'type' => 'city',
                'priority' => 3,
                'region' => 'Misamis Occidental',
                'aliases' => ['ozamiz city hall'],
            ],
            'malaybalay' => [
                'name' => 'Malaybalay City',
                'distance_km' => 123.0,
                'distance_to_municipal_hall_km' => 123.0,
                'lat' => 8.1567,
                'lng' => 125.1331,
                'type' => 'city',
                'priority' => 3,
                'region' => 'Bukidnon',
                'aliases' => ['malaybalay city hall'],
            ],
            'valencia' => [
                'name' => 'Valencia City',
                'distance_km' => 154.0,
                'distance_to_municipal_hall_km' => 154.0,
                'lat' => 7.9044,
                'lng' => 125.0928,
                'type' => 'city',
                'priority' => 3,
                'region' => 'Bukidnon',
                'aliases' => ['valencia city hall'],
            ],
            'butuan' => [
                'name' => 'Butuan City',
                'distance_km' => 202.0,
                'distance_to_municipal_hall_km' => 202.0,
                'lat' => 8.9475,
                'lng' => 125.5437,
                'type' => 'city',
                'priority' => 4,
                'region' => 'Agusan del Norte',
                'aliases' => ['butuan city hall'],
            ],
            'davao' => [
                'name' => 'Davao City',
                'distance_km' => 317.0,
                'distance_to_municipal_hall_km' => 317.0,
                'lat' => 7.1907,
                'lng' => 125.4553,
                'type' => 'city',
                'priority' => 4,
                'region' => 'Davao',
                'aliases' => ['davao city hall'],
            ],
            'surigao' => [
                'name' => 'Surigao City',
                'distance_km' => 322.0,
                'distance_to_municipal_hall_km' => 322.0,
                'lat' => 9.7836,
                'lng' => 125.4955,
                'type' => 'city',
                'priority' => 4,
                'region' => 'Surigao del Norte',
                'aliases' => ['surigao city hall'],
            ],
            'zamboanga' => [
                'name' => 'Zamboanga City',
                'distance_km' => 465.0,
                'distance_to_municipal_hall_km' => 465.0,
                'lat' => 6.9127,
                'lng' => 122.0680,
                'type' => 'city',
                'priority' => 4,
                'region' => 'Zamboanga',
                'aliases' => ['zamboanga city hall'],
            ],
        ];
    }

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
            $type = $location['type'] ?? 'location';

            if ($type === 'group') {
                $description = $name;
            } elseif ($type === 'barangay') {
                $description = $name . ', Misamis Oriental';
            } elseif ($type === 'municipality') {
                if (strpos($nameLower, 'misamis oriental') === false) {
                    $description = $name . ', Misamis Oriental';
                }
            } elseif ($type === 'landmark') {
                if (strpos($nameLower, 'cagayan de oro') !== false || strpos($nameLower, 'misamis oriental') !== false) {
                    $description = $name;
                } else {
                    $description = $name . ', Misamis Oriental';
                }
            } elseif ($type === 'city') {
                if (strpos($nameLower, 'philippines') === false) {
                    $description = $name . ', Philippines';
                }
            }

            $results[] = [
                'description' => $description,
                'place_id' => 'fallback_' . $key,
                'lat' => (float) $lat,
                'lng' => (float) $lng,
                'type' => $type,
                'distance_km' => (float) ($location['distance_km'] ?? 0),
                'distance_to_municipal_hall_km' => (float) ($location['distance_to_municipal_hall_km'] ?? 0),
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

    public function calculateDistance($origin, $destinations)
    {
        $originData = $this->findLocation($origin) ?? $this->findLocationByPartialMatch($origin);
        if (!$originData) return ['success' => false, 'message' => 'Origin not found: ' . $origin];

        if (is_string($destinations)) {
            $destinations = [$destinations];
        }

        $totalDistance = 0;
        $routeNames = [];
        $points = [$originData];

        foreach ($destinations as $dest) {
            $destData = $this->findLocation($dest) ?? $this->findLocationByPartialMatch($dest);
            if (!$destData) continue;
            $points[] = $destData;
            $routeNames[] = $destData['name'];
        }

        if (count($points) < 2) return ['success' => false, 'message' => 'No valid destinations found.'];

        for ($i = 0; $i < count($points) - 1; $i++) {
            $from = $points[$i];
            $to = $points[$i + 1];

            if ($this->isWithinLaguindingan($from) && $this->isWithinLaguindingan($to)) {
                $totalDistance += abs(($to['distance_km'] ?? 0) - ($from['distance_km'] ?? 0));
                continue;
            }

            if ($this->isOriginLaguindingan($from) && ($to['distance_km'] ?? 0) > 0) {
                $totalDistance += (float) $to['distance_km'];
                continue;
            }
            
            if ($this->isOriginLaguindingan($to) && ($from['distance_km'] ?? 0) > 0) {
                $totalDistance += (float) $from['distance_km'];
                continue;
            }

            $totalDistance += (float) ($from['distance_km'] ?? 0) + (float) ($to['distance_km'] ?? 0);
        }

        if ($totalDistance < 0.1) $totalDistance = 0.1;

        return [
            'success' => true,
            'distance_km' => round($totalDistance, 2),
            'duration_minutes' => $this->estimateDuration($totalDistance, $points[count($points)-1]),
            'origin' => $originData['name'],
            'destinations' => $routeNames,
            'source' => 'multi_location_fixed',
        ];
    }

       public function calculateTripEstimate($originAddress, $destinationAddresses, $vehicleId = null, $roundTrip = true)
    {
        $result = $this->calculateDistance($originAddress, $destinationAddresses);
        if (!$result['success']) return $result;

        $distanceKm = $result['distance_km'];
        
        // ✅ BAG-ONG FORMULA: (3.2 + distance_km + distance_to_municipal_hall_km)
        $distanceToHall = 0;
        if (is_string($destinationAddresses)) {
            $destinationAddresses = [$destinationAddresses];
        }
        
        $destData = null;
        foreach ($destinationAddresses as $dest) {
            $destData = $this->findLocation($dest) ?? $this->findLocationByPartialMatch($dest);
            if ($destData) {
                $distanceToHall += (float) ($destData['distance_to_municipal_hall_km'] ?? 0);
            }
        }
        
        // Ang 3.2 km kay gikan Municipal Hall to Fuel Station
        $totalEstimateDistance = 3.2 + $distanceKm + $distanceToHall;
        
        // Dili na kinahanglan i-multiply og 2 kay ang formula naglakip na sa round trip
        $durationMinutes = $this->estimateDuration($totalEstimateDistance, $destData ?? ['type' => 'municipality']);

        $efficiency = 10;
        $fuelType = 'gasoline';
        if ($vehicleId) {
            try {
                $vehicle = \App\Models\Vehicle::find($vehicleId);
                if ($vehicle) {
                    $efficiency = $vehicle->reference_efficiency ?? 10;
                    $fuelType = $vehicle->fuel_type ?? 'gasoline';
                }
            } catch (\Exception $e) {
                Log::error('Error getting vehicle: ' . $e->getMessage());
            }
        }

        $fuelPrice = $this->getFuelPrice($fuelType);
        $estimatedLiters = round($totalEstimateDistance / $efficiency, 2);
        $estimatedCost = round($estimatedLiters * $fuelPrice, 2);

        // 10% buffer
        $estimatedLitersWithBuffer = round($estimatedLiters * 1.1, 2);
        $estimatedCostWithBuffer = round($estimatedCost * 1.1, 2);

        return [
            'success' => true,
            'origin' => $result['origin'],
            'destinations' => $result['destinations'],
            'distance_km' => round($totalEstimateDistance, 2), // Kini na ang 10.3 km na round trip base sa formula
            'duration_minutes' => round($durationMinutes, 2),
            'estimated_liters' => $estimatedLitersWithBuffer,
            'estimated_cost' => $estimatedCostWithBuffer,
            'fuel_efficiency_km_per_liter' => $efficiency,
            'fuel_price_per_liter' => $fuelPrice,
            'fuel_type' => $fuelType,
            'is_round_trip' => $roundTrip,
            'source' => $result['source'],
        ];
    }

    private function isWithinLaguindingan($location)
    {
        $name = strtolower($location['name'] ?? '');
        $region = strtolower($location['region'] ?? '');
        return strpos($name, 'laguindingan') !== false || strpos($region, 'laguindingan') !== false;
    }

    private function estimateDuration($distanceKm, $destination)
    {
        $type = $destination['type'] ?? 'municipality';
        $avgSpeedKmh = match($type) {
            'barangay'     => 30,
            'municipality' => 40,
            'city'         => 25,
            'landmark'     => 25,
            'origin'       => 30,
            'group'        => 30,
            default        => 35,
        };
        return round($distanceKm / $avgSpeedKmh * 60, 1);
    }

    private function isOriginLaguindingan($location)
    {
        $name = strtolower($location['name'] ?? '');
        $type = $location['type'] ?? '';
        return $type === 'origin' || strpos($name, 'laguindingan municipal') !== false || ($type === 'municipality' && strpos($name, 'laguindingan') !== false);
    }

    private function findLocationByPartialMatch($query)
    {
        $query = strtolower(trim($query));
        $bestMatch = null;
        $bestScore = 0;
        foreach ($this->locations as $key => $location) {
            $name = strtolower($location['name'] ?? '');
            $score = 0;
            if (strpos($name, $query) !== false) $score = strlen($query) / max(strlen($name), 1) * 100;
            if (strpos($query, $name) !== false && strlen($name) > 3) $score = strlen($name) / max(strlen($query), 1) * 100;
            if (strpos(strtolower($key), $query) !== false) $score = max($score, 50);
            if ($score > $bestScore) { $bestScore = $score; $bestMatch = $location; }
        }
        return $bestMatch;
    }

    private function findLocation($query)
    {
        $query = strtolower(trim($query));
        foreach ($this->locations as $key => $location) {
            $name = strtolower($location['name'] ?? '');
            $aliases = array_map('strtolower', $location['aliases'] ?? []);
            if (strpos($name, $query) !== false || strpos(strtolower($key), $query) !== false) return $location;
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
                    if (strpos($name, $part) !== false || strpos(strtolower($key), $part) !== false) return $location;
                }
            }
        }
        return null;
    }

    public function geocode($address)
    {
        $location = $this->findLocation($address) ?? $this->findLocationByPartialMatch($address);
        if ($location) {
            return ['success' => true, 'lat' => $location['lat'], 'lng' => $location['lng'], 'display_name' => $location['name'], 'source' => 'fallback'];
        }
        return ['success' => false, 'message' => 'Location not found in fallback data'];
    }

    private function getFuelPrice($fuelType = null)
    {
        $map = ['diesel' => 'diesel_price_per_liter', 'premium' => 'premium_price_per_liter', 'gasoline' => 'regular_price_per_liter'];
        $key = $map[strtolower($fuelType ?? '')] ?? 'regular_price_per_liter';
        try {
            $setting = \App\Models\SystemSetting::where('setting_key', $key)->first();
            return $setting ? (float) $setting->setting_value : 75.00;
        } catch (\Exception $e) {
            return 75.00;
        }
    }
}
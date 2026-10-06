<?php

namespace App\Traits;

use Illuminate\Support\Collection;

trait FiltersGpsDistance
{
    /**
     * GPS distance filter tuning — adjust per fleet if needed.
     */
    protected float $gpsMinSegmentKm  = 0.015;   // 15 m noise floor
    protected float $gpsMaxSegmentKm  = 5.0;     // 5 km teleport guard
    protected float $gpsMaxSpeedKmh   = 120.0;   // 120 km/h speed ceiling
    protected int   $gpsMaxGapSeconds = 300;     // 5 min max gap between pings
    protected float $gpsEmaAlpha      = 0.3;     // EMA smoothing weight (0..1)

    /**
     * Filter pings and sum only legitimate movement.
     *
     * Expects a Collection of objects/arrays with at minimum:
     *   latitude, longitude, recorded_at
     * Optional:
     *   is_low_accuracy, accuracy_meters, speed_kmh
     */
    protected function filterAndSumGpsDistance(Collection $pings): float
    {
        if ($pings->count() < 2) {
            return 0.0;
        }

        // Drop low-accuracy pings up front
        $pings = $pings->filter(function ($p) {
            $low = is_array($p)
                ? ($p['is_low_accuracy'] ?? false)
                : ($p->is_low_accuracy ?? false);
            return !$low;
        })->values();

        if ($pings->count() < 2) {
            return 0.0;
        }

        $get = function ($p, $key) {
            return is_array($p) ? ($p[$key] ?? null) : ($p->$key ?? null);
        };

        $total = 0.0;

        // Seed with first ping (EMA)
        $smoothedLat  = (float) $get($pings[0], 'latitude');
        $smoothedLng  = (float) $get($pings[0], 'longitude');
        $lastKeptTime = $this->toTimestampGps($get($pings[0], 'recorded_at'));
        $lastKeptLat  = $smoothedLat;
        $lastKeptLng  = $smoothedLng;

        for ($i = 1; $i < $pings->count(); $i++) {
            $p = $pings[$i];

            // 1. EMA position smoothing — dampens random jitter
            $smoothedLat = (1 - $this->gpsEmaAlpha) * $smoothedLat
                         + $this->gpsEmaAlpha * (float) $get($p, 'latitude');
            $smoothedLng = (1 - $this->gpsEmaAlpha) * $smoothedLng
                         + $this->gpsEmaAlpha * (float) $get($p, 'longitude');

            $now = $this->toTimestampGps($get($p, 'recorded_at'));
            $gap = $now - $lastKeptTime;

            if ($gap <= 0) {
                continue;   // duplicate or out-of-order timestamp
            }

            $hop = $this->haversineGpsKm($lastKeptLat, $lastKeptLng, $smoothedLat, $smoothedLng);

            // 2. Noise floor — reject stationary jitter
            if ($hop < $this->gpsMinSegmentKm) {
                continue;
            }

            // 3. Teleport guard — skip jump but advance pointer
            if ($hop > $this->gpsMaxSegmentKm) {
                $lastKeptLat  = $smoothedLat;
                $lastKeptLng  = $smoothedLng;
                $lastKeptTime = $now;
                continue;
            }

            // 4. Speed ceiling — reject implausible hops
            $impliedKmh = ($hop / $gap) * 3600.0;
            if ($impliedKmh > $this->gpsMaxSpeedKmh) {
                $lastKeptLat  = $smoothedLat;
                $lastKeptLng  = $smoothedLng;
                $lastKeptTime = $now;
                continue;
            }

            // 5. Time gap too long — treat as new segment
            if ($gap > $this->gpsMaxGapSeconds) {
                $lastKeptLat  = $smoothedLat;
                $lastKeptLng  = $smoothedLng;
                $lastKeptTime = $now;
                continue;
            }

            $total += $hop;
            $lastKeptLat  = $smoothedLat;
            $lastKeptLng  = $smoothedLng;
            $lastKeptTime = $now;
        }

        return round($total, 2);
    }

    protected function haversineGpsKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $R    = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a    = sin($dLat / 2) ** 2
              + cos(deg2rad($lat1)) * cos(deg2rad($lat2))
              * sin($dLon / 2) ** 2;
        $c    = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $R * $c;
    }

    protected function toTimestampGps($value): int
    {
        if ($value instanceof \Carbon\Carbon || $value instanceof \DateTimeInterface) {
            return $value->getTimestamp();
        }
        return (int) strtotime((string) $value);
    }
}
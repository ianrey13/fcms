<?php

namespace App\Services;

use App\Models\TripTicket;
use App\Models\FuelReceipt;
use App\Models\GasSlip;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class FuelPredictionService
{
    /**
     * Suggest a release amount for a trip based on historical fuel consumption.
     *
     * Tiers (highest confidence first):
     *   route-level:    same destination + same vehicle, N >= 5
     *   vehicle-level:  same vehicle, N >= 3
     *   dept-level:     same department, N >= 1
     *   none:           no history
     */
    public function suggestFor(TripTicket $trip): array
    {
        $vehicleId    = $trip->vehicle_id;
        $departmentId = $trip->department_id;
        $destination  = trim((string) $trip->destination);

        // ============ TIER 1: route-level ============
        $routeRows = $this->historyQuery()
            ->where('tt.vehicle_id', $vehicleId)
            ->whereRaw('LOWER(TRIM(tt.destination)) = ?', [mb_strtolower($destination)])
            ->get();

        if ($routeRows->count() >= 5) {
            return $this->buildResponse($routeRows, 'route', 'high', $trip);
        }

        // ============ TIER 2: vehicle-level ============
        $vehicleRows = $this->historyQuery()
            ->where('tt.vehicle_id', $vehicleId)
            ->get();

        if ($vehicleRows->count() >= 3) {
            return $this->buildResponse($vehicleRows, 'vehicle', 'medium', $trip);
        }

        // ============ TIER 3: department-level ============
        $deptRows = $this->historyQuery()
            ->where('tt.department_id', $departmentId)
            ->get();

        if ($deptRows->count() >= 1) {
            return $this->buildResponse($deptRows, 'department', 'low', $trip);
        }

        // ============ NO HISTORY ============
        return [
            'available'          => false,
            'confidence'         => 'none',
            'tier'               => null,
            'sample_size'        => 0,
            'suggested_amount'   => null,
            'suggested_liters'   => null,
            'range_min'          => null,
            'range_max'          => null,
            'avg_amount'         => null,
            'avg_liters'         => null,
            'unit_price_hint'    => $this->currentUnitPrice($trip),
            'basis'              => [],
            'message'            => 'Not enough history to suggest a release amount. Enter manually.',
        ];
    }

    /**
     * Base query joining fuel_receipt → gas_slip → trip_ticket.
     * Only verified receipts from closed/completed trips.
     */
    private function historyQuery()
    {
        return FuelReceipt::query()
            ->join('gas_slip as gs', 'fuel_receipt.gas_slip_id', '=', 'gs.gas_slip_id')
            ->join('trip_ticket as tt', 'gs.trip_ticket_id', '=', 'tt.trip_ticket_id')
            ->whereIn('tt.status', ['closed', 'completed', 'pending_gso_validation'])
            ->whereNotNull('fuel_receipt.amount_on_receipt')
            ->where('fuel_receipt.amount_on_receipt', '>', 0)
            ->select([
                'fuel_receipt.fuel_receipt_id',
                'fuel_receipt.amount_on_receipt',
                'fuel_receipt.liters_availed',
                'fuel_receipt.unit_price',
                'tt.trip_ticket_id',
                'tt.trip_ticket_number',
                'tt.trip_date',
                'tt.destination',
                'tt.vehicle_id',
                'tt.department_id',
            ])
            ->orderBy('tt.trip_date', 'desc')
            ->limit(50);
    }

    /**
     * Compute suggestion from a collection of history rows.
     */
    private function buildResponse($rows, string $tier, string $confidence, TripTicket $trip): array
    {
        $amounts = $rows->pluck('amount_on_receipt')->map(fn($v) => (float) $v)->filter(fn($v) => $v > 0)->values();
        $liters  = $rows->pluck('liters_availed')->map(fn($v) => (float) $v)->filter(fn($v) => $v > 0)->values();

        if ($amounts->isEmpty()) {
            return [
                'available'        => false,
                'confidence'       => 'none',
                'tier'             => $tier,
                'sample_size'      => 0,
                'suggested_amount' => null,
                'suggested_liters' => null,
                'range_min'        => null,
                'range_max'        => null,
                'avg_amount'       => null,
                'avg_liters'       => null,
                'unit_price_hint'  => $this->currentUnitPrice($trip),
                'basis'            => [],
                'message'          => 'Insufficient verified fuel data.',
            ];
        }

        // ✅ SWITCHED TO AVERAGE (MEAN)
        $avgAmount = round($amounts->avg(), 2);
        $avgLiters = $liters->isNotEmpty() ? round($liters->avg(), 2) : null;

        // Calculate Standard Deviation for a realistic range
        $variance = 0;
        if ($amounts->count() > 1) {
            $variance = $amounts->map(fn($v) => pow($v - $avgAmount, 2))->sum() / ($amounts->count() - 1);
        }
        $stdDev = sqrt($variance);
        
        // Range is Mean ± 1 Standard Deviation (clamped to 0 to avoid negative amounts)
        $rangeMin = max(0, round($avgAmount - $stdDev, 2));
        $rangeMax = round($avgAmount + $stdDev, 2);

        // Derive liters from average if we don't have enough liters history
        $unitPrice = null;
        $suggestedLiters = null;

        if ($liters->isNotEmpty()) {
            $suggestedLiters = $avgLiters;
        }

        // Fallback: derive liters from a recent unit price
        $unitPrices = $rows->pluck('unit_price')->map(fn($v) => (float) $v)->filter(fn($v) => $v > 0)->values();
        if ($unitPrices->isNotEmpty()) {
            $unitPrice = round($unitPrices->avg(), 2);
        }

        if ($suggestedLiters === null && $unitPrice && $unitPrice > 0) {
            $suggestedLiters = round($avgAmount / $unitPrice, 2);
        }

        // Basis: last 5 entries for the "why" tooltip
        $basis = $rows->take(5)->map(fn($r) => [
            'ticket_number'    => $r->trip_ticket_number,
            'trip_date'        => $r->trip_date,
            'amount'           => (float) $r->amount_on_receipt,
            'liters'           => $r->liters_availed ? (float) $r->liters_availed : null,
            'destination'      => $r->destination,
        ])->values()->toArray();

        return [
            'available'        => true,
            'confidence'       => $confidence,   // high | medium | low
            'tier'             => $tier,         // route | vehicle | department
            'sample_size'      => $rows->count(),
            'suggested_amount' => $avgAmount,    // ✅ Now returns Average
            'suggested_liters' => $suggestedLiters,
            'range_min'        => $rangeMin,     // ✅ Now Mean - StdDev
            'range_max'        => $rangeMax,     // ✅ Now Mean + StdDev
            'avg_amount'       => $avgAmount,
            'avg_liters'       => $avgLiters,
            'unit_price_hint'  => $unitPrice,
            'basis'            => $basis,
            'message'          => $this->buildMessage($tier, $rows->count(), $avgAmount, $rangeMin, $rangeMax),
        ];
    }

    private function buildMessage(string $tier, int $n, float $amount, float $min, float $max): string
    {
        $tierLabel = match ($tier) {
            'route'      => "this route on this vehicle",
            'vehicle'    => "this vehicle",
            'department' => "this department",
            default      => "history",
        };

        return sprintf(
            "Based on %d prior trip%s on %s: average ₱%s (range ₱%s – ₱%s).",
            $n,
            $n === 1 ? '' : 's',
            $tierLabel,
            number_format($amount, 2),
            number_format($min, 2),
            number_format($max, 2)
        );
    }

    private function currentUnitPrice(TripTicket $trip): ?float
    {
        // ✅ Load vehicle if it's missing to prevent null errors
        if (!$trip->relationLoaded('vehicle')) {
            $trip->load('vehicle');
        }

        if (!$trip->vehicle || !$trip->vehicle->fuel_type) {
            return null;
        }

        $setting = DB::table('system_setting')
            ->where('setting_key', $trip->vehicle->fuel_type . '_price_per_liter')
            ->first();

        return $setting ? (float) $setting->setting_value : null;
    }
}
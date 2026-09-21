<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\TripTicket;
use App\Models\FuelReceipt;
use App\Models\Vehicle;
use App\Models\Department;
use App\Models\DeptBudgetPeriod;
use App\Models\GasSlip;
use App\Models\AuditLog;
use App\Exports\FuelConsumptionExport;
use App\Exports\FuelReceiptReportExport;
use App\Services\PdfReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Response;
use Carbon\Carbon;
use Maatwebsite\Excel\Facades\Excel;

class ReportsController extends Controller
{
    // ============================================================
    // 1. FUEL CONSUMPTION REPORT
    // ============================================================
   public function getFuelConsumptionReport(Request $request)
{
    try {
        $startDate = $request->get('start_date');
        $endDate = $request->get('end_date');
        $departmentId = $request->get('department_id');
        $vehicleId = $request->get('vehicle_id');

        $query = FuelReceipt::with([
            'gasSlip.tripTicket.department',
            'gasSlip.tripTicket.vehicle',
            'gasSlip.tripTicket.driver.user'
        ]);

        if ($startDate && $endDate) {
            $query->whereBetween('created_at', [
                Carbon::parse($startDate)->startOfDay(),
                Carbon::parse($endDate)->endOfDay()
            ]);
        }

        if ($departmentId) {
            $query->whereHas('gasSlip.tripTicket', function($q) use ($departmentId) {
                $q->where('department_id', $departmentId);
            });
        }

        if ($vehicleId) {
            $query->whereHas('gasSlip.tripTicket', function($q) use ($vehicleId) {
                $q->where('vehicle_id', $vehicleId);
            });
        }

        $fuelReceipts = $query->get();

        $totalTrips = $fuelReceipts->unique('gas_slip.trip_ticket_id')->count();
        $totalLiters = $fuelReceipts->sum('liters_availed');
        $totalCost = $fuelReceipts->sum('amount_on_receipt');
        $totalDistance = $this->calculateTotalDistance($fuelReceipts);

        // ✅ NEW: fuel-type breakdown for split Diesel/Gasoline columns
        $dieselReceipts = $fuelReceipts->filter(fn($r) =>
            ($r->gasSlip?->tripTicket?->vehicle?->fuel_type) === 'diesel'
        );
        $gasolineReceipts = $fuelReceipts->filter(fn($r) =>
            in_array($r->gasSlip?->tripTicket?->vehicle?->fuel_type, ['regular', 'premium'])
        );

        $summary = [
            'total_trips' => $totalTrips,
            'total_fuel_liters' => round($totalLiters, 2),
            'total_fuel_cost' => round($totalCost, 2),
            'total_distance_km' => round($totalDistance, 2),
            'average_km_per_liter' => $totalLiters > 0 ? round($totalDistance / $totalLiters, 2) : 0,
            'average_liters_per_trip' => $totalTrips > 0 ? round($totalLiters / $totalTrips, 2) : 0,
            'average_cost_per_trip' => $totalTrips > 0 ? round($totalCost / $totalTrips, 2) : 0,
            'average_cost_per_km' => $totalDistance > 0 ? round($totalCost / $totalDistance, 2) : 0,
            // ✅ NEW
            'diesel_liters' => round($dieselReceipts->sum('liters_availed'), 2),
            'diesel_cost' => round($dieselReceipts->sum('amount_on_receipt'), 2),
            'gasoline_liters' => round($gasolineReceipts->sum('liters_availed'), 2),
            'gasoline_cost' => round($gasolineReceipts->sum('amount_on_receipt'), 2),
        ];

        $vehicleBreakdown = $fuelReceipts->groupBy(function($receipt) {
            return $receipt->gasSlip->tripTicket->vehicle_id ?? 'unknown';
        })->map(function($group) {
            $first = $group->first();
            $vehicle = $first->gasSlip->tripTicket->vehicle;
            $distance = $this->calculateTotalDistance($group);
            $liters = $group->sum('liters_availed');
            $cost = $group->sum('amount_on_receipt');
            $trips = $group->unique('gas_slip.trip_ticket_id')->count();

            return [
                'vehicle_id' => $vehicle ? $vehicle->vehicle_id : null,
                'plate_number' => $vehicle ? $vehicle->plate_number : 'Unknown',
                'model' => $vehicle ? $vehicle->vehicle_model : 'Unknown',
                'fuel_type' => $vehicle ? $vehicle->fuel_type : 'Unknown',
                'trips' => $trips,
                'liters' => round($liters, 2),
                'cost' => round($cost, 2),
                'distance_km' => round($distance, 2),
                'km_per_liter' => $liters > 0 ? round($distance / $liters, 2) : 0,
                'efficiency_rating' => $this->getEfficiencyRating($liters, $distance),
                'percentage_of_total_liters' => 0,
            ];
        })->values();

        $totalLitersAll = $vehicleBreakdown->sum('liters');
        $vehicleBreakdown = $vehicleBreakdown->map(function($item) use ($totalLitersAll) {
            $item['percentage_of_total_liters'] = $totalLitersAll > 0 ? round(($item['liters'] / $totalLitersAll) * 100, 2) : 0;
            return $item;
        });

        $departmentBreakdown = $fuelReceipts->groupBy(function($receipt) {
            $department = $receipt->gasSlip->tripTicket->department;
            return $department ? $department->department_id : 'unknown';
        })->map(function($group) {
            $first = $group->first();
            $department = $first->gasSlip->tripTicket->department;
            $distance = $this->calculateTotalDistance($group);
            $liters = $group->sum('liters_availed');
            $cost = $group->sum('amount_on_receipt');
            $trips = $group->unique('gas_slip.trip_ticket_id')->count();

            return [
                'department_id' => $department ? $department->department_id : null,
                'department_name' => $department ? $department->department_name : 'Unknown',
                'department_code' => $department ? $department->department_code : 'Unknown',
                'trips' => $trips,
                'liters' => round($liters, 2),
                'cost' => round($cost, 2),
                'distance_km' => round($distance, 2),
                'km_per_liter' => $liters > 0 ? round($distance / $liters, 2) : 0,
                'percentage_of_total_liters' => 0,
            ];
        })->values();

        $totalLitersDept = $departmentBreakdown->sum('liters');
        $departmentBreakdown = $departmentBreakdown->map(function($item) use ($totalLitersDept) {
            $item['percentage_of_total_liters'] = $totalLitersDept > 0 ? round(($item['liters'] / $totalLitersDept) * 100, 2) : 0;
            return $item;
        });

        $periodTrends = $fuelReceipts->groupBy(function($receipt) {
            return $receipt->created_at ? Carbon::parse($receipt->created_at)->format('Y-m') : 'Unknown';
        })->map(function($group) {
            $distance = $this->calculateTotalDistance($group);
            $liters = $group->sum('liters_availed');
            $trips = $group->unique('gas_slip.trip_ticket_id')->count();

            return [
                'period' => $group->first()->created_at ? Carbon::parse($group->first()->created_at)->format('M Y') : 'Unknown',
                'trips' => $trips,
                'liters' => round($liters, 2),
                'km_per_liter' => $liters > 0 ? round($distance / $liters, 2) : 0,
            ];
        })->values();

        $efficiencyDistribution = [
            'Excellent' => 0,
            'Good' => 0,
            'Average' => 0,
            'Poor' => 0,
            'Critical' => 0,
            'No Data' => 0,
        ];

        foreach ($fuelReceipts->groupBy('gas_slip.trip_ticket_id') as $receipts) {
            $distance = $this->calculateTotalDistance($receipts);
            $liters = $receipts->sum('liters_availed');
            $rating = $this->getEfficiencyRating($liters, $distance);
            if (isset($efficiencyDistribution[$rating])) {
                $efficiencyDistribution[$rating]++;
            }
        }

        $recentReceipts = $fuelReceipts->sortByDesc('created_at')->take(50)->map(function($receipt) {
            $trip = $receipt->gasSlip->tripTicket;
            $vehicle = $trip->vehicle;
            $driver = $trip->driver;

            return [
                'fuel_receipt_id' => $receipt->fuel_receipt_id,
                'trip_ticket_id' => $trip->trip_ticket_id,
                'trip_ticket_number' => $trip->trip_ticket_number ?? 'N/A',
                'department' => $trip->department ? $trip->department->department_name : 'Unknown',
'department_code' => $trip->department ? $trip->department->department_code : 'Unknown',
'department_id' => $trip->department_id,
                'vehicle' => $vehicle ? $vehicle->plate_number . ' (' . $vehicle->vehicle_model . ')' : 'Unknown',
                'plate_number' => $vehicle?->plate_number ?? 'N/A',
                'vehicle_model' => $vehicle?->vehicle_model ?? 'N/A',
                'driver' => $driver && $driver->user ? $driver->user->full_name : 'Unknown',
                'destination' => $trip->destination,
                'purpose' => $trip->purpose,
                'fuel_type' => $vehicle?->fuel_type ?? 'unknown',
                'liters_availed' => $receipt->liters_availed,
                'amount_on_receipt' => $receipt->amount_on_receipt,
                'distance_km' => $this->calculateReceiptDistance($receipt),
                 'trip_ended_at' => $receipt->trip_ended_at?->toIso8601String(),
                'created_at' => $receipt->created_at?->toIso8601String(),
                'has_receipt' => !is_null($receipt->receipt_photo_path),
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => $summary,
                'vehicle_breakdown' => $vehicleBreakdown,
                'department_breakdown' => $departmentBreakdown,
                'period_trends' => $periodTrends,
                'efficiency_distribution' => $efficiencyDistribution,
                'recent_logs' => $recentReceipts,
                'filters' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'department_id' => $departmentId,
                    'vehicle_id' => $vehicleId,
                ],
            ]
        ]);

    } catch (\Exception $e) {
        Log::error('Report error: ' . $e->getMessage());
        Log::error($e->getTraceAsString());

        return response()->json([
            'success' => false,
            'message' => 'Failed to generate report: ' . $e->getMessage()
        ], 500);
    }
}

    // ============================================================
    // 2. VEHICLE REPORT
    // ============================================================
    public function getVehicleReport(Request $request)
    {
        try {
            $vehicles = Vehicle::all();
            $vehicleData = [];

            foreach ($vehicles as $vehicle) {
                $trips = TripTicket::where('vehicle_id', $vehicle->vehicle_id)
                    ->where('status', 'closed')
                    ->get();

                $totalLiters = 0;
                $totalCost = 0;
                $totalDistance = 0;
                $tripCount = $trips->count();

                foreach ($trips as $trip) {
                    $gasSlip = GasSlip::where('trip_ticket_id', $trip->trip_ticket_id)->first();
                    if ($gasSlip) {
                        $fuelReceipt = FuelReceipt::where('gas_slip_id', $gasSlip->gas_slip_id)->first();
                        if ($fuelReceipt) {
                            $totalLiters += $fuelReceipt->liters_availed ?? 0;
                            $totalCost += $fuelReceipt->amount_on_receipt ?? 0;
                            $totalDistance += $fuelReceipt->gps_distance_km ?? 0;
                        }
                    }
                }

                $vehicleData[] = [
                    'vehicle_id' => $vehicle->vehicle_id,
                    'plate_number' => $vehicle->plate_number,
                    'model' => $vehicle->vehicle_model,
                    'fuel_type' => $vehicle->fuel_type,
                    'maintenance_flag' => $vehicle->maintenance_flag,
                    'trip_count' => $tripCount,
                    'total_liters' => round($totalLiters, 2),
                    'total_cost' => round($totalCost, 2),
                    'total_distance_km' => round($totalDistance, 2),
                    'km_per_liter' => $totalLiters > 0 ? round($totalDistance / $totalLiters, 2) : 0,
                    'cost_per_km' => $totalDistance > 0 ? round($totalCost / $totalDistance, 2) : 0,
                    'efficiency_rating' => $this->getEfficiencyRating($totalLiters, $totalDistance),
                ];
            }

            return response()->json([
                'success' => true,
                'data' => $vehicleData
            ]);

        } catch (\Exception $e) {
            Log::error('Vehicle report error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate vehicle report: ' . $e->getMessage()
            ], 500);
        }
    }

    // ============================================================
    // 3. BUDGET REPORT
    // ============================================================
 public function getBudgetReport(Request $request)
{
    try {
        $departmentId = $request->get('department_id');
        $year         = (int) $request->get('year', date('Y'));
        $month        = $request->get('month'); // 1-12, 'all', or null

        // ----- 1. Determine target department -----
        if (!$departmentId || $departmentId === 'all') {
            $departmentId = DB::table('annual_budgets')
                ->where('fiscal_year', $year)
                ->orderBy('department_id')
                ->value('department_id');

            $departmentId = $departmentId
                ?: Department::where('is_active', 1)
                    ->orderBy('department_id')
                    ->value('department_id');
        }

        // ----- 2. Annual totals -----
        $annual = DB::table('annual_budgets')
            ->where('department_id', $departmentId)
            ->where('fiscal_year', $year)
            ->first();

        $annualAllocated = $annual ? (float) $annual->annual_amount : 0.0;

        $annualUsed = (float) DB::table('gas_slip as gs')
            ->join('dept_budget_period as p', 'gs.period_id', '=', 'p.period_id')
            ->where('p.department_id', $departmentId)
            ->whereYear('p.week_start', $year)
            ->sum('gs.amount_released');

        $weeklySuggested = $annualAllocated > 0 ? round($annualAllocated / 52, 2) : 0;

        // ----- 3. Fetch all periods for the department/year -----
        $periodQuery = DB::table('dept_budget_period as p')
            ->leftJoin('weekly_budget_usage as u', function ($join) {
                $join->on('u.department_id', '=', 'p.department_id')
                     ->on('u.week_start',   '=', 'p.week_start');
            })
            ->where('p.department_id', $departmentId)
            ->whereYear('p.week_start', $year);

        if ($month && $month !== 'all') {
            $periodQuery->whereMonth('p.week_start', $month);
        }

        $periods = $periodQuery
            ->orderBy('p.week_start')
            ->select([
                'p.period_id',
                'p.week_start',
                'p.week_end',
                'p.status',
                'u.amount_used as used',
            ])
            ->get();

        // ----- 4. Fetch ALL budget_history top-ups for the year, ordered by date -----
        $topups = DB::table('budget_history')
            ->where('department_id', $departmentId)
            ->whereYear('created_at', $year)
            ->whereIn('action', ['annual_added', 'annual_updated', 'annual_created'])
            ->orderBy('created_at')
            ->get(['action', 'previous_amount', 'added_amount', 'new_amount', 'created_at']);

        // ----- 5. Compute starting opening balance = FIRST recorded amount for the FY -----
        // If there's an 'annual_created' entry, that's the true starting point.
        // Otherwise, fall back to: (current annual) − (sum of all later top-ups).
        $startingBalance = null;
        $annualCreatedEntry = $topups->firstWhere('action', 'annual_created');
        if ($annualCreatedEntry) {
            $startingBalance = (float) $annualCreatedEntry->new_amount;
        } else {
            $totalTopups = (float) $topups->sum('added_amount');
            $startingBalance = max(0, $annualAllocated - $totalTopups);
        }

        // ----- 6. Carry-forward loop with top-up injection -----
        $openingBalance = $startingBalance;
        $topupIndex = 0;

        // Pre-filter out the 'annual_created' entry from the injectable list —
        // it's already baked into $startingBalance.
        $injectableTopups = $topups->whereIn('action', ['annual_added', 'annual_updated'])
            ->values();

        $rows = collect();
        $prevWeekEnd = null;

        foreach ($periods as $p) {
            // Apply any top-ups that landed AFTER the previous period's end
            // and BEFORE (or on) this period's start.
            while ($topupIndex < $injectableTopups->count()) {
                $topup = $injectableTopups[$topupIndex];
                $topupDate = Carbon::parse($topup->created_at)->toDateString();
                $thisWeekStart = $p->week_start;

                if ($topupDate <= $thisWeekStart) {
                    $openingBalance += (float) $topup->added_amount;
                    $topupIndex++;
                } else {
                    break;
                }
            }

            $used = (float) ($p->used ?? 0);
            $allocated = $openingBalance;      // BUDGET column
            $remaining = $allocated - $used;   // BALANCE column

            $rows->push([
                'period_id'  => $p->period_id,
                'week_start' => $p->week_start,
                'week_end'   => $p->week_end,
                'allocated'  => round($allocated, 2),
                'used'       => round($used, 2),
                'remaining'  => round($remaining, 2),
                'status'     => $p->status,
            ]);

            $openingBalance = $remaining;  // carry forward
        }

        // ----- 7. Summary -----
        $department = Department::find($departmentId);

        $monthAllocated = $rows->first()['allocated'] ?? 0;
        $monthUsed      = $rows->sum('used');
        $monthRemaining = $rows->last()['remaining'] ?? 0;

        return response()->json([
            'success' => true,
            'data' => [
                'department' => [
                    'department_id'   => $department?->department_id,
                    'department_name' => $department?->department_name ?? 'Unknown',
                    'department_code' => $department?->department_code ?? 'N/A',
                ],
                'summary' => [
                    'total_allocated'   => round($annualAllocated, 2),
                    'total_used'        => round($annualUsed, 2),
                    'total_remaining'   => round($annualAllocated - $annualUsed, 2),
                    'total_departments' => 1,
                    'total_weeks'       => $rows->count(),

                    'weekly_suggested'  => $weeklySuggested,
                    'starting_balance'  => round($startingBalance, 2),
                    'total_topups'      => round($injectableTopups->sum('added_amount'), 2),

                    'month_allocated'   => round($monthAllocated, 2),
                    'month_used'        => round($monthUsed, 2),
                    'month_remaining'   => round($monthRemaining, 2),
                ],
                'periods'   => $rows,
                'topups'    => $injectableTopups->map(fn($t) => [
                    'date'   => Carbon::parse($t->created_at)->toIso8601String(),
                    'amount' => (float) $t->added_amount,
                    'reason' => null, // optional — add if budget_history has it in select
                ]),
                'filters'   => [
                    'year'          => $year,
                    'month'         => ($month && $month !== 'all') ? (int) $month : null,
                    'department_id' => $departmentId,
                ],
            ],
        ]);

    } catch (\Exception $e) {
        Log::error('Budget report error: ' . $e->getMessage());
        Log::error($e->getTraceAsString());
        return response()->json([
            'success' => false,
            'message' => 'Failed to generate budget report: ' . $e->getMessage(),
        ], 500);
    }
}

        // ============================================================
    // 4. FUEL RECEIPT REPORT
    // ============================================================
    public function getFuelReceiptReport(Request $request)
    {
        try {
            $startDate    = $request->get('start_date');
            $endDate      = $request->get('end_date');
            $departmentId = $request->get('department_id');
            $vehicleId    = $request->get('vehicle_id');
            $statusFilter = $request->get('status'); // ✅ NEW: pending | verified (from frontend dropdown)

            $query = FuelReceipt::with([
                'gasSlip.tripTicket.department',
                'gasSlip.tripTicket.vehicle',
                'gasSlip.tripTicket.driver.user',
                'verifiedBy',   // ✅ NEW
            ]);

            if ($startDate && $endDate) {
                $query->whereBetween('created_at', [
                    Carbon::parse($startDate)->startOfDay(),
                    Carbon::parse($endDate)->endOfDay()
                ]);
            }

            if ($departmentId) {
                $query->whereHas('gasSlip.tripTicket', function ($q) use ($departmentId) {
                    $q->where('department_id', $departmentId);
                });
            }

            if ($vehicleId) {
                $query->whereHas('gasSlip.tripTicket', function ($q) use ($vehicleId) {
                    $q->where('vehicle_id', $vehicleId);
                });
            }

            // ✅ NEW: server-side status filter (frontend can also filter, but this keeps
            // counts in the summary accurate when a filter is applied)
            if ($statusFilter && $statusFilter !== 'all') {
                $query->where('verification_status', strtolower($statusFilter));
            }

            $receipts = $query->get();

            $formattedReceipts = $receipts->map(function ($receipt) {
                $trip       = $receipt->gasSlip?->tripTicket;
                $vehicle    = $trip?->vehicle;
                $department = $trip?->department;
                $driver     = $trip?->driver;

                $invoiceNumber = $receipt->invoice_number ?? 'N/A';

                $unitPrice = $receipt->unit_price ?? 0;
                if ($unitPrice == 0 && $receipt->liters_availed > 0 && $receipt->amount_on_receipt > 0) {
                    $unitPrice = round($receipt->amount_on_receipt / $receipt->liters_availed, 2);
                }

                $timeDeparture = $receipt->trip_started_at
                    ? Carbon::parse($receipt->trip_started_at)->format('h:i A')
                    : 'N/A';

                $timeArrival = $receipt->trip_ended_at
                    ? Carbon::parse($receipt->trip_ended_at)->format('h:i A')
                    : 'N/A';

                $status = $trip->status ?? 'N/A';

                $statusMap = [
                    'closed'                 => 'Closed',
                    'completed'              => 'Completed',
                    'pending_mayors_office'  => 'Pending MO',
                    'funds_issued'           => 'Funds Issued',
                    'in_transit'             => 'In Transit',
                    'acknowledged'           => 'Acknowledged',
                    'pending_gso_validation' => 'Pending Validation',
                ];
                $statusLabel = $statusMap[$status] ?? $status;

                return [
                    // ---- Identity ----
                    'fuel_receipt_id'    => $receipt->fuel_receipt_id,
                    'gas_slip_id'        => $receipt->gas_slip_id,
                    'invoice_number'     => $invoiceNumber,
                    'charge_invoice_no'  => $invoiceNumber,
                    'control_no'         => $trip?->trip_ticket_number ?? 'N/A',
                    'ticket_number'      => $trip?->trip_ticket_number ?? 'N/A',

                    // ---- Dates ----
                    'date'               => $receipt->created_at
                        ? $receipt->created_at->format('m/d/Y')
                        : 'N/A',
                    'trip_date'          => $trip?->trip_date ?? 'N/A',
                    'receipt_uploaded_at' => $receipt->receipt_uploaded_at
                        ? $receipt->receipt_uploaded_at->format('m/d/Y H:i')
                        : 'N/A',
                                      'time_departure'     => $timeDeparture,
                    'time_arrival'       => $timeArrival,
                    'trip_started_at'    => $receipt->trip_started_at?->toIso8601String(),
                    'trip_ended_at'      => $receipt->trip_ended_at?->toIso8601String(),
                    // ---- Vehicle / Department / Driver ----
                    'used_for'           => $department?->department_name ?? 'N/A',
                    'department'         => $department?->department_name ?? 'N/A',
                    'department_name'    => $department?->department_name ?? 'N/A',
                    'department_id'      => $department?->department_id,
                    'lubricant'          => $vehicle ? strtoupper($vehicle->fuel_type) : 'N/A',
                    'fuel_type'          => $vehicle ? strtoupper($vehicle->fuel_type) : 'N/A',
                    'plate_no'           => $vehicle?->plate_number ?? 'N/A',
                    'plate_number'       => $vehicle?->plate_number ?? 'N/A',
                    'vehicle'            => $vehicle?->vehicle_model ?? 'N/A',
                    'vehicle_model'      => $vehicle?->vehicle_model ?? 'N/A',
                    'vehicle_id'         => $vehicle?->vehicle_id,
                    'driver'             => $driver?->user?->full_name ?? 'N/A',
                    'driver_name'        => $driver?->user?->full_name ?? 'N/A',
                    'driver_id'          => $driver?->driver_id,
                    'destination'        => $trip?->destination ?? 'N/A',

                    // ---- Amounts ----
                    'quantity'              => $receipt->liters_availed ?? 0,
                    'unit_price'            => $unitPrice,
                    'formatted_unit_price'  => '₱' . number_format($unitPrice, 2),
                    'amount'                => $receipt->amount_on_receipt ?? 0,
                    'formatted_amount'      => '₱' . number_format($receipt->amount_on_receipt ?? 0, 2),

                    // ---- Trip status (unrelated to receipt verification) ----
                    'status' => $statusLabel,

                    // ---- ✅ NEW: Receipt verification (the field that matters now) ----
                    'receipt_status'        => $receipt->verification_status ?? 'pending',
                    'verified_at'           => $receipt->verified_at,
                    'verified_by'           => $receipt->verifiedBy?->full_name,
                    'verified_by_id'        => $receipt->verified_by,

                    // ---- Legacy: gas_slip reconciliation (kept for other views) ----
                    'reconciliation_status' => $receipt->gasSlip?->reconciliation_status ?? 'N/A',

                    // ---- Flags ----
                    'has_receipt' => !is_null($receipt->receipt_photo_path),
                ];
            });

            $summary = [
                'total_receipts'    => $receipts->count(),
                'total_liters'      => round($receipts->sum('liters_availed'), 2),
                'total_cost'        => round($receipts->sum('amount_on_receipt'), 2),
                'total_vehicles'    => $receipts->pluck('gasSlip.tripTicket.vehicle_id')->filter()->unique()->count(),
                'total_departments' => $receipts->pluck('gasSlip.tripTicket.department_id')->filter()->unique()->count(),
                'avg_unit_price'    => $receipts->count() > 0 && $receipts->sum('liters_availed') > 0
                    ? round($receipts->sum('amount_on_receipt') / $receipts->sum('liters_availed'), 2)
                    : 0,
                // ✅ NEW: status breakdown (only meaningful when not filtered)
                'pending_count'     => $receipts->where('verification_status', 'pending')->count(),
                'verified_count'    => $receipts->where('verification_status', 'verified')->count(),
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'summary'  => $summary,
                    'receipts' => $formattedReceipts,
                    'filters'  => [
                        'start_date'    => $startDate,
                        'end_date'      => $endDate,
                        'department_id' => $departmentId,
                        'vehicle_id'    => $vehicleId,
                        'status'        => $statusFilter,
                    ],
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Fuel receipt report error: ' . $e->getMessage());
            Log::error($e->getTraceAsString());

            return response()->json([
                'success' => false,
                'message' => 'Failed to generate fuel receipt report: ' . $e->getMessage()
            ], 500);
        }
    }

    // ============================================================
    // 5. RECONCILIATION REPORT  ✅ FIXED — distance-based, matches frontend
    // ============================================================
   public function getReconciliationReport(Request $request)
{
    try {
        $startDate = $request->get('start_date');
        $endDate = $request->get('end_date');
        $departmentId = $request->get('department_id');

        $query = TripTicket::with([
            'department',
            'driver.user',
            'vehicle',
            'gasSlip',
            'gasSlip.fuelReceipt',
        ])
        ->whereHas('gasSlip')
        ->whereHas('gasSlip.fuelReceipt');

        if ($startDate && $endDate) {
            $query->whereBetween('submitted_at', [
                Carbon::parse($startDate)->startOfDay(),
                Carbon::parse($endDate)->endOfDay()
            ]);
        }

        if ($departmentId) {
            $query->where('department_id', $departmentId);
        }

        $trips = $query->get();

        $reconciliations = $trips->map(function ($trip) {
            // ============================================
            // DISTANCE (primary metric)
            // ============================================
            $expectedDistance = (float) ($trip->estimated_distance_km ?? 0);

            $actualDistance = (float) (
                $trip->actual_distance_km
                ?? $trip->gasSlip?->fuelReceipt?->gps_distance_km
                ?? 0
            );

            $variance = round($expectedDistance - $actualDistance, 2);

            $varianceStatus = 'normal';
            if (abs($variance) > 2) {
                $varianceStatus = 'high_discrepancy';
            } elseif (abs($variance) > 0.5) {
                $varianceStatus = 'minor_discrepancy';
            }

            // ============================================
            // ✅ NEW: AMOUNT reconciliation
            // ============================================
            $amountReleased = (float) ($trip->gasSlip?->amount_released ?? 0);
            $actualAmount   = $trip->gasSlip?->fuelReceipt?->amount_on_receipt;

            $amountVariance = $actualAmount !== null
                ? round($amountReleased - (float) $actualAmount, 2)
                : null;

            // ============================================
            // FUEL (secondary, may be NULL until MO verifies)
            // ============================================
            $estimatedFuel = (float) ($trip->estimated_fuel_liters ?? 0);
            $actualFuel = $trip->gasSlip?->fuelReceipt?->liters_availed;
            $fuelVariance = $actualFuel !== null
                ? round($estimatedFuel - (float) $actualFuel, 2)
                : null;

            return [
                'ticket_number' => $trip->trip_ticket_number,
                'department_name' => $trip->department?->department_name ?? 'N/A',
                'plate_number' => $trip->vehicle?->plate_number ?? 'N/A',
                'driver_name' => $trip->driver?->user?->full_name ?? 'N/A',

                 'trip_started_at' => $trip->gasSlip?->fuelReceipt?->trip_started_at?->toIso8601String(),
                'trip_ended_at'   => $trip->gasSlip?->fuelReceipt?->trip_ended_at?->toIso8601String(),
                // ✅ Amount fields (NEW)
                'amount_released' => $amountReleased,
                'actual_amount' => $actualAmount !== null ? round((float) $actualAmount, 2) : null,
                'amount_variance' => $amountVariance,

                // Distance fields (existing)
                'expected_distance' => round($expectedDistance, 2),
                'actual_distance' => round($actualDistance, 2),
                'variance' => $variance,
                'variance_status' => $varianceStatus,

                // Fuel fields (existing)
                'estimated_fuel' => round($estimatedFuel, 2),
                'actual_fuel' => $actualFuel !== null ? round((float) $actualFuel, 2) : null,
                'fuel_variance' => $fuelVariance,

                // Meta
                'status' => $trip->gasSlip?->reconciliation_status ?? 'pending',
                'reconciled_by' => $trip->gasSlip?->reconciledBy?->full_name ?? 'N/A',
                 'reconciled_at' => $trip->gasSlip?->reconciled_at?->toIso8601String(),
            ];
        });

        $summary = [
            'total_reconciliations' => $reconciliations->count(),
            'total_verified' => $reconciliations->filter(fn($r) => $r['status'] === 'verified')->count(),
            'total_discrepancy' => $reconciliations->filter(fn($r) => $r['status'] === 'discrepancy')->count(),
            'total_amount_released' => round($reconciliations->sum('amount_released'), 2),
            'total_actual_amount' => round($reconciliations->sum(fn($r) => $r['actual_amount'] ?? 0), 2),
            'total_amount_variance' => round($reconciliations->sum(fn($r) => $r['amount_variance'] ?? 0), 2),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'reconciliations' => $reconciliations,
                'summary' => $summary,
            ],
            'filters' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'department_id' => $departmentId,
            ]
        ]);

    } catch (\Exception $e) {
        Log::error('Reconciliation report error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch reconciliation report: ' . $e->getMessage()
        ], 500);
    }
}

    // ============================================================
    // 6. DEPARTMENT FUEL CONSUMPTION
    // ============================================================
    public function getDepartmentFuelConsumption(Request $request)
    {
        try {
            $startDate = $request->get('start_date');
            $endDate = $request->get('end_date');
            $departmentId = $request->get('department_id');

            $query = FuelReceipt::with([
                'gasSlip.tripTicket.department',
                'gasSlip.tripTicket.vehicle',
            ]);

            if ($startDate && $endDate) {
                $query->whereBetween('created_at', [
                    Carbon::parse($startDate)->startOfDay(),
                    Carbon::parse($endDate)->endOfDay()
                ]);
            }

            if ($departmentId) {
                $query->whereHas('gasSlip.tripTicket', function($q) use ($departmentId) {
                    $q->where('department_id', $departmentId);
                });
            }

            $receipts = $query->get();

            $departments = $receipts->groupBy(function($receipt) {
                $department = $receipt->gasSlip->tripTicket->department;
                return $department ? $department->department_id : 'unknown';
            })->map(function($group) {
                $first = $group->first();
                $department = $first->gasSlip->tripTicket->department;

                $totalTrips = $group->unique('gas_slip.trip_ticket_id')->count();
                $totalLiters = $group->sum('liters_availed');
                $totalCost = $group->sum('amount_on_receipt');
                $totalDistance = $group->sum('gps_distance_km');

                return [
                    'department_id' => $department ? $department->department_id : null,
                    'department_name' => $department ? $department->department_name : 'Unknown',
                    'department_code' => $department ? $department->department_code : 'N/A',
                    'total_trips' => $totalTrips,
                    'total_fuel_liters' => round($totalLiters, 2),
                    'total_amount' => round($totalCost, 2),
                    'total_distance_km' => round($totalDistance, 2),
                    'avg_fuel_per_trip' => $totalTrips > 0 ? round($totalLiters / $totalTrips, 2) : 0,
                    'avg_cost_per_trip' => $totalTrips > 0 ? round($totalCost / $totalTrips, 2) : 0,
                    'km_per_liter' => $totalLiters > 0 ? round($totalDistance / $totalLiters, 2) : 0,
                ];
            })->values();

            $summary = [
                'total_departments' => $departments->count(),
                'total_trips' => $departments->sum('total_trips'),
                'total_fuel_liters' => round($departments->sum('total_fuel_liters'), 2),
                'total_cost' => round($departments->sum('total_amount'), 2),
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'departments' => $departments,
                    'summary' => $summary,
                    'filters' => [
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                        'department_id' => $departmentId,
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Department Fuel Consumption error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate report: ' . $e->getMessage()
            ], 500);
        }
    }

    // ============================================================
    // 7. MONTHLY FUEL CONSUMPTION
    // ============================================================
    public function getMonthlyFuelConsumption(Request $request)
    {
        try {
            $year = $request->get('year', date('Y'));
            $departmentId = $request->get('department_id');

            $query = FuelReceipt::with([
                'gasSlip.tripTicket.department',
            ])
            ->whereYear('created_at', $year);

            if ($departmentId) {
                $query->whereHas('gasSlip.tripTicket', function($q) use ($departmentId) {
                    $q->where('department_id', $departmentId);
                });
            }

            $receipts = $query->get();

            $months = $receipts->groupBy(function($receipt) {
                return $receipt->created_at ? Carbon::parse($receipt->created_at)->format('Y-m') : 'unknown';
            })->map(function($group) {
                $monthDate = Carbon::parse($group->first()->created_at);

                $totalTrips = $group->unique('gas_slip.trip_ticket_id')->count();
                $totalLiters = $group->sum('liters_availed');
                $totalCost = $group->sum('amount_on_receipt');
                $totalDistance = $group->sum('gps_distance_km');

                return [
                    'month' => $monthDate->format('F Y'),
                    'month_key' => $monthDate->format('Y-m'),
                    'total_trips' => $totalTrips,
                    'total_fuel_liters' => round($totalLiters, 2),
                    'total_cost' => round($totalCost, 2),
                    'total_distance_km' => round($totalDistance, 2),
                    'avg_fuel_per_trip' => $totalTrips > 0 ? round($totalLiters / $totalTrips, 2) : 0,
                    'km_per_liter' => $totalLiters > 0 ? round($totalDistance / $totalLiters, 2) : 0,
                ];
            })->sortKeys()->values();

            $summary = [
                'total_months' => $months->count(),
                'total_trips' => $months->sum('total_trips'),
                'total_fuel_liters' => round($months->sum('total_fuel_liters'), 2),
                'total_cost' => round($months->sum('total_cost'), 2),
                'year' => $year,
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'months' => $months,
                    'summary' => $summary,
                    'filters' => [
                        'year' => $year,
                        'department_id' => $departmentId,
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Monthly Fuel Consumption error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate report: ' . $e->getMessage()
            ], 500);
        }
    }

    // ============================================================
    // 8. TRIP TICKET REPORT
    // ============================================================
    public function getTripTicketReport(Request $request)
    {
        try {
            $startDate = $request->get('start_date');
            $endDate = $request->get('end_date');
            $departmentId = $request->get('department_id');
            $status = $request->get('status');

            $query = TripTicket::with([
                'department',
                'driver.user',
                'vehicle',
                'gasSlip',
                'gasSlip.fuelReceipt',
            ]);

            if ($startDate && $endDate) {
                $query->whereBetween('trip_date', [
                    Carbon::parse($startDate),
                    Carbon::parse($endDate)
                ]);
            }

            if ($departmentId) {
                $query->where('department_id', $departmentId);
            }

            if ($status) {
                $query->where('status', $status);
            }

            $trips = $query->orderBy('trip_date', 'desc')->get();

            $formattedTrips = $trips->map(function($trip) {
                $gasSlip = $trip->gasSlip;
                $fuelReceipt = $gasSlip ? $gasSlip->fuelReceipt : null;

                $distance = $fuelReceipt ? $fuelReceipt->gps_distance_km : $trip->estimated_distance_km;

                return [
                    'trip_ticket_id' => $trip->trip_ticket_id,
                    'trip_ticket_number' => $trip->trip_ticket_number,
                    'trip_date' => $trip->trip_date,
                    'department_name' => $trip->department?->department_name ?? 'N/A',
                    'department_code' => $trip->department?->department_code ?? 'N/A',
                    'vehicle_model' => $trip->vehicle?->vehicle_model ?? 'N/A',
                    'plate_number' => $trip->vehicle?->plate_number ?? 'N/A',
                    'driver_name' => $trip->driver?->user?->full_name ?? 'N/A',
                    'destination' => $trip->destination,
                    'purpose' => $trip->purpose,
                    'estimated_distance_km' => $trip->estimated_distance_km,
                    'actual_distance_km' => $trip->actual_distance_km ?? $fuelReceipt?->gps_distance_km,
                    'estimated_fuel_liters' => $trip->estimated_fuel_liters,
                    'actual_fuel_used' => $trip->actual_fuel_used ?? $fuelReceipt?->liters_availed,
                    'amount_released' => $gasSlip?->amount_released ?? 0,
                    'status' => $trip->status,
                    'has_receipt' => $fuelReceipt && !is_null($fuelReceipt->receipt_photo_path),
                     'submitted_at' => $trip->submitted_at?->toIso8601String(),
                ];
            });

            $statusBreakdown = $trips->groupBy('status')->map(fn($g) => $g->count());

            return response()->json([
                'success' => true,
                'data' => [
                    'trips' => $formattedTrips,
                    'summary' => [
                        'total_trips' => $trips->count(),
                        'status_breakdown' => $statusBreakdown,
                        'total_amount_released' => round($formattedTrips->sum('amount_released'), 2),
                        'total_distance' => round($formattedTrips->sum('actual_distance_km') ?? $formattedTrips->sum('estimated_distance_km'), 2),
                    ],
                    'filters' => [
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                        'department_id' => $departmentId,
                        'status' => $status,
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Trip Ticket Report error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate report: ' . $e->getMessage()
            ], 500);
        }
    }

    // ============================================================
    // 9. GPS VEHICLE ACTIVITY  ✅ FIXED — proper null handling + 3-tier fallback
    // ============================================================
    public function getGPSVehicleActivity(Request $request)
    {
        try {
            $startDate = $request->get('start_date');
            $endDate = $request->get('end_date');
            $vehicleId = $request->get('vehicle_id');

            $query = TripTicket::with([
                'vehicle',
                'driver.user',
                'gasSlip',
                'gasSlip.fuelReceipt',
                'tripHistory',
            ])
            ->whereIn('status', ['in_transit', 'completed', 'closed', 'pending_gso_validation']);

            if ($startDate && $endDate) {
                $query->whereBetween('trip_date', [
                    Carbon::parse($startDate),
                    Carbon::parse($endDate)
                ]);
            }

            if ($vehicleId) {
                $query->where('vehicle_id', $vehicleId);
            }

            $trips = $query->get();

            $activityData = $trips->map(function($trip) {
                // ✅ GPS Distance — prefer trip_ticket.actual_distance_km
                $gpsDistance = $trip->actual_distance_km;

                if ($gpsDistance === null || $gpsDistance == 0) {
                    $gpsDistance = $trip->gasSlip?->fuelReceipt?->gps_distance_km;
                }
                if ($gpsDistance === null || $gpsDistance == 0) {
                    $gpsDistance = $trip->tripHistory->sum('distance_km') ?: null;
                }

                $logbookDistance = $trip->estimated_distance_km;

                // Timing — prefer fuel_receipt, fallback to trip_history
                $fuelReceipt = $trip->gasSlip?->fuelReceipt;
                $tripStart = $fuelReceipt?->trip_started_at;

                if (!$tripStart) {
                    $firstHistory = $trip->tripHistory->sortBy('started_at')->first();
                    $tripStart = $firstHistory?->started_at;
                }

                $tripEnd = $fuelReceipt?->trip_ended_at;

                if (!$tripEnd) {
                    $lastHistory = $trip->tripHistory->where('status', 'completed')
                        ->sortByDesc('ended_at')->first();
                    $tripEnd = $lastHistory?->ended_at;
                }

                $duration = null;
                if ($tripStart && $tripEnd) {
                    $duration = round($tripStart->diffInHours($tripEnd), 1);
                }

                // Distance match logic
                $tolerance = 0.20;
                $hasGpsData = $gpsDistance !== null && $gpsDistance > 0;
                $hasLogbookData = $logbookDistance !== null && $logbookDistance > 0;

                $distanceMatch = 'No GPS Data';

                if ($trip->status === 'in_transit') {
                    $distanceMatch = 'In Progress';
                } elseif ($hasGpsData && $hasLogbookData) {
                    $ratio = $gpsDistance / $logbookDistance;
                    if ($ratio >= (1 - $tolerance) && $ratio <= (1 + $tolerance)) {
                        $distanceMatch = 'Match';
                    } else {
                        $distanceMatch = 'Discrepancy';
                    }
                } elseif ($trip->status === 'pending_gso_validation') {
                    $distanceMatch = 'In Progress';
                }

                return [
                    'trip_ticket_number' => $trip->trip_ticket_number,
                    'vehicle' => $trip->vehicle?->vehicle_model ?? 'N/A',
                    'plate_number' => $trip->vehicle?->plate_number ?? 'N/A',
                    'driver' => $trip->driver?->user?->full_name ?? 'N/A',
                    'trip_start' => $tripStart ? $tripStart->format('Y-m-d H:i') : 'N/A',
                    'trip_end' => $tripEnd ? $tripEnd->format('Y-m-d H:i') : 'N/A',
                    'duration_hrs' => $duration,
                    'gps_distance_km' => $hasGpsData ? round($gpsDistance, 2) : null,
                    'logbook_distance_km' => $hasLogbookData ? round($logbookDistance, 2) : null,
                    'distance_match' => $distanceMatch,
                    'trip_status' => ucfirst(str_replace('_', ' ', $trip->status)),
                    'has_gps_pings' => $trip->tripHistory()->exists(),
                ];
            });

            $summary = [
                'total_trips' => $activityData->count(),
                'match_count' => $activityData->filter(fn($d) => $d['distance_match'] === 'Match')->count(),
                'discrepancy_count' => $activityData->filter(fn($d) => $d['distance_match'] === 'Discrepancy')->count(),
                'in_progress_count' => $activityData->filter(fn($d) => $d['distance_match'] === 'In Progress')->count(),
                'no_gps_count' => $activityData->filter(fn($d) => $d['distance_match'] === 'No GPS Data')->count(),
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'activities' => $activityData,
                    'summary' => $summary,
                    'filters' => [
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                        'vehicle_id' => $vehicleId,
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('GPS Vehicle Activity error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate report: ' . $e->getMessage()
            ], 500);
        }
    }

    // ============================================================
    // 10. DRIVER EFFICIENCY REPORT
    // ============================================================
    public function getDriverEfficiencyReport(Request $request)
    {
        try {
            $startDate = $request->get('start_date');
            $endDate = $request->get('end_date');
            $driverId = $request->get('driver_id');
            $departmentId = $request->get('department_id');

            $query = TripTicket::with([
                'driver.user',
                'vehicle',
                'gasSlip',
                'gasSlip.fuelReceipt',
            ])
            ->whereHas('gasSlip')
            ->whereHas('gasSlip.fuelReceipt')
            ->whereIn('status', ['closed', 'completed']);

            if ($startDate && $endDate) {
                $query->whereBetween('trip_date', [
                    Carbon::parse($startDate),
                    Carbon::parse($endDate)
                ]);
            }

            if ($driverId) {
                $query->where('driver_id', $driverId);
            }

            if ($departmentId) {
                $query->where('department_id', $departmentId);
            }

            $trips = $query->get();

            $drivers = $trips->groupBy('driver_id')->map(function($group) {
                $first = $group->first();
                $driver = $first->driver;

                $totalTrips = $group->count();
                $totalDistance = 0;
                $totalFuel = 0;
                $totalCost = 0;

                foreach ($group as $trip) {
                    $receipt = $trip->gasSlip?->fuelReceipt;
                    if ($receipt) {
                        $totalDistance += $receipt->gps_distance_km ?? 0;
                        $totalFuel += $receipt->liters_availed ?? 0;
                        $totalCost += $receipt->amount_on_receipt ?? 0;
                    }
                }

                $vehicleCounts = $group->groupBy('vehicle_id')->map->count();
                $mostUsedVehicleId = $vehicleCounts->sortDesc()->keys()->first();
                $mostUsedVehicle = $group->firstWhere('vehicle_id', $mostUsedVehicleId)?->vehicle;

                return [
                    'driver_id' => $driver?->driver_id ?? null,
                    'driver_name' => $driver?->user?->full_name ?? 'Unknown',
                    'assigned_vehicle' => $mostUsedVehicle?->vehicle_model ?? 'N/A',
                    'plate_number' => $mostUsedVehicle?->plate_number ?? 'N/A',
                    'total_trips' => $totalTrips,
                    'total_distance_km' => round($totalDistance, 2),
                    'total_fuel_used_liters' => round($totalFuel, 2),
                    'total_cost' => round($totalCost, 2),
                    'fuel_efficiency_kmpl' => $totalFuel > 0 ? round($totalDistance / $totalFuel, 2) : 0,
                    'cost_per_km' => $totalDistance > 0 ? round($totalCost / $totalDistance, 2) : 0,
                    'avg_cost_per_trip' => $totalTrips > 0 ? round($totalCost / $totalTrips, 2) : 0,
                    'efficiency_rating' => $this->getEfficiencyRating($totalFuel, $totalDistance),
                ];
            })->values();

            $summary = [
                'total_drivers' => $drivers->count(),
                'total_trips' => $drivers->sum('total_trips'),
                'total_distance' => round($drivers->sum('total_distance_km'), 2),
                'total_fuel' => round($drivers->sum('total_fuel_used_liters'), 2),
                'total_cost' => round($drivers->sum('total_cost'), 2),
                'avg_efficiency' => $drivers->sum('total_fuel_used_liters') > 0
                    ? round($drivers->sum('total_distance_km') / $drivers->sum('total_fuel_used_liters'), 2)
                    : 0,
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'drivers' => $drivers,
                    'summary' => $summary,
                    'filters' => [
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                        'driver_id' => $driverId,
                        'department_id' => $departmentId,
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Driver Efficiency Report error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate report: ' . $e->getMessage()
            ], 500);
        }
    }

    // ============================================================
    // 11. AUDIT TRAIL REPORT
    // ============================================================
    public function getAuditTrailReport(Request $request)
    {
        try {
            $startDate = $request->get('start_date');
            $endDate = $request->get('end_date');
            $userId = $request->get('user_id');
            $role = $request->get('role');
            $action = $request->get('action');
            $module = $request->get('module');
            $result = $request->get('result');

            $query = AuditLog::with(['user']);

            if ($startDate && $endDate) {
                $query->whereBetween('created_at', [
                    Carbon::parse($startDate)->startOfDay(),
                    Carbon::parse($endDate)->endOfDay()
                ]);
            }

            if ($userId) {
                $query->where('user_id', $userId);
            }

            if ($role) {
                $query->whereHas('user', function($q) use ($role) {
                    $q->where('role', $role);
                });
            }

            if ($action) {
                $query->where('action', $action);
            }

            if ($module) {
                $query->where('table_name', $module);
            }

            if ($result) {
                if ($result === 'Success') {
                    $query->whereNotNull('new_values');
                } else {
                    $query->whereNull('new_values');
                }
            }

            $logs = $query->orderBy('created_at', 'desc')->get();

            $formattedLogs = $logs->map(function($log) {
                return [
                    'log_id' => $log->log_id,
                    'created_at' => $log->created_at,
                    'user_name' => $log->user?->full_name ?? 'Unknown User',
                    'user_email' => $log->user?->email ?? 'N/A',
                    'role' => $log->user?->role ?? 'N/A',
                    'module' => $log->table_name,
                    'action' => $log->action,
                    'details' => $this->formatAuditDetails($log),
                    'result' => $log->new_values ? 'Success' : 'Failed',
                    'ip_address' => $log->ip_address,
                ];
            });

            $summary = [
                'total_logs' => $logs->count(),
                'success_count' => $logs->filter(fn($l) => $l->new_values)->count(),
                'failed_count' => $logs->filter(fn($l) => !$l->new_values)->count(),
                'unique_users' => $logs->pluck('user_id')->filter()->unique()->count(),
                'action_breakdown' => $logs->groupBy('action')->map(fn($g) => $g->count()),
                'module_breakdown' => $logs->groupBy('table_name')->map(fn($g) => $g->count()),
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'logs' => $formattedLogs,
                    'summary' => $summary,
                    'filters' => [
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                        'user_id' => $userId,
                        'role' => $role,
                        'action' => $action,
                        'module' => $module,
                        'result' => $result,
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Audit Trail Report error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate report: ' . $e->getMessage()
            ], 500);
        }
    }


    // ============================================================
// 11b. MAYOR'S OFFICE ACTIVITY LOGS (audit_log + budget_history)
// ============================================================
public function getMoActivityLogs(Request $request)
{
    try {
        $startDate = $request->get('start_date');
        $endDate   = $request->get('end_date');

        // --------------------------------------------
        // 1. AUDIT LOG entries (role = mayors_office)
        // --------------------------------------------
        $auditQuery = AuditLog::with(['user'])
            ->whereHas('user', function ($q) {
                $q->where('role', 'mayors_office');
            });

        if ($startDate && $endDate) {
            $auditQuery->whereBetween('created_at', [
                Carbon::parse($startDate)->startOfDay(),
                Carbon::parse($endDate)->endOfDay(),
            ]);
        }

        $auditLogs = $auditQuery->orderBy('created_at', 'desc')->get()
            ->map(function ($log) {
                return [
                    'id' => 'audit-' . $log->log_id,
                    'source' => 'audit',
                    'user_name' => $log->user?->full_name ?? 'Unknown User',
                    'user_id' => $log->user_id,
                    'action' => $log->action,
                    'module' => $log->table_name,
                    'details' => $this->formatAuditDetails($log),
                    'created_at' => $log->created_at?->toIso8601String(),
                ];
            });

        // --------------------------------------------
        // 2. BUDGET HISTORY entries
        // --------------------------------------------
        $budgetQuery = \App\Models\BudgetHistory::query();

        if ($startDate && $endDate) {
            $budgetQuery->whereBetween('created_at', [
                Carbon::parse($startDate)->startOfDay(),
                Carbon::parse($endDate)->endOfDay(),
            ]);
        }

        $budgetLogs = $budgetQuery->orderBy('created_at', 'desc')->get()
            ->map(function ($entry) {
                return [
                    'id' => 'budget-' . $entry->id,
                    'source' => 'budget',
                    'user_name' => $entry->user_name ?? 'System',
                    'user_id' => $entry->user_id,
                    'action' => $entry->action,
                    'module' => 'budget',
                    'details' => null, // formatted on frontend
                    'department_name' => $entry->department_name,
                    'reason' => $entry->reason,
                    'previous_amount' => $entry->previous_amount,
                    'added_amount' => $entry->added_amount,
                    'new_amount' => $entry->new_amount,
                    'created_at' => $entry->created_at?->toIso8601String(),
                ];
            });

        // --------------------------------------------
        // 3. MERGE and sort desc by created_at
        // --------------------------------------------
        $merged = $auditLogs->concat($budgetLogs)
            ->sortByDesc(fn($item) => $item['created_at'] instanceof \Carbon\Carbon
                ? $item['created_at']->timestamp
                : strtotime($item['created_at']))
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'logs' => $merged,
                'summary' => [
                    'total_logs'     => $merged->count(),
                    'audit_count'    => $auditLogs->count(),
                    'budget_count'   => $budgetLogs->count(),
                ],
            ],
        ]);

    } catch (\Exception $e) {
        Log::error('MO Activity Logs error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch activity logs: ' . $e->getMessage(),
        ], 500);
    }
}

    // ============================================================
    // GSO ACTIVITY LOGS (audit_log + trip_history)
    // ============================================================
    public function getGsoActivityLogs(Request $request)
    {
        try {
            $startDate = $request->get('start_date');
            $endDate   = $request->get('end_date');

            // --------------------------------------------
            // 1. AUDIT LOG entries (role = gso_office)
            // --------------------------------------------
            $auditQuery = AuditLog::with(['user'])
                ->whereHas('user', function ($q) {
                    $q->where('role', 'gso_office');
                });

            if ($startDate && $endDate) {
                $auditQuery->whereBetween('created_at', [
                    Carbon::parse($startDate)->startOfDay(),
                    Carbon::parse($endDate)->endOfDay(),
                ]);
            }

            $auditLogs = $auditQuery->orderBy('created_at', 'desc')->get()
                ->map(function ($log) {
                    return [
                        'id'          => 'audit-' . $log->log_id,
                        'source'      => 'audit',
                        'user_name'   => $log->user?->full_name ?? 'Unknown User',
                        'user_id'     => $log->user_id,
                        'action'      => $log->action,
                        'module'      => $log->table_name,
                        'details'     => $this->formatAuditDetails($log),
                        'created_at' => $log->created_at?->toIso8601String(),
                    ];
                });

            // --------------------------------------------
            // 2. TRIP HISTORY entries (per leg)
            // --------------------------------------------
            $thQuery = \App\Models\TripHistory::with([
                'tripTicket.driver.user',
                'tripTicket.vehicle',
            ]);

            if ($startDate && $endDate) {
                $thQuery->where(function ($q) use ($startDate, $endDate) {
                    $q->whereBetween('started_at', [
                        Carbon::parse($startDate)->startOfDay(),
                        Carbon::parse($endDate)->endOfDay(),
                    ])->orWhereBetween('ended_at', [
                        Carbon::parse($startDate)->startOfDay(),
                        Carbon::parse($endDate)->endOfDay(),
                    ]);
                });
            }

            $tripHistoryLogs = collect();

            foreach ($thQuery->orderBy('started_at', 'desc')->limit(100)->get() as $th) {
                $ticket    = $th->tripTicket;
                $driver    = $ticket?->driver?->user?->full_name ?? 'Unknown Driver';
                $vehicle   = $ticket?->vehicle?->plate_number ?? 'N/A';
                $ticketNo  = $ticket?->trip_ticket_number ?? 'N/A';
                $dest      = $ticket?->destination ?? 'N/A';
                $tripNo    = $th->trip_number ?? '?';

                // Start event
                if ($th->started_at) {
                    $tripHistoryLogs->push([
                        'id'                 => 'trip-' . $th->history_id . '-start',
                        'source'             => 'trip_history',
                        'event'              => 'started',
                        'user_name'          => $driver,
                        'user_id'            => null,
                        'action'             => 'started',
                        'module'             => 'trip',
                        'trip_number'        => $tripNo,
                        'trip_ticket_number' => $ticketNo,
                        'vehicle_plate'      => $vehicle,
                        'destination'        => $dest,
                        'distance_km'        => null,
                       'created_at'         => $th->started_at?->toIso8601String(),
                    ]);
                }

                // End event
                if ($th->ended_at && $th->status === 'completed') {
                    $tripHistoryLogs->push([
                        'id'                 => 'trip-' . $th->history_id . '-end',
                        'source'             => 'trip_history',
                        'event'              => 'completed',
                        'user_name'          => $driver,
                        'user_id'            => null,
                        'action'             => 'completed',
                        'module'             => 'trip',
                        'trip_number'        => $tripNo,
                        'trip_ticket_number' => $ticketNo,
                        'vehicle_plate'      => $vehicle,
                        'destination'        => $dest,
                        'distance_km'        => $th->distance_km,
                        'created_at'         => $th->ended_at?->toIso8601String(),
                    ]);
                }
            }

            // --------------------------------------------
            // 3. MERGE and sort desc by timestamp
            // --------------------------------------------
            $merged = $auditLogs->concat($tripHistoryLogs)
                ->sortByDesc(fn($i) => $i['created_at'] instanceof \Carbon\Carbon
                    ? $i['created_at']->timestamp
                    : strtotime($i['created_at']))
                ->values();

            return response()->json([
                'success' => true,
                'data' => [
                    'logs' => $merged,
                    'summary' => [
                        'total_logs'         => $merged->count(),
                        'audit_count'        => $auditLogs->count(),
                        'trip_history_count' => $tripHistoryLogs->count(),
                    ],
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('GSO Activity Logs error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch activity logs: ' . $e->getMessage(),
            ], 500);
        }
    }


    // ============================================================
    // EXPORT METHODS
    // ============================================================

    public function exportFuelConsumptionReport(Request $request, $format)
    {
        try {
            $response = $this->getFuelConsumptionReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return $this->returnAsCSV("Error: " . ($data['message'] ?? 'Failed'), 'error.csv');
            }

            $reportData = $data['data'];
            $filename = 'fuel_consumption_report_' . date('Y-m-d');

            if ($format === 'excel') {
                return Excel::download(new FuelConsumptionExport($reportData), $filename . '.xlsx');
            } elseif ($format === 'pdf') {
                return $this->generateFuelConsumptionPDF($reportData, $filename);
            } else {
                return $this->returnAsCSV($this->buildFuelConsumptionCSV($reportData), $filename . '.csv');
            }
        } catch (\Exception $e) {
            Log::error('Export error: ' . $e->getMessage());
            return $this->returnAsCSV("Error: " . $e->getMessage(), 'error.csv');
        }
    }

    public function exportVehicleReport(Request $request, $format)
    {
        try {
            $response = $this->getVehicleReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json(['success' => false, 'message' => 'Failed'], 500);
            }

            $reportData = $data['data'];
            $filename = 'vehicle_summary_' . date('Y-m-d');
            $filters = ['start_date' => $request->get('start_date'), 'end_date' => $request->get('end_date')];

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(new \App\Exports\VehicleSummaryExport($reportData), $filename . '.xlsx');
            } elseif ($format === 'pdf') {
                return $this->streamPdf(PdfReportService::vehicleSummary($reportData, $filters), $filename);
            } else {
                return $this->returnAsCSV($this->buildVehicleSummaryCSV($reportData), $filename . '.csv');
            }
        } catch (\Exception $e) {
            Log::error('Export vehicle report error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function exportBudgetReport(Request $request, $format)
    {
        try {
            $response = $this->getBudgetReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json(['success' => false, 'message' => 'Failed'], 500);
            }

            $reportData = $data['data'];
            $filename = 'budget_utilization_' . date('Y-m-d');
            $filters = ['year' => $request->get('year', date('Y'))];

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(new \App\Exports\BudgetUtilizationExport($reportData), $filename . '.xlsx');
            } elseif ($format === 'pdf') {
                return $this->streamPdf(PdfReportService::budgetUtilization($reportData, $filters), $filename);
            } else {
                return $this->returnAsCSV($this->buildBudgetUtilizationCSV($reportData), $filename . '.csv');
            }
        } catch (\Exception $e) {
            Log::error('Export budget report error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function exportFuelReceiptReport(Request $request, $format)
    {
        try {
            $response = $this->getFuelReceiptReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json(['success' => false, 'message' => 'Failed'], 500);
            }

            $reportData = $data['data'];
            $filename = 'fuel_receipt_report_' . date('Y-m-d');

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(new FuelReceiptReportExport($reportData, 'gso'), $filename . '.xlsx');
            } elseif ($format === 'pdf') {
                return $this->generateFuelReceiptPDF($reportData, $filename);
            } else {
                return $this->exportFuelReceiptCSV($reportData, $filename);
            }
        } catch (\Exception $e) {
            Log::error('Export fuel receipt report error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function exportDepartmentFuelConsumption(Request $request, $format)
    {
        try {
            $response = $this->getDepartmentFuelConsumption($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json(['success' => false, 'message' => 'Failed'], 500);
            }

            $reportData = $data['data'];
            $filename = 'department_fuel_consumption_' . date('Y-m-d');
            $filters = ['start_date' => $request->get('start_date'), 'end_date' => $request->get('end_date')];

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(new \App\Exports\DepartmentFuelExport($reportData), $filename . '.xlsx');
            } elseif ($format === 'pdf') {
                return $this->streamPdf(PdfReportService::departmentSummary($reportData, $filters), $filename);
            } else {
                return $this->returnAsCSV($this->buildDepartmentFuelCSV($reportData), $filename . '.csv');
            }
        } catch (\Exception $e) {
            Log::error('Export department fuel error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function exportMonthlyFuelConsumption(Request $request, $format)
    {
        try {
            $response = $this->getMonthlyFuelConsumption($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json(['success' => false, 'message' => 'Failed'], 500);
            }

            $reportData = $data['data'];
            $filename = 'monthly_fuel_consumption_' . date('Y-m-d');
            $filters = ['year' => $request->get('year', date('Y'))];

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(new \App\Exports\MonthlyFuelExport($reportData), $filename . '.xlsx');
            } elseif ($format === 'pdf') {
                return $this->streamPdf(PdfReportService::monthlySummary($reportData, $filters), $filename);
            } else {
                return $this->returnAsCSV($this->buildMonthlyFuelCSV($reportData), $filename . '.csv');
            }
        } catch (\Exception $e) {
            Log::error('Export monthly fuel error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function exportTripTicketReport(Request $request, $format)
    {
        try {
            $response = $this->getTripTicketReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json(['success' => false, 'message' => 'Failed'], 500);
            }

            $reportData = $data['data'];
            $filename = 'trip_ticket_report_' . date('Y-m-d');
            $filters = ['start_date' => $request->get('start_date'), 'end_date' => $request->get('end_date')];

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(new \App\Exports\TripTicketExport($reportData), $filename . '.xlsx');
            } elseif ($format === 'pdf') {
                return $this->streamPdf(PdfReportService::tripTicket($reportData, $filters), $filename);
            } else {
                return $this->returnAsCSV($this->buildTripTicketCSV($reportData), $filename . '.csv');
            }
        } catch (\Exception $e) {
            Log::error('Export trip ticket error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function exportGPSVehicleActivity(Request $request, $format)
    {
        try {
            $response = $this->getGPSVehicleActivity($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json(['success' => false, 'message' => 'Failed'], 500);
            }

            $reportData = $data['data'];
            $filename = 'gps_vehicle_activity_' . date('Y-m-d');
            $filters = ['start_date' => $request->get('start_date'), 'end_date' => $request->get('end_date')];

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(new \App\Exports\GPSActivityExport($reportData), $filename . '.xlsx');
            } elseif ($format === 'pdf') {
                return $this->streamPdf(PdfReportService::gpsActivity($reportData, $filters), $filename);
            } else {
                return $this->returnAsCSV($this->buildGPSActivityCSV($reportData), $filename . '.csv');
            }
        } catch (\Exception $e) {
            Log::error('Export GPS activity error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function exportReconciliation(Request $request, $format)
    {
        try {
            $response = $this->getReconciliationReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json(['success' => false, 'message' => 'Failed'], 500);
            }

            $reportData = $data['data'];
            $filename = 'reconciliation_report_' . date('Y-m-d');
            $filters = ['start_date' => $request->get('start_date'), 'end_date' => $request->get('end_date')];

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(new \App\Exports\ReconciliationExport($reportData), $filename . '.xlsx');
            } elseif ($format === 'pdf') {
                return $this->streamPdf(PdfReportService::reconciliation($reportData, $filters), $filename);
            } else {
                return $this->returnAsCSV($this->buildReconciliationCSV($reportData), $filename . '.csv');
            }
        } catch (\Exception $e) {
            Log::error('Export reconciliation error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function exportDriverEfficiency(Request $request, $format)
    {
        try {
            $response = $this->getDriverEfficiencyReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json(['success' => false, 'message' => 'Failed'], 500);
            }

            $reportData = $data['data'];
            $filename = 'driver_efficiency_' . date('Y-m-d');
            $filters = ['start_date' => $request->get('start_date'), 'end_date' => $request->get('end_date')];

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(new \App\Exports\DriverEfficiencyExport($reportData), $filename . '.xlsx');
            } elseif ($format === 'pdf') {
                return $this->streamPdf(PdfReportService::driverEfficiency($reportData, $filters), $filename);
            } else {
                return $this->returnAsCSV($this->buildDriverEfficiencyCSV($reportData), $filename . '.csv');
            }
        } catch (\Exception $e) {
            Log::error('Export driver efficiency error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function exportAuditTrail(Request $request, $format)
    {
        try {
            $response = $this->getAuditTrailReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json(['success' => false, 'message' => 'Failed'], 500);
            }

            $reportData = $data['data'];
            $filename = 'audit_trail_' . date('Y-m-d');
            $filters = ['start_date' => $request->get('start_date'), 'end_date' => $request->get('end_date')];

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(new \App\Exports\AuditTrailExport($reportData), $filename . '.xlsx');
            } elseif ($format === 'pdf') {
                return $this->streamPdf(PdfReportService::auditTrail($reportData, $filters), $filename);
            } else {
                return $this->returnAsCSV($this->buildAuditTrailCSV($reportData), $filename . '.csv');
            }
        } catch (\Exception $e) {
            Log::error('Export audit trail error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    // ============================================================
    // PDF HELPERS
    // ============================================================
    private function streamPdf(string $html, string $filename)
    {
        if (class_exists('Barryvdh\DomPDF\Facade\Pdf')) {
            $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html);
            $pdf->setPaper('A4', 'landscape');
            $pdf->setOptions(['defaultFont' => 'sans-serif', 'isHtml5ParserEnabled' => true, 'isRemoteEnabled' => true]);
            return $pdf->download($filename . '.pdf');
        }
        return response($html, 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="' . $filename . '.pdf"']);
    }

    private function generateFuelConsumptionPDF($reportData, $filename)
    {
        try {
            $html = $this->buildFuelConsumptionPDFHTML($reportData);
            return $this->streamPdf($html, $filename);
        } catch (\Exception $e) {
            Log::error('PDF generation error: ' . $e->getMessage());
            return $this->returnAsCSV($this->buildFuelConsumptionCSV($reportData), $filename . '.csv');
        }
    }

    private function generateFuelReceiptPDF($reportData, $filename)
    {
        try {
            $html = $this->buildFuelReceiptPDFHTML($reportData);
            return $this->streamPdf($html, $filename);
        } catch (\Exception $e) {
            Log::error('PDF generation error: ' . $e->getMessage());
            return $this->exportFuelReceiptCSV($reportData, $filename);
        }
    }

    private function buildFuelConsumptionPDFHTML($reportData)
    {
        $logs = $reportData['recent_logs'] ?? [];
        $filters = $reportData['filters'] ?? [];
        $totalLiters = 0;
        $totalCost = 0;

        $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fuel Consumption Report</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 9px; padding: 20px; color: #1e293b; }
            .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 15px; }
            .header h1 { font-size: 18px; color: #1e293b; font-weight: bold; }
            .header p { color: #64748b; font-size: 10px; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 8px; }
            th { background: #2563eb; color: white; padding: 6px 4px; text-align: center; font-weight: bold; border: 1px solid #1e40af; }
            td { padding: 5px 4px; border: 1px solid #d1d5db; text-align: center; font-size: 8px; }
            tr:nth-child(even) { background: #f8fafc; }
            .total-row { background: #e2e8f0; font-weight: bold; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .footer { text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 15px; color: #94a3b8; font-size: 7px; }
        </style></head><body>
        <div class="header"><h1>FUEL CONSUMPTION REPORT</h1><p>LGU Laguindingan - FCMS</p>
        <p style="font-size: 8px; color: #64748b;">Generated: ' . now()->format('F d, Y h:i A') . '</p></div>
        <table><thead><tr>
        <th>#</th><th>Date</th><th>Ticket #</th><th>Vehicle</th><th>Plate</th><th>Driver</th>
        <th>Department</th><th>Destination</th><th>Qty (L)</th><th>Amount</th>
        </tr></thead><tbody>';

        if (count($logs) > 0) {
            $i = 1;
            foreach ($logs as $log) {
                $liters = (float) ($log['liters_availed'] ?? 0);
                $amount = (float) ($log['amount_on_receipt'] ?? 0);
                $totalLiters += $liters;
                $totalCost += $amount;
                $dateRaw = $log['trip_ended_at'] ?? null;
                $dateDisplay = $dateRaw ? \Carbon\Carbon::parse($dateRaw)->format('m/d/Y') : 'N/A';

                $html .= '<tr>
                    <td>' . $i++ . '</td>
                    <td>' . $dateDisplay . '</td>
                    <td>' . ($log['trip_ticket_number'] ?? 'N/A') . '</td>
                    <td class="text-left">' . ($log['vehicle'] ?? 'N/A') . '</td>
                    <td>' . ($log['plate_number'] ?? 'N/A') . '</td>
                    <td class="text-left">' . ($log['driver'] ?? 'N/A') . '</td>
                    <td class="text-left">' . ($log['department'] ?? 'N/A') . '</td>
                    <td class="text-left">' . ($log['destination'] ?? 'N/A') . '</td>
                    <td class="text-right">' . number_format($liters, 2) . '</td>
                    <td class="text-right" style="color:#059669;font-weight:bold;">₱' . number_format($amount, 2) . '</td>
                </tr>';
            }
            $html .= '<tr class="total-row"><td colspan="8" class="text-right">TOTAL</td>
                <td class="text-right">' . number_format($totalLiters, 2) . '</td>
                <td class="text-right" style="color:#059669;">₱' . number_format($totalCost, 2) . '</td></tr>';
        } else {
            $html .= '<tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:20px;">No data</td></tr>';
        }
        $html .= '</tbody></table><div class="footer"><p>FCMS — © ' . date('Y') . ' Laguindingan</p></div></body></html>';
        return $html;
    }

    private function buildFuelReceiptPDFHTML($reportData)
    {
        $receipts = $reportData['receipts'] ?? [];
        $totalAmount = 0;
        $totalQuantity = 0;

        $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fuel Receipt Report</title>
        <style>
            body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 8px; padding: 15px; color: #1e293b; }
            .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 15px; }
            .header h1 { font-size: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 7px; }
            th { background: #2563eb; color: white; padding: 5px 3px; border: 1px solid #1e40af; }
            td { padding: 4px 3px; border: 1px solid #d1d5db; }
            tr:nth-child(even) { background: #f8fafc; }
            .text-right { text-align: right; }
        </style></head><body>
        <div class="header"><h1>FUEL RECEIPT REPORT</h1><p>Generated: ' . now()->format('F d, Y h:i A') . '</p></div>
        <table><thead><tr>
        <th>Date</th><th>Invoice #</th><th>Ticket #</th><th>Driver</th><th>Vehicle</th><th>Plate</th>
        <th>Destination</th><th>Fuel Type</th><th>Unit Price</th><th>Amount</th><th>Qty (L)</th>
        </tr></thead><tbody>';

        foreach ($receipts as $r) {
            $totalAmount += $r['amount'] ?? 0;
            $totalQuantity += $r['quantity'] ?? 0;
            $html .= '<tr>
                <td>' . ($r['date'] ?? 'N/A') . '</td>
                <td>' . ($r['invoice_number'] ?? 'N/A') . '</td>
                <td>' . ($r['ticket_number'] ?? 'N/A') . '</td>
                <td>' . ($r['driver'] ?? 'N/A') . '</td>
                <td>' . ($r['vehicle'] ?? 'N/A') . '</td>
                <td>' . ($r['plate_no'] ?? 'N/A') . '</td>
                <td>' . ($r['destination'] ?? 'N/A') . '</td>
                <td>' . ($r['fuel_type'] ?? 'N/A') . '</td>
                <td class="text-right">₱' . number_format($r['unit_price'] ?? 0, 2) . '</td>
                <td class="text-right">₱' . number_format($r['amount'] ?? 0, 2) . '</td>
                <td class="text-right">' . number_format($r['quantity'] ?? 0, 2) . '</td>
            </tr>';
        }
        $html .= '<tr style="background:#e2e8f0;font-weight:bold;"><td colspan="9" class="text-right">TOTAL</td>
            <td class="text-right">₱' . number_format($totalAmount, 2) . '</td>
            <td class="text-right">' . number_format($totalQuantity, 2) . '</td></tr>';
        $html .= '</tbody></table></body></html>';
        return $html;
    }

    // ============================================================
    // CSV BUILDERS
    // ============================================================
    private function buildFuelConsumptionCSV($reportData)
    {
        $lines = ["\xEF\xBB\xBF", 'FUEL CONSUMPTION REPORT', 'Generated: ' . now()->format('Y-m-d H:i:s'), ''];
        $summary = $reportData['summary'] ?? [];
        $lines[] = 'SUMMARY';
        $lines[] = 'Total Trips,' . ($summary['total_trips'] ?? 0);
        $lines[] = 'Total Fuel (Liters),' . ($summary['total_fuel_liters'] ?? 0);
        $lines[] = 'Total Cost (PHP),' . ($summary['total_fuel_cost'] ?? 0);
        $lines[] = '';
        $lines[] = 'VEHICLE BREAKDOWN';
        $lines[] = 'Plate #,Model,Fuel Type,Trips,Liters,Cost,Distance (km),Km/L,Efficiency';

        foreach ($reportData['vehicle_breakdown'] ?? [] as $v) {
            $lines[] = implode(',', [
                '"' . ($v['plate_number'] ?? 'N/A') . '"',
                '"' . ($v['model'] ?? 'N/A') . '"',
                '"' . ($v['fuel_type'] ?? 'N/A') . '"',
                $v['trips'] ?? 0,
                $v['liters'] ?? 0,
                $v['cost'] ?? 0,
                $v['distance_km'] ?? 0,
                $v['km_per_liter'] ?? 0,
                '"' . ($v['efficiency_rating'] ?? '') . '"',
            ]);
        }
        return implode("\n", $lines);
    }

    private function exportFuelReceiptCSV($reportData, $filename)
    {
        $receipts = $reportData['receipts'] ?? [];
        $summary = $reportData['summary'] ?? [];
        $lines = ["\xEF\xBB\xBF", 'FUEL RECEIPT REPORT', 'Generated: ' . now()->format('Y-m-d H:i:s'), ''];
        $lines[] = 'SUMMARY';
        $lines[] = 'Total Receipts,' . ($summary['total_receipts'] ?? 0);
        $lines[] = 'Total Fuel (Liters),' . ($summary['total_liters'] ?? 0);
        $lines[] = 'Total Cost,' . ($summary['total_cost'] ?? 0);
        $lines[] = '';
        $lines[] = 'Used For,Invoice #,Date,Lubricant,Quantity,Unit Price,Amount,Control No.,Plate No.,Vehicle,Department,Driver';

        foreach ($receipts as $r) {
            $lines[] = implode(',', [
                '"' . ($r['used_for'] ?? 'N/A') . '"',
                '"' . ($r['charge_invoice_no'] ?? 'N/A') . '"',
                '"' . ($r['date'] ?? 'N/A') . '"',
                '"' . ($r['lubricant'] ?? 'N/A') . '"',
                $r['quantity'] ?? 0,
                $r['unit_price'] ?? 0,
                $r['amount'] ?? 0,
                '"' . ($r['control_no'] ?? 'N/A') . '"',
                '"' . ($r['plate_no'] ?? 'N/A') . '"',
                '"' . ($r['vehicle'] ?? 'N/A') . '"',
                '"' . ($r['department'] ?? 'N/A') . '"',
                '"' . ($r['driver'] ?? 'N/A') . '"',
            ]);
        }
        $content = implode("\n", $lines);
        return response($content, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '.csv"',
        ]);
    }

    private function buildVehicleSummaryCSV($reportData)
    {
        $lines = ["\xEF\xBB\xBF", 'VEHICLE SUMMARY', 'Generated: ' . now()->format('Y-m-d H:i:s'), '',
            'Vehicle,Plate No.,Total Trips,Total Fuel (L),Total Amount (₱),Average Fuel/Trip (L)'];

        foreach ($reportData as $v) {
            $avgFuelPerTrip = ($v['trip_count'] ?? 0) > 0 ? number_format(($v['total_liters'] ?? 0) / ($v['trip_count'] ?? 1), 2) : 0;
            $lines[] = implode(',', [
                '"' . ($v['model'] ?? 'N/A') . '"',
                '"' . ($v['plate_number'] ?? 'N/A') . '"',
                $v['trip_count'] ?? 0,
                $v['total_liters'] ?? 0,
                $v['total_cost'] ?? 0,
                $avgFuelPerTrip,
            ]);
        }
        return implode("\n", $lines);
    }

    private function buildBudgetUtilizationCSV($reportData)
    {
        $lines = ["\xEF\xBB\xBF", 'BUDGET UTILIZATION', 'Generated: ' . now()->format('Y-m-d H:i:s'), '',
            'Department,Allocated (₱),Used (₱),Remaining (₱),Utilization (%)'];

        foreach ($reportData['periods'] ?? [] as $p) {
            $lines[] = implode(',', [
                '"' . ($p['department_name'] ?? 'N/A') . '"',
                $p['allocated'] ?? 0,
                $p['used'] ?? 0,
                $p['remaining'] ?? 0,
                $p['utilization'] ?? 0,
            ]);
        }
        return implode("\n", $lines);
    }

    private function buildDepartmentFuelCSV($reportData)
    {
        $lines = ["\xEF\xBB\xBF", 'DEPARTMENT FUEL CONSUMPTION', 'Generated: ' . now()->format('Y-m-d H:i:s'), '',
            'Department,Trips,Fuel (L),Amount (₱),Avg Fuel/Trip'];

        foreach ($reportData['departments'] ?? [] as $d) {
            $lines[] = implode(',', [
                '"' . ($d['department_name'] ?? 'N/A') . '"',
                $d['total_trips'] ?? 0,
                $d['total_fuel_liters'] ?? 0,
                $d['total_amount'] ?? 0,
                $d['avg_fuel_per_trip'] ?? 0,
            ]);
        }
        return implode("\n", $lines);
    }

    private function buildMonthlyFuelCSV($reportData)
    {
        $lines = ["\xEF\xBB\xBF", 'MONTHLY FUEL CONSUMPTION', 'Generated: ' . now()->format('Y-m-d H:i:s'), '',
            'Month,Trips,Fuel (L),Cost (₱),Avg Fuel/Trip'];

        foreach ($reportData['months'] ?? [] as $m) {
            $lines[] = implode(',', [
                '"' . ($m['month'] ?? 'N/A') . '"',
                $m['total_trips'] ?? 0,
                $m['total_fuel_liters'] ?? 0,
                $m['total_cost'] ?? 0,
                $m['avg_fuel_per_trip'] ?? 0,
            ]);
        }
        return implode("\n", $lines);
    }

    private function buildTripTicketCSV($reportData)
    {
        $lines = ["\xEF\xBB\xBF", 'TRIP TICKET REPORT', 'Generated: ' . now()->format('Y-m-d H:i:s'), '',
            'TT Number,Date,Department,Vehicle,Plate,Driver,Destination,Purpose,Distance (km),Status'];

        foreach ($reportData['trips'] ?? [] as $t) {
            $lines[] = implode(',', [
                '"' . ($t['trip_ticket_number'] ?? 'N/A') . '"',
                '"' . ($t['trip_date'] ?? 'N/A') . '"',
                '"' . ($t['department_name'] ?? 'N/A') . '"',
                '"' . ($t['vehicle_model'] ?? 'N/A') . '"',
                '"' . ($t['plate_number'] ?? 'N/A') . '"',
                '"' . ($t['driver_name'] ?? 'N/A') . '"',
                '"' . ($t['destination'] ?? 'N/A') . '"',
                '"' . ($t['purpose'] ?? 'N/A') . '"',
                $t['estimated_distance_km'] ?? $t['actual_distance_km'] ?? 0,
                '"' . ($t['status'] ?? 'N/A') . '"',
            ]);
        }
        return implode("\n", $lines);
    }

    private function buildGPSActivityCSV($reportData)
    {
        $lines = ["\xEF\xBB\xBF", 'GPS VEHICLE ACTIVITY', 'Generated: ' . now()->format('Y-m-d H:i:s'), '',
            'TT Number,Vehicle,Driver,Trip Start,Trip End,Duration (hrs),GPS Distance,Logbook Distance,Distance Match,Trip Status'];

        foreach ($reportData['activities'] ?? [] as $a) {
            $lines[] = implode(',', [
                '"' . ($a['trip_ticket_number'] ?? 'N/A') . '"',
                '"' . ($a['vehicle'] ?? 'N/A') . '"',
                '"' . ($a['driver'] ?? 'N/A') . '"',
                '"' . ($a['trip_start'] ?? 'N/A') . '"',
                '"' . ($a['trip_end'] ?? 'N/A') . '"',
                $a['duration_hrs'] ?? 0,
                $a['gps_distance_km'] ?? 0,
                $a['logbook_distance_km'] ?? 0,
                '"' . ($a['distance_match'] ?? 'N/A') . '"',
                '"' . ($a['trip_status'] ?? 'N/A') . '"',
            ]);
        }
        return implode("\n", $lines);
    }

    private function buildReconciliationCSV($reportData)
    {
        $lines = ["\xEF\xBB\xBF", 'RECONCILIATION REPORT', 'Generated: ' . now()->format('Y-m-d H:i:s'), '',
            'Ticket No.,Vehicle,Driver,Expected Distance,Actual Distance,Variance,Expected Fuel,Actual Fuel,Fuel Variance'];

        foreach ($reportData['reconciliations'] ?? [] as $r) {
            $lines[] = implode(',', [
                '"' . ($r['ticket_number'] ?? 'N/A') . '"',
                '"' . ($r['plate_number'] ?? 'N/A') . '"',
                '"' . ($r['driver_name'] ?? 'N/A') . '"',
                $r['expected_distance'] ?? 0,
                $r['actual_distance'] ?? 0,
                $r['variance'] ?? 0,
                $r['estimated_fuel'] ?? 0,
                $r['actual_fuel'] ?? '',
                $r['fuel_variance'] ?? '',
            ]);
        }
        return implode("\n", $lines);
    }

    private function buildDriverEfficiencyCSV($reportData)
    {
        $lines = ["\xEF\xBB\xBF", 'DRIVER EFFICIENCY', 'Generated: ' . now()->format('Y-m-d H:i:s'), '',
            'Rank,Driver,Vehicle,Trips,Distance (km),Fuel (L),Efficiency (km/L)'];
        $rank = 1;
        foreach ($reportData['drivers'] ?? [] as $d) {
            $lines[] = implode(',', [
                $rank++,
                '"' . ($d['driver_name'] ?? 'N/A') . '"',
                '"' . ($d['assigned_vehicle'] ?? 'N/A') . '"',
                $d['total_trips'] ?? 0,
                $d['total_distance_km'] ?? 0,
                $d['total_fuel_used_liters'] ?? 0,
                $d['fuel_efficiency_kmpl'] ?? 0,
            ]);
        }
        return implode("\n", $lines);
    }

    private function buildAuditTrailCSV($reportData)
    {
        $lines = ["\xEF\xBB\xBF", 'AUDIT TRAIL', 'Generated: ' . now()->format('Y-m-d H:i:s'), '',
            'Date/Time,User,Role,Module,Action,Details,Result'];

        foreach ($reportData['logs'] ?? [] as $log) {
            $lines[] = implode(',', [
                '"' . ($log['created_at'] ?? 'N/A') . '"',
                '"' . ($log['user_name'] ?? 'N/A') . '"',
                '"' . ($log['role'] ?? 'N/A') . '"',
                '"' . ($log['module'] ?? 'N/A') . '"',
                '"' . ($log['action'] ?? 'N/A') . '"',
                '"' . str_replace('"', '""', $log['details'] ?? 'N/A') . '"',
                '"' . ($log['result'] ?? 'N/A') . '"',
            ]);
        }
        return implode("\n", $lines);
    }

    // ============================================================
    // LEGACY METHODS
    // ============================================================
    public function getTripReport(Request $request)
    {
        try {
            $startDate = $request->get('start_date');
            $endDate = $request->get('end_date');
            $departmentId = $request->get('department_id');

            $query = TripTicket::with(['department', 'driver.user', 'vehicle', 'gasSlip']);

            if ($startDate && $endDate) {
                $query->whereBetween('trip_date', [$startDate, $endDate]);
            }
            if ($departmentId) {
                $query->where('department_id', $departmentId);
            }

            $trips = $query->get();
            $statusBreakdown = $trips->groupBy('status')->map(fn($g) => $g->count());

            return response()->json([
                'success' => true,
                'data' => [
                    'total_trips' => $trips->count(),
                    'status_breakdown' => $statusBreakdown,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getFuelReport(Request $request)
    {
        try {
            $startDate = $request->get('start_date');
            $endDate = $request->get('end_date');
            $query = FuelReceipt::query();
            if ($startDate && $endDate) {
                $query->whereBetween('created_at', [$startDate, $endDate]);
            }
            $receipts = $query->get();
            return response()->json([
                'success' => true,
                'data' => [
                    'summary' => [
                        'total_liters' => $receipts->sum('liters_availed'),
                        'total_cost' => $receipts->sum('amount_on_receipt'),
                    ]
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getReportSummary(Request $request)
    {
        try {
            return response()->json([
                'success' => true,
                'data' => [
                    'trips' => ['total' => TripTicket::count()],
                    'fuel' => ['total_liters' => FuelReceipt::sum('liters_availed')],
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getWeeklyMonitoring(Request $request) { return response()->json(['success' => true, 'data' => []]); }
    public function getFuelWithoutTrip(Request $request) { return response()->json(['success' => true, 'data' => []]); }
    public function getFundReleaseHistory(Request $request) { return response()->json(['success' => true, 'data' => []]); }
    public function exportTripReport(Request $request, $format) { return response()->json(['message' => 'Coming soon'], 200); }
    public function exportFuelReport(Request $request, $format) { return response()->json(['message' => 'Coming soon'], 200); }
    public function exportWeeklyMonitoring(Request $request, $format) { return response()->json(['message' => 'Coming soon'], 200); }
    public function exportFuelWithoutTrip(Request $request, $format) { return response()->json(['message' => 'Coming soon'], 200); }
    public function exportFundReleaseHistory(Request $request, $format) { return response()->json(['message' => 'Coming soon'], 200); }

    // ============================================================
    // HELPER METHODS
    // ============================================================
    private function calculateTotalDistance($receipts)
    {
        $totalDistance = 0;
        foreach ($receipts as $receipt) {
            if ($receipt->gps_distance_km) {
                $totalDistance += $receipt->gps_distance_km;
            }
        }
        return $totalDistance;
    }

    private function calculateReceiptDistance($receipt)
    {
        return $receipt->gps_distance_km ?? 0;
    }

    private function getEfficiencyRating($liters, $distance)
    {
        if ($liters == 0 || $distance == 0) return 'No Data';
        $kmPerLiter = $distance / $liters;
        if ($kmPerLiter >= 10) return 'Excellent';
        if ($kmPerLiter >= 7) return 'Good';
        if ($kmPerLiter >= 5) return 'Average';
        if ($kmPerLiter >= 3) return 'Poor';
        return 'Critical - Needs Maintenance';
    }

  private function formatAuditDetails($log)
{
    // Fields that never matter to a user reading the log
    static $noiseFields = [
        'created_at', 'updated_at', 'deleted_at',
        'verified_at', 'reconciled_at', 'acknowledged_at',
        'cancelled_at', 'closed_at', 'last_login_at',
        'password_changed_at', 'deactivated_at',
        'receipt_uploaded_at', 'last_used_at',
        'email_verified_at', 'remember_token',
    ];

    // Human-friendly labels for raw DB columns
    static $labels = [
        // Departments
        'department_name' => 'Department Name',
        'department_code' => 'Department Code',
        'head_of_office' => 'Head of Office',
        'is_active' => 'Active',

        // Users
        'first_name' => 'First Name',
        'middle_name' => 'Middle Name',
        'last_name' => 'Last Name',
        'email' => 'Email',
        'employee_number' => 'Employee Number',
        'role' => 'Role',
        'can_drive' => 'Can Drive',
        'status' => 'Status',
        'esignature_path' => 'E-Signature',
        'deactivation_reason' => 'Deactivation Reason',

        // Vehicles
        'vehicle_model' => 'Vehicle Model',
        'plate_number' => 'Plate Number',
        'fuel_type' => 'Fuel Type',
        'fuel_efficiency' => 'Fuel Efficiency (km/L)',
        'fuel_capacity' => 'Fuel Capacity',
        'current_fuel_balance' => 'Fuel Balance',
        'maintenance_flag' => 'Maintenance Mode',

        // Budget
        'annual_amount' => 'Annual Budget',
        'weekly_ceiling' => 'Weekly Ceiling',
        'default_weekly_allocation' => 'Default Weekly Allocation',
        'allocated_amount' => 'Allocated Amount',
        'used_amount' => 'Used Amount',
        'remaining_amount' => 'Remaining',

        // Receipts & gas slips
        'amount_released' => 'Amount Released',
        'amount_on_receipt' => 'Amount on Receipt',
        'liters_availed' => 'Liters Availed',
        'unit_price' => 'Unit Price',
        'invoice_number' => 'Invoice Number',
        'verification_status' => 'Verification Status',
        'reconciliation_status' => 'Reconciliation Status',
        'is_cross_department' => 'Cross-Department',

        // Trip
        'destination' => 'Destination',
        'purpose' => 'Purpose',
        'trip_date' => 'Trip Date',
        'trip_count' => 'Trip Count',
        'cancellation_reason' => 'Cancellation Reason',
    ];

    // Human-friendly table names
    static $resources = [
        'departments' => 'Department',
        'users' => 'User',
        'vehicles' => 'Vehicle',
        'drivers' => 'Driver',
        'trip_ticket' => 'Trip Ticket',
        'trip_history' => 'Trip',
        'gas_slip' => 'Gas Slip',
        'fuel_receipt' => 'Fuel Receipt',
        'annual_budgets' => 'Annual Budget',
        'budget_policies' => 'Budget Policy',
        'dept_budget_policy' => 'Budget Policy',
        'dept_budget_period' => 'Budget Period',
        'weekly_budget_usage' => 'Weekly Budget',
        'system_setting' => 'System Setting',
        'fiscal_years' => 'Fiscal Year',
        'notifications' => 'Notification',
    ];

    $label = fn($key) => $labels[$key]
        ?? ucwords(str_replace('_', ' ', $key));

    $resource = $resources[$log->table_name]
        ?? ucwords(str_replace('_', ' ', $log->table_name ?? 'record'));

    // ── login / logout ──
    if (in_array($log->action, ['login', 'logout'])) {
        $data = $log->new_values ? json_decode($log->new_values, true) : [];
        return ($data['email'] ?? 'User') . ' ' . $log->action;
    }

    // ── created ──
    if ($log->action === 'created') {
        $new = $log->new_values ? json_decode($log->new_values, true) : [];
        // Try to find a good "name" for the record
        $name = $new['department_name']
            ?? $new['trip_ticket_number']
            ?? $new['plate_number']
            ?? $new['email']
            ?? $new['invoice_number']
            ?? null;
        return $name
            ? "Created {$resource} \"{$name}\""
            : "Created {$resource} #{$log->record_id}";
    }

    // ── deleted ──
    if ($log->action === 'deleted') {
        $old = $log->old_values ? json_decode($log->old_values, true) : [];
        $name = $old['department_name']
            ?? $old['trip_ticket_number']
            ?? $old['plate_number']
            ?? $old['email']
            ?? null;
        return $name
            ? "Deleted {$resource} \"{$name}\""
            : "Deleted {$resource} #{$log->record_id}";
    }

    // ── updated / edited ──
    if (in_array($log->action, ['updated', 'edited'])) {
        $old = $log->old_values ? json_decode($log->old_values, true) : [];
        $new = $log->new_values ? json_decode($log->new_values, true) : [];

        // Filter out noise + unchanged fields
        $changed = [];
        foreach ($new as $key => $value) {
            if (in_array($key, $noiseFields, true)) continue;
            $oldValue = $old[$key] ?? null;
            if ((string) $oldValue !== (string) $value) {
                $changed[$key] = ['old' => $oldValue, 'new' => $value];
            }
        }

        if (empty($changed)) {
            return "Updated {$resource} #{$log->record_id}";
        }

        // Build "Field: before → after" list, cap at 3 fields
        $pieces = [];
        $i = 0;
        foreach ($changed as $key => $pair) {
            if ($i++ >= 3) {
                $pieces[] = '…';
                break;
            }
            $fieldLabel = $label($key);
            $oldStr = $this->prettifyAuditValue($pair['old']);
            $newStr = $this->prettifyAuditValue($pair['new']);

            if ($pair['old'] === null || $pair['old'] === '') {
                // Only "after" — new field populated
                $pieces[] = "{$fieldLabel}: {$newStr}";
            } else {
                $pieces[] = "{$fieldLabel}: {$oldStr} → {$newStr}";
            }
        }

        return "Updated {$resource} #{$log->record_id} — " . implode(' · ', $pieces);
    }

    // ── default fallback ──
    return ucfirst($log->action) . " on {$resource} #{$log->record_id}";
}

/**
 * Turn raw DB values into readable strings for audit display.
 */
private function prettifyAuditValue($value)
{
    if ($value === null || $value === '') return '—';
    if ($value === true || $value === '1' || $value === 1) return 'Yes';
    if ($value === false || $value === '0' || $value === 0) return 'No';

    if (is_string($value)) {
        // ISO datetime → friendly format
        if (preg_match('/^\d{4}-\d{2}-\d{2}T/', $value)) {
            try {
                return Carbon::parse($value)->format('M d, Y');
            } catch (\Exception $e) {
                return $value;
            }
        }
        // Long text → truncate
        if (strlen($value) > 60) {
            return substr($value, 0, 60) . '…';
        }
    }

    return (string) $value;
}

    private function returnAsCSV($content, $filename)
    {
        return Response::make($content, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }
}
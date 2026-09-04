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
            
            $summary = [
                'total_trips' => $totalTrips,
                'total_fuel_liters' => round($totalLiters, 2),
                'total_fuel_cost' => round($totalCost, 2),
                'total_distance_km' => round($totalDistance, 2),
                'average_km_per_liter' => $totalLiters > 0 ? round($totalDistance / $totalLiters, 2) : 0,
                'average_liters_per_trip' => $totalTrips > 0 ? round($totalLiters / $totalTrips, 2) : 0,
                'average_cost_per_trip' => $totalTrips > 0 ? round($totalCost / $totalTrips, 2) : 0,
                'average_cost_per_km' => $totalDistance > 0 ? round($totalCost / $totalDistance, 2) : 0,
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
                    'vehicle' => $vehicle ? $vehicle->plate_number . ' (' . $vehicle->vehicle_model . ')' : 'Unknown',
                    'driver' => $driver && $driver->user ? $driver->user->full_name : 'Unknown',
                    'destination' => $trip->destination,
                    'liters_availed' => $receipt->liters_availed,
                    'amount_on_receipt' => $receipt->amount_on_receipt,
                    'distance_km' => $this->calculateReceiptDistance($receipt),
                    'trip_ended_at' => $receipt->trip_ended_at,
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
            Log::info('🔍 getVehicleReport started');
            
            $vehicles = Vehicle::all();
            Log::info('✅ Vehicles found: ' . $vehicles->count());
            
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
                    'odometer_status' => $vehicle->odometer_status ?? 'functional',
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
            
            Log::info('✅ Vehicle data generated: ' . count($vehicleData));
            
            return response()->json([
                'success' => true,
                'data' => $vehicleData
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Vehicle report error: ' . $e->getMessage());
            Log::error('❌ Trace: ' . $e->getTraceAsString());
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
            $year = $request->get('year', date('Y'));

            $query = DeptBudgetPeriod::with(['department'])
                ->whereYear('created_at', $year);

            if ($departmentId) {
                $query->where('department_id', $departmentId);
            }

            $periods = $query->get();

            $groupedByDepartment = $periods->groupBy('department_id')->map(function($group) {
                $first = $group->first();
                $department = $first->department;
                
                $totalAllocated = $group->sum('allocated_amount');
                $totalUsed = $group->sum(function($p) {
                    return GasSlip::where('period_id', $p->period_id)->sum('amount_released');
                });
                
                return [
                    'period_id' => $first->period_id,
                    'department_id' => $first->department_id,
                    'department_name' => $department ? $department->department_name : 'Unknown',
                    'department_code' => $department ? $department->department_code : 'Unknown',
                    'allocated' => $totalAllocated,
                    'used' => $totalUsed,
                    'remaining' => $totalAllocated - $totalUsed,
                    'utilization' => $totalAllocated > 0 
                        ? round(($totalUsed / $totalAllocated) * 100, 2) 
                        : 0,
                    'period_count' => $group->count(),
                ];
            })->values();

            $summary = [
                'total_allocated' => $groupedByDepartment->sum('allocated'),
                'total_used' => $groupedByDepartment->sum('used'),
                'total_remaining' => $groupedByDepartment->sum('remaining'),
                'total_departments' => $groupedByDepartment->count(),
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'summary' => $summary,
                    'periods' => $groupedByDepartment,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Budget report error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate budget report: ' . $e->getMessage()
            ], 500);
        }
    }

    // ============================================================
    // 4. FUEL RECEIPT REPORT
    // ============================================================
    public function getFuelReceiptReport(Request $request)
    {
        try {
            $startDate = $request->get('start_date');
            $endDate = $request->get('end_date');
            $departmentId = $request->get('department_id');
            $vehicleId = $request->get('vehicle_id');

            Log::info('Fuel Receipt Report Request', [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'department_id' => $departmentId,
                'vehicle_id' => $vehicleId,
            ]);

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

            $receipts = $query->get();

            Log::info('Receipts found: ' . $receipts->count());

            $formattedReceipts = $receipts->map(function($receipt) {
                $trip = $receipt->gasSlip->tripTicket;
                $vehicle = $trip->vehicle;
                $department = $trip->department;
                $driver = $trip->driver;

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
                    'closed' => 'Closed',
                    'completed' => 'Completed',
                    'pending_mayors_office' => 'Pending MO',
                    'funds_issued' => 'Funds Issued',
                    'in_transit' => 'In Transit',
                    'acknowledged' => 'Acknowledged',
                    'pending_gso_validation' => 'Pending Validation',
                ];
                $statusLabel = $statusMap[$status] ?? $status;

                return [
                    'used_for' => $department ? $department->department_name : 'N/A',
                    'invoice_number' => $invoiceNumber,
                    'charge_invoice_no' => $invoiceNumber,
                    'gas_slip_id' => $receipt->gas_slip_id,
                    'date' => $receipt->created_at ? $receipt->created_at->format('m/d/Y') : 'N/A',
                    'lubricant' => $vehicle ? strtoupper($vehicle->fuel_type) : 'N/A',
                    'fuel_type' => $vehicle ? strtoupper($vehicle->fuel_type) : 'N/A',
                    'quantity' => $receipt->liters_availed ?? 0,
                    'unit_price' => $unitPrice,
                    'formatted_unit_price' => '₱' . number_format($unitPrice, 2),
                    'amount' => $receipt->amount_on_receipt ?? 0,
                    'formatted_amount' => '₱' . number_format($receipt->amount_on_receipt ?? 0, 2),
                    'ticket_number' => $trip->trip_ticket_number ?? 'N/A',
                    'control_no' => $trip->trip_ticket_number ?? 'N/A',
                    'plate_no' => $vehicle ? $vehicle->plate_number : 'N/A',
                    'plate_number' => $vehicle ? $vehicle->plate_number : 'N/A',
                    'vehicle' => $vehicle ? $vehicle->vehicle_model : 'N/A',
                    'vehicle_model' => $vehicle ? $vehicle->vehicle_model : 'N/A',
                    'vehicle_id' => $vehicle ? $vehicle->vehicle_id : null,
                    'department' => $department ? $department->department_name : 'N/A',
                    'department_name' => $department ? $department->department_name : 'N/A',
                    'department_id' => $department ? $department->department_id : null,
                    'driver' => $driver && $driver->user ? $driver->user->full_name : 'N/A',
                    'driver_name' => $driver && $driver->user ? $driver->user->full_name : 'N/A',
                    'driver_id' => $driver ? $driver->driver_id : null,
                    'destination' => $trip->destination ?? 'N/A',
                    'time_departure' => $timeDeparture,
                    'time_arrival' => $timeArrival,
                    'status' => $statusLabel,
                    'reconciliation_status' => $receipt->gasSlip?->reconciliation_status ?? 'N/A',
                    'has_receipt' => !is_null($receipt->receipt_photo_path),
                    'receipt_uploaded_at' => $receipt->receipt_uploaded_at 
                        ? $receipt->receipt_uploaded_at->format('m/d/Y H:i') 
                        : 'N/A',
                    'fuel_receipt_id' => $receipt->fuel_receipt_id,
                    'trip_date' => $trip->trip_date ?? 'N/A',
                    'trip_started_at' => $receipt->trip_started_at,
                    'trip_ended_at' => $receipt->trip_ended_at,
                ];
            });

            $summary = [
                'total_receipts' => $receipts->count(),
                'total_liters' => round($receipts->sum('liters_availed'), 2),
                'total_cost' => round($receipts->sum('amount_on_receipt'), 2),
                'total_vehicles' => $receipts->pluck('gasSlip.tripTicket.vehicle_id')->unique()->count(),
                'total_departments' => $receipts->pluck('gasSlip.tripTicket.department_id')->unique()->count(),
                'avg_unit_price' => $receipts->count() > 0 && $receipts->sum('liters_availed') > 0 
                    ? round($receipts->sum('amount_on_receipt') / $receipts->sum('liters_availed'), 2) 
                    : 0,
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'summary' => $summary,
                    'receipts' => $formattedReceipts,
                    'filters' => [
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                        'department_id' => $departmentId,
                        'vehicle_id' => $vehicleId,
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
    // 5. RECONCILIATION REPORT
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
                $estimatedFuel = $trip->estimated_fuel_liters ?? 0;
                $actualFuel = $trip->gasSlip?->fuelReceipt?->liters_availed ?? 0;
                $variance = $estimatedFuel - $actualFuel;

                $varianceStatus = 'normal';
                if (abs($variance) > 0.5) {
                    $varianceStatus = abs($variance) > 2 ? 'high_discrepancy' : 'minor_discrepancy';
                }

                return [
                    'ticket_number' => $trip->trip_ticket_number,
                    'department_name' => $trip->department?->department_name ?? 'N/A',
                    'plate_number' => $trip->vehicle?->plate_number ?? 'N/A',
                    'driver_name' => $trip->driver?->user?->full_name ?? 'N/A',
                    'amount_released' => $trip->gasSlip?->amount_released ?? 0,
                    'estimated_fuel' => round($estimatedFuel, 2),
                    'actual_fuel' => round($actualFuel, 2),
                    'variance' => round($variance, 2),
                    'variance_status' => $varianceStatus,
                    'status' => $trip->gasSlip?->reconciliation_status ?? 'pending',
                    'reconciled_by' => $trip->gasSlip?->reconciledBy?->full_name ?? 'N/A',
                    'reconciled_at' => $trip->gasSlip?->reconciled_at,
                ];
            });

            $summary = [
                'total_reconciliations' => $reconciliations->count(),
                'total_verified' => $reconciliations->filter(fn($r) => $r['status'] === 'verified')->count(),
                'total_discrepancy' => $reconciliations->filter(fn($r) => $r['status'] === 'discrepancy')->count(),
                'total_amount_released' => $reconciliations->sum('amount_released'),
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
                    'status_label' => $trip->status_label,
                    'has_receipt' => $fuelReceipt && !is_null($fuelReceipt->receipt_photo_path),
                    'submitted_at' => $trip->submitted_at,
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
    // 9. GPS VEHICLE ACTIVITY
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
                $fuelReceipt = $trip->gasSlip?->fuelReceipt;
                $gpsDistance = $fuelReceipt?->gps_distance_km ?? 0;
                $logbookDistance = $trip->estimated_distance_km ?? 0;
                
                $tripStart = $fuelReceipt?->trip_started_at;
                $tripEnd = $fuelReceipt?->trip_ended_at;
                $duration = null;
                if ($tripStart && $tripEnd) {
                    $duration = round($tripStart->diffInHours($tripEnd), 1);
                }

                $tolerance = 0.20;
                $distanceMatch = 'In Progress';
                if ($gpsDistance > 0 && $logbookDistance > 0) {
                    $ratio = $gpsDistance / $logbookDistance;
                    if ($ratio >= (1 - $tolerance) && $ratio <= (1 + $tolerance)) {
                        $distanceMatch = 'Match';
                    } else {
                        $distanceMatch = 'Discrepancy';
                    }
                } elseif ($trip->status === 'closed' || $trip->status === 'completed') {
                    $distanceMatch = 'No GPS Data';
                }

                return [
                    'trip_ticket_number' => $trip->trip_ticket_number,
                    'vehicle' => $trip->vehicle?->vehicle_model ?? 'N/A',
                    'plate_number' => $trip->vehicle?->plate_number ?? 'N/A',
                    'driver' => $trip->driver?->user?->full_name ?? 'N/A',
                    'trip_start' => $tripStart ? $tripStart->format('Y-m-d H:i') : 'N/A',
                    'trip_end' => $tripEnd ? $tripEnd->format('Y-m-d H:i') : 'N/A',
                    'duration_hrs' => $duration,
                    'gps_distance_km' => round($gpsDistance, 2),
                    'logbook_distance_km' => round($logbookDistance, 2),
                    'distance_match' => $distanceMatch,
                    'trip_status' => $trip->status_label,
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
    // EXPORT METHODS
    // ============================================================

    // 1. EXPORT FUEL CONSUMPTION
    public function exportFuelConsumptionReport(Request $request, $format)
    {
        try {
            $response = $this->getFuelConsumptionReport($request);
            $data = $response->getData(true);
            
            if (!$data['success']) {
                $errorContent = "Error: " . ($data['message'] ?? 'Failed to get report data');
                return $this->returnAsCSV($errorContent, 'error_report.csv');
            }

            $reportData = $data['data'];
            $filename = 'fuel_consumption_report_' . date('Y-m-d');

            if ($format === 'excel') {
                return Excel::download(
                    new FuelConsumptionExport($reportData), 
                    $filename . '.xlsx'
                );
            } elseif ($format === 'pdf') {
                return $this->generateFuelConsumptionPDF($reportData, $filename);
            } else {
                $content = $this->buildFuelConsumptionCSV($reportData);
                return $this->returnAsCSV($content, $filename . '.csv');
            }

        } catch (\Exception $e) {
            Log::error('Export error: ' . $e->getMessage());
            Log::error($e->getTraceAsString());
            $errorContent = "Error: " . $e->getMessage();
            return $this->returnAsCSV($errorContent, 'error_report.csv');
        }
    }

    // 2. EXPORT VEHICLE REPORT
    public function exportVehicleReport(Request $request, $format)
    {
        try {
            $response = $this->getVehicleReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to get report data'
                ], 500);
            }

            $reportData = $data['data'];
            $filename = 'vehicle_summary_' . date('Y-m-d');

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(
                    new \App\Exports\VehicleSummaryExport($reportData),
                    $filename . '.xlsx'
                );
            } elseif ($format === 'csv') {
                $content = $this->buildVehicleSummaryCSV($reportData);
                return $this->returnAsCSV($content, $filename . '.csv');
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Unsupported format'
                ], 400);
            }
        } catch (\Exception $e) {
            Log::error('Export vehicle report error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to export report: ' . $e->getMessage()
            ], 500);
        }
    }

    // 3. EXPORT BUDGET REPORT
    public function exportBudgetReport(Request $request, $format)
    {
        try {
            $response = $this->getBudgetReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to get report data'
                ], 500);
            }

            $reportData = $data['data'];
            $filename = 'budget_utilization_' . date('Y-m-d');

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(
                    new \App\Exports\BudgetUtilizationExport($reportData),
                    $filename . '.xlsx'
                );
            } elseif ($format === 'csv') {
                $content = $this->buildBudgetUtilizationCSV($reportData);
                return $this->returnAsCSV($content, $filename . '.csv');
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Unsupported format'
                ], 400);
            }
        } catch (\Exception $e) {
            Log::error('Export budget report error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to export report: ' . $e->getMessage()
            ], 500);
        }
    }

    // 4. EXPORT FUEL RECEIPT
    public function exportFuelReceiptReport(Request $request, $format)
    {
        try {
            $response = $this->getFuelReceiptReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to get report data'
                ], 500);
            }

            $reportData = $data['data'];
            $filename = 'fuel_receipt_report_' . date('Y-m-d');

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(
                    new FuelReceiptReportExport($reportData, 'gso'),
                    $filename . '.xlsx'
                );
            } elseif ($format === 'pdf') {
                return $this->generateFuelReceiptPDF($reportData, $filename);
            } else {
                return $this->exportFuelReceiptCSV($reportData, $filename);
            }

        } catch (\Exception $e) {
            Log::error('Export fuel receipt report error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to export report: ' . $e->getMessage()
            ], 500);
        }
    }

    // 5. EXPORT DEPARTMENT FUEL CONSUMPTION
    public function exportDepartmentFuelConsumption(Request $request, $format)
    {
        try {
            $response = $this->getDepartmentFuelConsumption($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to get report data'
                ], 500);
            }

            $reportData = $data['data'];
            $filename = 'department_fuel_consumption_' . date('Y-m-d');

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(
                    new \App\Exports\DepartmentFuelExport($reportData),
                    $filename . '.xlsx'
                );
            } elseif ($format === 'csv') {
                $content = $this->buildDepartmentFuelCSV($reportData);
                return $this->returnAsCSV($content, $filename . '.csv');
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Unsupported format'
                ], 400);
            }
        } catch (\Exception $e) {
            Log::error('Export department fuel error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to export report: ' . $e->getMessage()
            ], 500);
        }
    }

    // 6. EXPORT MONTHLY FUEL CONSUMPTION
    public function exportMonthlyFuelConsumption(Request $request, $format)
    {
        try {
            $response = $this->getMonthlyFuelConsumption($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to get report data'
                ], 500);
            }

            $reportData = $data['data'];
            $filename = 'monthly_fuel_consumption_' . date('Y-m-d');

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(
                    new \App\Exports\MonthlyFuelExport($reportData),
                    $filename . '.xlsx'
                );
            } elseif ($format === 'csv') {
                $content = $this->buildMonthlyFuelCSV($reportData);
                return $this->returnAsCSV($content, $filename . '.csv');
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Unsupported format'
                ], 400);
            }
        } catch (\Exception $e) {
            Log::error('Export monthly fuel error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to export report: ' . $e->getMessage()
            ], 500);
        }
    }

    // 7. EXPORT TRIP TICKET REPORT
    public function exportTripTicketReport(Request $request, $format)
    {
        try {
            $response = $this->getTripTicketReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to get report data'
                ], 500);
            }

            $reportData = $data['data'];
            $filename = 'trip_ticket_report_' . date('Y-m-d');

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(
                    new \App\Exports\TripTicketExport($reportData),
                    $filename . '.xlsx'
                );
            } elseif ($format === 'csv') {
                $content = $this->buildTripTicketCSV($reportData);
                return $this->returnAsCSV($content, $filename . '.csv');
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Unsupported format'
                ], 400);
            }
        } catch (\Exception $e) {
            Log::error('Export trip ticket error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to export report: ' . $e->getMessage()
            ], 500);
        }
    }

    // 8. EXPORT GPS VEHICLE ACTIVITY
    public function exportGPSVehicleActivity(Request $request, $format)
    {
        try {
            $response = $this->getGPSVehicleActivity($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to get report data'
                ], 500);
            }

            $reportData = $data['data'];
            $filename = 'gps_vehicle_activity_' . date('Y-m-d');

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(
                    new \App\Exports\GPSActivityExport($reportData),
                    $filename . '.xlsx'
                );
            } elseif ($format === 'csv') {
                $content = $this->buildGPSActivityCSV($reportData);
                return $this->returnAsCSV($content, $filename . '.csv');
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Unsupported format'
                ], 400);
            }
        } catch (\Exception $e) {
            Log::error('Export GPS activity error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to export report: ' . $e->getMessage()
            ], 500);
        }
    }

    // 9. EXPORT RECONCILIATION
    public function exportReconciliation(Request $request, $format)
    {
        try {
            $response = $this->getReconciliationReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to get report data'
                ], 500);
            }

            $reportData = $data['data'];
            $filename = 'reconciliation_report_' . date('Y-m-d');

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(
                    new \App\Exports\ReconciliationExport($reportData),
                    $filename . '.xlsx'
                );
            } elseif ($format === 'csv') {
                $content = $this->buildReconciliationCSV($reportData);
                return $this->returnAsCSV($content, $filename . '.csv');
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Unsupported format'
                ], 400);
            }
        } catch (\Exception $e) {
            Log::error('Export reconciliation error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to export report: ' . $e->getMessage()
            ], 500);
        }
    }

    // 10. EXPORT DRIVER EFFICIENCY
    public function exportDriverEfficiency(Request $request, $format)
    {
        try {
            $response = $this->getDriverEfficiencyReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to get report data'
                ], 500);
            }

            $reportData = $data['data'];
            $filename = 'driver_efficiency_' . date('Y-m-d');

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(
                    new \App\Exports\DriverEfficiencyExport($reportData),
                    $filename . '.xlsx'
                );
            } elseif ($format === 'csv') {
                $content = $this->buildDriverEfficiencyCSV($reportData);
                return $this->returnAsCSV($content, $filename . '.csv');
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Unsupported format'
                ], 400);
            }
        } catch (\Exception $e) {
            Log::error('Export driver efficiency error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to export report: ' . $e->getMessage()
            ], 500);
        }
    }

    // 11. EXPORT AUDIT TRAIL
    public function exportAuditTrail(Request $request, $format)
    {
        try {
            $response = $this->getAuditTrailReport($request);
            $data = $response->getData(true);

            if (!$data['success']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to get report data'
                ], 500);
            }

            $reportData = $data['data'];
            $filename = 'audit_trail_' . date('Y-m-d');

            if ($format === 'excel' || $format === 'xlsx') {
                return Excel::download(
                    new \App\Exports\AuditTrailExport($reportData),
                    $filename . '.xlsx'
                );
            } elseif ($format === 'csv') {
                $content = $this->buildAuditTrailCSV($reportData);
                return $this->returnAsCSV($content, $filename . '.csv');
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Unsupported format'
                ], 400);
            }
        } catch (\Exception $e) {
            Log::error('Export audit trail error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to export report: ' . $e->getMessage()
            ], 500);
        }
    }

    // ============================================================
    // PDF GENERATORS
    // ============================================================

    // FUEL CONSUMPTION PDF
    private function generateFuelConsumptionPDF($reportData, $filename)
    {
        try {
            $html = $this->buildFuelConsumptionPDFHTML($reportData);
            
            if (class_exists('Barryvdh\DomPDF\Facade\Pdf')) {
                $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html);
                $pdf->setPaper('A4', 'landscape');
                $pdf->setOptions([
                    'defaultFont' => 'sans-serif',
                    'isHtml5ParserEnabled' => true,
                    'isRemoteEnabled' => true,
                ]);
                return $pdf->download($filename . '.pdf');
            }
            
            return response($html, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="' . $filename . '.pdf"',
            ]);

        } catch (\Exception $e) {
            Log::error('PDF generation error: ' . $e->getMessage());
            $content = $this->buildFuelConsumptionCSV($reportData);
            return $this->returnAsCSV($content, $filename . '.csv');
        }
    }

    private function buildFuelConsumptionPDFHTML($reportData)
    {
        $summary = $reportData['summary'] ?? [];
        $vehicles = $reportData['vehicle_breakdown'] ?? [];
        $filters = $reportData['filters'] ?? [];
        
        $totalTrips = 0;
        $totalLiters = 0;
        $totalCost = 0;
        $totalDistance = 0;

        foreach ($vehicles as $v) {
            $totalTrips += $v['trips'] ?? 0;
            $totalLiters += $v['liters'] ?? 0;
            $totalCost += $v['cost'] ?? 0;
            $totalDistance += $v['distance_km'] ?? 0;
        }

        $html = '<!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Fuel Consumption Report</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: "DejaVu Sans", Arial, sans-serif; 
                    font-size: 9px; 
                    padding: 20px; 
                    color: #1e293b; 
                }
                .header { 
                    text-align: center; 
                    border-bottom: 2px solid #2563eb; 
                    padding-bottom: 12px; 
                    margin-bottom: 15px; 
                }
                .header h1 { 
                    font-size: 18px; 
                    color: #1e293b; 
                    font-weight: bold; 
                }
                .header p { 
                    color: #64748b; 
                    font-size: 10px; 
                    margin-top: 4px; 
                }
                .header .subtitle { 
                    font-size: 9px; 
                    color: #94a3b8; 
                    margin-top: 3px; 
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 8px; 
                    font-size: 8px; 
                }
                th { 
                    background: #2563eb; 
                    color: white; 
                    padding: 6px 4px; 
                    text-align: center; 
                    font-weight: bold; 
                    border: 1px solid #1e40af; 
                    font-size: 8px;
                }
                td { 
                    padding: 5px 4px; 
                    border: 1px solid #d1d5db; 
                    text-align: center; 
                    font-size: 8px; 
                }
                tr:nth-child(even) { 
                    background: #f8fafc; 
                }
                .total-row { 
                    background: #e2e8f0; 
                    font-weight: bold; 
                }
                .total-row td { 
                    border-top: 2px solid #2563eb; 
                    padding: 6px 4px; 
                    font-weight: bold;
                }
                .badge { 
                    padding: 2px 10px; 
                    border-radius: 12px; 
                    font-size: 7px; 
                    font-weight: bold; 
                    display: inline-block; 
                }
                .badge-excellent { background: #dcfce7; color: #166534; }
                .badge-good { background: #dbeafe; color: #1e40af; }
                .badge-average { background: #fef3c7; color: #92400e; }
                .badge-poor { background: #fee2e2; color: #991b1b; }
                .badge-critical { background: #fecaca; color: #7f1d1d; }
                .badge-nodata { background: #f1f5f9; color: #94a3b8; }
                .text-success { color: #059669; }
                .text-right { text-align: right; }
                .text-left { text-align: left; }
                .text-center { text-align: center; }
                .footer { 
                    text-align: center; 
                    border-top: 1px solid #e2e8f0; 
                    padding-top: 10px; 
                    margin-top: 15px; 
                    color: #94a3b8; 
                    font-size: 7px; 
                }
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    margin: 10px 0 15px 0;
                }
                .summary-card {
                    background: #f8fafc;
                    padding: 10px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                    text-align: center;
                }
                .summary-card .label {
                    font-size: 8px;
                    color: #64748b;
                    text-transform: uppercase;
                }
                .summary-card .value {
                    font-size: 14px;
                    font-weight: bold;
                    color: #0f172a;
                    margin-top: 3px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>FUEL CONSUMPTION REPORT</h1>
                <p>LGU Laguindingan - Fuel Consumption Monitoring System</p>
                <p class="subtitle">Generated: ' . now()->format('F d, Y h:i A') . '</p>
                <p style="font-size: 8px; color: #64748b; margin-top: 3px;">
                    Period: ' . ($filters['start_date'] ?? 'N/A') . ' to ' . ($filters['end_date'] ?? 'N/A') . '
                </p>
            </div>

            <!-- Summary Cards -->
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="label">Total Trips</div>
                    <div class="value">' . ($summary['total_trips'] ?? 0) . '</div>
                </div>
                <div class="summary-card">
                    <div class="label">Total Fuel</div>
                    <div class="value">' . number_format($summary['total_fuel_liters'] ?? 0, 2) . ' L</div>
                </div>
                <div class="summary-card">
                    <div class="label">Total Cost</div>
                    <div class="value">₱' . number_format($summary['total_fuel_cost'] ?? 0, 2) . '</div>
                </div>
                <div class="summary-card">
                    <div class="label">Average Km/L</div>
                    <div class="value">' . number_format($summary['average_km_per_liter'] ?? 0, 2) . '</div>
                </div>
            </div>

            <!-- Vehicle Breakdown Table -->
            <table>
                <thead>
                    <tr>
                        <th>Plate #</th>
                        <th>Model</th>
                        <th>Fuel Type</th>
                        <th>Trips</th>
                        <th>Liters</th>
                        <th>Cost</th>
                        <th>Distance</th>
                        <th>Km/L</th>
                        <th>Efficiency</th>
                    </tr>
                </thead>
                <tbody>';
    
    if (count($vehicles) > 0) {
        foreach ($vehicles as $v) {
            $km = $v['km_per_liter'] ?? 0;
            $badgeClass = 'badge-nodata';
            $label = 'No Data';
            
            if ($km >= 10) { 
                $badgeClass = 'badge-excellent'; 
                $label = 'Excellent'; 
            } elseif ($km >= 7) { 
                $badgeClass = 'badge-good'; 
                $label = 'Good'; 
            } elseif ($km >= 5) { 
                $badgeClass = 'badge-average'; 
                $label = 'Average'; 
            } elseif ($km >= 3) { 
                $badgeClass = 'badge-poor'; 
                $label = 'Poor'; 
            } elseif ($km > 0) { 
                $badgeClass = 'badge-critical'; 
                $label = 'Critical'; 
            }
            
            $html .= '
                <tr>
                    <td><strong>' . ($v['plate_number'] ?? 'N/A') . '</strong></td>
                    <td class="text-left">' . ($v['model'] ?? 'N/A') . '</td>
                    <td>' . ucfirst($v['fuel_type'] ?? 'N/A') . '</td>
                    <td class="text-right">' . ($v['trips'] ?? 0) . '</td>
                    <td class="text-right">' . number_format($v['liters'] ?? 0, 2) . '</td>
                    <td class="text-right">₱' . number_format($v['cost'] ?? 0, 2) . '</td>
                    <td class="text-right">' . number_format($v['distance_km'] ?? 0, 2) . '</td>
                    <td class="text-right"><strong>' . number_format($km, 2) . '</strong></td>
                    <td><span class="badge ' . $badgeClass . '">' . $label . '</span></td>
                </tr>';
        }

        // TOTAL ROW
        $avgKmPerLiter = $totalLiters > 0 ? number_format($totalDistance / $totalLiters, 2) : '0.00';
        $html .= '
                <tr class="total-row">
                    <td style="font-weight:bold;">TOTAL</td>
                    <td></td>
                    <td></td>
                    <td class="text-right" style="font-weight:bold;">' . $totalTrips . '</td>
                    <td class="text-right" style="font-weight:bold;">' . number_format($totalLiters, 2) . '</td>
                    <td class="text-right" style="font-weight:bold;color:#059669;">₱' . number_format($totalCost, 2) . '</td>
                    <td class="text-right" style="font-weight:bold;">' . number_format($totalDistance, 2) . '</td>
                    <td class="text-right" style="font-weight:bold;">' . $avgKmPerLiter . '</td>
                    <td></td>
                </tr>';
        
    } else {
        $html .= '
                <tr>
                    <td colspan="9" style="text-align:center; color:#94a3b8; padding:20px;">No data available</td>
                </tr>';
    }
    
    $html .= '
            </tbody>
        </table>

        <div class="footer">
            <p>This report is automatically generated by the FCMS System</p>
            <p>© ' . date('Y') . ' Laguindingan Municipality - Fuel Consumption Monitoring System</p>
        </div>
    </body>
    </html>';
    
    return $html;
    }

    // FUEL RECEIPT PDF
    private function generateFuelReceiptPDF($reportData, $filename)
    {
        try {
            $html = $this->buildFuelReceiptPDFHTML($reportData);
            
            if (class_exists('Barryvdh\DomPDF\Facade\Pdf')) {
                $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html);
                $pdf->setPaper('A4', 'landscape');
                $pdf->setOptions([
                    'defaultFont' => 'sans-serif',
                    'isHtml5ParserEnabled' => true,
                    'isRemoteEnabled' => true,
                ]);
                return $pdf->download($filename . '.pdf');
            }
            
            return response($html, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="' . $filename . '.pdf"',
            ]);

        } catch (\Exception $e) {
            Log::error('PDF generation error: ' . $e->getMessage());
            return $this->exportFuelReceiptCSV($reportData, $filename);
        }
    }

    private function buildFuelReceiptPDFHTML($reportData)
    {
        $summary = $reportData['summary'] ?? [];
        $receipts = $reportData['receipts'] ?? [];
        $filters = $reportData['filters'] ?? [];

        $totalAmount = 0;
        $totalQuantity = 0;
        $totalUnitPrice = 0;

        $html = '<!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Fuel Receipt Report</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: "DejaVu Sans", Arial, sans-serif; 
                    font-size: 8px; 
                    padding: 15px; 
                    color: #1e293b; 
                }
                .header { 
                    text-align: center; 
                    border-bottom: 2px solid #2563eb; 
                    padding-bottom: 10px; 
                    margin-bottom: 15px; 
                }
                .header h1 { 
                    font-size: 16px; 
                    color: #1e293b; 
                    font-weight: bold; 
                }
                .header p { 
                    color: #64748b; 
                    font-size: 10px; 
                    margin-top: 4px; 
                }
                .header .subtitle { 
                    font-size: 9px; 
                    color: #94a3b8; 
                    margin-top: 3px; 
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 8px; 
                    font-size: 7px; 
                }
                th { 
                    background: #2563eb; 
                    color: white; 
                    padding: 5px 3px; 
                    text-align: center; 
                    font-weight: bold; 
                    border: 1px solid #1e40af; 
                    font-size: 7px;
                }
                td { 
                    padding: 4px 3px; 
                    border: 1px solid #d1d5db; 
                    text-align: center; 
                    font-size: 7px; 
                }
                tr:nth-child(even) { 
                    background: #f8fafc; 
                }
                .total-row { 
                    background: #e2e8f0; 
                    font-weight: bold; 
                }
                .total-row td { 
                    border-top: 2px solid #2563eb; 
                    padding: 5px 3px; 
                    font-weight: bold;
                }
                .text-success { 
                    color: #059669; 
                }
                .text-right { 
                    text-align: right; 
                }
                .text-left { 
                    text-align: left; 
                }
                .text-center { 
                    text-align: center; 
                }
                .footer { 
                    text-align: center; 
                    border-top: 1px solid #e2e8f0; 
                    padding-top: 10px; 
                    margin-top: 15px; 
                    color: #94a3b8; 
                    font-size: 7px; 
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>FUEL RECEIPT REPORT</h1>
                <p>LGU Laguindingan - Fuel Consumption Monitoring System</p>
                <p class="subtitle">Generated: ' . now()->format('F d, Y h:i A') . '</p>
                <p style="font-size: 8px; color: #64748b; margin-top: 3px;">
                    Period: ' . ($filters['start_date'] ?? 'N/A') . ' to ' . ($filters['end_date'] ?? 'N/A') . '
                </p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Invoice #</th>
                        <th>Ticket #</th>
                        <th>Driver</th>
                        <th>Vehicle</th>
                        <th>Plate No.</th>
                        <th>Destination</th>
                        <th>Time Dep.</th>
                        <th>Time Arr.</th>
                        <th>Fuel Type</th>
                        <th>Unit Price</th>
                        <th>Amount</th>
                        <th>Qty (L)</th>
                    </tr>
                </thead>
                <tbody>';

    if (count($receipts) > 0) {
        foreach ($receipts as $r) {
            $totalAmount += $r['amount'] ?? 0;
            $totalQuantity += $r['quantity'] ?? 0;
            $totalUnitPrice += $r['unit_price'] ?? 0;

            $html .= '
                <tr>
                    <td>' . ($r['date'] ?? 'N/A') . '</td>
                    <td><span style="font-weight:bold;color:#2563eb;">' . ($r['invoice_number'] ?? 'N/A') . '</span></td>
                    <td>' . ($r['ticket_number'] ?? 'N/A') . '</td>
                    <td>' . ($r['driver'] ?? 'N/A') . '</td>
                    <td>' . ($r['vehicle'] ?? 'N/A') . '</td>
                    <td><span style="font-weight:bold;">' . ($r['plate_no'] ?? 'N/A') . '</span></td>
                    <td style="text-align:left;">' . ($r['destination'] ?? 'N/A') . '</td>
                    <td>' . ($r['time_departure'] ?? 'N/A') . '</td>
                    <td>' . ($r['time_arrival'] ?? 'N/A') . '</td>
                    <td><span style="font-weight:bold;color:#2563eb;">' . ($r['lubricant'] ?? 'N/A') . '</span></td>
                    <td class="text-right">₱' . number_format($r['unit_price'] ?? 0, 2) . '</td>
                    <td class="text-right" style="font-weight:bold;color:#059669;">₱' . number_format($r['amount'] ?? 0, 2) . '</td>
                    <td class="text-right">' . number_format($r['quantity'] ?? 0, 2) . '</td>
                </tr>';
        }
        
        // TOTAL ROW
        $html .= '
                <tr class="total-row">
                    <td colspan="10" style="text-align:right;">TOTAL</td>
                    <td class="text-right">₱' . number_format($totalUnitPrice, 2) . '</td>
                    <td class="text-right" style="color:#059669;">₱' . number_format($totalAmount, 2) . '</td>
                    <td class="text-right">' . number_format($totalQuantity, 2) . '</td>
                </tr>';
        
    } else {
        $html .= '
                <tr>
                    <td colspan="13" style="text-align:center; color:#94a3b8; padding:20px;">No fuel receipt data available</td>
                </tr>';
    }

    $html .= '
            </tbody>
        </table>

        <div class="footer">
            <p>This report is automatically generated by the FCMS System</p>
            <p>© ' . date('Y') . ' Laguindingan Municipality - Fuel Consumption Monitoring System</p>
        </div>
    </body>
    </html>';

    return $html;
    }

    // ============================================================
    // CSV BUILDERS
    // ============================================================

    private function buildFuelConsumptionCSV($reportData)
    {
        $lines = [];
        $lines[] = "\xEF\xBB\xBF";
        $lines[] = 'FUEL CONSUMPTION REPORT';
        $lines[] = 'Generated: ' . now()->format('Y-m-d H:i:s');
        $lines[] = '';
        
        $summary = $reportData['summary'] ?? [];
        $lines[] = 'SUMMARY';
        $lines[] = 'Total Trips,' . ($summary['total_trips'] ?? 0);
        $lines[] = 'Total Fuel (Liters),' . ($summary['total_fuel_liters'] ?? 0);
        $lines[] = 'Total Cost (PHP),' . ($summary['total_fuel_cost'] ?? 0);
        $lines[] = 'Average Km/L,' . ($summary['average_km_per_liter'] ?? 0);
        $lines[] = '';
        
        $lines[] = 'VEHICLE BREAKDOWN';
        $lines[] = 'Plate #,Model,Fuel Type,Trips,Liters,Cost,Distance (km),Km/L,Efficiency';
        
        $vehicles = $reportData['vehicle_breakdown'] ?? [];
        $totalTrips = 0;
        $totalLiters = 0;
        $totalCost = 0;
        $totalDistance = 0;

        foreach ($vehicles as $v) {
            $km = $v['km_per_liter'] ?? 0;
            $efficiency = $v['efficiency_rating'] ?? 'No Data';
            $totalTrips += $v['trips'] ?? 0;
            $totalLiters += $v['liters'] ?? 0;
            $totalCost += $v['cost'] ?? 0;
            $totalDistance += $v['distance_km'] ?? 0;

            $lines[] = implode(',', [
                '"' . ($v['plate_number'] ?? 'N/A') . '"',
                '"' . ($v['model'] ?? 'N/A') . '"',
                '"' . ($v['fuel_type'] ?? 'N/A') . '"',
                $v['trips'] ?? 0,
                $v['liters'] ?? 0,
                $v['cost'] ?? 0,
                $v['distance_km'] ?? 0,
                $km,
                '"' . $efficiency . '"',
            ]);
        }

        // TOTAL ROW
        $avgKmPerLiter = $totalLiters > 0 ? number_format($totalDistance / $totalLiters, 2) : 0;
        $lines[] = implode(',', [
            '"TOTAL"',
            '""',
            '""',
            $totalTrips,
            number_format($totalLiters, 2),
            number_format($totalCost, 2),
            number_format($totalDistance, 2),
            $avgKmPerLiter,
            '""',
        ]);
        
        return implode("\n", $lines);
    }

    private function exportFuelReceiptCSV($reportData, $filename)
    {
        $receipts = $reportData['receipts'] ?? [];
        $summary = $reportData['summary'] ?? [];

        $lines = [];
        $lines[] = "\xEF\xBB\xBF";
        $lines[] = 'FUEL RECEIPT REPORT';
        $lines[] = 'Generated: ' . now()->format('Y-m-d H:i:s');
        $lines[] = '';
        $lines[] = 'SUMMARY';
        $lines[] = 'Total Receipts,' . ($summary['total_receipts'] ?? 0);
        $lines[] = 'Total Fuel (Liters),' . ($summary['total_liters'] ?? 0);
        $lines[] = 'Total Cost,' . ($summary['total_cost'] ?? 0);
        $lines[] = '';
        $lines[] = 'FUEL RECEIPT DETAILS';
        $lines[] = 'Used For,Invoice #,Date,Lubricant,Quantity,Unit Price,Amount,Control No.,Plate No.,Vehicle,Department,Driver';

        $totalAmount = 0;
        $totalQuantity = 0;

        foreach ($receipts as $r) {
            $totalAmount += $r['amount'] ?? 0;
            $totalQuantity += $r['quantity'] ?? 0;

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

        // TOTAL ROW
        $lines[] = implode(',', [
            '"TOTAL"',
            '""',
            '""',
            '""',
            number_format($totalQuantity, 2),
            '""',
            number_format($totalAmount, 2),
            '""',
            '""',
            '""',
            '""',
            '""',
        ]);

        $content = implode("\n", $lines);

        return response($content, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '.csv"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }

    // ============================================================
    // OTHER CSV BUILDERS
    // ============================================================

    private function buildVehicleSummaryCSV($reportData)
    {
        $lines = [];
        $lines[] = "\xEF\xBB\xBF";
        $lines[] = 'VEHICLE FUEL CONSUMPTION SUMMARY';
        $lines[] = 'Generated: ' . now()->format('Y-m-d H:i:s');
        $lines[] = '';
        $lines[] = 'Vehicle,Plate No.,Total Trips,Total Fuel (L),Total Amount (₱),Average Fuel/Trip (L)';
        
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
        $lines = [];
        $lines[] = "\xEF\xBB\xBF";
        $lines[] = 'BUDGET UTILIZATION REPORT';
        $lines[] = 'Generated: ' . now()->format('Y-m-d H:i:s');
        $lines[] = '';
        $lines[] = 'Department,Allocated Budget (₱),Amount Utilized (₱),Remaining Budget (₱),Utilization (%)';
        
        $periods = $reportData['periods'] ?? [];
        foreach ($periods as $p) {
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
        $lines = [];
        $lines[] = "\xEF\xBB\xBF";
        $lines[] = 'DEPARTMENT FUEL CONSUMPTION REPORT';
        $lines[] = 'Generated: ' . now()->format('Y-m-d H:i:s');
        $lines[] = '';
        $lines[] = 'Department,Total Trips,Total Fuel (L),Total Amount (₱),Average Fuel/Trip (L)';
        
        $departments = $reportData['departments'] ?? [];
        foreach ($departments as $d) {
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
        $lines = [];
        $lines[] = "\xEF\xBB\xBF";
        $lines[] = 'MONTHLY FUEL CONSUMPTION REPORT';
        $lines[] = 'Generated: ' . now()->format('Y-m-d H:i:s');
        $lines[] = '';
        $lines[] = 'Month,Total Trips,Total Fuel (L),Total Fuel Cost (₱),Average Fuel/Trip (L)';
        
        $months = $reportData['months'] ?? [];
        foreach ($months as $m) {
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
        $lines = [];
        $lines[] = "\xEF\xBB\xBF";
        $lines[] = 'TRIP TICKET REPORT';
        $lines[] = 'Generated: ' . now()->format('Y-m-d H:i:s');
        $lines[] = '';
        $lines[] = 'TT Number,Date,Department,Vehicle,Plate Number,Driver,Destination,Purpose,Distance (km),Status';
        
        $trips = $reportData['trips'] ?? [];
        foreach ($trips as $t) {
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
        $lines = [];
        $lines[] = "\xEF\xBB\xBF";
        $lines[] = 'GPS VEHICLE ACTIVITY REPORT';
        $lines[] = 'Generated: ' . now()->format('Y-m-d H:i:s');
        $lines[] = '';
        $lines[] = 'TT Number,Vehicle,Driver,Trip Start,Trip End,Duration (hrs),GPS Distance,Logbook Distance,Distance Match,Trip Status';
        
        $activities = $reportData['activities'] ?? [];
        foreach ($activities as $a) {
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
        $lines = [];
        $lines[] = "\xEF\xBB\xBF";
        $lines[] = 'RECONCILIATION REPORT';
        $lines[] = 'Generated: ' . now()->format('Y-m-d H:i:s');
        $lines[] = '';
        $lines[] = 'Trip Ticket No.,Vehicle,Driver,Expected Distance,Actual Distance,Distance Variance,Amount Released,Actual Amount Paid,Amount Variance';
        
        $reconciliations = $reportData['reconciliations'] ?? [];
        foreach ($reconciliations as $r) {
            $lines[] = implode(',', [
                '"' . ($r['ticket_number'] ?? 'N/A') . '"',
                '"' . ($r['plate_number'] ?? 'N/A') . '"',
                '"' . ($r['driver_name'] ?? 'N/A') . '"',
                $r['expected_distance'] ?? 0,
                $r['actual_distance'] ?? 0,
                $r['variance'] ?? 0,
                $r['amount_released'] ?? 0,
                $r['actual_amount'] ?? 0,
                $r['amount_variance'] ?? 0,
            ]);
        }
        return implode("\n", $lines);
    }

    private function buildDriverEfficiencyCSV($reportData)
    {
        $lines = [];
        $lines[] = "\xEF\xBB\xBF";
        $lines[] = 'DRIVER FUEL EFFICIENCY REPORT';
        $lines[] = 'Generated: ' . now()->format('Y-m-d H:i:s');
        $lines[] = '';
        $lines[] = 'Rank,Driver,Assigned Vehicle,Total Trips,Total Distance (km),Total Fuel Used (L),Fuel Efficiency (km/L)';
        
        $drivers = $reportData['drivers'] ?? [];
        $rank = 1;
        foreach ($drivers as $d) {
            $lines[] = implode(',', [
                $rank,
                '"' . ($d['driver_name'] ?? 'N/A') . '"',
                '"' . ($d['assigned_vehicle'] ?? 'N/A') . '"',
                $d['total_trips'] ?? 0,
                $d['total_distance_km'] ?? 0,
                $d['total_fuel_used_liters'] ?? 0,
                $d['fuel_efficiency_kmpl'] ?? 0,
            ]);
            $rank++;
        }
        return implode("\n", $lines);
    }

    private function buildAuditTrailCSV($reportData)
    {
        $lines = [];
        $lines[] = "\xEF\xBB\xBF";
        $lines[] = 'AUDIT TRAIL REPORT';
        $lines[] = 'Generated: ' . now()->format('Y-m-d H:i:s');
        $lines[] = '';
        $lines[] = 'Date/Time,User,Role,Module,Action,Details,Result';
        
        $logs = $reportData['logs'] ?? [];
        foreach ($logs as $log) {
            $lines[] = implode(',', [
                '"' . ($log['created_at'] ?? 'N/A') . '"',
                '"' . ($log['user_name'] ?? 'N/A') . '"',
                '"' . ($log['role'] ?? 'N/A') . '"',
                '"' . ($log['module'] ?? 'N/A') . '"',
                '"' . ($log['action'] ?? 'N/A') . '"',
                '"' . ($log['details'] ?? 'N/A') . '"',
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
            
            $statusBreakdown = $trips->groupBy('status')->map(function($group) {
                return $group->count();
            });

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

    public function getWeeklyMonitoring(Request $request)
    {
        return response()->json(['success' => true, 'data' => []]);
    }

    public function getFuelWithoutTrip(Request $request)
    {
        return response()->json(['success' => true, 'data' => []]);
    }

    public function getFundReleaseHistory(Request $request)
    {
        return response()->json(['success' => true, 'data' => []]);
    }

    public function exportTripReport(Request $request, $format)
    {
        return response()->json(['message' => 'Trip export coming soon'], 200);
    }

    public function exportFuelReport(Request $request, $format)
    {
        return response()->json(['message' => 'Fuel export coming soon'], 200);
    }

    public function exportWeeklyMonitoring(Request $request, $format)
    {
        return response()->json(['message' => 'Weekly monitoring export coming soon'], 200);
    }

    public function exportFuelWithoutTrip(Request $request, $format)
    {
        return response()->json(['message' => 'Fuel without trip export coming soon'], 200);
    }

    public function exportFundReleaseHistory(Request $request, $format)
    {
        return response()->json(['message' => 'Fund release history export coming soon'], 200);
    }

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
        $details = '';
        
        if ($log->action === 'login' || $log->action === 'logout') {
            if ($log->new_values) {
                $data = json_decode($log->new_values, true);
                $details = "User: " . ($data['email'] ?? 'N/A');
            }
        } elseif ($log->action === 'created') {
            if ($log->new_values) {
                $data = json_decode($log->new_values, true);
                $details = "Created " . ($data['name'] ?? $data['trip_ticket_number'] ?? 'record');
            }
        } elseif ($log->action === 'updated' || $log->action === 'edited') {
            $details = "Updated record ID: " . $log->record_id;
            if ($log->old_values && $log->new_values) {
                $old = json_decode($log->old_values, true);
                $new = json_decode($log->new_values, true);
                $changed = [];
                foreach ($new as $key => $value) {
                    if (isset($old[$key]) && $old[$key] != $value) {
                        $changed[] = $key;
                    }
                }
                if (!empty($changed)) {
                    $details .= " (Changed: " . implode(', ', array_slice($changed, 0, 3)) . ")";
                }
            }
        } elseif ($log->action === 'deleted') {
            $details = "Deleted record ID: " . $log->record_id;
        } else {
            $details = "Action on " . $log->table_name . " ID: " . $log->record_id;
        }
        
        return $details;
    }

    private function returnAsCSV($content, $filename)
    {
        return Response::make($content, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }
}
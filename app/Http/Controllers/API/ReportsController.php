<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\TripTicket;
use App\Models\FuelReceipt;
use App\Models\Vehicle;
use App\Models\Department;
use App\Models\DeptBudgetPeriod;
use App\Models\GasSlip;
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
    /**
     * Get Fuel Consumption Report Data
     */
    public function getFuelConsumptionReport(Request $request)
    {
        try {
            $startDate = $request->get('start_date');
            $endDate = $request->get('end_date');
            $departmentId = $request->get('department_id');
            $vehicleId = $request->get('vehicle_id');
            
            // Build query
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
            
            // ============================================
            // Calculate Summary
            // ============================================
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
            
            // ============================================
            // Vehicle Breakdown with Distance Calculation
            // ============================================
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

            // Calculate percentages
            $totalLitersAll = $vehicleBreakdown->sum('liters');
            $vehicleBreakdown = $vehicleBreakdown->map(function($item) use ($totalLitersAll) {
                $item['percentage_of_total_liters'] = $totalLitersAll > 0 ? round(($item['liters'] / $totalLitersAll) * 100, 2) : 0;
                return $item;
            });

            // ============================================
            // Department Breakdown
            // ============================================
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

            // ============================================
            // Period Trends
            // ============================================
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

            // ============================================
            // Efficiency Distribution
            // ============================================
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

            // ============================================
            // Recent Receipts
            // ============================================
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

    /**
     * EXPORT - Supports CSV, Excel, and PDF
     */
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
                return $this->generatePDF($reportData, $filename);
            } else {
                $content = $this->buildCSVContent($reportData);
                return $this->returnAsCSV($content, $filename . '.csv');
            }

        } catch (\Exception $e) {
            Log::error('Export error: ' . $e->getMessage());
            Log::error($e->getTraceAsString());
            $errorContent = "Error: " . $e->getMessage();
            return $this->returnAsCSV($errorContent, 'error_report.csv');
        }
    }

    // ============================================
    // HELPER METHODS - CLEANED (No Odometer)
    // ============================================

    /**
     * Calculate total distance from fuel receipts (GPS only)
     */
    private function calculateTotalDistance($receipts)
    {
        $totalDistance = 0;
        foreach ($receipts as $receipt) {
            // ✅ Only use GPS distance
            if ($receipt->gps_distance_km) {
                $totalDistance += $receipt->gps_distance_km;
            }
        }
        return $totalDistance;
    }

    /**
     * Calculate distance for a single receipt (GPS only)
     */
    private function calculateReceiptDistance($receipt)
    {
        // ✅ Only use GPS distance
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

    private function generatePDF($reportData, $filename)
    {
        try {
            if (class_exists('Barryvdh\DomPDF\Facade\Pdf')) {
                $html = $this->buildPDFHTML($reportData);
                $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html);
                $pdf->setPaper('A4', 'landscape');
                return $pdf->download($filename . '.pdf');
            }
            
            $html = $this->buildPDFHTML($reportData);
            return response($html, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="' . $filename . '.pdf"',
            ]);

        } catch (\Exception $e) {
            Log::error('PDF generation error: ' . $e->getMessage());
            $content = $this->buildCSVContent($reportData);
            return $this->returnAsCSV($content, $filename . '.csv');
        }
    }

    private function buildPDFHTML($reportData)
    {
        $summary = $reportData['summary'] ?? [];
        $vehicles = $reportData['vehicle_breakdown'] ?? [];
        $filters = $reportData['filters'] ?? [];
        
        $html = '<!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Fuel Consumption Report</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 10px; padding: 30px; color: #1e293b; }
                .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px; }
                .header h1 { font-size: 18px; color: #1e293b; font-weight: bold; }
                .header p { color: #64748b; font-size: 11px; margin-top: 5px; }
                .section { margin-bottom: 20px; }
                .section-title { background: #e2e8f0; padding: 8px 12px; font-weight: bold; font-size: 12px; border-radius: 4px; margin-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 9px; text-transform: uppercase; font-weight: bold; border-bottom: 2px solid #94a3b8; }
                td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9px; }
                .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 15px 0; }
                .summary-card { background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center; }
                .summary-card .label { font-size: 8px; color: #64748b; text-transform: uppercase; }
                .summary-card .value { font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 4px; }
                .badge { padding: 2px 8px; border-radius: 10px; font-size: 8px; font-weight: bold; display: inline-block; }
                .badge-excellent { background: #dcfce7; color: #166534; }
                .badge-good { background: #dbeafe; color: #1e40af; }
                .badge-average { background: #fef3c7; color: #92400e; }
                .badge-poor { background: #fee2e2; color: #991b1b; }
                .badge-critical { background: #fecaca; color: #7f1d1d; }
                .footer { text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 25px; color: #94a3b8; font-size: 8px; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .text-muted { color: #94a3b8; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>FUEL CONSUMPTION MONITORING REPORT</h1>
                <p>Laguindingan Municipality - FCMS</p>
                <p>Generated: ' . now()->format('F d, Y h:i A') . '</p>
                <p style="font-size: 10px; margin-top: 3px;">
                    Period: ' . ($filters['start_date'] ?? 'N/A') . ' to ' . ($filters['end_date'] ?? 'N/A') . '
                </p>
            </div>
            
         
            <div class="section">
                <div class="section-title">🚗 VEHICLE BREAKDOWN</div>
                <table>
                    <thead>
                        <tr>
                            <th>Plate #</th>
                            <th>Model</th>
                            <th>Fuel Type</th>
                            <th class="text-right">Trips</th>
                            <th class="text-right">Liters</th>
                            <th class="text-right">Cost</th>
                            <th class="text-right">Distance</th>
                            <th class="text-right">Km/L</th>
                            <th>Efficiency</th>
                        </tr>
                    </thead>
                    <tbody>';
        
        if (count($vehicles) > 0) {
            foreach ($vehicles as $v) {
                $km = $v['km_per_liter'] ?? 0;
                $badge = 'badge-average';
                $label = 'Average';
                if ($km >= 10) { $badge = 'badge-excellent'; $label = 'Excellent'; }
                elseif ($km >= 7) { $badge = 'badge-good'; $label = 'Good'; }
                elseif ($km >= 5) { $badge = 'badge-average'; $label = 'Average'; }
                elseif ($km >= 3) { $badge = 'badge-poor'; $label = 'Poor'; }
                elseif ($km > 0) { $badge = 'badge-critical'; $label = 'Critical'; }
                else { $label = 'No Data'; $badge = 'badge-average'; }
                
                $html .= '<tr>
                    <td><strong>' . ($v['plate_number'] ?? 'N/A') . '</strong></td>
                    <td>' . ($v['model'] ?? 'N/A') . '</td>
                    <td>' . ucfirst($v['fuel_type'] ?? 'N/A') . '</td>
                    <td class="text-right">' . ($v['trips'] ?? 0) . '</td>
                    <td class="text-right">' . number_format($v['liters'] ?? 0, 2) . '</td>
                    <td class="text-right">₱' . number_format($v['cost'] ?? 0, 2) . '</td>
                    <td class="text-right">' . number_format($v['distance_km'] ?? 0, 2) . '</td>
                    <td class="text-right"><strong>' . number_format($km, 2) . '</strong></td>
                    <td><span class="badge ' . $badge . '">' . $label . '</span></td>
                </tr>';
            }
        } else {
            $html .= '<tr><td colspan="9" class="text-center text-muted">No data available</td></tr>';
        }
        
        $html .= '</tbody>
                </table>
            </div>
            
            <div class="footer">
                <p>This report is automatically generated by the FCMS System</p>
                <p>© ' . date('Y') . ' Laguindingan Municipality - Fuel Consumption Monitoring System</p>
            </div>
        </body>
        </html>';
        
        return $html;
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

    private function buildCSVContent($reportData)
    {
        $lines = [];
        $lines[] = "\xEF\xBB\xBF";
        $lines[] = 'FUEL CONSUMPTION MONITORING REPORT';
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
        foreach ($vehicles as $v) {
            $km = $v['km_per_liter'] ?? 0;
            $efficiency = $v['efficiency_rating'] ?? 'No Data';
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
        
        return implode("\n", $lines);
    }

    // ============================================
    // TRIP REPORT
    // ============================================

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

    // ============================================
    // FUEL REPORT (Legacy)
    // ============================================

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

    // ============================================
    // BUDGET REPORT
    // ============================================

    public function getBudgetReport(Request $request)
    {
        try {
            $departmentId = $request->get('department_id');

            $query = DeptBudgetPeriod::with(['department']);
            
            if ($departmentId) {
                $query->where('department_id', $departmentId);
            }
            
            $periods = $query->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'summary' => [
                        'total_allocated' => $periods->sum('allocated_amount'),
                    ],
                    'periods' => $periods->map(function($p) {
                        $used = GasSlip::where('period_id', $p->period_id)->sum('amount_released');
                        return [
                            'period_id' => $p->period_id,
                            'department_name' => $p->department->department_name ?? 'Unknown',
                            'allocated' => $p->allocated_amount,
                            'used' => $used,
                            'remaining' => $p->allocated_amount - $used,
                            'utilization_percentage' => $p->allocated_amount > 0 ? round(($used / $p->allocated_amount) * 100, 2) : 0,
                        ];
                    })
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    // ============================================
    // VEHICLE REPORT - CLEANED (No Odometer)
    // ============================================

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
                            // ✅ Only use GPS distance
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

    // ============================================
    // REPORT SUMMARY
    // ============================================

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

    // ============================================
    // EXPORT PLACEHOLDERS
    // ============================================

    public function exportTripReport(Request $request, $format)
    {
        return response()->json(['message' => 'Trip export coming soon'], 200);
    }

    public function exportFuelReport(Request $request, $format)
    {
        return response()->json(['message' => 'Fuel export coming soon'], 200);
    }

    public function exportBudgetReport(Request $request, $format)
    {
        return response()->json(['message' => 'Budget export coming soon'], 200);
    }

// ============================================
// FUEL RECEIPT REPORT 
// ============================================

public function getFuelReceiptReport(Request $request)
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

        $receipts = $query->get();

        $formattedReceipts = $receipts->map(function($receipt) {
            $trip = $receipt->gasSlip->tripTicket;
            $vehicle = $trip->vehicle;
            $department = $trip->department;
            $driver = $trip->driver;

            // ✅ Get invoice number from database
            $invoiceNumber = $receipt->invoice_number ?? 'N/A';
            
            // ✅ Get unit price from database
            $unitPrice = $receipt->unit_price ?? 0;

            return [
                'used_for' => $department ? $department->department_name : 'N/A',
                // ✅ Primary field - use invoice_number
                'invoice_number' => $invoiceNumber,
                // ✅ Keep charge_invoice_no for backward compatibility with your frontend
                'charge_invoice_no' => $invoiceNumber,
                'gas_slip_id' => $receipt->gas_slip_id,
                'date' => $receipt->created_at ? $receipt->created_at->format('m/d/Y') : 'N/A',
                'lubricant' => $vehicle ? strtoupper($vehicle->fuel_type) : 'N/A',
                'quantity' => $receipt->liters_availed ?? 0,
                // ✅ Use unit_price from database
                'unit_price' => $unitPrice,
                'formatted_unit_price' => '₱' . number_format($unitPrice, 2),
                'amount' => $receipt->amount_on_receipt ?? 0,
                'formatted_amount' => '₱' . number_format($receipt->amount_on_receipt ?? 0, 2),
                'control_no' => $trip->trip_ticket_number ?? 'N/A',
                'plate_no' => $vehicle ? $vehicle->plate_number : 'N/A',
                'vehicle' => $vehicle ? $vehicle->vehicle_model : 'N/A',
                'vehicle_id' => $vehicle ? $vehicle->vehicle_id : null,
                'department' => $department ? $department->department_name : 'N/A',
                'department_id' => $department ? $department->department_id : null,
                'driver' => $driver && $driver->user ? $driver->user->full_name : 'N/A',
                'driver_id' => $driver ? $driver->driver_id : null,
                'status' => $trip->status ?? 'N/A',
                // ✅ Add receipt photo path for reference
                'has_receipt' => !is_null($receipt->receipt_photo_path),
                'receipt_uploaded_at' => $receipt->receipt_uploaded_at ? $receipt->receipt_uploaded_at->format('m/d/Y H:i') : 'N/A',
                // ✅ Add fuel receipt ID for key reference
                'fuel_receipt_id' => $receipt->fuel_receipt_id,
            ];
        });

        $summary = [
            'total_receipts' => $receipts->count(),
            'total_liters' => round($receipts->sum('liters_availed'), 2),
            'total_cost' => round($receipts->sum('amount_on_receipt'), 2),
            'total_vehicles' => $receipts->pluck('gasSlip.tripTicket.vehicle_id')->unique()->count(),
            'total_departments' => $receipts->pluck('gasSlip.tripTicket.department_id')->unique()->count(),
            'avg_unit_price' => $receipts->count() > 0 ? round($receipts->sum('amount_on_receipt') / $receipts->sum('liters_availed'), 2) : 0,
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
    // ============================================
    // EXPORT FUEL RECEIPT REPORT
    // ============================================

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
                    new FuelReceiptReportExport($reportData),
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

    // ============================================
    // FUEL RECEIPT PDF
    // ============================================

    private function generateFuelReceiptPDF($reportData, $filename)
    {
        try {
            $html = $this->buildFuelReceiptPDFHTML($reportData);
            
            if (class_exists('Barryvdh\DomPDF\Facade\Pdf')) {
                $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html);
                $pdf->setPaper('A4', 'landscape');
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

        $html = '<!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Fuel Receipt Report</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 9px; padding: 20px; color: #1e293b; }
                .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
                .header h1 { font-size: 18px; color: #1e293b; font-weight: bold; }
                .header p { color: #64748b; font-size: 11px; margin-top: 5px; }
                .section { margin-bottom: 15px; }
                .section-title { background: #e2e8f0; padding: 6px 12px; font-weight: bold; font-size: 11px; border-radius: 4px; margin-bottom: 8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 8px; }
                th { background: #2563eb; color: white; padding: 6px 4px; text-align: center; font-weight: bold; border: 1px solid #1e40af; }
                td { padding: 5px 4px; border: 1px solid #d1d5db; text-align: center; font-size: 8px; }
                tr:nth-child(even) { background: #f8fafc; }
                .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 10px 0; }
                .summary-card { background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center; }
                .summary-card .label { font-size: 8px; color: #64748b; text-transform: uppercase; }
                .summary-card .value { font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 4px; }
                .footer { text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px; color: #94a3b8; font-size: 8px; }
                .badge-active { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 10px; font-size: 7px; font-weight: bold; }
                .badge-completed { background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 10px; font-size: 7px; font-weight: bold; }
                .badge-pending { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 10px; font-size: 7px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>FUEL RECEIPT REPORT</h1>
                <p>Laguindingan Municipality - FCMS</p>
                <p>Generated: ' . now()->format('F d, Y h:i A') . '</p>
                <p style="font-size: 9px; margin-top: 3px;">
                    Period: ' . ($filters['start_date'] ?? 'N/A') . ' to ' . ($filters['end_date'] ?? 'N/A') . '
                </p>
            </div>

            

            <div class="section">
                <div class="section-title">📋 FUEL RECEIPT DETAILS</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width:8%">Used For</th>
                            <th style="width:7%">Invoice #</th>
                            <th style="width:8%">Date</th>
                            <th style="width:8%">Lubricant</th>
                            <th style="width:7%">Qty</th>
                            <th style="width:8%">Unit Price</th>
                            <th style="width:8%">Amount</th>
                            <th style="width:10%">Control No.</th>
                            <th style="width:8%">Plate No.</th>
                            <th style="width:10%">Vehicle</th>
                            <th style="width:8%">Department</th>
                            <th style="width:8%">Driver</th>
                        </tr>
                    </thead>
                    <tbody>';

        if (count($receipts) > 0) {
            foreach ($receipts as $r) {
                $html .= '<tr>
                    <td>' . ($r['used_for'] ?? 'N/A') . '</td>
                    <td>' . ($r['charge_invoice_no'] ?? 'N/A') . '</td>
                    <td>' . ($r['date'] ?? 'N/A') . '</td>
                    <td>' . ($r['lubricant'] ?? 'N/A') . '</td>
                    <td>' . number_format($r['quantity'] ?? 0, 2) . '</td>
                    <td>₱' . number_format($r['unit_price'] ?? 0, 2) . '</td>
                    <td>₱' . number_format($r['amount'] ?? 0, 2) . '</td>
                    <td>' . ($r['control_no'] ?? 'N/A') . '</td>
                    <td>' . ($r['plate_no'] ?? 'N/A') . '</td>
                    <td>' . ($r['vehicle'] ?? 'N/A') . '</td>
                    <td>' . ($r['department'] ?? 'N/A') . '</td>
                    <td>' . ($r['driver'] ?? 'N/A') . '</td>
                </tr>';
            }
        } else {
            $html .= '<tr><td colspan="12" class="text-center text-muted">No fuel receipt data available</td></tr>';
        }

        $html .= '</tbody>
                </table>
            </div>

            <div class="footer">
                <p>This report is automatically generated by the FCMS System</p>
                <p>© ' . date('Y') . ' Laguindingan Municipality - Fuel Consumption Monitoring System</p>
            </div>
        </body>
        </html>';

        return $html;
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
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }
}
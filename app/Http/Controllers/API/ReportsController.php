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
        $year = $request->get('year', date('Y'));

        // ✅ Get budget periods grouped by department
        $query = DeptBudgetPeriod::with(['department'])
            ->whereYear('created_at', $year);

        if ($departmentId) {
            $query->where('department_id', $departmentId);
        }

        $periods = $query->get();

        // ✅ Group by department and calculate totals
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
                'utilization_percentage' => $totalAllocated > 0 
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
/**
 * GET FUEL RECEIPT REPORT - FIXED
 */
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

            // ✅ Get invoice number
            $invoiceNumber = $receipt->invoice_number ?? 'N/A';

            // ✅ Get unit price - calculate if not set
            $unitPrice = $receipt->unit_price ?? 0;
            if ($unitPrice == 0 && $receipt->liters_availed > 0 && $receipt->amount_on_receipt > 0) {
                $unitPrice = round($receipt->amount_on_receipt / $receipt->liters_availed, 2);
            }

            // ✅ Get time fields from fuel_receipt (trip_started_at, trip_ended_at)
            $timeDeparture = $receipt->trip_started_at 
                ? Carbon::parse($receipt->trip_started_at)->format('h:i A') 
                : 'N/A';
            
            $timeArrival = $receipt->trip_ended_at 
                ? Carbon::parse($receipt->trip_ended_at)->format('h:i A') 
                : 'N/A';

            // ✅ Get status from trip ticket
            $status = $trip->status ?? 'N/A';
            
            // ✅ Map status to display label
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

        // ✅ Calculate summary
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
/**
 * Calculate unit price from amount and liters
 */
private function calculateUnitPrice($amount, $liters)
{
    if ($liters > 0 && $amount > 0) {
        return round($amount / $liters, 2);
    }
    return 0;
}

    // ============================================
    // EXPORT FUEL RECEIPT REPORT
    // ============================================

    /**
 * EXPORT FUEL RECEIPT REPORT - SUPPORTS PDF, EXCEL, CSV
 */
public function exportFuelReceiptReport(Request $request, $format)
{
    try {
        // ✅ Get the report data
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

        // ✅ Handle different formats
        if ($format === 'excel' || $format === 'xlsx') {
            return Excel::download(
                new FuelReceiptReportExport($reportData, 'gso'),
                $filename . '.xlsx'
            );
        } elseif ($format === 'pdf') {
            // ✅ Use the updated PDF builder
            return $this->generateFuelReceiptPDF($reportData, $filename);
        } else {
            // CSV
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

 /**
 * Build Fuel Receipt PDF HTML - FIXED with TOTAL row
 */
private function buildFuelReceiptPDFHTML($reportData)
{
    $summary = $reportData['summary'] ?? [];
    $receipts = $reportData['receipts'] ?? [];
    $filters = $reportData['filters'] ?? [];

    // ✅ Calculate totals
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
                border-bottom: 3px solid #2563eb; 
                padding-bottom: 12px; 
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
            .section { 
                margin-bottom: 12px; 
            }
            .section-title { 
                background: #e2e8f0; 
                padding: 5px 10px; 
                font-weight: bold; 
                font-size: 10px; 
                border-radius: 4px; 
                margin-bottom: 6px; 
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 6px; 
                font-size: 7px; 
            }
            th { 
                background: #2563eb; 
                color: white; 
                padding: 4px 3px; 
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
            .summary-grid { 
                display: grid; 
                grid-template-columns: repeat(4, 1fr); 
                gap: 8px; 
                margin: 8px 0; 
            }
            .summary-card { 
                background: #f8fafc; 
                padding: 8px; 
                border-radius: 4px; 
                border: 1px solid #e2e8f0; 
                text-align: center; 
            }
            .summary-card .label { 
                font-size: 7px; 
                color: #64748b; 
                text-transform: uppercase; 
            }
            .summary-card .value { 
                font-size: 12px; 
                font-weight: bold; 
                color: #0f172a; 
                margin-top: 3px; 
            }
            .footer { 
                text-align: center; 
                border-top: 1px solid #e2e8f0; 
                padding-top: 10px; 
                margin-top: 15px; 
                color: #94a3b8; 
                font-size: 7px; 
            }
            .text-muted { 
                color: #94a3b8; 
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
            .fw-bold { 
                font-weight: bold; 
            }
            .text-success { 
                color: #059669; 
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>FUEL RECEIPT REPORT</h1>
            <p>LGU Laguindingan - FCMS</p>
            <p class="subtitle">Generated: ' . now()->format('F d, Y h:i A') . '</p>
            <p style="font-size: 8px; margin-top: 3px; color: #64748b;">
                Period: ' . ($filters['start_date'] ?? 'N/A') . ' to ' . ($filters['end_date'] ?? 'N/A') . '
            </p>
        </div>

       

        <!-- RECEIPT DETAILS TABLE -->
        <div class="section">
            <div class="section-title">📋 FUEL RECEIPT DETAILS</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:6%">Date</th>
                        <th style="width:6%">Invoice #</th>
                        <th style="width:7%">Ticket #</th>
                        <th style="width:7%">Driver</th>
                        <th style="width:7%">Vehicle</th>
                        <th style="width:6%">Plate No.</th>
                        <th style="width:8%">Destination</th>
                        <th style="width:6%">Time Dep.</th>
                        <th style="width:6%">Time Arr.</th>
                        <th style="width:5%">Fuel Type</th>
                        <th style="width:5%">Unit Price</th>
                        <th style="width:6%">Amount</th>
                        <th style="width:5%">Qty (L)</th>
                    </tr>
                </thead>
                <tbody>';

    if (count($receipts) > 0) {
        foreach ($receipts as $r) {
            $totalAmount += $r['amount'] ?? 0;
            $totalQuantity += $r['quantity'] ?? 0;
            $totalUnitPrice += $r['unit_price'] ?? 0;

            $html .= '<tr>
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
                <td>₱' . number_format($r['unit_price'] ?? 0, 2) . '</td>
                <td style="font-weight:bold;color:#059669;">₱' . number_format($r['amount'] ?? 0, 2) . '</td>
                <td>' . number_format($r['quantity'] ?? 0, 2) . '</td>
            </tr>';
        }
        
        // ✅ TOTAL ROW
        $html .= '<tr style="background: #e2e8f0; font-weight: bold;">
            <td colspan="10" style="text-align:right; font-weight:bold;">TOTAL</td>
            <td>₱' . number_format($totalUnitPrice, 2) . '</td>
            <td style="font-weight:bold;color:#059669;">₱' . number_format($totalAmount, 2) . '</td>
            <td>' . number_format($totalQuantity, 2) . '</td>
        </tr>';
        
    } else {
        $html .= '<tr><td colspan="13" style="text-align:center; color:#94a3b8; padding:20px;">No fuel receipt data available</td></tr>';
    }

    $html .= '</tbody>
            </table>
        </div>

        <!-- FOOTER -->
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

/**
 * Get Weekly Monitoring Data - FIXED with per-week budgets
 */
public function getWeeklyMonitoring(Request $request)
{
    try {
        $departmentId = $request->get('department_id');
        $weekStart = $request->get('week_start');
        $weekEnd = $request->get('week_end');

        // ✅ If no dates provided, use current week
        if (!$weekStart || !$weekEnd) {
            $weekStart = now()->startOfWeek()->toDateString();
            $weekEnd = now()->endOfWeek()->toDateString();
        }

        Log::info('Weekly Monitoring Request', [
            'department_id' => $departmentId,
            'week_start' => $weekStart,
            'week_end' => $weekEnd,
        ]);

        // ✅ Build query with proper relationships
        $query = TripTicket::with([
            'department', 
            'gasSlip', 
            'gasSlip.fuelReceipt',
            'driver.user', 
            'vehicle'
        ])
        ->whereBetween('submitted_at', [
            Carbon::parse($weekStart)->startOfDay(),
            Carbon::parse($weekEnd)->endOfDay()
        ]);

        if ($departmentId) {
            $query->where('department_id', $departmentId);
        }

        $trips = $query->get();

        Log::info('Trips found: ' . $trips->count());

        // ✅ ============================================
        // ✅ FIXED: Get budget for the SELECTED week
        // ✅ ============================================
        $totalBudget = 0;
        $departmentBudgets = [];

        if ($departmentId) {
            // ✅ Get budget for the selected week
            $budgetPeriod = DeptBudgetPeriod::where('department_id', $departmentId)
                ->where('week_start', Carbon::parse($weekStart)->startOfWeek()->toDateString())
                ->first();

            if ($budgetPeriod) {
                $totalBudget = $budgetPeriod->allocated_amount;
                $departmentBudgets[] = [
                    'department_id' => $departmentId,
                    'allocated' => $budgetPeriod->allocated_amount,
                ];
            }
        } else {
            // ✅ Get ALL department budgets for the selected week
            $periods = DeptBudgetPeriod::where('week_start', Carbon::parse($weekStart)->startOfWeek()->toDateString())
                ->with('department')
                ->get();

            foreach ($periods as $period) {
                $totalBudget += $period->allocated_amount;
                $departmentBudgets[] = [
                    'department_id' => $period->department_id,
                    'department_name' => $period->department->department_name ?? 'Unknown',
                    'department_code' => $period->department->department_code ?? 'Unknown',
                    'allocated' => $period->allocated_amount,
                ];
            }
        }

        Log::info('Weekly Budget: ' . $totalBudget);

        // ✅ Calculate metrics
        $totalUsed = 0;
        $completed = 0;
        $pending = 0;
        $inTransit = 0;
        $departmentUsage = [];

        foreach ($trips as $trip) {
            $amount = $trip->gasSlip ? $trip->gasSlip->amount_released : 0;
            $totalUsed += $amount;

            // ✅ Track per-department usage
            $deptId = $trip->department_id;
            if (!isset($departmentUsage[$deptId])) {
                $departmentUsage[$deptId] = 0;
            }
            $departmentUsage[$deptId] += $amount;

            // ✅ Count statuses
            if ($trip->status === 'closed' || $trip->status === 'completed') {
                $completed++;
            } elseif ($trip->status === 'in_transit') {
                $inTransit++;
            } else {
                $pending++;
            }
        }

        // ✅ Build department breakdown with budgets
        $departmentBreakdown = [];
        foreach ($departmentBudgets as $dept) {
            $deptId = $dept['department_id'];
            $used = $departmentUsage[$deptId] ?? 0;
            $allocated = $dept['allocated'] ?? 0;

            $departmentBreakdown[] = [
                'department_id' => $deptId,
                'department_name' => $dept['department_name'] ?? 'Unknown',
                'department_code' => $dept['department_code'] ?? 'N/A',
                'allocated' => $allocated,
                'used' => $used,
                'remaining' => $allocated - $used,
                'utilization' => $allocated > 0 ? round(($used / $allocated) * 100, 2) : 0,
            ];
        }

        // ✅ Format trips data
        $formattedTrips = $trips->map(function($trip) {
            $fuelReceipt = $trip->gasSlip?->fuelReceipt;
            $actualFuel = $fuelReceipt ? $fuelReceipt->liters_availed : null;
            
            return [
                'id' => $trip->trip_ticket_id,
                'number' => $trip->trip_ticket_number,
                'destination' => $trip->destination,
                'status' => $trip->status,
                'estimated_fuel' => $trip->estimated_fuel_liters ?? null,
                'actual_fuel' => $actualFuel,
                'amount' => $trip->gasSlip?->amount_released ?? 0,
                'driver' => $trip->driver?->user?->full_name ?? 'N/A',
                'vehicle' => $trip->vehicle?->plate_number ?? 'N/A',
                'trip_date' => $trip->trip_date,
            ];
        });

        $response = [
            'success' => true,
            'data' => [
                'summary' => [
                    'budget' => $totalBudget,
                    'used' => $totalUsed,
                    'remaining' => $totalBudget - $totalUsed,
                    'utilization' => $totalBudget > 0 ? round(($totalUsed / $totalBudget) * 100, 2) : 0,
                    'trips' => $trips->count(),
                    'completed' => $completed,
                    'pending' => $pending,
                    'in_transit' => $inTransit,
                ],
                'period' => [
                    'start' => $weekStart,
                    'end' => $weekEnd,
                ],
                'trips' => $formattedTrips,
                'departments' => $departmentBreakdown, // ✅ NEW: Department breakdown
            ]
        ];

        Log::info('Weekly Monitoring Response', ['summary' => $response['data']['summary']]);

        return response()->json($response);

    } catch (\Exception $e) {
        Log::error('Weekly monitoring error: ' . $e->getMessage());
        Log::error('Stack trace: ' . $e->getTraceAsString());
        
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch weekly monitoring data: ' . $e->getMessage()
        ], 500);
    }
}
/**
 * Get Fuel Without Trip Report - FIXED
 */
public function getFuelWithoutTrip(Request $request)
{
    try {
        $departmentId = $request->get('department_id');
        $startDate = $request->get('start_date');
        $endDate = $request->get('end_date');

        Log::info('Fuel Without Trip Request', [
            'department_id' => $departmentId,
            'start_date' => $startDate,
            'end_date' => $endDate,
        ]);

        $query = TripTicket::with(['gasSlip', 'gasSlip.fuelReceipt', 'vehicle', 'driver.user', 'department'])
            ->whereHas('gasSlip')
            ->where(function($q) {
                $q->whereNull('odometer_start')
                  ->orWhereNull('odometer_end')
                  ->orWhere('actual_distance_km', '<', 1)
                  ->orWhere('actual_distance_km', '=', 0)
                  ->orWhereNull('actual_distance_km');  // ✅ Add this
            });

        if ($departmentId && $departmentId !== 'all') {
            $query->where('department_id', $departmentId);
        }

        // ✅ Use 'submitted_at' for date filtering
        if ($startDate && $endDate) {
            $query->whereBetween('submitted_at', [
                Carbon::parse($startDate)->startOfDay(),
                Carbon::parse($endDate)->endOfDay()
            ]);
        }

        $trips = $query->get();

        Log::info('Fuel Without Trip - Trips found: ' . $trips->count());

        // ✅ Calculate totals
        $totalFuelIssued = $trips->sum(function($trip) {
            return (float) ($trip->gasSlip?->amount_released ?? 0);
        });

        $totalLiters = $trips->sum(function($trip) {
            return (float) ($trip->gasSlip?->fuelReceipt?->liters_availed ?? 0);
        });

        // ✅ Map data
        $formattedData = $trips->map(function($trip) {
            // ✅ Determine movement status
            $movementStatus = 'No Odometer Reading';
            
            if ($trip->odometer_start !== null && $trip->odometer_end !== null) {
                $distance = $trip->odometer_end - $trip->odometer_start;
                if ($distance == 0) {
                    $movementStatus = 'No Movement';
                } elseif ($distance < 1) {
                    $movementStatus = 'Minimal Movement (<1km)';
                } else {
                    $movementStatus = 'Normal Trip';
                }
            }

            // ✅ Use actual_distance_km if odometer not available
            if ($movementStatus === 'No Odometer Reading' && $trip->actual_distance_km !== null) {
                if ($trip->actual_distance_km == 0) {
                    $movementStatus = 'No Movement';
                } elseif ($trip->actual_distance_km < 1) {
                    $movementStatus = 'Minimal Movement (<1km)';
                } else {
                    $movementStatus = 'Normal Trip';
                }
            }

            // ✅ Get driver name
            $driverName = 'N/A';
            if ($trip->driver && $trip->driver->user) {
                $driverName = $trip->driver->user->first_name . ' ' . $trip->driver->user->last_name;
            }

            return [
                'id' => $trip->trip_ticket_id,
                'trip_number' => $trip->trip_ticket_number,
                'date' => $trip->submitted_at ? Carbon::parse($trip->submitted_at)->format('Y-m-d') : 'N/A',
                'plate_number' => $trip->vehicle?->plate_number ?? 'N/A',
                'driver' => $driverName,
                'department' => $trip->department?->department_name ?? 'N/A',
                'fuel_issued' => (float) ($trip->gasSlip?->amount_released ?? 0),
                'fuel_liters' => (float) ($trip->gasSlip?->fuelReceipt?->liters_availed ?? 0),
                'odometer_start' => $trip->odometer_start,
                'odometer_end' => $trip->odometer_end,
                'actual_distance' => $trip->actual_distance_km ?? 0,
                'movement_status' => $movementStatus,
                'status' => $trip->status,
            ];
        });

        // ✅ Calculate summary
        $noMovement = $trips->filter(function($t) {
            if ($t->odometer_start !== null && $t->odometer_end !== null) {
                return $t->odometer_start == $t->odometer_end;
            }
            return false;
        })->count();

        $noOdometer = $trips->filter(function($t) {
            return $t->odometer_start === null || $t->odometer_end === null;
        })->count();

        return response()->json([
            'success' => true,
            'data' => $formattedData,
            'summary' => [
                'total_trips' => $trips->count(),
                'total_fuel_issued' => round($totalFuelIssued, 2),
                'total_liters' => round($totalLiters, 2),
                'no_movement' => $noMovement,
                'no_odometer' => $noOdometer,
            ]
        ]);

    } catch (\Exception $e) {
        Log::error('Fuel without trip error: ' . $e->getMessage());
        Log::error('Stack trace: ' . $e->getTraceAsString());
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch fuel without trip report: ' . $e->getMessage()
        ], 500);
    }
}

// ============================================================
// ✅ EXPORT WEEKLY MONITORING
// ============================================================

public function exportWeeklyMonitoring(Request $request, $format)
{
    try {
        $response = $this->getWeeklyMonitoring($request);
        $data = $response->getData(true);

        if (!$data['success']) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get report data'
            ], 500);
        }

        $reportData = $data['data'];
        $filename = 'weekly_monitoring_' . date('Y-m-d');

        if ($format === 'excel' || $format === 'xlsx') {
            // Create Excel export if needed
            return Excel::download(
                new \App\Exports\WeeklyMonitoringExport($reportData),
                $filename . '.xlsx'
            );
        } elseif ($format === 'csv') {
            $content = $this->buildWeeklyMonitoringCSV($reportData);
            return $this->returnAsCSV($content, $filename . '.csv');
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Unsupported format'
            ], 400);
        }

    } catch (\Exception $e) {
        Log::error('Export weekly monitoring error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to export report: ' . $e->getMessage()
        ], 500);
    }
}

private function buildWeeklyMonitoringCSV($reportData)
{
    $lines = [];
    $lines[] = "\xEF\xBB\xBF";
    $lines[] = 'WEEKLY MONITORING REPORT';
    $lines[] = 'Generated: ' . now()->format('Y-m-d H:i:s');
    $lines[] = '';
    
    $summary = $reportData['summary'] ?? [];
    $period = $reportData['period'] ?? [];
    $trips = $reportData['trips'] ?? [];
    
    $lines[] = 'PERIOD: ' . ($period['start'] ?? 'N/A') . ' to ' . ($period['end'] ?? 'N/A');
    $lines[] = '';
    $lines[] = 'SUMMARY';
    $lines[] = 'Budget,' . ($summary['budget'] ?? 0);
    $lines[] = 'Used,' . ($summary['used'] ?? 0);
    $lines[] = 'Remaining,' . ($summary['remaining'] ?? 0);
    $lines[] = 'Utilization,' . ($summary['utilization'] ?? 0) . '%';
    $lines[] = 'Total Trips,' . ($summary['trips'] ?? 0);
    $lines[] = 'Completed,' . ($summary['completed'] ?? 0);
    $lines[] = 'Pending,' . ($summary['pending'] ?? 0);
    $lines[] = '';
    $lines[] = 'TRIP DETAILS';
    $lines[] = 'Ticket #,Destination,Status,Estimated Fuel,Actual Fuel,Amount,Driver,Vehicle';
    
    foreach ($trips as $trip) {
        $lines[] = implode(',', [
            '"' . ($trip['number'] ?? 'N/A') . '"',
            '"' . ($trip['destination'] ?? 'N/A') . '"',
            '"' . ($trip['status'] ?? 'N/A') . '"',
            $trip['estimated_fuel'] ?? 0,
            $trip['actual_fuel'] ?? 0,
            $trip['amount'] ?? 0,
            '"' . ($trip['driver'] ?? 'N/A') . '"',
            '"' . ($trip['vehicle'] ?? 'N/A') . '"',
        ]);
    }
    
    return implode("\n", $lines);
}

// ============================================================
// ✅ EXPORT FUEL WITHOUT TRIP
// ============================================================

public function exportFuelWithoutTrip(Request $request, $format)
{
    try {
        $response = $this->getFuelWithoutTrip($request);
        $data = $response->getData(true);

        if (!$data['success']) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get report data'
            ], 500);
        }

        // ✅ Extract data properly
        $reportData = $data['data'] ?? [];
        $filename = 'fuel_without_trip_' . date('Y-m-d');

        if ($format === 'excel' || $format === 'xlsx') {
            return Excel::download(
                new \App\Exports\FuelWithoutTripExport($reportData),
                $filename . '.xlsx'
            );
        } elseif ($format === 'csv') {
            $content = $this->buildFuelWithoutTripCSV($reportData);
            return $this->returnAsCSV($content, $filename . '.csv');
        } elseif ($format === 'pdf') {
            return $this->generateFuelWithoutTripPDF($reportData, $filename);
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Unsupported format'
            ], 400);
        }

    } catch (\Exception $e) {
        Log::error('Export fuel without trip error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to export report: ' . $e->getMessage()
        ], 500);
    }
}

private function buildFuelWithoutTripCSV($reportData)
{
    $lines = [];
    $lines[] = "\xEF\xBB\xBF";
    $lines[] = 'FUEL WITHOUT TRIP REPORT';
    $lines[] = 'Generated: ' . now()->format('Y-m-d H:i:s');
    $lines[] = '';
    
    $lines[] = 'Trip #,Date,Vehicle,Driver,Department,Fuel Issued,Movement,Status';
    
    foreach ($reportData as $item) {
        $lines[] = implode(',', [
            '"' . ($item['trip_number'] ?? 'N/A') . '"',
            '"' . ($item['date'] ?? 'N/A') . '"',
            '"' . ($item['plate_number'] ?? 'N/A') . '"',
            '"' . ($item['driver'] ?? 'N/A') . '"',
            '"' . ($item['department'] ?? 'N/A') . '"',
            $item['fuel_issued'] ?? 0,
            '"' . ($item['movement_status'] ?? 'N/A') . '"',
            '"' . ($item['status'] ?? 'N/A') . '"',
        ]);
    }
    
    return implode("\n", $lines);
}

private function generateFuelWithoutTripPDF($reportData, $filename)
{
    try {
        $html = $this->buildFuelWithoutTripPDFHTML($reportData);
        
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
        return $this->exportFuelWithoutTripCSV($reportData, $filename);
    }
}

private function buildFuelWithoutTripPDFHTML($reportData)
{
    $html = '<!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Fuel Without Trip Report</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 9px; padding: 20px; color: #1e293b; }
            .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
            .header h1 { font-size: 18px; color: #1e293b; font-weight: bold; }
            .header p { color: #64748b; font-size: 11px; margin-top: 5px; }
            .header .subtitle { font-size: 10px; color: #94a3b8; margin-top: 3px; }
            .section { margin-bottom: 15px; }
            .section-title { background: #e2e8f0; padding: 6px 12px; font-weight: bold; font-size: 11px; border-radius: 4px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 8px; }
            th { background: #2563eb; color: white; padding: 6px 4px; text-align: center; font-weight: bold; border: 1px solid #1e40af; }
            td { padding: 5px 4px; border: 1px solid #d1d5db; text-align: center; font-size: 8px; }
            tr:nth-child(even) { background: #f8fafc; }
            .footer { text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px; color: #94a3b8; font-size: 8px; }
            .badge-pending { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 10px; font-size: 7px; }
            .badge-completed { background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 10px; font-size: 7px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>FUEL WITHOUT TRIP REPORT</h1>
            <p>Laguindingan Municipality - FCMS</p>
            <p class="subtitle">Generated: ' . now()->format('F d, Y h:i A') . '</p>
        </div>

        <div class="section">
            <div class="section-title">📋 FUEL WITHOUT TRIP DETAILS</div>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Trip #</th>
                        <th>Vehicle</th>
                        <th>Driver</th>
                        <th>Department</th>
                        <th>Fuel Issued</th>
                        <th>Movement</th>
                       
                    </tr>
                </thead>
                <tbody>';

    if (count($reportData) > 0) {
        foreach ($reportData as $item) {
            $html .= '<tr>
                <td>' . ($item['date'] ?? 'N/A') . '</td>
                <td>' . ($item['trip_number'] ?? 'N/A') . '</td>
                <td>' . ($item['plate_number'] ?? 'N/A') . '</td>
                <td>' . ($item['driver'] ?? 'N/A') . '</td>
                <td>' . ($item['department'] ?? 'N/A') . '</td>
                <td>₱' . number_format($item['fuel_issued'] ?? 0, 2) . '</td>
                <td>' . ($item['movement_status'] ?? 'N/A') . '</td>
               
            </tr>';
        }
    } else {
        $html .= '<tr><td colspan="8" style="text-align:center; color:#94a3b8;">No data available</td></tr>';
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

private function exportFuelWithoutTripCSV($reportData, $filename)
{
    $content = $this->buildFuelWithoutTripCSV($reportData);
    return $this->returnAsCSV($content, $filename . '.csv');
}


}
<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Color;

class FuelConsumptionExport implements 
    FromArray, 
    WithHeadings, 
    WithStyles, 
    WithColumnWidths, 
    WithTitle, 
    WithEvents,
    ShouldAutoSize
{
    protected $data;

    public function __construct($data)
    {
        $this->data = $data;
    }

    /**
     * Return the data for the export
     */
    public function array(): array
    {
        $rows = [];

        // ============================================
        // HEADER SECTION
        // ============================================
        $rows[] = ['FUEL CONSUMPTION MONITORING REPORT'];
        $rows[] = ['Laguindingan Municipality - Fuel Consumption Monitoring System'];
        $rows[] = ['Generated: ' . now()->format('F d, Y h:i A')];
        $rows[] = [];
        
        // Filters / Period
        $filters = $this->data['filters'] ?? [];
        $periodText = 'Period: ';
        $periodText .= ($filters['start_date'] ?? 'N/A') . ' to ' . ($filters['end_date'] ?? 'N/A');
        $rows[] = [$periodText];
        $rows[] = [];

        // ============================================
        // SUMMARY SECTION
        // ============================================
        $summary = $this->data['summary'] ?? [];
        $rows[] = ['📊 SUMMARY'];
        $rows[] = ['Metric', 'Value'];
        $rows[] = ['Total Trips', $summary['total_trips'] ?? 0];
        $rows[] = ['Total Fuel Consumed (Liters)', $summary['total_fuel_liters'] ?? 0];
        $rows[] = ['Total Fuel Cost (PHP)', $summary['total_fuel_cost'] ?? 0];
        $rows[] = ['Average Km/Liter', $summary['average_km_per_liter'] ?? 0];
        $rows[] = ['Total Distance (km)', $summary['total_distance_km'] ?? 0];
        $rows[] = [];

        // ============================================
        // VEHICLE BREAKDOWN SECTION
        // ============================================
        $rows[] = ['🚗 VEHICLE BREAKDOWN'];
        $rows[] = [
            'Plate #', 
            'Vehicle Model', 
            'Fuel Type', 
            'Trips', 
            'Liters', 
            'Cost (PHP)', 
            'Distance (km)', 
            'Km/L', 
            'Efficiency'
        ];

        $vehicles = $this->data['vehicle_breakdown'] ?? [];
        if (empty($vehicles)) {
            $rows[] = ['No data available', '', '', '', '', '', '', '', ''];
        } else {
            foreach ($vehicles as $vehicle) {
                $km = $vehicle['km_per_liter'] ?? 0;
                $efficiency = 'No Data';
                
                if ($km >= 10) { 
                    $efficiency = 'Excellent';
                } elseif ($km >= 7) { 
                    $efficiency = 'Good';
                } elseif ($km >= 5) { 
                    $efficiency = 'Average';
                } elseif ($km >= 3) { 
                    $efficiency = 'Poor';
                } elseif ($km > 0) { 
                    $efficiency = 'Critical';
                }

                $rows[] = [
                    $vehicle['plate_number'] ?? 'N/A',
                    $vehicle['model'] ?? 'N/A',
                    ucfirst($vehicle['fuel_type'] ?? 'N/A'),
                    $vehicle['trips'] ?? 0,
                    $vehicle['liters'] ?? 0,
                    $vehicle['cost'] ?? 0,
                    $vehicle['distance_km'] ?? 0,
                    $km,
                    $efficiency,
                ];
            }
        }

        return $rows;
    }

    /**
     * Headings (empty since we add them manually)
     */
    public function headings(): array
    {
        return [];
    }

    /**
     * Column widths
     */
    public function columnWidths(): array
    {
        return [
            'A' => 18,  // Plate #
            'B' => 28,  // Vehicle Model
            'C' => 14,  // Fuel Type
            'D' => 10,  // Trips
            'E' => 14,  // Liters
            'F' => 18,  // Cost
            'G' => 16,  // Distance
            'H' => 12,  // Km/L
            'I' => 16,  // Efficiency
        ];
    }

    /**
     * Sheet title
     */
    public function title(): string
    {
        return 'Fuel Consumption Report';
    }

    /**
     * Basic styles
     */
    public function styles(Worksheet $sheet)
    {
        return [
            // Title row
            1 => ['font' => ['bold' => true, 'size' => 16, 'color' => ['argb' => 'FF1E40AF']]],
            2 => ['font' => ['bold' => true, 'size' => 12, 'color' => ['argb' => 'FF4B5563']]],
        ];
    }

    /**
     * Register events for advanced styling
     */
    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function(AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                
                // Get highest row
                $highestRow = $sheet->getHighestRow();

                // ============================================
                // 1. HEADER STYLING (Rows 1-5)
                // ============================================
                // Merge header cells
                $sheet->mergeCells('A1:I1');
                $sheet->mergeCells('A2:I2');
                $sheet->mergeCells('A3:I3');
                $sheet->mergeCells('A5:I5');
                
                // Center align headers
                $sheet->getStyle('A1:I5')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('A1:I5')->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
                
                // Header background colors
                $sheet->getStyle('A1:I1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('DBEAFE');
                $sheet->getStyle('A2:I2')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F3F4F6');

                // ============================================
                // 2. SUMMARY TABLE (Rows 8-13)
                // ============================================
                // Summary title
                $sheet->mergeCells('A8:I8');
                $sheet->getStyle('A8:I8')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('BFDBFE');
                $sheet->getStyle('A8:I8')->getFont()->setBold(true)->setSize(12);
                $sheet->getStyle('A8:I8')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
                
                // Summary labels (column A)
                $sheet->getStyle('A9:A15')->getFont()->setBold(true);
                $sheet->getStyle('A9:A15')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F1F5F9');
                
                // Summary values (column B) - right align
                $sheet->getStyle('B9:B15')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                $sheet->getStyle('B9:B15')->getFont()->setBold(true);
                
                // Highlight total cost in red
                $sheet->getStyle('B11')->getFont()->getColor()->setRGB('DC2626');
                // Highlight average km/l in blue
                $sheet->getStyle('B13')->getFont()->getColor()->setRGB('2563EB');

                // ============================================
                // 3. VEHICLE BREAKDOWN TABLE HEADER (Row 15)
                // ============================================
                $vehicleHeaderRow = 17;
                
                // Vehicle section title
                $sheet->mergeCells('A' . $vehicleHeaderRow . ':I' . $vehicleHeaderRow);
                $sheet->getStyle('A' . $vehicleHeaderRow . ':I' . $vehicleHeaderRow)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('BFDBFE');
                $sheet->getStyle('A' . $vehicleHeaderRow . ':I' . $vehicleHeaderRow)
                    ->getFont()->setBold(true)->setSize(12);
                
                // Table headers (Row 18)
                $headerRow = $vehicleHeaderRow + 1;
                $sheet->getStyle('A' . $headerRow . ':I' . $headerRow)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('2563EB');
                $sheet->getStyle('A' . $headerRow . ':I' . $headerRow)
                    ->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
                $sheet->getStyle('A' . $headerRow . ':I' . $headerRow)
                    ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // ============================================
                // 4. VEHICLE DATA ROWS
                // ============================================
                $startRow = $headerRow + 1;
                $endRow = $highestRow;
                
                if ($startRow <= $endRow && $endRow > $headerRow) {
                    // Add borders to data rows
                    $sheet->getStyle('A' . $startRow . ':I' . $endRow)
                        ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
                    
                    // Alternating row colors
                    for ($row = $startRow; $row <= $endRow; $row++) {
                        // Check if it's the "No data" row
                        $cellValue = $sheet->getCell('A' . $row)->getValue();
                        if ($cellValue === 'No data available') {
                            $sheet->getStyle('A' . $row . ':I' . $row)
                                ->getFont()->setItalic(true)->getColor()->setRGB('94A3B8');
                            $sheet->getStyle('A' . $row . ':I' . $row)
                                ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                            continue;
                        }
                        
                        $fillColor = ($row % 2 == 0) ? 'F8FAFC' : 'FFFFFF';
                        $sheet->getStyle('A' . $row . ':I' . $row)
                            ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($fillColor);
                    }
                    
                    // Number formatting
                    $sheet->getStyle('D' . $startRow . ':D' . $endRow)->getNumberFormat()->setFormatCode('#,##0');
                    $sheet->getStyle('E' . $startRow . ':E' . $endRow)->getNumberFormat()->setFormatCode('#,##0.00');
                    $sheet->getStyle('F' . $startRow . ':F' . $endRow)->getNumberFormat()->setFormatCode('₱#,##0.00');
                    $sheet->getStyle('G' . $startRow . ':G' . $endRow)->getNumberFormat()->setFormatCode('#,##0.00');
                    $sheet->getStyle('H' . $startRow . ':H' . $endRow)->getNumberFormat()->setFormatCode('#,##0.00');
                }

                // ============================================
                // 5. CONDITIONAL FORMATTING FOR EFFICIENCY
                // ============================================
                $efficiencyColumn = 'I';
                $startRowEff = $headerRow + 1;
                
                for ($row = $startRowEff; $row <= $endRow; $row++) {
                    $cell = $efficiencyColumn . $row;
                    $value = $sheet->getCell($cell)->getValue();
                    
                    // Skip if it's "No data available" row
                    if ($value === 'No data available') continue;
                    
                    // Set color based on efficiency
                    $colorMap = [
                        'Excellent' => '22C55E',
                        'Good' => '3B82F6',
                        'Average' => 'F59E0B',
                        'Poor' => 'EF4444',
                        'Critical' => 'DC2626',
                        'No Data' => '94A3B8',
                    ];
                    
                    $bgColorMap = [
                        'Excellent' => 'DCFCE7',
                        'Good' => 'DBEAFE',
                        'Average' => 'FEF3C7',
                        'Poor' => 'FEE2E2',
                        'Critical' => 'FECACA',
                        'No Data' => 'F1F5F9',
                    ];
                    
                    $color = $colorMap[$value] ?? '94A3B8';
                    $bgColor = $bgColorMap[$value] ?? 'F1F5F9';
                    
                    $sheet->getStyle($cell)->getFont()->getColor()->setRGB($color);
                    $sheet->getStyle($cell)->getFont()->setBold(true);
                    $sheet->getStyle($cell)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($bgColor);
                }

                // ============================================
                // 6. FOOTER
                // ============================================
                $footerRow = $endRow + 2;
                $sheet->mergeCells('A' . $footerRow . ':I' . $footerRow);
                $sheet->setCellValue('A' . $footerRow, '© ' . date('Y') . ' Laguindingan Municipality - Fuel Consumption Monitoring System');
                $sheet->getStyle('A' . $footerRow)->getFont()->setSize(8)->getColor()->setRGB('94A3B8');
                $sheet->getStyle('A' . $footerRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // ============================================
                // 7. FREEZE PANE (Header row)
                // ============================================
                $sheet->freezePane('A' . ($headerRow + 1));
            },
        ];
    }
}
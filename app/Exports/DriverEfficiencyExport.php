<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Color;

class DriverEfficiencyExport implements 
    FromArray,
    WithHeadings,
    ShouldAutoSize,
    WithTitle,
    WithStyles,
    WithEvents
{
    protected $data;

    public function __construct($data)
    {
        $this->data = $data;
    }

      public function array(): array
    {
        $rows = [];

        $rows[] = ['DRIVER FUEL EFFICIENCY REPORT'];
        $rows[] = ['Laguindingan Municipality - FCMS'];
        $rows[] = ['Generated: ' . now()->format('F d, Y h:i A')];
        $rows[] = array_fill(0, 7, '');   // ✅ Empty spacer (7 columns)
        $rows[] = ['Rank', 'Driver', 'Assigned Vehicle', 'Total Trips', 'Total Distance (km)', 'Total Fuel Used (L)', 'Fuel Efficiency (km/L)'];

        $drivers = $this->data['drivers'] ?? [];
        $rank = 1;
        foreach ($drivers as $driver) {
            $rows[] = [
                $rank,
                $driver['driver_name'] ?? 'N/A',
                $driver['assigned_vehicle'] ?? 'N/A',
                $driver['total_trips'] ?? 0,
                number_format($driver['total_distance_km'] ?? 0, 2),
                number_format($driver['total_fuel_used_liters'] ?? 0, 2),
                number_format($driver['fuel_efficiency_kmpl'] ?? 0, 2),
            ];
            $rank++;
        }

        return $rows;
    }

    public function headings(): array
    {
        return [];
    }

    public function title(): string
    {
        return 'Driver Efficiency';
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => ['font' => ['bold' => true, 'size' => 16, 'color' => ['argb' => 'FF1E40AF']]],
            2 => ['font' => ['bold' => true, 'size' => 12, 'color' => ['argb' => 'FF4B5563']]],
            5 => ['font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FFFFFFFF']]],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function(AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                
                $sheet->mergeCells('A1:G1');
                $sheet->mergeCells('A2:G2');
                $sheet->mergeCells('A3:G3');
                
                $sheet->getStyle('A1:G3')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('A1:G3')->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
                
                $sheet->getStyle('A1:G1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('DBEAFE');
                $sheet->getStyle('A2:G2')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F3F4F6');
                
                $sheet->getStyle('A5:G5')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('2563EB');
                $sheet->getStyle('A5:G5')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                
                $highestRow = $sheet->getHighestRow();
                if ($highestRow > 5) {
                    $sheet->getStyle('A6:G' . $highestRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
                    
                    for ($row = 6; $row <= $highestRow; $row++) {
                        // Color coding for efficiency
                       $efficiency = (float) $sheet->getCell('G' . $row)->getValue();
                        $color = 'FFFFFF';
                        if ($efficiency >= 10) {
                            $color = 'DCFCE7'; // Excellent
                        } elseif ($efficiency >= 7) {
                            $color = 'DBEAFE'; // Good
                        } elseif ($efficiency >= 5) {
                            $color = 'FEF3C7'; // Average
                        } elseif ($efficiency >= 3) {
                            $color = 'FEE2E2'; // Poor
                        } elseif ($efficiency > 0) {
                            $color = 'FECACA'; // Critical
                        }
                        
                        $sheet->getStyle('A' . $row . ':G' . $row)
                            ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($color);
                    }
                    
                    $sheet->getStyle('E6:G' . $highestRow)->getNumberFormat()->setFormatCode('#,##0.00');
                }
            },
        ];
    }
}
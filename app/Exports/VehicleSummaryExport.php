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
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;

class VehicleSummaryExport implements 
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

        // HEADER
        $rows[] = ['VEHICLE FUEL CONSUMPTION SUMMARY'];
        $rows[] = ['Laguindingan Municipality - FCMS'];
        $rows[] = ['Generated: ' . now()->format('F d, Y h:i A')];
        $rows[] = array_fill(0, 6, '');   // ✅ Empty spacer (6 columns)
        $rows[] = ['Vehicle', 'Plate No.', 'Total Trips', 'Total Fuel (L)', 'Total Amount (₱)', 'Average Fuel/Trip (L)'];

        foreach ($this->data as $vehicle) {
            $avgFuelPerTrip = ($vehicle['trip_count'] ?? 0) > 0 
                ? number_format(($vehicle['total_liters'] ?? 0) / ($vehicle['trip_count'] ?? 1), 2) 
                : 0;
            
            $rows[] = [
                $vehicle['model'] ?? 'N/A',
                $vehicle['plate_number'] ?? 'N/A',
                $vehicle['trip_count'] ?? 0,
                number_format($vehicle['total_liters'] ?? 0, 2),
                number_format($vehicle['total_cost'] ?? 0, 2),
                $avgFuelPerTrip,
            ];
        }

        return $rows;
    }

    public function headings(): array
    {
        return [];
    }

    public function title(): string
    {
        return 'Vehicle Summary';
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
                
                // Merge headers
                $sheet->mergeCells('A1:F1');
                $sheet->mergeCells('A2:F2');
                $sheet->mergeCells('A3:F3');
                
                // Center align
                $sheet->getStyle('A1:F3')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('A1:F3')->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
                
                // Header background
                $sheet->getStyle('A1:F1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('DBEAFE');
                $sheet->getStyle('A2:F2')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F3F4F6');
                
                // Table header
                $sheet->getStyle('A5:F5')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('2563EB');
                $sheet->getStyle('A5:F5')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                
                // Data rows
                $highestRow = $sheet->getHighestRow();
                if ($highestRow > 5) {
                    $sheet->getStyle('A6:F' . $highestRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
                    
                    for ($row = 6; $row <= $highestRow; $row++) {
                        $fillColor = ($row % 2 == 0) ? 'F8FAFC' : 'FFFFFF';
                        $sheet->getStyle('A' . $row . ':F' . $row)
                            ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($fillColor);
                    }
                    
                    // Number formatting
                    $sheet->getStyle('C6:C' . $highestRow)->getNumberFormat()->setFormatCode('#,##0');
                    $sheet->getStyle('D6:F' . $highestRow)->getNumberFormat()->setFormatCode('#,##0.00');
                }
            },
        ];
    }
}
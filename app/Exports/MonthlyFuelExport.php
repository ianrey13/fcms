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

class MonthlyFuelExport implements 
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

        $rows[] = ['MONTHLY FUEL CONSUMPTION SUMMARY'];
        $rows[] = ['Laguindingan Municipality - FCMS'];
        $rows[] = ['Generated: ' . now()->format('F d, Y h:i A')];
        $rows[] = ['Year: ' . ($this->data['summary']['year'] ?? date('Y'))];
        $rows[] = array_fill(0, 5, '');   // ✅ Empty spacer (5 columns)
        $rows[] = ['Month', 'Total Trips', 'Total Fuel (L)', 'Total Fuel Cost (₱)', 'Average Fuel/Trip (L)'];

        $months = $this->data['months'] ?? [];
        foreach ($months as $month) {
            $rows[] = [
                $month['month'] ?? 'N/A',
                $month['total_trips'] ?? 0,
                number_format($month['total_fuel_liters'] ?? 0, 2),
                number_format($month['total_cost'] ?? 0, 2),
                number_format($month['avg_fuel_per_trip'] ?? 0, 2),
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
        return 'Monthly Summary';
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => ['font' => ['bold' => true, 'size' => 16, 'color' => ['argb' => 'FF1E40AF']]],
            2 => ['font' => ['bold' => true, 'size' => 12, 'color' => ['argb' => 'FF4B5563']]],
            6 => ['font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FFFFFFFF']]],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function(AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                
                $sheet->mergeCells('A1:E1');
                $sheet->mergeCells('A2:E2');
                $sheet->mergeCells('A3:E3');
                $sheet->mergeCells('A4:E4');
                
                $sheet->getStyle('A1:E4')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('A1:E4')->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
                
                $sheet->getStyle('A1:E1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('DBEAFE');
                $sheet->getStyle('A2:E2')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F3F4F6');
                $sheet->getStyle('A4:E4')->getFont()->setBold(true);
                
                $sheet->getStyle('A6:E6')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('2563EB');
                $sheet->getStyle('A6:E6')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                
                $highestRow = $sheet->getHighestRow();
                if ($highestRow > 6) {
                    $sheet->getStyle('A7:E' . $highestRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
                    
                    for ($row = 7; $row <= $highestRow; $row++) {
                        $fillColor = ($row % 2 == 0) ? 'F8FAFC' : 'FFFFFF';
                        $sheet->getStyle('A' . $row . ':E' . $row)
                            ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($fillColor);
                    }
                }
            },
        ];
    }
}
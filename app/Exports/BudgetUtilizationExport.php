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

class BudgetUtilizationExport implements 
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

        $rows[] = ['BUDGET UTILIZATION REPORT'];
        $rows[] = ['Laguindingan Municipality - FCMS'];
        $rows[] = ['Generated: ' . now()->format('F d, Y h:i A')];
        $rows[] = [];
        $rows[] = ['Department', 'Allocated Budget (₱)', 'Amount Utilized (₱)', 'Remaining Budget (₱)', 'Utilization (%)'];

        $periods = $this->data['periods'] ?? [];
        foreach ($periods as $period) {
            $util = $period['utilization'] ?? ($period['allocated'] > 0 ? (($period['used'] ?? 0) / $period['allocated']) * 100 : 0);
            $rows[] = [
                $period['department_name'] ?? 'Unknown',
                number_format($period['allocated'] ?? 0, 2),
                number_format($period['used'] ?? 0, 2),
                number_format($period['remaining'] ?? 0, 2),
                number_format($util, 1) . '%',
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
        return 'Budget Utilization';
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
                
                $sheet->mergeCells('A1:E1');
                $sheet->mergeCells('A2:E2');
                $sheet->mergeCells('A3:E3');
                
                $sheet->getStyle('A1:E3')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('A1:E3')->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
                
                $sheet->getStyle('A1:E1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('DBEAFE');
                $sheet->getStyle('A2:E2')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F3F4F6');
                
                $sheet->getStyle('A5:E5')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('2563EB');
                $sheet->getStyle('A5:E5')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                
                $highestRow = $sheet->getHighestRow();
                if ($highestRow > 5) {
                    $sheet->getStyle('A6:E' . $highestRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
                    
                    for ($row = 6; $row <= $highestRow; $row++) {
                        // Color coding for utilization
                        $utilValue = (float) str_replace('%', '', $sheet->getCell('E' . $row)->getValue());
                        $color = 'FFFFFF';
                        if ($utilValue > 80) {
                            $color = 'FEE2E2'; // Red
                        } elseif ($utilValue > 60) {
                            $color = 'FEF3C7'; // Yellow
                        } else {
                            $color = 'DCFCE7'; // Green
                        }
                        
                        $sheet->getStyle('A' . $row . ':E' . $row)
                            ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($color);
                    }
                    
                    $sheet->getStyle('B6:E' . $highestRow)->getNumberFormat()->setFormatCode('#,##0.00');
                }
            },
        ];
    }
}
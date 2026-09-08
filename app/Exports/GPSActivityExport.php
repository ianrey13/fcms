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

class GPSActivityExport implements 
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

        $rows[] = ['GPS VEHICLE ACTIVITY REPORT'];
        $rows[] = ['Laguindingan Municipality - FCMS'];
        $rows[] = ['Generated: ' . now()->format('F d, Y h:i A')];
        $rows[] = [];
        $rows[] = [
            'TT Number', 'Vehicle', 'Driver', 'Trip Start', 'Trip End', 
            'Duration (hrs)', 'GPS Distance', 'Logbook Distance', 'Distance Match', 'Trip Status'
        ];

        $activities = $this->data['activities'] ?? [];
        foreach ($activities as $activity) {
            $rows[] = [
                $activity['trip_ticket_number'] ?? 'N/A',
                $activity['vehicle'] ?? 'N/A',
                $activity['driver'] ?? 'N/A',
                $activity['trip_start'] ?? 'N/A',
                $activity['trip_end'] ?? 'N/A',
                $activity['duration_hrs'] ?? 0,
                number_format($activity['gps_distance_km'] ?? 0, 2),
                number_format($activity['logbook_distance_km'] ?? 0, 2),
                $activity['distance_match'] ?? 'N/A',
                $activity['trip_status'] ?? 'N/A',
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
        return 'GPS Activity';
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
                
                $sheet->mergeCells('A1:J1');
                $sheet->mergeCells('A2:J2');
                $sheet->mergeCells('A3:J3');
                
                $sheet->getStyle('A1:J3')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('A1:J3')->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
                
                $sheet->getStyle('A1:J1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('DBEAFE');
                $sheet->getStyle('A2:J2')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F3F4F6');
                
                $sheet->getStyle('A5:J5')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('2563EB');
                $sheet->getStyle('A5:J5')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                
                $highestRow = $sheet->getHighestRow();
                if ($highestRow > 5) {
                    $sheet->getStyle('A6:J' . $highestRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
                    
                    for ($row = 6; $row <= $highestRow; $row++) {
                        // Color coding for Distance Match
                        $matchValue = $sheet->getCell('I' . $row)->getValue();
                        $color = 'FFFFFF';
                        if ($matchValue === 'Match') {
                            $color = 'DCFCE7';
                        } elseif ($matchValue === 'Discrepancy') {
                            $color = 'FEE2E2';
                        } elseif ($matchValue === 'In Progress') {
                            $color = 'FEF3C7';
                        }
                        
                        $sheet->getStyle('A' . $row . ':J' . $row)
                            ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($color);
                    }
                    
                    $sheet->getStyle('G6:H' . $highestRow)->getNumberFormat()->setFormatCode('#,##0.00');
                }
            },
        ];
    }
}
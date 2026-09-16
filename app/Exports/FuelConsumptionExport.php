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
use Carbon\Carbon;

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

    public function array(): array
    {
        $rows = [];

        // HEADER
        $rows[] = ['FUEL CONSUMPTION MONITORING REPORT'];
        $rows[] = ['Laguindingan Municipality - Fuel Consumption Monitoring System'];
        $rows[] = ['Generated: ' . now()->format('F d, Y h:i A')];
        $rows[] = [];

        $filters = $this->data['filters'] ?? [];
        $rows[] = ['Period: ' . ($filters['start_date'] ?? 'N/A') . ' to ' . ($filters['end_date'] ?? 'N/A')];
        $rows[] = [];

        // SECTION TITLE
        $rows[] = ['FUEL CONSUMPTION DETAILS'];

        // COLUMN HEADERS
        $rows[] = [
            '#', 'Date', 'Ticket #', 'Vehicle', 'Plate No.',
            'Driver', 'Department', 'Destination', 'Fuel Type',
            'Qty (L)', 'Amount (PHP)',
        ];

        $logs = $this->data['recent_logs'] ?? [];

        $totalLiters = 0;
        $totalAmount = 0;

        if (empty($logs)) {
            $rows[] = ['No data available', '', '', '', '', '', '', '', '', '', ''];
        } else {
            $i = 1;
            foreach ($logs as $log) {
                $liters = (float) ($log['liters_availed'] ?? 0);
                $amount = (float) ($log['amount_on_receipt'] ?? 0);
                $totalLiters += $liters;
                $totalAmount += $amount;

                $dateRaw = $log['trip_ended_at'] ?? null;
                $dateDisplay = $dateRaw ? Carbon::parse($dateRaw)->format('m/d/Y') : 'N/A';

                $vehicle = $log['vehicle'] ?? 'N/A';
                $plate = 'N/A';
                if (strpos($vehicle, '(') !== false) {
                    $plate = trim(explode('(', $vehicle)[0]);
                }

                $fuelType = $log['fuel_type'] ?? 'Diesel';

                $rows[] = [
                    $i++,
                    $dateDisplay,
                    $log['trip_ticket_number'] ?? 'N/A',
                    $vehicle,
                    $plate,
                    $log['driver'] ?? 'N/A',
                    $log['department'] ?? 'N/A',
                    $log['destination'] ?? 'N/A',
                    ucfirst($fuelType),
                    $liters,
                    $amount,
                ];
            }

            // TOTAL
            $rows[] = [
                'TOTAL', '', '', '', '', '', '', '', '',
                round($totalLiters, 2),
                round($totalAmount, 2),
            ];
        }

        return $rows;
    }

    public function headings(): array { return []; }

    public function columnWidths(): array
    {
        return [
            'A' => 6,  'B' => 12, 'C' => 16, 'D' => 24, 'E' => 14,
            'F' => 20, 'G' => 28, 'H' => 28, 'I' => 12, 'J' => 12, 'K' => 16,
        ];
    }

    public function title(): string { return 'Fuel Consumption Report'; }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => ['font' => ['bold' => true, 'size' => 16, 'color' => ['argb' => 'FF1E40AF']]],
            2 => ['font' => ['bold' => true, 'size' => 12, 'color' => ['argb' => 'FF4B5563']]],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function(AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $highestRow = $sheet->getHighestRow();
                $highestCol = 'K';

                // ============================================
                // 1. TITLE ROWS (1-3)
                // ============================================
                $sheet->mergeCells('A1:' . $highestCol . '1');
                $sheet->mergeCells('A2:' . $highestCol . '2');
                $sheet->mergeCells('A3:' . $highestCol . '3');

                $sheet->getStyle('A1:' . $highestCol . '3')
                    ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('A1:' . $highestCol . '3')
                    ->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);

                $sheet->getStyle('A1:' . $highestCol . '1')
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('DBEAFE');
                $sheet->getStyle('A2:' . $highestCol . '2')
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F3F4F6');

                // Merge period row
                $sheet->mergeCells('A5:' . $highestCol . '5');
                $sheet->getStyle('A5:' . $highestCol . '5')
                    ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // ============================================
                // 2. FIND SECTION ROW (dynamic)
                // ============================================
                $sectionRow = null;
                for ($r = 1; $r <= $highestRow; $r++) {
                    $val = (string) $sheet->getCell('A' . $r)->getValue();
                    if (stripos($val, 'FUEL CONSUMPTION DETAILS') !== false) {
                        $sectionRow = $r;
                        break;
                    }
                }

                if (!$sectionRow) $sectionRow = 7;
                $headerRow = $sectionRow + 1;

                // Section title style
                $sheet->mergeCells('A' . $sectionRow . ':' . $highestCol . $sectionRow);
                $sheet->getStyle('A' . $sectionRow . ':' . $highestCol . $sectionRow)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('BFDBFE');
                $sheet->getStyle('A' . $sectionRow . ':' . $highestCol . $sectionRow)
                    ->getFont()->setBold(true)->setSize(12);
                $sheet->getStyle('A' . $sectionRow . ':' . $highestCol . $sectionRow)
                    ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

                // Header row style
                $sheet->getStyle('A' . $headerRow . ':' . $highestCol . $headerRow)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('2563EB');
                $sheet->getStyle('A' . $headerRow . ':' . $highestCol . $headerRow)
                    ->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
                $sheet->getStyle('A' . $headerRow . ':' . $highestCol . $headerRow)
                    ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // ============================================
                // 3. DATA ROWS
                // ============================================
                $startRow = $headerRow + 1;
                $endRow = $highestRow;

                if ($startRow <= $endRow) {
                    $sheet->getStyle('A' . $startRow . ':' . $highestCol . $endRow)
                        ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

                    for ($row = $startRow; $row <= $endRow; $row++) {
                        $cellA = (string) $sheet->getCell('A' . $row)->getValue();

                        if ($cellA === 'No data available') {
                            $sheet->getStyle('A' . $row . ':' . $highestCol . $row)
                                ->getFont()->setItalic(true)->getColor()->setRGB('94A3B8');
                            $sheet->getStyle('A' . $row . ':' . $highestCol . $row)
                                ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                            continue;
                        }

                        if ($cellA === 'TOTAL') {
                            $sheet->getStyle('A' . $row . ':' . $highestCol . $row)
                                ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('E5E7EB');
                            $sheet->getStyle('A' . $row . ':' . $highestCol . $row)
                                ->getFont()->setBold(true);
                            continue;
                        }

                        // Alternating on even rows only
                        if ($row % 2 == 0) {
                            $sheet->getStyle('A' . $row . ':' . $highestCol . $row)
                                ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F8FAFC');
                        }
                    }

                    // Number format for Qty + Amount
                    $sheet->getStyle('J' . $startRow . ':J' . $endRow)
                        ->getNumberFormat()->setFormatCode('#,##0.00');
                    $sheet->getStyle('K' . $startRow . ':K' . $endRow)
                        ->getNumberFormat()->setFormatCode('₱#,##0.00');
                }

                // ============================================
                // 4. FOOTER
                // ============================================
                $footerRow = $endRow + 2;
                $sheet->mergeCells('A' . $footerRow . ':' . $highestCol . $footerRow);
                $sheet->setCellValue('A' . $footerRow, '© ' . date('Y') . ' Laguindingan Municipality - Fuel Consumption Monitoring System');
                $sheet->getStyle('A' . $footerRow)->getFont()->setSize(8)->getColor()->setRGB('94A3B8');
                $sheet->getStyle('A' . $footerRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // ============================================
                // 5. FREEZE PANE
                // ============================================
                $sheet->freezePane('A' . ($headerRow + 1));
            },
        ];
    }
}
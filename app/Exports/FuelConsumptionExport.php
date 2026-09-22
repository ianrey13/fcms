<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use Carbon\Carbon;

class FuelConsumptionExport implements
    FromArray,
    WithTitle,
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

        $filters = $this->data['filters'] ?? [];
        $logs    = $this->data['recent_logs'] ?? [];

        // ---- Header block ----
        $rows[] = ['FUEL CONSUMPTION REPORT'];
        $rows[] = ['Laguindingan Municipality - Fuel Consumption Monitoring System'];
        $rows[] = ['Generated: ' . now()->format('F d, Y h:i A')];
        $rows[] = ['Period: ' . ($filters['start_date'] ?? 'All') . '  to  ' . ($filters['end_date'] ?? 'All')];
        $rows[] = array_fill(0, 10, '');   // spacer

        // ---- Two-row table header ----
        $rows[] = [
            'Date', 'Vehicle', 'Driver',
            'Fuel Type', '',
            'Qty (L)', 'Amount (₱)', 'Department', 'Destination', 'Purpose',
        ];
        $rows[] = [
            '', '', '',
            'Diesel', 'Gasoline',
            '', '', '', '', '',
        ];

        // ---- Data rows ----
        $totals = [
            'diesel_liters'   => 0,
            'gasoline_liters' => 0,
            'liters'          => 0,
            'amount'          => 0,
        ];

        foreach ($logs as $log) {
            $liters   = (float) ($log['liters_availed'] ?? 0);
            $amount   = (float) ($log['amount_on_receipt'] ?? 0);
            $type     = strtolower($log['fuel_type'] ?? '');
            $isDiesel = $type === 'diesel';
            $isGas    = in_array($type, ['regular', 'premium', 'gasoline']);

            $totals['liters'] += $liters;
            $totals['amount'] += $amount;
            if ($isDiesel) $totals['diesel_liters'] += $liters;
            if ($isGas)    $totals['gasoline_liters'] += $liters;

            $date = $log['trip_ended_at']
                ? Carbon::parse($log['trip_ended_at'])->format('Y-m-d')
                : 'N/A';

            $vehicleDisplay = trim(($log['vehicle_model'] ?? $log['vehicle'] ?? 'N/A')
                . ' ' . ($log['plate_number'] ?? ''));

            $rows[] = [
                $date,
                $vehicleDisplay,
                $log['driver'] ?? 'N/A',
                $isDiesel ? round($liters, 2) : 0,
                $isGas    ? round($liters, 2) : 0,
                round($liters, 2),
                round($amount, 2),
                $log['department_code'] ?? $log['department'] ?? 'N/A',
                $log['destination'] ?? 'N/A',
                $log['purpose'] ?? 'N/A',
            ];
        }

        // ---- TOTAL row ----
        if (!empty($logs)) {
            $rows[] = [
                'TOTAL', '', '',
                round($totals['diesel_liters'], 2),
                round($totals['gasoline_liters'], 2),
                round($totals['liters'], 2),
                round($totals['amount'], 2),
                '', '', '',
            ];
        }

        return $rows;
    }

    public function title(): string
    {
        return 'Fuel Consumption';
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $highestRow = $sheet->getHighestRow();
                $highestCol = 'J';

                // ============================================
                // 1. HEADER BLOCK (rows 1-4)
                // ============================================
                $sheet->mergeCells('A1:' . $highestCol . '1');
                $sheet->mergeCells('A2:' . $highestCol . '2');
                $sheet->mergeCells('A3:' . $highestCol . '3');
                $sheet->mergeCells('A4:' . $highestCol . '4');

                $sheet->getStyle('A1:' . $highestCol . '4')
                    ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('A1:' . $highestCol . '4')
                    ->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);

                // Row 1 — background
                $sheet->getStyle('A1:' . $highestCol . '1')
                    ->getFill()->setFillType(Fill::FILL_SOLID);
                $sheet->getStyle('A1:' . $highestCol . '1')
                    ->getFill()->getStartColor()->setRGB('DBEAFE');
                // Row 1 — font (split)
                $sheet->getStyle('A1')->getFont()->setBold(true);
                $sheet->getStyle('A1')->getFont()->setSize(16);
                $sheet->getStyle('A1')->getFont()->getColor()->setRGB('1E40AF');

                // Row 2 — background
                $sheet->getStyle('A2:' . $highestCol . '2')
                    ->getFill()->setFillType(Fill::FILL_SOLID);
                $sheet->getStyle('A2:' . $highestCol . '2')
                    ->getFill()->getStartColor()->setRGB('F3F4F6');
                // Row 2 — font (split)
                $sheet->getStyle('A2')->getFont()->setBold(true);
                $sheet->getStyle('A2')->getFont()->setSize(11);
                $sheet->getStyle('A2')->getFont()->getColor()->setRGB('4B5563');

                // ============================================
                // 2. TABLE HEADER (rows 6 and 7)
                // ============================================
                $headerRow1 = 6;
                $headerRow2 = 7;

                $sheet->mergeCells('A' . $headerRow1 . ':A' . $headerRow2);
                $sheet->mergeCells('B' . $headerRow1 . ':B' . $headerRow2);
                $sheet->mergeCells('C' . $headerRow1 . ':C' . $headerRow2);
                $sheet->mergeCells('D' . $headerRow1 . ':E' . $headerRow1);
                $sheet->mergeCells('F' . $headerRow1 . ':F' . $headerRow2);
                $sheet->mergeCells('G' . $headerRow1 . ':G' . $headerRow2);
                $sheet->mergeCells('H' . $headerRow1 . ':H' . $headerRow2);
                $sheet->mergeCells('I' . $headerRow1 . ':I' . $headerRow2);
                $sheet->mergeCells('J' . $headerRow1 . ':J' . $headerRow2);

                // Header background
                $sheet->getStyle('A' . $headerRow1 . ':' . $highestCol . $headerRow2)
                    ->getFill()->setFillType(Fill::FILL_SOLID);
                $sheet->getStyle('A' . $headerRow1 . ':' . $highestCol . $headerRow2)
                    ->getFill()->getStartColor()->setRGB('2563EB');

                // Header font (split — setSize before getColor)
                $sheet->getStyle('A' . $headerRow1 . ':' . $highestCol . $headerRow2)
                    ->getFont()->setBold(true);
                $sheet->getStyle('A' . $headerRow1 . ':' . $highestCol . $headerRow2)
                    ->getFont()->setSize(10);
                $sheet->getStyle('A' . $headerRow1 . ':' . $highestCol . $headerRow2)
                    ->getFont()->getColor()->setRGB('FFFFFF');

                // Header alignment
                $sheet->getStyle('A' . $headerRow1 . ':' . $highestCol . $headerRow2)
                    ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)
                    ->setVertical(Alignment::VERTICAL_CENTER)
                    ->setWrapText(true);

                // Header border
                $sheet->getStyle('A' . $headerRow1 . ':' . $highestCol . $headerRow2)
                    ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

                // ============================================
                // 3. DATA ROWS
                // ============================================
                $startRow = $headerRow2 + 1;
                $endRow = $highestRow;

                if ($startRow <= $endRow) {
                    $sheet->getStyle('A' . $startRow . ':' . $highestCol . $endRow)
                        ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

                    for ($row = $startRow; $row <= $endRow; $row++) {
                        $cellA = (string) $sheet->getCell('A' . $row)->getValue();

                        if ($cellA === 'TOTAL') {
                            $sheet->getStyle('A' . $row . ':' . $highestCol . $row)
                                ->getFill()->setFillType(Fill::FILL_SOLID);
                            $sheet->getStyle('A' . $row . ':' . $highestCol . $row)
                                ->getFill()->getStartColor()->setRGB('E5E7EB');
                            $sheet->getStyle('A' . $row . ':' . $highestCol . $row)
                                ->getFont()->setBold(true);
                            continue;
                        }

                        if ($row % 2 == 0) {
                            $sheet->getStyle('A' . $row . ':' . $highestCol . $row)
                                ->getFill()->setFillType(Fill::FILL_SOLID);
                            $sheet->getStyle('A' . $row . ':' . $highestCol . $row)
                                ->getFill()->getStartColor()->setRGB('F8FAFC');
                        }
                    }

                    // Number formats
                    $sheet->getStyle('D' . $startRow . ':F' . $endRow)
                        ->getNumberFormat()->setFormatCode('#,##0.00');
                    $sheet->getStyle('G' . $startRow . ':G' . $endRow)
                        ->getNumberFormat()->setFormatCode('₱#,##0.00');
                }

                // ============================================
                // 4. FOOTER
                // ============================================
                $footerRow = $endRow + 2;
                $sheet->mergeCells('A' . $footerRow . ':' . $highestCol . $footerRow);
                $sheet->setCellValue('A' . $footerRow, '© ' . date('Y') . ' Laguindingan Municipality - Fuel Consumption Monitoring System');
                $sheet->getStyle('A' . $footerRow)->getFont()->setSize(8);
                $sheet->getStyle('A' . $footerRow)->getFont()->getColor()->setRGB('94A3B8');
                $sheet->getStyle('A' . $footerRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // ============================================
                // 5. FREEZE PANE
                // ============================================
                $sheet->freezePane('A' . ($headerRow2 + 1));

                // ============================================
                // 6. COLUMN WIDTHS
                // ============================================
                $sheet->getColumnDimension('A')->setWidth(12);
                $sheet->getColumnDimension('B')->setWidth(24);
                $sheet->getColumnDimension('C')->setWidth(20);
                $sheet->getColumnDimension('D')->setWidth(10);
                $sheet->getColumnDimension('E')->setWidth(10);
                $sheet->getColumnDimension('F')->setWidth(10);
                $sheet->getColumnDimension('G')->setWidth(14);
                $sheet->getColumnDimension('H')->setWidth(14);
                $sheet->getColumnDimension('I')->setWidth(28);
                $sheet->getColumnDimension('J')->setWidth(28);
            },
        ];
    }
}
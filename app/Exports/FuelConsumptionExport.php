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
        $rows[] = array_fill(0, 11, '');   // spacer

        // ---- Two-row table header ----
        // 11 columns: Date, Vehicle, Driver, Diesel, Gasoline, Premium, Qty, Amount, Department, Destination, Purpose
        $rows[] = [
            'Date', 'Vehicle', 'Driver',
            'Fuel Type', '', '',
            'Qty (L)', 'Amount (₱)', 'Department', 'Destination', 'Purpose',
        ];
        $rows[] = [
            '', '', '',
            'Diesel', 'Gasoline', 'Premium',
            '', '', '', '', '',
        ];

        // ---- Data rows ----
        $totals = [
            'diesel_liters'  => 0,
            'gasoline_liters' => 0,
            'premium_liters' => 0,
            'liters'         => 0,
            'amount'         => 0,
        ];

        foreach ($logs as $log) {
            $liters = (float) ($log['liters_availed'] ?? 0);
            $amount = (float) ($log['amount_on_receipt'] ?? 0);
            $type   = strtolower($log['fuel_type'] ?? '');

            // Three-way classification
            $isDiesel   = $type === 'diesel';
            $isGasoline = in_array($type, ['regular', 'gasoline']); // legacy 'regular' → Gasoline
            $isPremium  = $type === 'premium';

            $totals['liters'] += $liters;
            $totals['amount'] += $amount;
            if ($isDiesel)   $totals['diesel_liters']   += $liters;
            if ($isGasoline) $totals['gasoline_liters'] += $liters;
            if ($isPremium)  $totals['premium_liters']  += $liters;

            $date = $log['trip_ended_at']
                ? Carbon::parse($log['trip_ended_at'])->format('Y-m-d')
                : 'N/A';

            $vehicleDisplay = trim(($log['vehicle_model'] ?? $log['vehicle'] ?? 'N/A')
                . ' ' . ($log['plate_number'] ?? ''));

            $rows[] = [
                $date,
                $vehicleDisplay,
                $log['driver'] ?? 'N/A',
                // Three fuel columns
                $isDiesel   ? round($liters, 2) : 0,
                $isGasoline ? round($liters, 2) : 0,
                $isPremium  ? round($liters, 2) : 0,
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
                // Three fuel totals
                round($totals['diesel_liters'], 2),
                round($totals['gasoline_liters'], 2),
                round($totals['premium_liters'], 2),
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
                $highestCol = 'K';

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
                // Row 1 — font
                $sheet->getStyle('A1')->getFont()->setBold(true);
                $sheet->getStyle('A1')->getFont()->setSize(16);
                $sheet->getStyle('A1')->getFont()->getColor()->setRGB('1E40AF');

                // Row 2 — background
                $sheet->getStyle('A2:' . $highestCol . '2')
                    ->getFill()->setFillType(Fill::FILL_SOLID);
                $sheet->getStyle('A2:' . $highestCol . '2')
                    ->getFill()->getStartColor()->setRGB('F3F4F6');
                // Row 2 — font
                $sheet->getStyle('A2')->getFont()->setBold(true);
                $sheet->getStyle('A2')->getFont()->setSize(11);
                $sheet->getStyle('A2')->getFont()->getColor()->setRGB('4B5563');

                // ============================================
                // 2. TABLE HEADER (rows 6 and 7)
                // ============================================
                $headerRow1 = 6;
                $headerRow2 = 7;

                // Merges for 11 columns
                $sheet->mergeCells('A' . $headerRow1 . ':A' . $headerRow2);   // Date
                $sheet->mergeCells('B' . $headerRow1 . ':B' . $headerRow2);   // Vehicle
                $sheet->mergeCells('C' . $headerRow1 . ':C' . $headerRow2);   // Driver
                $sheet->mergeCells('D' . $headerRow1 . ':F' . $headerRow1);   // Fuel Type (3 cols)
                $sheet->mergeCells('G' . $headerRow1 . ':G' . $headerRow2);   // Qty
                $sheet->mergeCells('H' . $headerRow1 . ':H' . $headerRow2);   // Amount
                $sheet->mergeCells('I' . $headerRow1 . ':I' . $headerRow2);   // Department
                $sheet->mergeCells('J' . $headerRow1 . ':J' . $headerRow2);   // Destination
                $sheet->mergeCells('K' . $headerRow1 . ':K' . $headerRow2);   // Purpose

                // Header background
                $sheet->getStyle('A' . $headerRow1 . ':' . $highestCol . $headerRow2)
                    ->getFill()->setFillType(Fill::FILL_SOLID);
                $sheet->getStyle('A' . $headerRow1 . ':' . $highestCol . $headerRow2)
                    ->getFill()->getStartColor()->setRGB('2563EB');

                // Header font
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

                    // Number formats — D:G (3 fuel cols + Qty), H (Amount)
                    $sheet->getStyle('D' . $startRow . ':G' . $endRow)
                        ->getNumberFormat()->setFormatCode('#,##0.00');
                    $sheet->getStyle('H' . $startRow . ':H' . $endRow)
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
                $sheet->getColumnDimension('A')->setWidth(12);  // Date
                $sheet->getColumnDimension('B')->setWidth(24);  // Vehicle
                $sheet->getColumnDimension('C')->setWidth(20);  // Driver
                $sheet->getColumnDimension('D')->setWidth(10);  // Diesel
                $sheet->getColumnDimension('E')->setWidth(12);  // Gasoline (wider)
                $sheet->getColumnDimension('F')->setWidth(10);  // Premium
                $sheet->getColumnDimension('G')->setWidth(10);  // Qty
                $sheet->getColumnDimension('H')->setWidth(14);  // Amount
                $sheet->getColumnDimension('I')->setWidth(14);  // Department
                $sheet->getColumnDimension('J')->setWidth(28);  // Destination
                $sheet->getColumnDimension('K')->setWidth(28);  // Purpose
            },
        ];
    }
}
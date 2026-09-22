<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class BillingStatementExport implements FromArray, WithTitle, WithEvents
{
    protected $data;
    protected $subtotalRows = [];   // ✅ track row numbers for merges

    public function __construct($data)
    {
        $this->data = $data;
    }

    public function array(): array
    {
        $rows = [];
        $departments = $this->data['departments'] ?? [];
        $grandTotals = $this->data['grand_totals'] ?? [];

        // Header block (rows 1–3)
        $rows[] = ['BILLING STATEMENT OF FUEL'];
        $rows[] = [$this->data['period_label'] ?? ''];
        $rows[] = ['Generated: ' . now()->format('F d, Y h:i A')];
        $rows[] = array_fill(0, 9, '');     // row 4 — spacer

        foreach ($departments as $dept) {
            // Department header row
            $rows[] = ['FOR ' . $dept['department_code'] . ' — ' . $dept['department_name']];

            // Column header row
            $rows[] = [
                'NO.', 'CHARGE INVOICE NO.', 'PLATE NO.', 'DATE', 'CONTROL NO.',
                'LUBRICANT', 'QUANTITY', 'UNIT PRICE', 'AMOUNT',
            ];

            // Data rows
            foreach ($dept['rows'] as $r) {
                $rows[] = [
                    $r['no'],
                    $r['charge_invoice_no'],
                    $r['plate_no'],
                    $r['date'],
                    $r['control_no'],
                    $r['lubricant'],
                    is_null($r['quantity']) ? 0 : (float) $r['quantity'],   // ✅ null guard
                    is_null($r['unit_price']) ? 0 : (float) $r['unit_price'],
                    is_null($r['amount']) ? 0 : (float) $r['amount'],
                ];
            }

            // ✅ SINGLE subtotal row — combined label, quantity, amount
            $st = $dept['subtotals'];
            $subtotalLabel = sprintf(
                'Premium: %s L  |  Diesel: %s L  |  Gasoline: %s L',
                number_format($st['premium_liters'], 2),
                number_format($st['diesel_liters'], 2),
                number_format($st['regular_liters'], 2)
            );

            // Mark this row number for merging in AfterSheet
            $this->subtotalRows[] = count($rows) + 1;

            $rows[] = [
                '', '', '', '', '',      // A–E blank (will be merged)
                $subtotalLabel,           // F — the combined fuel breakdown
                (float) $st['total_liters'],   // G — quantity
                '',                        // H — unit price blank
                (float) $st['total_amount'],   // I — amount
            ];

            $rows[] = array_fill(0, 9, '');   // spacer between departments
        }

        // Grand total row — mark for styling
        $this->subtotalRows[] = count($rows) + 1;

        $rows[] = [
            'GRAND TOTAL', '', '', '', '',
            sprintf(
                'Premium: %s  |  Diesel: %s  |  Gasoline: %s',
                number_format($grandTotals['premium_liters'], 2),
                number_format($grandTotals['diesel_liters'], 2),
                number_format($grandTotals['regular_liters'], 2)
            ),
            (float) $grandTotals['total_liters'],
            '',
            (float) $grandTotals['total_amount'],
        ];

        return $rows;
    }

    public function title(): string
    {
        return 'Billing Statement';
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $highestRow = $sheet->getHighestRow();

                // Column widths
                $sheet->getColumnDimension('A')->setWidth(6);
                $sheet->getColumnDimension('B')->setWidth(20);
                $sheet->getColumnDimension('C')->setWidth(14);
                $sheet->getColumnDimension('D')->setWidth(12);
                $sheet->getColumnDimension('E')->setWidth(18);
                $sheet->getColumnDimension('F')->setWidth(42);  // ✅ wider for subtotal label
                $sheet->getColumnDimension('G')->setWidth(12);
                $sheet->getColumnDimension('H')->setWidth(14);
                $sheet->getColumnDimension('I')->setWidth(16);

                // Thin borders everywhere
                $sheet->getStyle('A1:I' . $highestRow)
                    ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

                // Header merges
                $sheet->mergeCells('A1:I1');
                $sheet->mergeCells('A2:I2');
                $sheet->mergeCells('A3:I3');

                $sheet->getStyle('A1:I3')->getAlignment()
                    ->setHorizontal(Alignment::HORIZONTAL_CENTER)
                    ->setVertical(Alignment::VERTICAL_CENTER);

                // Title styling
                $sheet->getStyle('A1')->getFont()->setBold(true);
                $sheet->getStyle('A1')->getFont()->setSize(16);
                $sheet->getStyle('A1')->getFont()->getColor()->setRGB('1E40AF');

                // Number formats for quantity / unit price / amount columns
                $sheet->getStyle('G1:G' . $highestRow)
                    ->getNumberFormat()->setFormatCode('#,##0.00');
                $sheet->getStyle('H1:H' . $highestRow)
                    ->getNumberFormat()->setFormatCode('₱#,##0.00');
                $sheet->getStyle('I1:I' . $highestRow)
                    ->getNumberFormat()->setFormatCode('₱#,##0.00');

                // ✅ Style each subtotal / grand-total row
                foreach ($this->subtotalRows as $rowNum) {
                    // Merge A:F for the combined fuel breakdown label
                    $sheet->mergeCells('A' . $rowNum . ':F' . $rowNum);

                    // Right-align the merged label so it hugs the numbers
                    $sheet->getStyle('A' . $rowNum)
                        ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

                    // Bold + light gray background
                    $sheet->getStyle('A' . $rowNum . ':I' . $rowNum)
                        ->getFont()->setBold(true);
                    $sheet->getStyle('A' . $rowNum . ':I' . $rowNum)
                        ->getFill()->setFillType(Fill::FILL_SOLID);
                    $sheet->getStyle('A' . $rowNum . ':I' . $rowNum)
                        ->getFill()->getStartColor()->setRGB('F1F5F9');
                }

                // Grand total row — dark background
                $lastRow = end($this->subtotalRows);
                if ($lastRow) {
                    $sheet->getStyle('A' . $lastRow . ':I' . $lastRow)
                        ->getFill()->setFillType(Fill::FILL_SOLID);
                    $sheet->getStyle('A' . $lastRow . ':I' . $lastRow)
                        ->getFill()->getStartColor()->setRGB('0F172A');
                    $sheet->getStyle('A' . $lastRow . ':I' . $lastRow)
                        ->getFont()->getColor()->setRGB('FFFFFF');
                    $sheet->getStyle('A' . $lastRow . ':I' . $lastRow)
                        ->getFont()->setBold(true);

                    // Re-apply ₱ formats so they survive the white font
                    $sheet->getStyle('H' . $lastRow . ':I' . $lastRow)
                        ->getNumberFormat()->setFormatCode('₱#,##0.00');
                    $sheet->getStyle('G' . $lastRow)
                        ->getNumberFormat()->setFormatCode('#,##0.00');
                }
            },
        ];
    }
}
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

    public function __construct($data)
    {
        $this->data = $data;
    }

    public function array(): array
    {
        $rows = [];
        $departments = $this->data['departments'] ?? [];
        $grandTotals = $this->data['grand_totals'] ?? [];

        // Header block
        $rows[] = ['BILLING STATEMENT OF FUEL'];
        $rows[] = [$this->data['period_label'] ?? ''];
        $rows[] = ['Generated: ' . now()->format('F d, Y h:i A')];
        $rows[] = array_fill(0, 9, '');

        foreach ($departments as $dept) {
            // Department header
            $rows[] = ['FOR ' . $dept['department_code'] . ' — ' . $dept['department_name']];
            $rows[] = [
                'NO.', 'CHARGE INVOICE NO.', 'PLATE NO.', 'DATE', 'CONTROL NO.',
                'LUBRICANT', 'QUANTITY', 'UNIT PRICE', 'AMOUNT',
            ];

            foreach ($dept['rows'] as $r) {
                $rows[] = [
                    $r['no'],
                    $r['charge_invoice_no'],
                    $r['plate_no'],
                    $r['date'],
                    $r['control_no'],
                    $r['lubricant'],
                    $r['quantity'],
                    $r['unit_price'],
                    $r['amount'],
                ];
            }

            // Subtotals
            $st = $dept['subtotals'];
            $rows[] = [
                '', '', '', '', '',
                'Premium: ' . number_format($st['premium_liters'], 2) . ' L',
                number_format($st['total_liters'], 2),
                '',
                number_format($st['total_amount'], 2),
            ];
            $rows[] = [
                '', '', '', '', '',
                'Diesel: ' . number_format($st['diesel_liters'], 2) . ' L',
                '', '', '',
            ];
            $rows[] = [
                '', '', '', '', '',
                'Regular: ' . number_format($st['regular_liters'], 2) . ' L',
                '', '', '',
            ];
            $rows[] = array_fill(0, 9, '');  // spacer between departments
        }

        // Grand totals
        $rows[] = [
            'GRAND TOTAL', '', '', '', '',
            'Premium: ' . number_format($grandTotals['premium_liters'], 2)
                . ' | Diesel: ' . number_format($grandTotals['diesel_liters'], 2)
                . ' | Regular: ' . number_format($grandTotals['regular_liters'], 2),
            number_format($grandTotals['total_liters'], 2),
            '',
            number_format($grandTotals['total_amount'], 2),
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
                $sheet->getColumnDimension('F')->setWidth(20);
                $sheet->getColumnDimension('G')->setWidth(12);
                $sheet->getColumnDimension('H')->setWidth(14);
                $sheet->getColumnDimension('I')->setWidth(16);

                // Style all cells with thin border
                $sheet->getStyle('A1:I' . $highestRow)
                    ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

                // Merge header row
                $sheet->mergeCells('A1:I1');
                $sheet->mergeCells('A2:I2');
                $sheet->mergeCells('A3:I3');

                $sheet->getStyle('A1:I3')->getAlignment()
                    ->setHorizontal(Alignment::HORIZONTAL_CENTER)
                    ->setVertical(Alignment::VERTICAL_CENTER);

                // Title font
                $sheet->getStyle('A1')->getFont()->setBold(true);
                $sheet->getStyle('A1')->getFont()->setSize(16);
                $sheet->getStyle('A1')->getFont()->getColor()->setRGB('1E40AF');

                // Number formats for quantity / unit price / amount columns
                // Note: this is per-row now; keep global format
                $sheet->getStyle('G1:G' . $highestRow)
                    ->getNumberFormat()->setFormatCode('#,##0.00');
                $sheet->getStyle('H1:H' . $highestRow)
                    ->getNumberFormat()->setFormatCode('₱#,##0.00');
                $sheet->getStyle('I1:I' . $highestRow)
                    ->getNumberFormat()->setFormatCode('₱#,##0.00');
            },
        ];
    }
}
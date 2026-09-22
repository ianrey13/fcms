<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
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

        $department = $this->data['department'] ?? [];
        $summary    = $this->data['summary'] ?? [];
        $periods    = $this->data['periods'] ?? [];
        $filters    = $this->data['filters'] ?? [];

        // ---- Header block ----
        $rows[] = ['BUDGET UTILIZATION REPORT'];
        $rows[] = ['Laguindingan Municipality - FCMS'];
        $rows[] = ['Department: ' . ($department['department_name'] ?? 'Unknown')
                 . ' (' . ($department['department_code'] ?? 'N/A') . ')'];
        $rows[] = ['Fiscal Year: ' . ($filters['year'] ?? date('Y'))
                 . '   |   Month: ' . ($filters['month'] ?? 'All Months')];
        $rows[] = ['Generated: ' . now()->format('F d, Y h:i A')];
        $rows[] = array_fill(0, 4, '');   // spacer

        // ---- Summary block ----
        $rows[] = ['SUMMARY'];
        $rows[] = ['Annual Allocated', 'Annual Utilized', 'Annual Remaining', 'Weeks in View'];
        $rows[] = [
            (float) ($summary['total_allocated'] ?? 0),
            (float) ($summary['total_used'] ?? 0),
            (float) ($summary['total_remaining'] ?? 0),
            (int)   ($summary['total_weeks'] ?? 0),
        ];
        $rows[] = array_fill(0, 4, '');   // spacer

        // ---- Detail table ----
        $rows[] = ['WEEK (DATE RANGE)', 'BUDGET (₱)', 'UTILIZED (₱)', 'BALANCE (₱)'];

        foreach ($periods as $p) {
            $rows[] = [
                $this->formatWeekRange($p['week_start'] ?? null, $p['week_end'] ?? null),
                (float) ($p['allocated'] ?? 0),
                (float) ($p['used'] ?? 0),
                (float) ($p['remaining'] ?? 0),
            ];
        }

        // ---- Total row ----
        if (!empty($periods)) {
            $rows[] = [
                'TOTAL',
                (float) ($periods[0]['allocated'] ?? 0),
                array_sum(array_map(fn($p) => (float) ($p['used'] ?? 0), $periods)),
                (float) (end($periods)['remaining'] ?? 0),
            ];
        }

        return $rows;
    }

    private function formatWeekRange($start, $end): string
    {
        if (!$start || !$end) return '—';
        try {
            $s = \Carbon\Carbon::parse($start)->format('M d, Y');
            $e = \Carbon\Carbon::parse($end)->format('M d, Y');
            return "{$s} – {$e}";
        } catch (\Exception $e) {
            return '—';
        }
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
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();

                // ---- Header block styling ----
                $sheet->mergeCells('A1:D1');
                $sheet->mergeCells('A2:D2');
                $sheet->mergeCells('A3:D3');
                $sheet->mergeCells('A4:D4');
                $sheet->mergeCells('A5:D5');

                $sheet->getStyle('A1:D5')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('A1:D5')->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);

                $sheet->getStyle('A1:D1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('DBEAFE');
                $sheet->getStyle('A2:D2')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F3F4F6');
                $sheet->getStyle('A3:D3')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F3F4F6');
                $sheet->getStyle('A4:D4')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F3F4F6');
                $sheet->getStyle('A5:D5')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F3F4F6');

                // ---- Summary block (row 7-9) ----
                $sheet->mergeCells('A7:D7');
                $sheet->getStyle('A7')->getFont()->setBold(true)->setSize(11);
                $sheet->getStyle('A7')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

                $sheet->getStyle('A8:D8')
                    ->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
                $sheet->getStyle('A8:D8')
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('2563EB');
                $sheet->getStyle('A8:D8')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                $sheet->getStyle('A9:D9')->getFont()->setBold(true);
                $sheet->getStyle('A9:D9')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('B9:C9')->getNumberFormat()->setFormatCode('#,##0.00');
                $sheet->getStyle('A9:D9')
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('E0F2FE');

                // ---- Detail table header (row 11) ----
                $sheet->getStyle('A11:D11')
                    ->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
                $sheet->getStyle('A11:D11')
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('2563EB');
                $sheet->getStyle('A11:D11')
                    ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // ---- Detail rows + TOTAL row ----
                $highestRow = $sheet->getHighestRow();

                if ($highestRow > 11) {
                    $sheet->getStyle('A12:D' . $highestRow)
                        ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

                    $sheet->getStyle('B12:D' . $highestRow)
                        ->getNumberFormat()->setFormatCode('#,##0.00');

                    // Style the TOTAL row (last row) — but only if it says "TOTAL"
                    $lastValue = $sheet->getCell('A' . $highestRow)->getValue();
                    if ($lastValue === 'TOTAL') {
                        $sheet->getStyle('A' . $highestRow . ':D' . $highestRow)
                            ->getFont()->setBold(true);
                        $sheet->getStyle('A' . $highestRow . ':D' . $highestRow)
                            ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('E5E7EB');
                    }
                }
            },
        ];
    }
}
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

class ReconciliationExport implements
    FromArray,
    WithHeadings,
    ShouldAutoSize,
    WithTitle,
    WithStyles,
    WithEvents
{
    protected $data;
    protected $mode;  // 'trip' | 'cash' | 'both'

    public function __construct($data, $mode = 'both')
    {
        $this->data = $data;
        $this->mode = in_array($mode, ['trip', 'cash', 'both'], true) ? $mode : 'both';
    }

    /**
     * Column layout per mode:
     *  - trip  → 6 cols (A-F)  : Trip · Vehicle · Driver · Expected · Actual · Variance (km)
     *  - cash  → 7 cols (A-G)  : Trip · Vehicle · Driver · Released · Actual · Variance (₱) · Status
     *  - both  → 9 cols (A-I)  : previous combined layout
     */
    protected function columnCount(): int
    {
        return match ($this->mode) {
            'trip' => 6,
            'cash' => 7,
            default => 9,
        };
    }

    protected function endColumn(): string
    {
        return match ($this->mode) {
            'trip' => 'F',
            'cash' => 'G',
            default => 'I',
        };
    }

    /**
     * Report heading shown in cell A1 of the sheet.
     * NOT the sheet tab name — that's title() below.
     */
    protected function reportHeading(): string
    {
        return match ($this->mode) {
            'trip' => 'TRIP RECONCILIATION REPORT',
            'cash' => 'CASH RECONCILIATION REPORT',
            default => 'TRIP AND FUEL RECONCILIATION REPORT',
        };
    }

    public function array(): array
    {
        $rows = [];
        $cols = $this->columnCount();
        $blank = array_fill(0, $cols, '');

        $rows[] = [$this->reportHeading()];
        $rows[] = ['Laguindingan Municipality - FCMS'];
        $rows[] = ['Generated: ' . now()->format('F d, Y h:i A')];
        $rows[] = $blank;

        // Header row
        if ($this->mode === 'trip') {
            $rows[] = [
                'Trip Ticket No.', 'Vehicle', 'Driver',
                'Expected Distance (km)', 'Actual Distance (km)', 'Distance Variance (km)',
            ];
        } elseif ($this->mode === 'cash') {
            $rows[] = [
                'Trip Ticket No.', 'Vehicle', 'Driver',
                'Amount Released (₱)', 'Actual Amount Paid (₱)', 'Amount Variance (₱)',
                'Status',
            ];
        } else {
            $rows[] = [
                'Trip Ticket No.', 'Vehicle', 'Driver', 'Expected Distance',
                'Actual Distance', 'Distance Variance', 'Amount Released',
                'Actual Amount Paid', 'Amount Variance',
            ];
        }

        $reconciliations = $this->data['reconciliations'] ?? [];

        foreach ($reconciliations as $r) {
            if ($this->mode === 'trip') {
                $rows[] = [
                    $r['ticket_number'] ?? 'N/A',
                    $r['plate_number'] ?? 'N/A',
                    $r['driver_name'] ?? 'N/A',
                    number_format($r['expected_distance'] ?? 0, 2),
                    number_format($r['actual_distance'] ?? 0, 2),
                    number_format($r['variance'] ?? 0, 2),
                ];
            } elseif ($this->mode === 'cash') {
                $status = $r['status'] ?? 'pending';
                $rows[] = [
                    $r['ticket_number'] ?? 'N/A',
                    $r['plate_number'] ?? 'N/A',
                    $r['driver_name'] ?? 'N/A',
                    number_format($r['amount_released'] ?? 0, 2),
                    $r['actual_amount'] !== null
                        ? number_format($r['actual_amount'], 2)
                        : 'Not verified',
                    $r['amount_variance'] !== null
                        ? number_format($r['amount_variance'], 2)
                        : '—',
                    ucfirst(str_replace('_', ' ', $status)),
                ];
            } else {
                $rows[] = [
                    $r['ticket_number'] ?? 'N/A',
                    $r['plate_number'] ?? 'N/A',
                    $r['driver_name'] ?? 'N/A',
                    number_format($r['expected_distance'] ?? 0, 2),
                    number_format($r['actual_distance'] ?? 0, 2),
                    number_format($r['variance'] ?? 0, 2),
                    number_format($r['amount_released'] ?? 0, 2),
                    number_format($r['actual_amount'] ?? 0, 2),
                    number_format($r['amount_variance'] ?? 0, 2),
                ];
            }
        }

        return $rows;
    }

    public function headings(): array
    {
        return [];
    }

    /**
     * ✅ WithTitle interface method — sheet tab name.
     * Must be named `title()` and be public.
     */
    public function title(): string
    {
        return match ($this->mode) {
            'trip' => 'Trip Reconciliation',
            'cash' => 'Cash Reconciliation',
            default => 'Reconciliation',
        };
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
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $lastCol = $this->endColumn();

                // Merge title rows across full width
                $sheet->mergeCells("A1:{$lastCol}1");
                $sheet->mergeCells("A2:{$lastCol}2");
                $sheet->mergeCells("A3:{$lastCol}3");

                $sheet->getStyle("A1:{$lastCol}3")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle("A1:{$lastCol}3")->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);

                $sheet->getStyle("A1:{$lastCol}1")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('DBEAFE');
                $sheet->getStyle("A2:{$lastCol}2")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F3F4F6');

                // Header row styling
                $sheet->getStyle("A5:{$lastCol}5")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('2563EB');
                $sheet->getStyle("A5:{$lastCol}5")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                $highestRow = $sheet->getHighestRow();
                if ($highestRow > 5) {
                    $sheet->getStyle("A6:{$lastCol}{$highestRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

                    for ($row = 6; $row <= $highestRow; $row++) {
                        $fillColor = ($row % 2 == 0) ? 'F8FAFC' : 'FFFFFF';
                        $sheet->getStyle("A{$row}:{$lastCol}{$row}")
                            ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($fillColor);
                    }

                    // Numeric columns per mode
                    if ($this->mode === 'trip') {
                        $sheet->getStyle("D6:F{$highestRow}")->getNumberFormat()->setFormatCode('#,##0.00');
                    } elseif ($this->mode === 'cash') {
                        $sheet->getStyle("D6:F{$highestRow}")->getNumberFormat()->setFormatCode('#,##0.00');
                    } else {
                        $sheet->getStyle("D6:I{$highestRow}")->getNumberFormat()->setFormatCode('#,##0.00');
                    }
                }
            },
        ];
    }
}
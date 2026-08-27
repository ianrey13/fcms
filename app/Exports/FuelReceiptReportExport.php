<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;

class FuelReceiptReportExport implements 
    FromArray, 
    WithHeadings, 
    ShouldAutoSize, 
    WithTitle,
    WithStyles,
    WithEvents,
    WithColumnFormatting
{
    protected $data;
    protected $reportType;

    public function __construct($data, $reportType = 'gso')
    {
        $this->data = $data;
        $this->reportType = $reportType;
    }

    /**
     * Return the data for the export
     */
    public function array(): array
    {
        $rows = [];
        $receipts = $this->data['receipts'] ?? [];
        $filters = $this->data['filters'] ?? [];
        $summary = $this->data['summary'] ?? [];

        // ============================================
        // HEADER SECTION
        // ============================================
        $title = $this->reportType === 'mo' 
            ? 'MAYOR\'S OFFICE - FUEL RECEIPT REPORT'
            : 'GSO - FUEL RECEIPT REPORT';
        
        $rows[] = [$title];
        $rows[] = ['Laguindingan Municipality - Fuel Consumption Monitoring System'];
        $rows[] = ['Generated: ' . now()->format('F d, Y h:i A')];
        $rows[] = [];

        // Filters
        $rows[] = ['Period: ' . ($filters['start_date'] ?? 'N/A') . ' to ' . ($filters['end_date'] ?? 'N/A')];
        $rows[] = [];

        // ============================================
        // SUMMARY SECTION
        // ============================================
        $rows[] = ['SUMMARY'];
        $rows[] = ['Total Receipts', $summary['total_receipts'] ?? 0];
        $rows[] = ['Total Fuel (Liters)', $summary['total_liters'] ?? 0];
        $rows[] = ['Total Cost (PHP)', $summary['total_cost'] ?? 0];
        $rows[] = [];

        // ============================================
        // RECEIPT DETAILS TABLE
        // ============================================
        $rows[] = ['FUEL RECEIPT DETAILS'];
        $rows[] = [
            'Date',
            'Invoice #',
            'Ticket #',
            'Driver',
            'Vehicle',
            'Plate No.',
            'Destination',
            'Time Departure',
            'Time Arrival',
            'Fuel Type',
            'Unit Price',
            'Amount',
            'Qty (L)',
            'Status'
        ];

        foreach ($receipts as $receipt) {
            $rows[] = [
                $receipt['date'] ?? 'N/A',
                $receipt['invoice_number'] ?? 'N/A',
                $receipt['ticket_number'] ?? 'N/A',
                $receipt['driver'] ?? 'N/A',
                $receipt['vehicle'] ?? 'N/A',
                $receipt['plate_no'] ?? 'N/A',
                $receipt['destination'] ?? 'N/A',
                $receipt['time_departure'] ?? 'N/A',
                $receipt['time_arrival'] ?? 'N/A',
                $receipt['lubricant'] ?? 'N/A',
                $receipt['unit_price'] ?? 0,
                $receipt['amount'] ?? 0,
                $receipt['quantity'] ?? 0,
                $receipt['status'] ?? 'N/A',
            ];
        }

        return $rows;
    }

    /**
     * Headings (empty since we add them manually)
     */
    public function headings(): array
    {
        return [];
    }

    /**
     * Sheet title
     */
    public function title(): string
    {
        return $this->reportType === 'mo' ? 'MO Fuel Receipts' : 'GSO Fuel Receipts';
    }

    /**
     * Column formatting
     */
    public function columnFormats(): array
    {
        return [
            'K' => NumberFormat::FORMAT_NUMBER_00,
            'L' => NumberFormat::FORMAT_NUMBER_COMMA_SEPARATED1,
            'M' => NumberFormat::FORMAT_NUMBER_00,
        ];
    }

    /**
     * Basic styles
     */
    public function styles(Worksheet $sheet)
    {
        return [
            1 => ['font' => ['bold' => true, 'size' => 16, 'color' => ['argb' => 'FF1E40AF']]],
            2 => ['font' => ['bold' => true, 'size' => 12, 'color' => ['argb' => 'FF4B5563']]],
        ];
    }

    /**
     * Register events for advanced styling
     */
    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function(AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                
                $highestRow = $sheet->getHighestRow();
                $highestColumn = 'N';

                // ============================================
                // 1. HEADER STYLING (Rows 1-6)
                // ============================================
                $sheet->mergeCells('A1:' . $highestColumn . '1');
                $sheet->mergeCells('A2:' . $highestColumn . '2');
                $sheet->mergeCells('A3:' . $highestColumn . '3');
                $sheet->mergeCells('A5:' . $highestColumn . '5');
                $sheet->mergeCells('A6:' . $highestColumn . '6');
                
                $sheet->getStyle('A1:' . $highestColumn . '6')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('A1:' . $highestColumn . '6')->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
                
                $sheet->getStyle('A1:' . $highestColumn . '1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('DBEAFE');

                // ============================================
                // 2. SUMMARY STYLING (Rows 8-12)
                // ============================================
                $sheet->mergeCells('A8:' . $highestColumn . '8');
                $sheet->getStyle('A8:' . $highestColumn . '8')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('BFDBFE');
                $sheet->getStyle('A8:' . $highestColumn . '8')->getFont()->setBold(true)->setSize(12);
                $sheet->getStyle('A8:' . $highestColumn . '8')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
                
                // Summary labels (column A)
                $sheet->getStyle('A9:A12')->getFont()->setBold(true);
                $sheet->getStyle('A9:A12')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F1F5F9');
                
                // Summary values (column B) - right align
                $sheet->getStyle('B9:B12')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                $sheet->getStyle('B9:B12')->getFont()->setBold(true);

                // ============================================
                // 3. TABLE HEADER STYLING (Rows 14-15)
                // ============================================
                $headerRow = 14;
                $sheet->mergeCells('A' . $headerRow . ':' . $highestColumn . $headerRow);
                $sheet->getStyle('A' . $headerRow . ':' . $highestColumn . $headerRow)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('BFDBFE');
                $sheet->getStyle('A' . $headerRow . ':' . $highestColumn . $headerRow)
                    ->getFont()->setBold(true)->setSize(12);
                $sheet->getStyle('A' . $headerRow . ':' . $highestColumn . $headerRow)
                    ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

                // Table Headers (Row 15)
                $headerRow2 = $headerRow + 1;
                $sheet->getStyle('A' . $headerRow2 . ':' . $highestColumn . $headerRow2)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('2563EB');
                $sheet->getStyle('A' . $headerRow2 . ':' . $highestColumn . $headerRow2)
                    ->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
                $sheet->getStyle('A' . $headerRow2 . ':' . $highestColumn . $headerRow2)
                    ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // ============================================
                // 4. DATA ROW STYLING
                // ============================================
                $startRow = $headerRow2 + 1;
                $endRow = $highestRow;

                if ($startRow <= $endRow && $endRow > $headerRow2) {
                    // Add borders to data rows
                    $sheet->getStyle('A' . $startRow . ':' . $highestColumn . $endRow)
                        ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

                    // Alternating row colors
                    for ($row = $startRow; $row <= $endRow; $row++) {
                        $fillColor = ($row % 2 == 0) ? 'F8FAFC' : 'FFFFFF';
                        $sheet->getStyle('A' . $row . ':' . $highestColumn . $row)
                            ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($fillColor);
                    }

                    // Number formatting for columns K, L, M (Unit Price, Amount, Qty)
                    $sheet->getStyle('K' . $startRow . ':K' . $endRow)->getNumberFormat()->setFormatCode('₱#,##0.00');
                    $sheet->getStyle('L' . $startRow . ':L' . $endRow)->getNumberFormat()->setFormatCode('₱#,##0.00');
                    $sheet->getStyle('M' . $startRow . ':M' . $endRow)->getNumberFormat()->setFormatCode('#,##0.00');
                }

                // ============================================
                // 5. AUTO SIZE COLUMNS
                // ============================================
                foreach (range('A', $highestColumn) as $columnID) {
                    $sheet->getColumnDimension($columnID)->setAutoSize(true);
                }

                // ============================================
                // 6. FREEZE PANE (Header row)
                // ============================================
                $sheet->freezePane('A' . ($headerRow2 + 1));
            },
        ];
    }
}
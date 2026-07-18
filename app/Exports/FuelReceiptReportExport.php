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
        $rows[] = ['Laguindingan Municipality - Fuel Consumption Management System'];
        $rows[] = ['Generated: ' . now()->format('F d, Y h:i A')];
        $rows[] = [];

        // Filters
        $rows[] = ['Period: ' . ($filters['start_date'] ?? 'N/A') . ' to ' . ($filters['end_date'] ?? 'N/A')];
        $periodType = $filters['period_type'] ?? 'Weekly';
        $rows[] = ['Period Type: ' . ucfirst($periodType)];
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
            'Invoice Number',
            'Driver',
            'Vehicle',
            'Plate Number',
            'Fuel (Lubricant)',
            'Unit Price',
            'Amount',
            'Quantity (L)'
        ];

        foreach ($receipts as $receipt) {
            $rows[] = [
                $receipt['date'] ?? 'N/A',
                $receipt['invoice_number'] ?? 'N/A',
                $receipt['driver'] ?? 'N/A',
                $receipt['vehicle'] ?? 'N/A',
                $receipt['plate_no'] ?? 'N/A',
                $receipt['lubricant'] ?? 'N/A',
                $receipt['unit_price'] ?? 0,
                $receipt['amount'] ?? 0,
                $receipt['quantity'] ?? 0,
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
            'G' => NumberFormat::FORMAT_NUMBER_00,
            'H' => NumberFormat::FORMAT_NUMBER_COMMA_SEPARATED1,
            'I' => NumberFormat::FORMAT_NUMBER_00,
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
                $highestColumn = 'I';

                // ============================================
                // 1. HEADER STYLING (Rows 1-6)
                // ============================================
                $sheet->mergeCells('A1:I1');
                $sheet->mergeCells('A2:I2');
                $sheet->mergeCells('A3:I3');
                $sheet->mergeCells('A5:I5');
                $sheet->mergeCells('A6:I6');
                
                $sheet->getStyle('A1:I6')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle('A1:I6')->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
                
                $sheet->getStyle('A1:I1')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('DBEAFE');

                // ============================================
                // 2. SUMMARY STYLING (Rows 8-12)
                // ============================================
                $sheet->mergeCells('A8:I8');
                $sheet->getStyle('A8:I8')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('BFDBFE');
                $sheet->getStyle('A8:I8')->getFont()->setBold(true)->setSize(12);
                $sheet->getStyle('A8:I8')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
                
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
                $sheet->mergeCells('A' . $headerRow . ':I' . $headerRow);
                $sheet->getStyle('A' . $headerRow . ':I' . $headerRow)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('BFDBFE');
                $sheet->getStyle('A' . $headerRow . ':I' . $headerRow)
                    ->getFont()->setBold(true)->setSize(12);
                $sheet->getStyle('A' . $headerRow . ':I' . $headerRow)
                    ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

                // Table Headers (Row 15)
                $headerRow2 = $headerRow + 1;
                $sheet->getStyle('A' . $headerRow2 . ':I' . $headerRow2)
                    ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('2563EB');
                // ✅ CORRECT: Use getColor()->setRGB() instead of setColor(['rgb' => '...'])
                $sheet->getStyle('A' . $headerRow2 . ':I' . $headerRow2)
                    ->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
                $sheet->getStyle('A' . $headerRow2 . ':I' . $headerRow2)
                    ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // ============================================
                // 4. DATA ROW STYLING
                // ============================================
                $startRow = $headerRow2 + 1;
                $endRow = $highestRow;

                if ($startRow <= $endRow && $endRow > $headerRow2) {
                    // Add borders to data rows
                    $sheet->getStyle('A' . $startRow . ':I' . $endRow)
                        ->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

                    // Alternating row colors
                    for ($row = $startRow; $row <= $endRow; $row++) {
                        $fillColor = ($row % 2 == 0) ? 'F8FAFC' : 'FFFFFF';
                        $sheet->getStyle('A' . $row . ':I' . $row)
                            ->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($fillColor);
                    }

                    // Number formatting for columns G, H, I
                    $sheet->getStyle('G' . $startRow . ':G' . $endRow)->getNumberFormat()->setFormatCode('₱#,##0.00');
                    $sheet->getStyle('H' . $startRow . ':H' . $endRow)->getNumberFormat()->setFormatCode('₱#,##0.00');
                    $sheet->getStyle('I' . $startRow . ':I' . $endRow)->getNumberFormat()->setFormatCode('#,##0.00');
                }

                // ============================================
                // 5. AUTO SIZE COLUMNS
                // ============================================
                foreach (range('A', 'I') as $columnID) {
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
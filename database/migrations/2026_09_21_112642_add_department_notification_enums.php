<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Add 'department_added' to notification_type enum
        DB::statement("
            ALTER TABLE notifications MODIFY notification_type 
            ENUM(
                'trip_submitted','forwarded_to_mo','batch_forwarded_to_mo',
                'mo_approved','fund_issued','fund_released','trip_started',
                'trip_completed','reconciliation_closed','duplicate_receipt_flag',
                'signature_integrity_violation','budget_low_warning',
                'fund_return_pending','budget_assistance_request','trip_created',
                'trip_assigned','receipt_uploaded','test','trip_reconciled',
                'driver_acknowledged','gso_rejected','mo_rejected',
                'cross_department_usage','trip_cancelled','trip_closed',
                'trip_pending_validation','department_added'
            ) DEFAULT NULL
        ");

        // Add 'department' to entity_type enum
        DB::statement("
            ALTER TABLE notifications MODIFY entity_type 
            ENUM(
                'trip_ticket','gas_slip','fund_issuance',
                'trip_ticket_esignature','mo_request','test','department'
            ) NOT NULL
        ");
    }

    public function down(): void
    {
        // Remove any rows using the new values first
        DB::statement("DELETE FROM notifications WHERE notification_type = 'department_added'");

        // Revert notification_type enum
        DB::statement("
            ALTER TABLE notifications MODIFY notification_type 
            ENUM(
                'trip_submitted','forwarded_to_mo','batch_forwarded_to_mo',
                'mo_approved','fund_issued','fund_released','trip_started',
                'trip_completed','reconciliation_closed','duplicate_receipt_flag',
                'signature_integrity_violation','budget_low_warning',
                'fund_return_pending','budget_assistance_request','trip_created',
                'trip_assigned','receipt_uploaded','test','trip_reconciled',
                'driver_acknowledged','gso_rejected','mo_rejected',
                'cross_department_usage','trip_cancelled','trip_closed',
                'trip_pending_validation'
            ) DEFAULT NULL
        ");

        // Revert entity_type enum
        DB::statement("
            ALTER TABLE notifications MODIFY entity_type 
            ENUM(
                'trip_ticket','gas_slip','fund_issuance',
                'trip_ticket_esignature','mo_request','test'
            ) NOT NULL
        ");
    }
};
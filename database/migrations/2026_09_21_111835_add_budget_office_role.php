<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Expand enum — additive, no data loss
        DB::statement("
            ALTER TABLE users MODIFY role 
            ENUM('gso_office','mayors_office','driver','budget_office') NOT NULL
        ");

        // Add 'department_added' to notification_type enum (needed for B4)
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
    }

    public function down(): void
    {
        // Remove any budget_office users first (reassign to mayors_office)
        DB::statement("UPDATE users SET role = 'mayors_office' WHERE role = 'budget_office'");
        DB::statement("ALTER TABLE users MODIFY role ENUM('gso_office','mayors_office','driver') NOT NULL");
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
    }
};
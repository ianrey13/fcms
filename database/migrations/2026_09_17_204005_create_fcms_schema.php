<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // ============================================================
        // 0. IDEMPOTENT CLEANUP
        // MySQL DROP TABLES doesn't remove procedures/views/triggers,
        // so we explicitly drop them here. This makes `migrate:fresh`
        // safe to run repeatedly.
        // ============================================================
        DB::unprepared("DROP PROCEDURE IF EXISTS `proc_weekly_budget_reset`");
        DB::unprepared("DROP VIEW IF EXISTS `v_remaining_budget`");
        DB::unprepared("DROP VIEW IF EXISTS `v_fuel_efficiency`");
        DB::unprepared("DROP VIEW IF EXISTS `v_department_budget_summary`");
        DB::unprepared("DROP VIEW IF EXISTS `v_active_trips`");
        DB::unprepared("DROP TRIGGER IF EXISTS `trg_log_charge_to_change`");
        DB::unprepared("DROP TRIGGER IF EXISTS `trg_gas_slip_budget_immutable`");

        Schema::disableForeignKeyConstraints();

        // ============================================================
        // 1. CORE: departments, users, drivers
        // ============================================================

        Schema::create('departments', function (Blueprint $table) {
            $table->bigIncrements('department_id');
            $table->string('department_name', 150)->unique();
            $table->string('department_code', 20)->unique();
            $table->string('head_of_office', 150)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->bigIncrements('user_id');
            $table->unsignedBigInteger('department_id');
            $table->string('first_name', 50);
            $table->string('middle_name', 50)->nullable();
            $table->string('last_name', 50);
            $table->string('email', 150)->unique();
            $table->string('employee_number', 50)->nullable()->unique();
            $table->string('password_hash', 255)->nullable();
            // ✅ Merged enum — includes budget_office
            $table->enum('role', ['gso_office', 'mayors_office', 'driver', 'budget_office']);
            $table->boolean('can_drive')->default(false);
            $table->string('esignature_path', 500)->nullable();
            $table->string('esignature_hash', 64)->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->tinyInteger('failed_login_attempts')->default(0);
            $table->timestamp('account_locked_until')->nullable();
            $table->timestamp('deactivated_at')->nullable();
            $table->unsignedBigInteger('deactivated_by')->nullable();
            $table->string('deactivation_reason', 255)->nullable();
            $table->timestamp('password_changed_at')->nullable();

            $table->foreign('department_id')->references('department_id')->on('departments');
            $table->foreign('deactivated_by')->references('user_id')->on('users')->onDelete('set null');
            $table->index('role');
            $table->index('department_id');
        });

        Schema::create('drivers', function (Blueprint $table) {
            $table->bigIncrements('driver_id');
            $table->unsignedBigInteger('user_id')->unique();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();

            $table->foreign('user_id')->references('user_id')->on('users');
        });

        // ============================================================
        // 2. FISCAL YEARS & BUDGET
        // ============================================================

        Schema::create('fiscal_years', function (Blueprint $table) {
            $table->bigIncrements('fiscal_year_id');
            $table->year('year')->unique();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();

            $table->foreign('created_by')->references('user_id')->on('users')->onDelete('set null');
        });

        Schema::create('annual_budgets', function (Blueprint $table) {
            $table->bigIncrements('budget_id');
            $table->unsignedBigInteger('department_id');
            $table->year('fiscal_year');
            $table->decimal('annual_amount', 12, 2);
            $table->decimal('weekly_ceiling', 12, 2)->nullable();
            $table->decimal('used_amount', 12, 2)->default(0.00);
            $table->decimal('remaining_amount', 12, 2)->virtualAs('annual_amount - used_amount');
            $table->enum('status', ['active', 'closed'])->default('active');
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->decimal('suggested_ceiling', 12, 2)->virtualAs('annual_amount / 52');

            $table->unique(['department_id', 'fiscal_year']);
            $table->index(['department_id', 'fiscal_year', 'status']);
            $table->foreign('department_id')->references('department_id')->on('departments');
        });

        // ✅ MERGED: dept_budget_policy now has dept_policy_id PK + composite unique on (department_id, fiscal_year)
        Schema::create('dept_budget_policy', function (Blueprint $table) {
            $table->bigIncrements('dept_policy_id');
            $table->unsignedBigInteger('department_id');
            $table->year('fiscal_year');
            $table->decimal('default_weekly_allocation', 12, 2)->default(0.00);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();

            $table->unique(['department_id', 'fiscal_year'], 'dept_budget_policy_dept_year_unique');
            $table->foreign('department_id')->references('department_id')->on('departments');
        });

        // ✅ MERGED: dept_budget_period now has fiscal_year + composite unique on (department_id, fiscal_year, week_start)
        Schema::create('dept_budget_period', function (Blueprint $table) {
            $table->bigIncrements('period_id');
            $table->unsignedBigInteger('department_id');
            $table->year('fiscal_year')->nullable();
            $table->date('week_start');
            $table->date('week_end')->virtualAs('DATE_ADD(week_start, INTERVAL 4 DAY)');
            $table->decimal('allocated_amount', 12, 2)->default(0.00);
            $table->enum('status', ['active', 'closed'])->default('active');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->decimal('remaining_balance', 12, 2)->nullable();

            $table->unique(['department_id', 'fiscal_year', 'week_start'], 'dept_budget_period_dept_year_week_unique');
            $table->index(['department_id', 'status', 'week_start'], 'idx_budget_period_dept_status');
            $table->index(['department_id', 'fiscal_year'], 'idx_budget_period_dept_year');
            $table->foreign('department_id')->references('department_id')->on('departments');
        });

        Schema::create('budget_history', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('department_id');
            $table->string('department_name', 255);
            $table->string('action', 50);
            $table->decimal('previous_amount', 12, 2)->default(0.00);
            $table->decimal('added_amount', 12, 2)->default(0.00);
            $table->decimal('new_amount', 12, 2)->default(0.00);
            $table->string('reason', 255)->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('user_name', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();

            $table->index('department_id');
            $table->index('action');
            $table->index('created_at');
        });

        Schema::create('weekly_budget_usage', function (Blueprint $table) {
            $table->bigIncrements('usage_id');
            $table->unsignedBigInteger('department_id');
            $table->integer('week_number');
            $table->year('year');
            $table->date('week_start');
            $table->date('week_end');
            $table->decimal('amount_used', 12, 2)->default(0.00);
            $table->decimal('weekly_allocation', 12, 2)->default(0.00);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();

            $table->unique(['department_id', 'week_number', 'year']);
            $table->index(['department_id', 'year', 'week_number']);
            $table->foreign('department_id')->references('department_id')->on('departments');
        });

        // ============================================================
        // 3. VEHICLES — ✅ fuel_type includes diesel, regular, premium
        //    (regular replaces the old 'gasoline' nomenclature)
        // ============================================================
        Schema::create('vehicles', function (Blueprint $table) {
            $table->bigIncrements('vehicle_id');
            $table->unsignedBigInteger('department_id');
            $table->string('vehicle_model', 120);
            $table->string('plate_number', 20)->unique();
            $table->enum('fuel_type', ['diesel', 'regular', 'premium']);
            $table->decimal('fuel_efficiency', 5, 2)->default(10.00);
            $table->decimal('current_fuel_balance', 10, 2)->default(0.00);
            $table->decimal('fuel_capacity', 10, 2)->default(60.00);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->boolean('maintenance_flag')->default(false);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();

            $table->index('department_id');
            $table->foreign('department_id')->references('department_id')->on('departments');
        });

        // ============================================================
        // 4. TRIP TICKETS
        // ============================================================
        Schema::create('trip_ticket', function (Blueprint $table) {
            $table->bigIncrements('trip_ticket_id');
            $table->string('trip_ticket_number', 20)->nullable()->unique();
            $table->unsignedBigInteger('department_id');
            $table->unsignedBigInteger('submitted_by');
            $table->unsignedBigInteger('driver_id')->nullable();
            $table->unsignedBigInteger('vehicle_id');
            $table->unsignedBigInteger('created_by_mo_user_id')->nullable();
            $table->boolean('submitted_by_staff')->default(true);
            $table->timestamp('submitted_at')->useCurrent();
            $table->date('trip_date');
            $table->text('purpose');
            $table->string('destination', 255);
            $table->string('charge_to', 20);
            $table->string('passenger_name', 120)->nullable();
            $table->enum('status', [
                'draft', 'pending_mayors_office', 'returned_for_revision',
                'funds_issued', 'in_transit', 'pending_reconciliation',
                'closed', 'rejected', 'cancelled', 'acknowledged',
                'pending_gso_validation', 'completed',
            ])->default('draft');
            $table->integer('trip_count')->default(0);
            $table->unsignedBigInteger('closed_by')->nullable();
            $table->unsignedBigInteger('cancelled_by')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('original_charge_to', 20)->nullable();
            $table->unsignedBigInteger('charge_to_modified_by')->nullable();
            $table->timestamp('charge_to_modified_at')->nullable();
            $table->text('charge_to_modification_reason')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->decimal('estimated_distance_km', 10, 2)->nullable();
            $table->decimal('estimated_fuel_liters', 10, 2)->nullable();
            $table->decimal('actual_distance_km', 10, 2)->nullable();
            $table->decimal('actual_fuel_used', 10, 2)->nullable();
            $table->boolean('is_fuel_issued_without_trip')->default(false);
            $table->boolean('has_insufficient_budget')->default(false);
            $table->decimal('budget_shortage', 12, 2)->default(0.00);
            $table->integer('original_department_id')->nullable();

            $table->index('status');
            $table->index(['status', 'submitted_at'], 'idx_tt_status_date');
            $table->index('charge_to');

            $table->foreign('department_id')->references('department_id')->on('departments');
            $table->foreign('submitted_by')->references('user_id')->on('users');
            $table->foreign('driver_id')->references('driver_id')->on('drivers');
            $table->foreign('vehicle_id')->references('vehicle_id')->on('vehicles');
            $table->foreign('created_by_mo_user_id')->references('user_id')->on('users');
            $table->foreign('charge_to_modified_by')->references('user_id')->on('users');
            $table->foreign('closed_by')->references('user_id')->on('users')->onDelete('set null');
            $table->foreign('cancelled_by')->references('user_id')->on('users')->onDelete('set null');
            $table->foreign('charge_to')->references('department_code')->on('departments');
        });

        // ✅ fuel_type enum updated to match vehicles
        Schema::create('trip_vehicle_snapshot', function (Blueprint $table) {
            $table->unsignedBigInteger('trip_ticket_id')->primary();
            $table->enum('vehicle_status', ['active', 'inactive']);
            $table->enum('fuel_type', ['diesel', 'regular', 'premium']);
            $table->timestamp('snapshot_taken_at')->useCurrent();

            $table->foreign('trip_ticket_id')->references('trip_ticket_id')->on('trip_ticket');
        });

        Schema::create('trip_history', function (Blueprint $table) {
            $table->bigIncrements('history_id');
            $table->unsignedBigInteger('trip_ticket_id');
            $table->integer('trip_number')->default(1);
            $table->decimal('start_lat', 10, 7)->nullable();
            $table->decimal('start_lng', 10, 7)->nullable();
            $table->timestamp('started_at')->nullable();
            $table->decimal('end_lat', 10, 7)->nullable();
            $table->decimal('end_lng', 10, 7)->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->decimal('distance_km', 8, 2)->default(0.00);
            $table->enum('status', ['in_progress', 'completed'])->default('completed');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();

            $table->index('trip_ticket_id');
            $table->foreign('trip_ticket_id')->references('trip_ticket_id')->on('trip_ticket')->onDelete('cascade');
        });

        // ============================================================
        // 5. GAS SLIPS, FUEL RECEIPTS, GPS, CROSS-DEPT
        // ============================================================
        Schema::create('gas_slip', function (Blueprint $table) {
            $table->bigIncrements('gas_slip_id');
            $table->unsignedBigInteger('trip_ticket_id')->unique();
            $table->unsignedBigInteger('created_by');
            $table->decimal('amount_released', 10, 2);
            $table->boolean('is_cross_department')->default(false);
            $table->decimal('budget_before', 12, 2);
            $table->decimal('budget_after', 12, 2);
            $table->unsignedBigInteger('period_id');
            $table->enum('reconciliation_status', ['pending', 'verified', 'discrepancy'])->default('pending');
            $table->text('reconciliation_note')->nullable();
            $table->unsignedBigInteger('reconciled_by')->nullable();
            $table->timestamp('reconciled_at')->nullable();
            $table->unsignedBigInteger('acknowledged_by')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();
            $table->unsignedBigInteger('original_department_id')->nullable();
            $table->string('cross_department_reason', 255)->nullable();

            $table->index('created_by');
            $table->index('acknowledged_by');
            $table->index('period_id');
            $table->index(['period_id', 'amount_released'], 'idx_gas_slip_period_amount');

            $table->foreign('trip_ticket_id')->references('trip_ticket_id')->on('trip_ticket');
            $table->foreign('created_by')->references('user_id')->on('users');
            $table->foreign('reconciled_by')->references('user_id')->on('users');
            $table->foreign('acknowledged_by')->references('user_id')->on('users');
            $table->foreign('period_id')->references('period_id')->on('dept_budget_period');
            $table->foreign('original_department_id')->references('department_id')->on('departments');
        });

        Schema::create('fuel_receipt', function (Blueprint $table) {
            $table->bigIncrements('fuel_receipt_id');
            $table->unsignedBigInteger('gas_slip_id')->unique();
            $table->string('invoice_number', 50)->nullable();
            $table->decimal('liters_availed', 8, 2)->nullable();
            $table->decimal('amount_on_receipt', 10, 2)->nullable();
            $table->decimal('unit_price', 10, 2)->nullable();
            $table->string('receipt_photo_path', 500)->nullable();
            $table->timestamp('receipt_uploaded_at')->nullable();

            // ✅ Merged: verification fields
            $table->enum('verification_status', ['pending', 'verified'])->default('pending');
            $table->timestamp('verified_at')->nullable();
            $table->unsignedBigInteger('verified_by')->nullable();

            $table->decimal('trip_start_gps_lat', 10, 7)->nullable();
            $table->decimal('trip_start_gps_lng', 10, 7)->nullable();
            $table->decimal('trip_end_gps_lat', 10, 7)->nullable();
            $table->decimal('trip_end_gps_lng', 10, 7)->nullable();
            $table->decimal('trip_start_gps_accuracy', 8, 2)->nullable();
            $table->timestamp('trip_started_at')->nullable();
            $table->timestamp('trip_ended_at')->nullable();
            $table->unsignedInteger('trip_elapsed_minutes')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();
            $table->decimal('gps_distance_km', 8, 2)->nullable();

            $table->foreign('gas_slip_id')->references('gas_slip_id')->on('gas_slip');
            $table->foreign('verified_by')->references('user_id')->on('users')->onDelete('set null');
            $table->index('verification_status', 'idx_fuel_receipt_verification_status');
        });

        Schema::create('gps_ping', function (Blueprint $table) {
            $table->bigIncrements('ping_id');
            $table->unsignedBigInteger('trip_ticket_id');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('accuracy_meters', 10, 2)->nullable();
            $table->decimal('speed_kmh', 8, 2)->nullable();
            $table->decimal('heading_degrees', 8, 2)->nullable();
            $table->boolean('is_low_accuracy')->default(false);
            $table->boolean('is_queued_upload')->default(false);
            $table->boolean('has_mock_location_flag')->default(false);
            $table->timestamp('recorded_at')->useCurrent();
            $table->timestamp('received_at')->useCurrent();

            $table->index('trip_ticket_id');
            $table->index('recorded_at');
            $table->foreign('trip_ticket_id')->references('trip_ticket_id')->on('trip_ticket')->onDelete('cascade');
        });

        Schema::create('cross_department_usage', function (Blueprint $table) {
            $table->bigIncrements('usage_id');
            $table->unsignedBigInteger('from_department_id');
            $table->unsignedBigInteger('to_department_id');
            $table->unsignedBigInteger('gas_slip_id');
            $table->decimal('amount', 12, 2);
            $table->string('reason', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();

            $table->index(['from_department_id', 'to_department_id']);
            $table->foreign('from_department_id')->references('department_id')->on('departments');
            $table->foreign('to_department_id')->references('department_id')->on('departments');
            $table->foreign('gas_slip_id')->references('gas_slip_id')->on('gas_slip');
        });

        // ============================================================
        // 6. AUDIT, NOTIFICATIONS, CACHE, JOBS, SESSIONS, SETTINGS
        // ============================================================
        Schema::create('audit_log', function (Blueprint $table) {
            $table->bigIncrements('log_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('action', 50);
            $table->string('table_name', 50);
            $table->unsignedInteger('record_id');
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('user_id');
            $table->foreign('user_id')->references('user_id')->on('users')->onDelete('set null');
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->bigIncrements('notification_id');
            $table->unsignedBigInteger('recipient_user_id');
            $table->enum('notification_type', [
                'trip_submitted', 'forwarded_to_mo', 'batch_forwarded_to_mo',
                'mo_approved', 'fund_issued', 'fund_released', 'trip_started',
                'trip_completed', 'reconciliation_closed', 'duplicate_receipt_flag',
                'signature_integrity_violation', 'budget_low_warning',
                'fund_return_pending', 'budget_assistance_request', 'trip_created',
                'trip_assigned', 'receipt_uploaded', 'test', 'trip_reconciled',
                'driver_acknowledged', 'gso_rejected', 'mo_rejected',
                'cross_department_usage', 'trip_cancelled', 'trip_closed',
                'trip_pending_validation', 'department_added',
            ])->nullable();
            $table->enum('entity_type', [
                'trip_ticket', 'gas_slip', 'fund_issuance',
                'trip_ticket_esignature', 'mo_request', 'test', 'department',
            ]);
            $table->integer('entity_id');
            $table->string('message', 500);
            $table->enum('channel', ['in_app', 'push'])->default('in_app');
            $table->boolean('is_read')->default(false);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('read_at')->nullable();

            $table->index('recipient_user_id');
            $table->index(['entity_type', 'entity_id']);
            $table->index('created_at');
            $table->foreign('recipient_user_id')->references('user_id')->on('users')->onDelete('cascade');
        });

        Schema::create('system_setting', function (Blueprint $table) {
            $table->increments('setting_id');
            $table->string('setting_key', 80)->unique();
            $table->text('setting_value');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('updated_at')->nullable();

            $table->foreign('updated_by')->references('user_id')->on('users')->onDelete('set null');
        });

        // Laravel-standard
        Schema::create('cache', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->mediumText('value');
            $table->integer('expiration');
        });

        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('owner');
            $table->integer('expiration');
        });

        Schema::create('jobs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('queue')->index();
            $table->longText('payload');
            $table->unsignedTinyInteger('attempts');
            $table->unsignedInteger('reserved_at')->nullable();
            $table->unsignedInteger('available_at');
            $table->unsignedInteger('created_at');
        });

        Schema::create('job_batches', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->integer('total_jobs');
            $table->integer('pending_jobs');
            $table->integer('failed_jobs');
            $table->longText('failed_job_ids');
            $table->mediumText('options')->nullable();
            $table->integer('cancelled_at')->nullable();
            $table->integer('created_at');
            $table->integer('finished_at')->nullable();
        });

        Schema::create('failed_jobs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('uuid')->unique();
            $table->string('connection');
            $table->string('queue');
            $table->longText('payload');
            $table->longText('exception');
            $table->timestamp('failed_at')->useCurrent();

            $table->index(['connection', 'queue', 'failed_at']);
        });

        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('tokenable_type');
            $table->unsignedBigInteger('tokenable_id');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['tokenable_type', 'tokenable_id']);
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        Schema::enableForeignKeyConstraints();

        // ============================================================
        // 7. TRIGGERS
        // ============================================================
        DB::unprepared("
            CREATE TRIGGER `trg_gas_slip_budget_immutable`
            BEFORE UPDATE ON `gas_slip`
            FOR EACH ROW
            BEGIN
                IF NEW.budget_before != OLD.budget_before OR NEW.budget_after != OLD.budget_after THEN
                    SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'gas_slip.budget_before and budget_after are write-once and cannot be modified.';
                END IF;
            END
        ");

        DB::unprepared("
            CREATE TRIGGER `trg_log_charge_to_change`
            BEFORE UPDATE ON `trip_ticket`
            FOR EACH ROW
            BEGIN
                IF OLD.charge_to != NEW.charge_to AND OLD.charge_to IS NOT NULL THEN
                    SET NEW.original_charge_to = COALESCE(OLD.original_charge_to, OLD.charge_to);
                    SET NEW.charge_to_modified_by = @current_user_id;
                    SET NEW.charge_to_modified_at = NOW();
                END IF;
            END
        ");

        // ============================================================
        // 8. STORED PROCEDURE
        // ============================================================
        DB::unprepared("
            CREATE PROCEDURE `proc_weekly_budget_reset` ()
            BEGIN
                DECLARE v_week_start DATE;
                DECLARE v_prev_week_start DATE;

                SET v_week_start = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY);
                SET v_prev_week_start = DATE_SUB(v_week_start, INTERVAL 7 DAY);

                START TRANSACTION;

                UPDATE dept_budget_period
                SET status = 'closed', closed_at = NOW()
                WHERE status = 'active';

                UPDATE dept_budget_policy dbp
                JOIN dept_budget_period p ON dbp.department_id = p.department_id
                SET dbp.default_weekly_allocation = p.allocated_amount,
                    dbp.updated_at = NOW()
                WHERE p.week_start = v_prev_week_start
                  AND p.status = 'closed';

                INSERT INTO dept_budget_period (department_id, week_start, allocated_amount, remaining_balance, status)
                SELECT
                    dbp.department_id,
                    v_week_start,
                    dbp.default_weekly_allocation,
                    dbp.default_weekly_allocation,
                    'active'
                FROM dept_budget_policy dbp
                ON DUPLICATE KEY UPDATE
                    allocated_amount = VALUES(allocated_amount),
                    remaining_balance = VALUES(remaining_balance),
                    status = 'active',
                    closed_at = NULL;

                COMMIT;
            END
        ");

        // ============================================================
        // 9. VIEWS
        // ============================================================
        DB::unprepared("
            CREATE VIEW `v_active_trips` AS
            SELECT
                tt.trip_ticket_id, tt.trip_ticket_number,
                d.department_name,
                CONCAT(u.first_name, ' ', u.last_name) AS driver_name,
                v.vehicle_model, v.plate_number,
                tt.destination, tt.purpose, tt.trip_date, tt.submitted_at,
                TIMESTAMPDIFF(HOUR, tt.submitted_at, NOW()) AS hours_in_status,
                fr.trip_started_at, fr.trip_ended_at,
                CASE
                    WHEN fr.trip_started_at IS NOT NULL AND fr.trip_ended_at IS NULL THEN 'In Transit'
                    WHEN fr.trip_started_at IS NULL THEN 'Not Started'
                    ELSE 'Completed'
                END AS trip_progress
            FROM trip_ticket tt
            JOIN departments d ON tt.department_id = d.department_id
            JOIN drivers dr ON tt.driver_id = dr.driver_id
            JOIN users u ON dr.user_id = u.user_id
            JOIN vehicles v ON tt.vehicle_id = v.vehicle_id
            LEFT JOIN gas_slip gs ON tt.trip_ticket_id = gs.trip_ticket_id
            LEFT JOIN fuel_receipt fr ON gs.gas_slip_id = fr.gas_slip_id
            WHERE tt.status IN ('in_transit', 'funds_issued', 'pending_reconciliation')
            ORDER BY tt.submitted_at DESC
        ");

        DB::unprepared("
            CREATE VIEW `v_department_budget_summary` AS
            SELECT
                d.department_id, d.department_name, d.department_code,
                COUNT(p.period_id) AS total_periods,
                SUM(p.allocated_amount) AS total_allocated,
                SUM(COALESCE(gs.amount_released, 0)) AS total_spent,
                SUM(p.allocated_amount) - SUM(COALESCE(gs.amount_released, 0)) AS total_remaining,
                MAX(CASE WHEN p.status = 'active' THEN p.allocated_amount ELSE 0 END) AS current_weekly_budget,
                MAX(CASE WHEN p.status = 'active' THEN p.week_start ELSE NULL END) AS current_week_start,
                MAX(CASE WHEN p.status = 'active' THEN p.week_end ELSE NULL END) AS current_week_end
            FROM departments d
            LEFT JOIN dept_budget_period p ON d.department_id = p.department_id
            LEFT JOIN gas_slip gs ON p.period_id = gs.period_id
            WHERE d.is_active = 1
            GROUP BY d.department_id, d.department_name, d.department_code
        ");

        DB::unprepared("
            CREATE VIEW `v_fuel_efficiency` AS
            SELECT
                v.vehicle_id, v.vehicle_model, v.plate_number, v.fuel_type,
                d.department_name AS owner_department,
                COUNT(DISTINCT tt.trip_ticket_id) AS total_trips,
                COUNT(fr.fuel_receipt_id) AS trips_with_fuel_data,
                ROUND(SUM(fr.liters_availed), 2) AS total_liters,
                ROUND(AVG(fr.liters_availed), 2) AS avg_liters_per_trip,
                ROUND(SUM(fr.amount_on_receipt), 2) AS total_fuel_cost,
                ROUND(SUM(fr.gps_distance_km), 2) AS total_km,
                ROUND(SUM(fr.liters_availed) / NULLIF(SUM(fr.gps_distance_km), 0) * 100, 2) AS liters_per_100km,
                ROUND(SUM(fr.amount_on_receipt) / NULLIF(SUM(fr.gps_distance_km), 0), 2) AS peso_per_km
            FROM vehicles v
            JOIN departments d ON v.department_id = d.department_id
            LEFT JOIN trip_ticket tt ON v.vehicle_id = tt.vehicle_id
            LEFT JOIN gas_slip gs ON tt.trip_ticket_id = gs.trip_ticket_id
            LEFT JOIN fuel_receipt fr ON gs.gas_slip_id = fr.gas_slip_id
            WHERE v.status = 'active'
            GROUP BY v.vehicle_id, v.vehicle_model, v.plate_number, v.fuel_type, d.department_name
        ");

        DB::unprepared("
            CREATE VIEW `v_remaining_budget` AS
            SELECT
                p.period_id, p.department_id, d.department_name, d.department_code,
                p.week_start, p.week_end, p.allocated_amount,
                COALESCE(SUM(gs.amount_released), 0) AS total_spent_amount,
                p.allocated_amount - COALESCE(SUM(gs.amount_released), 0) AS remaining_amount,
                ROUND(COALESCE(SUM(gs.amount_released), 0) / NULLIF(p.allocated_amount, 0) * 100, 2) AS utilization_percentage,
                CASE WHEN COALESCE(SUM(gs.amount_released), 0) > p.allocated_amount THEN 1 ELSE 0 END AS is_over_budget,
                CASE WHEN (p.allocated_amount - COALESCE(SUM(gs.amount_released), 0)) / NULLIF(p.allocated_amount, 0) * 100 < 10 THEN 1 ELSE 0 END AS is_critical_low_warning,
                CASE WHEN (p.allocated_amount - COALESCE(SUM(gs.amount_released), 0)) / NULLIF(p.allocated_amount, 0) * 100 < 20 THEN 1 ELSE 0 END AS is_low_warning,
                p.status, p.created_at, p.closed_at,
                TO_DAYS(p.week_end) - TO_DAYS(CURDATE()) AS days_remaining_in_period,
                ROUND(COALESCE(SUM(gs.amount_released), 0) / NULLIF(TO_DAYS(CURDATE()) - TO_DAYS(p.week_start), 0), 2) AS avg_daily_spend,
                ROUND(COALESCE(SUM(gs.amount_released), 0) / NULLIF(TO_DAYS(CURDATE()) - TO_DAYS(p.week_start), 0) * 7, 2) AS projected_week_total
            FROM dept_budget_period p
            JOIN departments d ON d.department_id = p.department_id
            LEFT JOIN gas_slip gs ON gs.period_id = p.period_id
            GROUP BY p.period_id, p.department_id, d.department_name, d.department_code,
                     p.week_start, p.week_end, p.allocated_amount, p.status, p.created_at, p.closed_at
        ");
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();

        DB::unprepared("DROP VIEW IF EXISTS `v_remaining_budget`");
        DB::unprepared("DROP VIEW IF EXISTS `v_fuel_efficiency`");
        DB::unprepared("DROP VIEW IF EXISTS `v_department_budget_summary`");
        DB::unprepared("DROP VIEW IF EXISTS `v_active_trips`");

        DB::unprepared("DROP TRIGGER IF EXISTS `trg_log_charge_to_change`");
        DB::unprepared("DROP TRIGGER IF EXISTS `trg_gas_slip_budget_immutable`");

        DB::unprepared("DROP PROCEDURE IF EXISTS `proc_weekly_budget_reset`");

        Schema::dropIfExists('sessions');
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('failed_jobs');
        Schema::dropIfExists('job_batches');
        Schema::dropIfExists('jobs');
        Schema::dropIfExists('cache_locks');
        Schema::dropIfExists('cache');
        Schema::dropIfExists('system_setting');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('audit_log');
        Schema::dropIfExists('cross_department_usage');
        Schema::dropIfExists('gps_ping');
        Schema::dropIfExists('fuel_receipt');
        Schema::dropIfExists('gas_slip');
        Schema::dropIfExists('trip_history');
        Schema::dropIfExists('trip_vehicle_snapshot');
        Schema::dropIfExists('trip_ticket');
        Schema::dropIfExists('vehicles');
        Schema::dropIfExists('weekly_budget_usage');
        Schema::dropIfExists('budget_history');
        Schema::dropIfExists('dept_budget_period');
        Schema::dropIfExists('dept_budget_policy');
        Schema::dropIfExists('annual_budgets');
        Schema::dropIfExists('fiscal_years');
        Schema::dropIfExists('drivers');
        Schema::dropIfExists('users');
        Schema::dropIfExists('departments');

        Schema::enableForeignKeyConstraints();
    }
};
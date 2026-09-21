<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // fuel_receipt verification columns (exist in prod, missing from php.txt)
        if (!Schema::hasColumn('fuel_receipt', 'verification_status')) {
            Schema::table('fuel_receipt', function (Blueprint $table) {
                $table->enum('verification_status', ['pending', 'verified'])->default('pending')->after('receipt_uploaded_at');
                $table->timestamp('verified_at')->nullable()->after('verification_status');
                $table->unsignedBigInteger('verified_by')->nullable()->after('verified_at');
                $table->foreign('verified_by')->references('user_id')->on('users')->onDelete('set null');
            });
        }

        // trip_ticket cancel columns
        if (!Schema::hasColumn('trip_ticket', 'cancelled_by')) {
            Schema::table('trip_ticket', function (Blueprint $table) {
                $table->unsignedBigInteger('cancelled_by')->nullable()->after('closed_by');
                $table->timestamp('cancelled_at')->nullable()->after('cancelled_by');
                $table->text('cancellation_reason')->nullable()->after('cancelled_at');
                $table->foreign('cancelled_by')->references('user_id')->on('users')->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        // Reversible but risky if data exists — leave empty
    }
};
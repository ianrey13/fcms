<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fuel_receipt', function (Blueprint $table) {
            $table->enum('verification_status', ['pending', 'verified'])
                  ->default('pending')
                  ->after('receipt_uploaded_at');

            $table->timestamp('verified_at')->nullable()->after('verification_status');
            $table->unsignedBigInteger('verified_by')->nullable()->after('verified_at');

            $table->foreign('verified_by')
                  ->references('user_id')->on('users')
                  ->onDelete('set null');

            $table->index('verification_status', 'idx_fuel_receipt_verification_status');
        });
    }

    public function down(): void
    {
        Schema::table('fuel_receipt', function (Blueprint $table) {
            $table->dropForeign(['verified_by']);
            $table->dropIndex('idx_fuel_receipt_verification_status');
            $table->dropColumn(['verification_status', 'verified_at', 'verified_by']);
        });
    }
};
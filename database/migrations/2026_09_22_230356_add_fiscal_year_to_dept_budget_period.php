<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dept_budget_period', function (Blueprint $table) {
            $table->year('fiscal_year')->nullable()->after('department_id');
            $table->index(['department_id', 'fiscal_year'], 'idx_budget_period_dept_year');
        });

        // ✅ Backfill existing rows — derive fiscal_year from week_start year
        DB::statement("
            UPDATE dept_budget_period
            SET fiscal_year = YEAR(week_start)
            WHERE fiscal_year IS NULL
        ");
    }

    public function down(): void
    {
        Schema::table('dept_budget_period', function (Blueprint $table) {
            $table->dropIndex('idx_budget_period_dept_year');
            $table->dropColumn('fiscal_year');
        });
    }
};
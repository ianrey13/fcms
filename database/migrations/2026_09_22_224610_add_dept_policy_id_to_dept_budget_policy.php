<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::disableForeignKeyConstraints();

        Schema::table('dept_budget_policy', function (Blueprint $table) {
            // 1. Drop the FK on department_id (can't drop PK while FK exists on MySQL)
            $table->dropForeign(['department_id']);
        });

        Schema::table('dept_budget_policy', function (Blueprint $table) {
            // 2. Drop the PRIMARY on department_id
            $table->dropPrimary();
        });

        Schema::table('dept_budget_policy', function (Blueprint $table) {
            // 3. Add auto-increment PK
            $table->bigIncrements('dept_policy_id')->first();

            // 4. Re-add department_id as FK (still unique-combined with fiscal_year)
            $table->foreign('department_id')
                  ->references('department_id')
                  ->on('departments');
        });

        // 5. Composite unique — one policy per dept per fiscal year
        //    (uses a named index so we can drop it cleanly in `down()`)
        Schema::table('dept_budget_policy', function (Blueprint $table) {
            $table->unique(
                ['department_id', 'fiscal_year'],
                'dept_budget_policy_dept_year_unique'
            );
        });

        Schema::enableForeignKeyConstraints();
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();

        Schema::table('dept_budget_policy', function (Blueprint $table) {
            $table->dropForeign(['department_id']);
            $table->dropUnique('dept_budget_policy_dept_year_unique');
            $table->dropColumn('dept_policy_id');
        });

        Schema::table('dept_budget_policy', function (Blueprint $table) {
            $table->primary('department_id');
            $table->foreign('department_id')
                  ->references('department_id')
                  ->on('departments');
        });

        Schema::enableForeignKeyConstraints();
    }
};
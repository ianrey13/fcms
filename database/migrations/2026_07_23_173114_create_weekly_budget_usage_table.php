// database/migrations/2026_07_23_create_weekly_budget_usage_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('weekly_budget_usage', function (Blueprint $table) {
            $table->id('usage_id');
            $table->foreignId('department_id')->constrained('departments', 'department_id');
            $table->integer('week_number');
            $table->year('year');
            $table->date('week_start');
            $table->date('week_end');
            $table->decimal('amount_used', 12, 2)->default(0);
            $table->timestamps();
            
            $table->unique(['department_id', 'week_number', 'year']);
            $table->index(['department_id', 'year', 'week_number']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('weekly_budget_usage');
    }
};
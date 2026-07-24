// database/migrations/2026_07_24_create_weekly_budget_surplus_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('weekly_budget_surplus', function (Blueprint $table) {
            $table->id('surplus_id');
            $table->foreignId('department_id')->constrained('departments', 'department_id');
            $table->integer('week_number');
            $table->year('year');
            $table->decimal('allocated_amount', 12, 2);
            $table->decimal('actual_used', 12, 2);
            $table->decimal('surplus_amount', 12, 2)->virtualAs('allocated_amount - actual_used');
            $table->enum('action', ['returned_to_annual', 'rolled_over', 'forfeited'])->default('returned_to_annual');
            $table->timestamps();
            
            $table->unique(['department_id', 'week_number', 'year']);
            $table->index(['department_id', 'year', 'week_number']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('weekly_budget_surplus');
    }
};
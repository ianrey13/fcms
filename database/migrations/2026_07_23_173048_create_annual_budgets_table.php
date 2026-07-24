// database/migrations/2026_07_23_create_annual_budgets_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('annual_budgets', function (Blueprint $table) {
            $table->id('budget_id');
            $table->foreignId('department_id')->constrained('departments', 'department_id');
            $table->year('fiscal_year');
            $table->decimal('annual_amount', 12, 2);
            $table->decimal('used_amount', 12, 2)->default(0);
            $table->decimal('remaining_amount', 12, 2)->virtualAs('annual_amount - used_amount');
            $table->enum('status', ['active', 'closed'])->default('active');
            $table->timestamps();
            
            $table->unique(['department_id', 'fiscal_year']);
            $table->index(['department_id', 'fiscal_year', 'status']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('annual_budgets');
    }
};
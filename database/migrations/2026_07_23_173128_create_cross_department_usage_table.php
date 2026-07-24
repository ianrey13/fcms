// database/migrations/2026_07_23_create_cross_department_usage_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('cross_department_usage', function (Blueprint $table) {
            $table->id('usage_id');
            $table->foreignId('from_department_id')->constrained('departments', 'department_id');
            $table->foreignId('to_department_id')->constrained('departments', 'department_id');
            $table->foreignId('gas_slip_id')->constrained('gas_slip', 'gas_slip_id');
            $table->decimal('amount', 12, 2);
            $table->string('reason', 255)->nullable();
            $table->timestamps();
            
            $table->index(['from_department_id', 'to_department_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('cross_department_usage');
    }
};
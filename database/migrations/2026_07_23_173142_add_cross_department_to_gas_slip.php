// database/migrations/2026_07_23_add_cross_department_to_gas_slip.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('gas_slip', function (Blueprint $table) {
            $table->boolean('is_cross_department')->default(false)->after('amount_released');
            $table->foreignId('original_department_id')->nullable()->constrained('departments', 'department_id')->after('is_cross_department');
            $table->string('cross_department_reason', 255)->nullable()->after('original_department_id');
        });
    }

    public function down()
    {
        Schema::table('gas_slip', function (Blueprint $table) {
            $table->dropForeign(['original_department_id']);
            $table->dropColumn(['is_cross_department', 'original_department_id', 'cross_department_reason']);
        });
    }
};
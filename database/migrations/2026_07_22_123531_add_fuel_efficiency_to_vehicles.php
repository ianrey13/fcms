// database/migrations/2026_07_22_add_fuel_efficiency_to_vehicles.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->decimal('fuel_efficiency', 5, 2)->default(10.00)->after('fuel_type');
        });
    }

    public function down()
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn('fuel_efficiency');
        });
    }
};
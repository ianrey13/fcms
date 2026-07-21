// database/migrations/2026_07_21_add_fuel_balance_to_vehicles.php

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->decimal('current_fuel_balance', 10, 2)->default(0)->after('fuel_type');
            $table->decimal('last_odometer_reading', 10, 2)->nullable()->after('current_fuel_balance');
            $table->decimal('fuel_capacity', 10, 2)->default(60.00)->after('last_odometer_reading');
        });
    }

    public function down()
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn([
                'current_fuel_balance',
                'last_odometer_reading',
                'fuel_capacity'
            ]);
        });
    }
};
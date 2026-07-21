// database/migrations/2026_07_21_add_monitoring_fields_to_trip_ticket.php

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('trip_ticket', function (Blueprint $table) {
            // Actual Trip Data
            $table->decimal('actual_distance_km', 10, 2)->nullable()->after('estimated_fuel_liters');
            $table->decimal('actual_fuel_used', 10, 2)->nullable()->after('actual_distance_km');
            
            // Fuel Balance
            $table->decimal('fuel_balance_before', 10, 2)->nullable()->after('actual_fuel_used');
            $table->decimal('fuel_balance_after', 10, 2)->nullable()->after('fuel_balance_before');
            
            // Odometer Readings
            $table->decimal('odometer_start', 10, 2)->nullable()->after('fuel_balance_after');
            $table->decimal('odometer_end', 10, 2)->nullable()->after('odometer_start');
            
            // Flag for fuel without trip
            $table->boolean('is_fuel_issued_without_trip')->default(false)->after('odometer_end');
        });
    }

    public function down()
    {
        Schema::table('trip_ticket', function (Blueprint $table) {
            $table->dropColumn([
                'actual_distance_km',
                'actual_fuel_used',
                'fuel_balance_before',
                'fuel_balance_after',
                'odometer_start',
                'odometer_end',
                'is_fuel_issued_without_trip'
            ]);
        });
    }
};
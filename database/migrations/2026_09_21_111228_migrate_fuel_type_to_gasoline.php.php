<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Map existing premium → gasoline (3 prod rows)
        DB::statement("UPDATE vehicles SET fuel_type = 'gasoline' WHERE fuel_type = 'premium'");
        DB::statement("UPDATE trip_vehicle_snapshot SET fuel_type = 'gasoline' WHERE fuel_type = 'premium'");

        // Also catch 'regular' just in case any row exists anywhere
        DB::statement("UPDATE vehicles SET fuel_type = 'gasoline' WHERE fuel_type = 'regular'");
        DB::statement("UPDATE trip_vehicle_snapshot SET fuel_type = 'gasoline' WHERE fuel_type = 'regular'");

        // Now safe to alter the enum
        DB::statement("ALTER TABLE vehicles MODIFY fuel_type ENUM('gasoline','diesel') NOT NULL");
        DB::statement("ALTER TABLE trip_vehicle_snapshot MODIFY fuel_type ENUM('gasoline','diesel') NOT NULL");
    }

    public function down(): void
    {
        // Reverse: expand enum first (data stays as 'gasoline')
        DB::statement("ALTER TABLE vehicles MODIFY fuel_type ENUM('regular','premium','diesel','gasoline') NOT NULL");
        DB::statement("ALTER TABLE trip_vehicle_snapshot MODIFY fuel_type ENUM('regular','premium','diesel','gasoline') NOT NULL");
    }
};
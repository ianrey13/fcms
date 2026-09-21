<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Step 1: EXPAND the enum to include 'gasoline' alongside old values
        DB::statement("ALTER TABLE vehicles MODIFY fuel_type ENUM('regular','premium','diesel','gasoline') NOT NULL");
        DB::statement("ALTER TABLE trip_vehicle_snapshot MODIFY fuel_type ENUM('regular','premium','diesel','gasoline') NOT NULL");

        // Step 2: Now safe to migrate the data
        DB::statement("UPDATE vehicles SET fuel_type = 'gasoline' WHERE fuel_type IN ('premium', 'regular')");
        DB::statement("UPDATE trip_vehicle_snapshot SET fuel_type = 'gasoline' WHERE fuel_type IN ('premium', 'regular')");

        // Step 3: SHRINK the enum to only new values
        DB::statement("ALTER TABLE vehicles MODIFY fuel_type ENUM('gasoline','diesel') NOT NULL");
        DB::statement("ALTER TABLE trip_vehicle_snapshot MODIFY fuel_type ENUM('gasoline','diesel') NOT NULL");
    }

    public function down(): void
    {
        // Expand first so data can be reverted (though 'gasoline' → 'regular' is lossy)
        DB::statement("ALTER TABLE vehicles MODIFY fuel_type ENUM('regular','premium','diesel','gasoline') NOT NULL");
        DB::statement("ALTER TABLE trip_vehicle_snapshot MODIFY fuel_type ENUM('regular','premium','diesel','gasoline') NOT NULL");
        // Note: cannot know which was premium vs regular — leave as-is
    }
};
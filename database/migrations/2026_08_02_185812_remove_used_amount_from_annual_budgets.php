// database/migrations/xxxx_xx_xx_remove_used_amount_from_annual_budgets.php

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('annual_budgets', function (Blueprint $table) {
            // ✅ Remove used_amount column
            $table->dropColumn('used_amount');
        });
    }

    public function down()
    {
        Schema::table('annual_budgets', function (Blueprint $table) {
            // Rollback: Add back used_amount
            $table->decimal('used_amount', 12, 2)->default(0)->after('weekly_ceiling');
        });
    }
};
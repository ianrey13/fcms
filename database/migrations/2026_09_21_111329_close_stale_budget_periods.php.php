<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Close any active period whose week_end already passed,
        // only when the same department has a newer active period.
        DB::statement("
            UPDATE dept_budget_period p1
            SET status = 'closed',
                closed_at = NOW()
            WHERE p1.status = 'active'
              AND p1.week_end < CURDATE()
              AND EXISTS (
                  SELECT 1 FROM (
                      SELECT department_id, MAX(week_start) AS latest
                      FROM dept_budget_period
                      WHERE status = 'active'
                      GROUP BY department_id
                  ) p2
                  WHERE p2.department_id = p1.department_id
                    AND p2.latest > p1.week_start
              )
        ");
    }

    public function down(): void
    {
        // Cannot safely reverse — leave as-is
    }
};
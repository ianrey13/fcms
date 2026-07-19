<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WeeklyBudgetReset extends Command
{
    protected $signature = 'budget:reset';
    protected $description = 'Reset weekly budget for all departments';

    public function handle()
    {
        try {
            DB::statement('CALL proc_weekly_budget_reset();');
            $this->info('✅ Weekly budget reset completed!');
            Log::info('Weekly budget reset executed successfully');
        } catch (\Exception $e) {
            $this->error('❌ Reset failed: ' . $e->getMessage());
            Log::error('Weekly budget reset failed: ' . $e->getMessage());
        }
    }
}
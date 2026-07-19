<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // Weekly budget reset - runs every Monday at 12:00 AM Manila time
        $schedule->call(function () {
            try {
                DB::statement('CALL proc_weekly_budget_reset();');
                Log::info('✅ Weekly budget reset executed successfully via Laravel Scheduler');
            } catch (\Exception $e) {
                Log::error('❌ Weekly budget reset failed: ' . $e->getMessage());
            }
        })->weekly()->mondays()->at('00:00')->timezone('Asia/Manila');
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
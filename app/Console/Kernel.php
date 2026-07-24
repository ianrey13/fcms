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
    protected function schedule(Schedule $schedule)
{
    // ✅ Every Monday at 8:00 AM - Send weekly budget alert
    $schedule->call(function () {
        $this->sendWeeklyBudgetAlert();
    })->weekly()->mondays()->at('08:00');
    
    // ✅ Every Monday at 8:30 AM - Process previous week surplus
    $schedule->call(function () {
        $budgetService = app(\App\Services\BudgetService::class);
        $results = $budgetService->processAllWeeklySurplus();
        
        Log::info('Weekly surplus processed', ['results' => $results]);
    })->weekly()->mondays()->at('08:30');
}

private function sendWeeklyBudgetAlert()
{
    $users = DB::table('users')
        ->where('role', 'mayors_office')
        ->where('status', 'active')
        ->get();
    
    foreach ($users as $user) {
        // Send notification
        DB::table('notifications')->insert([
            'recipient_user_id' => $user->user_id,
            'notification_type' => 'weekly_budget_alert',
            'entity_type' => 'budget',
            'entity_id' => 0,
            'message' => "📅 NEW WEEK ALERT!\n\n" .
                         "Please set weekly budget allocations for all departments.\n" .
                         "Last week's surplus has been returned to annual budgets.\n" .
                         "Check Weekly Tracking for details.",
            'channel' => 'in_app',
            'created_at' => now(),
        ]);
    }
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
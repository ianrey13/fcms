<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule)
    {
        // ✅ EVERY MONDAY - Weekly Budget Reset (Primary)
        $schedule->command('budget:reset')
            ->weeklyOn(1, '00:00')  // Monday at 12:00 AM
            ->withoutOverlapping()
            ->runInBackground()
            ->appendOutputTo(storage_path('logs/budget-reset.log'));

        // ✅ EVERY MONDAY - Fallback reset (if primary fails)
        $schedule->command('budget:reset --force')
            ->weeklyOn(1, '01:00')  // Monday at 1:00 AM (fallback)
            ->withoutOverlapping()
            ->runInBackground()
            ->appendOutputTo(storage_path('logs/budget-reset-fallback.log'));

        // ✅ EVERY MONDAY - Check if reset was successful (2:00 AM)
        $schedule->call(function () {
            $this->verifyBudgetReset();
        })->weeklyOn(1, '02:00');

        // ✅ Every Monday at 7:00 AM - Send weekly budget alert
        $schedule->call(function () {
            $this->sendWeeklyBudgetAlert();
        })->weekly()->mondays()->at('07:00');

        // ✅ Every Monday at 8:00 AM - Process previous week surplus
        $schedule->call(function () {
            $budgetService = app(\App\Services\BudgetService::class);
            $results = $budgetService->processAllWeeklySurplus();
            
            Log::info('Weekly surplus processed', ['results' => $results]);
        })->weekly()->mondays()->at('08:00');

        // ✅ EVERY 5 MINUTES - Emergency check (if reset not done)
        $schedule->call(function () {
            $this->emergencyBudgetReset();
        })->hourly();

        // ✅ EVERY HOUR - Log scheduler status
        $schedule->call(function () {
            Log::info('🔄 Laravel scheduler is running at ' . Carbon::now()->toDateTimeString());
        })->hourly();

        // ✅ DAILY - Clean old logs
        $schedule->command('logs:clean')
            ->daily()
            ->at('23:00');

        // ✅ NEW: DAILY - Auto-cancel stale trips (> 7 days without progress)
        $schedule->call(function () {
            $this->autoCancelStaleTrips();
        })->daily()->at('03:00');

        // ✅ NEW: HOURLY - Sync actual_distance_km for active trips
        $schedule->call(function () {
            $this->syncActiveTripActuals();
        })->hourly();
    }

    /**
     * ✅ Verify if budget reset was successful
     */
    private function verifyBudgetReset()
    {
        try {
            $today = Carbon::now();
            $currentWeek = $today->weekOfYear;
            $currentYear = $today->year;
            
            $resetDone = DB::table('weekly_budget_usage')
                ->where('week_number', $currentWeek)
                ->where('year', $currentYear)
                ->exists();
            
            if ($resetDone) {
                Log::info('✅ Weekly budget reset verified successfully', [
                    'week' => $currentWeek,
                    'year' => $currentYear,
                ]);
            } else {
                Log::warning('⚠️ Weekly budget reset verification failed - running emergency reset');
                
                DB::statement('CALL proc_weekly_budget_reset();');
                
                DB::table('budget_history')->insert([
                    'department_id' => 0,
                    'department_name' => 'ALL DEPARTMENTS',
                    'action' => 'weekly_reset',
                    'previous_amount' => 0,
                    'added_amount' => 0,
                    'new_amount' => 0,
                    'reason' => 'Emergency weekly budget reset (verification failed)',
                    'user_id' => 1,
                    'user_name' => 'System',
                    'created_at' => now(),
                ]);
                
                Log::info('✅ Emergency weekly budget reset completed (verification)');
            }
        } catch (\Exception $e) {
            Log::error('❌ Budget reset verification failed: ' . $e->getMessage());
        }
    }

    /**
     * ✅ Emergency budget reset (runs every 5 minutes)
     */
    private function emergencyBudgetReset()
    {
        try {
            $today = Carbon::now();
            $currentWeek = $today->weekOfYear;
            $currentYear = $today->year;
            
            // ✅ Only check on Monday or Tuesday (if reset was missed)
            $shouldCheck = $today->dayOfWeek === Carbon::MONDAY || $today->dayOfWeek === Carbon::TUESDAY;
            
            if (!$shouldCheck) {
                return;
            }
            
            // ✅ Check if reset was done this week
            $resetDone = DB::table('weekly_budget_usage')
                ->where('week_number', $currentWeek)
                ->where('year', $currentYear)
                ->exists();
            
            if (!$resetDone) {
                Log::warning('⚠️ Weekly budget reset not done. Running emergency reset...');
                
                DB::statement('CALL proc_weekly_budget_reset();');
                
                DB::table('budget_history')->insert([
                    'department_id' => 0,
                    'department_name' => 'ALL DEPARTMENTS',
                    'action' => 'weekly_reset',
                    'previous_amount' => 0,
                    'added_amount' => 0,
                    'new_amount' => 0,
                    'reason' => 'Emergency weekly budget reset (5-min check)',
                    'user_id' => 1,
                    'user_name' => 'System',
                    'created_at' => now(),
                ]);
                
                Log::info('✅ Emergency weekly budget reset completed (5-min check)');
            }
        } catch (\Exception $e) {
            Log::error('❌ Emergency budget reset failed: ' . $e->getMessage());
        }
    }

    /**
     * Send weekly budget alert to Mayor's Office
     */
    private function sendWeeklyBudgetAlert()
    {
        try {
            $weekNumber = Carbon::now()->weekOfYear;
            $weekStart = Carbon::now()->startOfWeek()->toDateString();
            $weekEnd = Carbon::now()->endOfWeek()->toDateString();
            
            $departments = DB::table('departments')
                ->where('is_active', 1)
                ->get();
            
            $deptList = "";
            $totalAllocation = 0;
            
            foreach ($departments as $dept) {
                $policy = DB::table('dept_budget_policy')
                    ->where('department_id', $dept->department_id)
                    ->first();
                    
                $allocation = $policy ? $policy->default_weekly_allocation : 0;
                $totalAllocation += $allocation;
                $deptList .= "  • {$dept->department_name}: ₱" . number_format($allocation, 2) . "\n";
            }

            $activePeriods = DB::table('dept_budget_period')
                ->where('status', 'active')
                ->count();

            $users = DB::table('users')
                ->where('role', 'mayors_office')
                ->where('status', 'active')
                ->get();

            foreach ($users as $user) {
                DB::table('notifications')->insert([
                    'recipient_user_id' => $user->user_id,
                    'notification_type' => 'weekly_budget_alert',
                    'entity_type' => 'budget',
                    'entity_id' => 0,
                    'message' => "📅 NEW WEEK ALERT!\n\n" .
                                 "Week #{$weekNumber}: {$weekStart} - {$weekEnd}\n" .
                                 "📊 Status: " . ($activePeriods > 0 ? "✅ Active" : "⚠️ No Active Periods") . "\n\n" .
                                 "📋 Weekly Allocations:\n" .
                                 $deptList .
                                 "─────────────────────\n" .
                                 "💰 Total: ₱" . number_format($totalAllocation, 2) . "\n\n" .
                                 "💡 Actions:\n" .
                                 "• Review and adjust weekly budgets\n" .
                                 "• Check surplus from last week\n" .
                                 "• Set new allocations if needed\n\n" .
                                 "🔗 Go to Weekly Tracking page to manage budgets.",
                    'channel' => 'in_app',
                    'created_at' => now(),
                ]);
            }

            Log::info('📧 Weekly budget alert sent to ' . $users->count() . ' users');

        } catch (\Exception $e) {
            Log::error('❌ Failed to send weekly budget alert: ' . $e->getMessage());
        }
    }

    /**
     * ✅ NEW: Auto-cancel stale trips (stuck > 7 days without progress)
     * 
     * Trips in active statuses that haven't been updated in 7 days
     * are auto-cancelled to free up vehicles.
     */
    private function autoCancelStaleTrips()
    {
        try {
            $staleDate = Carbon::now()->subDays(7);

            $activeStatuses = [
                \App\Models\TripTicket::STATUS_PENDING_MAYORS_OFFICE,
                \App\Models\TripTicket::STATUS_RETURNED_FOR_REVISION,
                \App\Models\TripTicket::STATUS_FUNDS_ISSUED,
                \App\Models\TripTicket::STATUS_ACKNOWLEDGED,
                \App\Models\TripTicket::STATUS_IN_TRANSIT,
                \App\Models\TripTicket::STATUS_COMPLETED,
                \App\Models\TripTicket::STATUS_PENDING_GSO_VALIDATION,
            ];

            $staleTrips = \App\Models\TripTicket::whereIn('status', $activeStatuses)
                ->where('updated_at', '<', $staleDate)
                ->whereNull('closed_at')
                ->whereNull('cancelled_at')
                ->get();

            if ($staleTrips->isEmpty()) {
                Log::info('✅ Auto-cancel check: No stale trips found');
                return;
            }

            $cancelledCount = 0;

            foreach ($staleTrips as $trip) {
                $trip->status = \App\Models\TripTicket::STATUS_CANCELLED;
                $trip->cancellation_reason = 'Auto-cancelled: No progress for 7+ days';
                $trip->cancelled_at = now();
                $trip->cancelled_by = null; // System
                $trip->save();

                $cancelledCount++;

                Log::warning('⚠️ Auto-cancelled stale trip', [
                    'trip_ticket_id' => $trip->trip_ticket_id,
                    'trip_ticket_number' => $trip->trip_ticket_number,
                    'last_status' => $trip->status,
                    'last_updated' => $trip->updated_at,
                ]);
            }

            Log::info("✅ Auto-cancelled {$cancelledCount} stale trips (>7 days)");

        } catch (\Exception $e) {
            Log::error('❌ Auto-cancel stale trips failed: ' . $e->getMessage());
        }
    }

    /**
     * ✅ NEW: Sync actual_distance_km for active trips hourly
     * 
     * Keeps the summary column fresh while the trip is in progress.
     * Runs hourly to avoid heavy load.
     */
    private function syncActiveTripActuals()
    {
        try {
            $activeTrips = \App\Models\TripTicket::whereIn('status', [
                \App\Models\TripTicket::STATUS_IN_TRANSIT,
                \App\Models\TripTicket::STATUS_COMPLETED,
            ])->get();

            $syncedCount = 0;

            foreach ($activeTrips as $trip) {
                $trip->syncActuals()->save();
                $syncedCount++;
            }

            if ($syncedCount > 0) {
                Log::info("✅ Synced actuals for {$syncedCount} active trips");
            }

        } catch (\Exception $e) {
            Log::error('❌ Sync active trip actuals failed: ' . $e->getMessage());
        }
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__ . '/Commands');

        require base_path('routes/console.php');
    }
}
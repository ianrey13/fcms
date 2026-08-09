<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class CheckWeeklyBudgetReset
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        // ✅ Only check if user is authenticated and is Mayor's Office
        if (auth()->check() && auth()->user()->role === 'mayors_office') {
            $this->checkAndReset();
        }

        return $next($request);
    }

    /**
     * ✅ Check and reset weekly budget if needed
     */
    private function checkAndReset()
    {
        try {
            $today = Carbon::now();
            $currentWeek = $today->weekOfYear;
            $currentYear = $today->year;
            
            // ✅ Check if reset was already done this week
            $resetDone = DB::table('weekly_budget_usage')
                ->where('week_number', $currentWeek)
                ->where('year', $currentYear)
                ->exists();
            
            // ✅ If not reset yet, run the reset
            if (!$resetDone) {
                Log::info('🔄 Weekly budget reset triggered by middleware (page load)', [
                    'user_id' => auth()->id(),
                    'user_email' => auth()->user()->email,
                    'week' => $currentWeek,
                    'year' => $currentYear,
                ]);
                
                // ✅ Call the stored procedure
                DB::statement('CALL proc_weekly_budget_reset();');
                
                // ✅ Log the reset in budget history
                DB::table('budget_history')->insert([
                    'department_id' => 0,
                    'department_name' => 'ALL DEPARTMENTS',
                    'action' => 'weekly_reset',
                    'previous_amount' => 0,
                    'added_amount' => 0,
                    'new_amount' => 0,
                    'reason' => 'Weekly budget reset triggered by middleware (Week ' . $currentWeek . ')',
                    'user_id' => auth()->id() ?? 1,
                    'user_name' => auth()->user()->full_name ?? 'System',
                    'created_at' => now(),
                ]);
                
                Log::info('✅ Weekly budget reset completed (middleware trigger)', [
                    'user_id' => auth()->id(),
                    'week' => $currentWeek,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('❌ Weekly budget reset failed (middleware): ' . $e->getMessage());
            // Don't break the page if reset fails
        }
    }
}
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class WeeklyBudgetReset extends Command
{
    protected $signature = 'budget:reset {--force : Force reset even if not Monday} {--dry-run : Show what would be reset without actually resetting}';
    
    protected $description = 'Reset weekly budget for all departments (runs automatically every Monday)';

    public function handle()
    {
        $isDryRun = $this->option('dry-run');
        $force = $this->option('force');
        
        // Check if it's Monday or forced
        if (!$force && Carbon::now()->dayOfWeek !== Carbon::MONDAY) {
            $this->warn('⚠️ Today is not Monday. Use --force to reset anyway.');
            $this->info('Next scheduled reset: ' . Carbon::now()->next(Carbon::MONDAY)->toDateString());
            return 0;
        }

        $this->info('🔄 Starting weekly budget reset...');
        $this->line('📅 Date: ' . Carbon::now()->toDateTimeString());
        $this->line('📆 Week: ' . Carbon::now()->weekOfYear);
        $this->newLine();

        try {
            if ($isDryRun) {
                $this->info('🔍 DRY RUN - No actual changes will be made');
                $this->showCurrentBudgetStatus();
                return 0;
            }

            // ✅ Get current active periods before reset
            $beforePeriods = DB::table('dept_budget_period')
                ->where('status', 'active')
                ->get();

            $this->line('📊 Active periods before reset: ' . $beforePeriods->count());

            // ✅ Execute the reset
            DB::statement('CALL proc_weekly_budget_reset();');

            // ✅ Get new active periods after reset
            $afterPeriods = DB::table('dept_budget_period')
                ->where('status', 'active')
                ->get();

            $this->newLine();
            $this->info('✅ Weekly budget reset completed successfully!');
            $this->line('📊 Active periods after reset: ' . $afterPeriods->count());

            // ✅ Log the reset
            $this->logBudgetReset($beforePeriods, $afterPeriods);

            // ✅ Show summary
            $this->showResetSummary($afterPeriods);

        } catch (\Exception $e) {
            $this->error('❌ Reset failed: ' . $e->getMessage());
            Log::error('❌ Weekly budget reset failed: ' . $e->getMessage());
            Log::error($e->getTraceAsString());
            return 1;
        }

        return 0;
    }

    private function showCurrentBudgetStatus()
    {
        $periods = DB::table('dept_budget_period as dbp')
            ->join('departments as d', 'dbp.department_id', '=', 'd.department_id')
            ->where('dbp.status', 'active')
            ->select(
                'd.department_name',
                'dbp.week_start',
                'dbp.allocated_amount',
                'dbp.remaining_balance'
            )
            ->get();

        if ($periods->isEmpty()) {
            $this->line('📊 No active budget periods found');
            return;
        }

        $this->table(
            ['Department', 'Week Start', 'Allocated', 'Remaining'],
            $periods->map(function ($p) {
                return [
                    $p->department_name,
                    $p->week_start,
                    '₱' . number_format($p->allocated_amount, 2),
                    '₱' . number_format($p->remaining_balance, 2),
                ];
            })
        );
    }

    private function showResetSummary($periods)
    {
        if ($periods->isEmpty()) {
            $this->line('⚠️ No active budget periods after reset');
            return;
        }

        $this->newLine();
        $this->line('📊 NEW BUDGET PERIODS:');
        
        $this->table(
            ['Department', 'Week Start', 'Allocated', 'Remaining'],
            $periods->map(function ($p) {
                $dept = DB::table('departments')
                    ->where('department_id', $p->department_id)
                    ->first();
                    
                return [
                    $dept->department_name ?? 'Unknown',
                    $p->week_start,
                    '₱' . number_format($p->allocated_amount, 2),
                    '₱' . number_format($p->remaining_balance, 2),
                ];
            })
        );
    }

    private function logBudgetReset($beforePeriods, $afterPeriods)
    {
        try {
            $user = auth()->user();
            
            $userId = $user ? $user->user_id : 1;
            $userName = $user ? $user->full_name : 'System';

            DB::table('budget_history')->insert([
                'department_id' => 0,
                'department_name' => 'ALL DEPARTMENTS',
                'action' => 'weekly_reset',
                'previous_amount' => $beforePeriods->sum('allocated_amount'),
                'added_amount' => $afterPeriods->sum('allocated_amount') - $beforePeriods->sum('allocated_amount'),
                'new_amount' => $afterPeriods->sum('allocated_amount'),
                'reason' => 'Weekly budget reset for week ' . Carbon::now()->weekOfYear . ' (' . Carbon::now()->startOfWeek()->toDateString() . ' to ' . Carbon::now()->endOfWeek()->toDateString() . ')',
                'user_id' => $userId,
                'user_name' => $userName,
                'created_at' => now(),
            ]);

            $this->line('📝 Budget history logged');

        } catch (\Exception $e) {
            Log::warning('Failed to log budget reset: ' . $e->getMessage());
        }
    }
}
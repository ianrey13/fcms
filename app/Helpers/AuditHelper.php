<?php

namespace App\Helpers;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Facades\Log;

class AuditHelper
{
    /**
     * Get the current user ID, or null if not authenticated
     */
    private static function getUserId()
    {
        $userId = Auth::id();
        
        if (!$userId) {
            $user = request()->user();
            if ($user) {
                $userId = $user->user_id;
            }
        }
        
        return $userId ?: null;
    }

    /**
     * Log a custom activity with explicit user ID
     */
    private static function logWithUserId(int $userId, string $action, string $tableName, int $recordId, array $oldValues = null, array $newValues = null)
    {
        try {
            Log::info('📝 AuditHelper::logWithUserId called', [
                'action' => $action,
                'table_name' => $tableName,
                'record_id' => $recordId,
                'user_id' => $userId,
            ]);

            AuditLog::create([
                'user_id' => $userId,
                'action' => $action,
                'table_name' => $tableName,
                'record_id' => $recordId,
                'old_values' => $oldValues ? json_encode($oldValues) : null,
                'new_values' => $newValues ? json_encode($newValues) : null,
                'ip_address' => Request::ip(),
                'created_at' => now(),
            ]);

            Log::info('✅ Audit log created successfully');
        } catch (\Exception $e) {
            Log::error('❌ Failed to log audit: ' . $e->getMessage());
        }
    }

    /**
     * Log a custom activity (uses Auth::id())
     */
    public static function log(string $action, string $tableName, int $recordId, array $oldValues = null, array $newValues = null)
    {
        try {
            $userId = self::getUserId();
            
            Log::info('📝 AuditHelper::log called', [
                'action' => $action,
                'table_name' => $tableName,
                'record_id' => $recordId,
                'user_id' => $userId ?? 'NULL',
            ]);

            if (!$userId) {
                Log::warning('⚠️ No valid user ID found, skipping audit log');
                return;
            }

            AuditLog::create([
                'user_id' => $userId,
                'action' => $action,
                'table_name' => $tableName,
                'record_id' => $recordId,
                'old_values' => $oldValues ? json_encode($oldValues) : null,
                'new_values' => $newValues ? json_encode($newValues) : null,
                'ip_address' => Request::ip(),
                'created_at' => now(),
            ]);

            Log::info('✅ Audit log created successfully');
        } catch (\Exception $e) {
            Log::error('❌ Failed to log audit: ' . $e->getMessage());
        }
    }

    /**
     * Log user login - PASS USER ID EXPLICITLY
     */
    public static function logLogin($user)
    {
        $userId = $user->user_id;
        
        self::logWithUserId(
            $userId,
            'login',
            'users',
            $userId,
            null,
            [
                'email' => $user->email, 
                'role' => $user->role, 
                'name' => $user->full_name
            ]
        );
    }

    /**
     * Log user logout - PASS USER ID EXPLICITLY
     */
    public static function logLogout($user)
    {
        $userId = $user->user_id;
        
        self::logWithUserId(
            $userId,
            'logout',
            'users',
            $userId,
            ['email' => $user->email, 'role' => $user->role],
            null
        );
    }

    /**
     * Log fund release
     */
    public static function logFundRelease($ticket, $amount, $department)
    {
        self::log(
            'fund_released',
            'trip_ticket',
            $ticket->trip_ticket_id,
            ['status' => $ticket->status],
            [
                'ticket_number' => $ticket->trip_ticket_number,
                'amount' => $amount,
                'department' => $department,
                'status' => $ticket->status,
            ]
        );
    }

    /**
     * Log trip status change
     */
    public static function logTripStatusChange($ticket, $oldStatus, $newStatus)
    {
        self::log(
            'status_change',
            'trip_ticket',
            $ticket->trip_ticket_id,
            ['status' => $oldStatus],
            [
                'status' => $newStatus,
                'ticket_number' => $ticket->trip_ticket_number,
                'changed_at' => now()->toDateTimeString(),
            ]
        );
    }

    /**
     * Log budget change
     */
    public static function logBudgetChange($department, $oldAmount, $newAmount, $reason)
    {
        self::log(
            'budget_change',
            'dept_budget_period',
            $department->department_id ?? 0,
            ['allocated_amount' => $oldAmount],
            [
                'allocated_amount' => $newAmount,
                'department' => $department->department_name ?? 'Unknown',
                'reason' => $reason,
            ]
        );
    }

    /**
     * Log GSO trip creation
     */
    public static function logGsoCreateTrip($ticket)
    {
        self::log(
            'gso_created_trip',
            'trip_ticket',
            $ticket->trip_ticket_id,
            null,
            [
                'ticket_number' => $ticket->trip_ticket_number,
                'department' => $ticket->department?->department_name,
                'destination' => $ticket->destination,
                'driver' => $ticket->driver?->user?->full_name,
            ]
        );
    }

    /**
     * Log MO approval
     */
    public static function logMoApproval($ticket, $amount)
    {
        self::log(
            'mo_approved',
            'trip_ticket',
            $ticket->trip_ticket_id,
            ['status' => $ticket->status],
            [
                'status' => 'funds_issued',
                'amount_released' => $amount,
                'ticket_number' => $ticket->trip_ticket_number,
            ]
        );
    }

    /**
     * Log receipt verification
     */
    public static function logReceiptVerification($receipt, $gasSlip)
    {
        self::log(
            'receipt_verified',
            'fuel_receipt',
            $receipt->fuel_receipt_id,
            ['reconciliation_status' => $gasSlip->reconciliation_status],
            [
                'reconciliation_status' => 'verified',
                'receipt_id' => $receipt->fuel_receipt_id,
                'amount' => $receipt->amount_on_receipt,
                'liters' => $receipt->liters_availed,
            ]
        );
    }
}
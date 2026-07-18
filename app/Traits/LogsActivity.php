<?php

namespace App\Traits;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Facades\Log;

trait LogsActivity
{
    public static function bootLogsActivity()
    {
        static::created(function ($model) {
            $model->logActivity('created');
        });

        static::updated(function ($model) {
            $model->logActivity('updated');
        });

        static::deleted(function ($model) {
            $model->logActivity('deleted');
        });
    }

    protected function logActivity(string $action)
    {
        try {
            // ✅ Get the current user ID
            $userId = Auth::id();
            if (!$userId) {
                $user = request()->user();
                if ($user) {
                    $userId = $user->user_id;
                }
            }

            // ✅ Skip if no valid user
            if (!$userId) {
                Log::warning('⚠️ No valid user ID for activity log, skipping');
                return;
            }

            $oldValues = null;
            $newValues = null;

            if ($action === 'updated') {
                $oldValues = $this->getOriginal();
                $newValues = $this->getAttributes();
                
                // Remove sensitive data
                unset($oldValues['password_hash'], $oldValues['remember_token']);
                unset($newValues['password_hash'], $newValues['remember_token']);
                
                // Only log if there are actual changes
                if (empty(array_diff_assoc($newValues, $oldValues))) {
                    return;
                }
            }

            if ($action === 'created') {
                $newValues = $this->getAttributes();
                unset($newValues['password_hash'], $newValues['remember_token']);
            }

            if ($action === 'deleted') {
                $oldValues = $this->getAttributes();
                unset($oldValues['password_hash'], $oldValues['remember_token']);
            }

            AuditLog::create([
                'user_id' => $userId,
                'action' => $action,
                'table_name' => $this->getTable(),
                'record_id' => $this->getKey(),
                'old_values' => $oldValues ? json_encode($oldValues) : null,
                'new_values' => $newValues ? json_encode($newValues) : null,
                'ip_address' => Request::ip(),
                'created_at' => now(),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to log activity: ' . $e->getMessage());
        }
    }
}
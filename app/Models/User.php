<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use App\Traits\LogsActivity;


class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, LogsActivity;
    
    protected $table = 'users';
    protected $primaryKey = 'user_id';
    
    // ============ ROLE CONSTANTS ============
    public const ROLE_GSO_OFFICE = 'gso_office';
    public const ROLE_MAYORS_OFFICE = 'mayors_office';
    public const ROLE_DRIVER = 'driver';
    
    // ============ STATUS CONSTANTS ============
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    
    protected $fillable = [
        'department_id', 'first_name', 'middle_name', 'last_name', 'email','employee_number',
        'password_hash', 'role', 'can_drive', 'esignature_path', 'esignature_hash',
        'status', 'last_login_at', 'failed_login_attempts', 'locked_until',
        'account_locked_until', 'deactivated_at', 'deactivated_by',
        'deactivation_reason', 'password_changed_at'
    ];
    
    protected $hidden = ['password_hash'];
    
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'last_login_at' => 'datetime',
        'deactivated_at' => 'datetime',
        'password_changed_at' => 'datetime',
        'locked_until' => 'datetime',
        'account_locked_until' => 'datetime',
        'can_drive' => 'boolean',
        'failed_login_attempts' => 'integer',
    ];
    
    // ============ AUTO-GENERATE EMPLOYEE NUMBER ============
    protected static function booted()
    {
        static::creating(function ($user) {
            // Auto-generate employee number if not provided
            if (empty($user->employee_number)) {
                $user->employee_number = $user->generateEmployeeNumber();
            }
        });
    }

    /**
     * Generate a unique employee number
     * Format: EMP-XXXX (4-digit padded)
     */
    public function generateEmployeeNumber()
    {
        // Get the last employee number
        $lastUser = static::where('employee_number', 'like', 'EMP-%')
            ->orderBy('user_id', 'desc')
            ->first();

        if ($lastUser && $lastUser->employee_number) {
            // Extract the number and increment
            $lastNumber = intval(substr($lastUser->employee_number, 4));
            $newNumber = $lastNumber + 1;
        } else {
            $newNumber = 1;
        }

        return 'EMP-' . str_pad($newNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Get the next employee number (for preview)
     */
    public static function getNextEmployeeNumber()
    {
        $lastUser = static::where('employee_number', 'like', 'EMP-%')
            ->orderBy('user_id', 'desc')
            ->first();

        if ($lastUser && $lastUser->employee_number) {
            $lastNumber = intval(substr($lastUser->employee_number, 4));
            $newNumber = $lastNumber + 1;
        } else {
            $newNumber = 1;
        }

        return 'EMP-' . str_pad($newNumber, 4, '0', STR_PAD_LEFT);
    }
    
    // ============ AUTHENTICATION ============
    public function getAuthPassword()
    {
        return $this->password_hash;
    }
    
    // ============ ACCESSORS ============
    public function getFullNameAttribute()
    {
        return trim($this->first_name . ' ' . ($this->middle_name ? $this->middle_name . ' ' : '') . $this->last_name);
    }
    
    // ============ ROLE CHECK METHODS ============
    public function isGsoOffice()
    {
        return $this->role === self::ROLE_GSO_OFFICE;
    }
    
    public function isMayorsOffice()
    {
        return $this->role === self::ROLE_MAYORS_OFFICE;
    }
    
    
    public function isDriver()
    {
        return $this->role === self::ROLE_DRIVER;
    }
    
    public function isActive()
    {
        return $this->status === self::STATUS_ACTIVE;
    }
    
    public function canDrive()
    {
        return $this->can_drive && $this->driver;
    }
    
    // ============ RELATIONSHIPS ============
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }
    
    public function driver()
    {
        return $this->hasOne(Driver::class, 'user_id', 'user_id');
    }
    
    public function submittedTripTickets()
    {
        return $this->hasMany(TripTicket::class, 'submitted_by', 'user_id');
    }
    
    public function moCreatedTripTickets()
    {
        return $this->hasMany(TripTicket::class, 'created_by_mo_user_id', 'user_id');
    }
    
    public function gasSlipsCreated()
    {
        return $this->hasMany(GasSlip::class, 'created_by', 'user_id');
    }
    
    public function gasSlipsReconciled()
    {
        return $this->hasMany(GasSlip::class, 'reconciled_by', 'user_id');
    }
    
    public function gasSlipsAcknowledged()
    {
        return $this->hasMany(GasSlip::class, 'receipt_acknowledged_by', 'user_id');
    }
    
    public function notifications()
    {
        return $this->hasMany(Notification::class, 'recipient_user_id', 'user_id');
    }
    
    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class, 'user_id', 'user_id');
    }
    
    public function tripTicketReturns()
    {
        return $this->hasMany(TripTicketReturn::class, 'actioned_by', 'user_id');
    }
    
    public function tripTicketCancellations()
    {
        return $this->hasMany(TripTicketCancellation::class, 'cancelled_by', 'user_id');
    }
    
    public function tripTicketCancellationsFundReturned()
    {
        return $this->hasMany(TripTicketCancellation::class, 'fund_returned_by', 'user_id');
    }
    
    public function systemSettingsUpdated()
    {
        return $this->hasMany(SystemSetting::class, 'updated_by', 'user_id');
    }
    
    public function uploadedFiles()
    {
        return $this->hasMany(FileStorage::class, 'uploaded_by', 'user_id');
    }
    
    public function deletedFiles()
    {
        return $this->hasMany(FileStorage::class, 'deleted_by', 'user_id');
    }
    
    public function deactivatedDrivers()
    {
        return $this->hasMany(Driver::class, 'deactivated_by', 'user_id');
    }
    
    public function deactivatedVehicles()
    {
        return $this->hasMany(Vehicle::class, 'deactivated_by', 'user_id');
    }
    
    public function deactivatedUsers()
    {
        return $this->hasMany(User::class, 'deactivated_by', 'user_id');
    }
}
<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // ============================================================
        // 1. Create (or fetch) the General Services Office department
        // ============================================================
        $gsoDepartmentId = DB::table('departments')
            ->where('department_code', 'GSO')
            ->value('department_id');

        if (!$gsoDepartmentId) {
            $gsoDepartmentId = DB::table('departments')->insertGetId([
                'department_name' => 'General Services Office',
                'department_code' => 'GSO',
                'head_of_office'  => 'GSO Head',
                'is_active'       => 1,
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);

            $this->command->info("✓ Created GSO department (ID: {$gsoDepartmentId})");
        } else {
            $this->command->info("→ GSO department already exists (ID: {$gsoDepartmentId})");
        }

        // ============================================================
        // 2. Create (or update) the GSO admin user
        // ============================================================
        $adminEmail = 'gso@fmcs.com';   // ⚠️ Note: you wrote "fmcs" — double-check!
        $adminPassword = 'password123';

        $existing = DB::table('users')->where('email', $adminEmail)->first();

        if ($existing) {
            // Update existing record so re-running the seeder keeps password in sync
            DB::table('users')
                ->where('user_id', $existing->user_id)
                ->update([
                    'department_id'        => $gsoDepartmentId,
                    'first_name'           => 'GSO',
                    'middle_name'          => null,
                    'last_name'            => 'Admin',
                    'password_hash'        => Hash::make($adminPassword),
                    'role'                 => 'gso_office',
                    'can_drive'            => 0,
                    'status'               => 'active',
                    'updated_at'           => now(),
                    'password_changed_at'  => now(),
                ]);

            $this->command->info("✓ Updated existing GSO admin (user_id: {$existing->user_id})");
        } else {
            // Generate a unique employee number (EMP-0001, EMP-0002, ...)
            $lastEmployeeNumber = DB::table('users')
                ->where('employee_number', 'like', 'EMP-%')
                ->orderByDesc('employee_number')
                ->value('employee_number');

            $nextNumber = 1;
            if ($lastEmployeeNumber && preg_match('/EMP-(\d+)/', $lastEmployeeNumber, $m)) {
                $nextNumber = (int) $m[1] + 1;
            }
            $employeeNumber = 'EMP-' . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);

            DB::table('users')->insert([
                'department_id'         => $gsoDepartmentId,
                'first_name'            => 'GSO',
                'middle_name'           => null,
                'last_name'             => 'Admin',
                'email'                 => $adminEmail,
                'employee_number'       => $employeeNumber,
                'password_hash'         => Hash::make($adminPassword),
                'role'                  => 'gso_office',
                'can_drive'             => 0,
                'esignature_path'       => null,
                'esignature_hash'       => null,
                'status'                => 'active',
                'created_at'            => now(),
                'updated_at'            => now(),
                'failed_login_attempts' => 0,
                'password_changed_at'   => now(),
            ]);

            $this->command->info("✓ Created GSO admin: {$adminEmail} / {$adminPassword}");
        }

        // ============================================================
        // 3. (Optional) Seed default system settings
        // ============================================================
        $defaultSettings = [
            'mayor_name'                     => 'Mayor',
            'system_name'                    => 'FCMS',
            'system_timezone'                => 'Asia/Manila',
            'date_format'                    => 'Y-m-d',
            'gps_ping_interval_seconds'      => '30',
            'gps_accuracy_threshold_meters'  => '50',
            'notification_retention_days'    => '30',
            'email_notifications_enabled'    => '1',
            'push_notifications_enabled'     => '1',
        ];

        foreach ($defaultSettings as $key => $value) {
            DB::table('system_setting')->updateOrInsert(
                ['setting_key' => $key],
                ['setting_value' => $value, 'updated_at' => now()]
            );
        }

        $this->command->info('✓ System settings seeded');
        $this->command->newLine();
        $this->command->info('═══════════════════════════════════════════');
        $this->command->info('  LOGIN CREDENTIALS');
        $this->command->info('  Email   : ' . $adminEmail);
        $this->command->info('  Password: ' . $adminPassword);
        $this->command->info('═══════════════════════════════════════════');
    }
}
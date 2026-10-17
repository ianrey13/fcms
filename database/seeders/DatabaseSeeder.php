<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ============================================================
        // HELPER — allocate next EMP-#### number
        // ============================================================
        $nextEmployeeNumber = function (): string {
            $last = DB::table('users')
                ->where('employee_number', 'like', 'EMP-%')
                ->orderByDesc('employee_number')
                ->value('employee_number');

            $next = 1;
            if ($last && preg_match('/EMP-(\d+)/', $last, $m)) {
                $next = (int) $m[1] + 1;
            }
            return 'EMP-' . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
        };

        // ============================================================
        // HELPER — upsert a user by email (safe to re-run)
        // ============================================================
        $upsertUser = function (array $data) use ($nextEmployeeNumber): int {
            $existing = DB::table('users')->where('email', $data['email'])->first();

            if ($existing) {
                $payload = collect($data)->except(['email', 'employee_number'])->toArray();
                $payload['updated_at'] = now();
                DB::table('users')->where('user_id', $existing->user_id)->update($payload);
                $this->command->info("✓ Updated user: {$data['email']} (user_id: {$existing->user_id})");
                return $existing->user_id;
            }

            $payload = $data + [
                'employee_number'       => $nextEmployeeNumber(),
                'status'                => 'active',
                'created_at'            => now(),
                'updated_at'            => now(),
                'failed_login_attempts' => 0,
                'password_changed_at'   => now(),
            ];
            $id = DB::table('users')->insertGetId($payload);
            $this->command->info("✓ Created user: {$data['email']} (user_id: {$id})");
            return $id;
        };

        // ============================================================
        // 1. DEPARTMENTS — GSO + Engineering Office
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

        $engrDepartmentId = DB::table('departments')
            ->where('department_code', 'ENGR')
            ->value('department_id');

        if (!$engrDepartmentId) {
            // Fallback: check by name in case a row exists with a different code
            $engrDepartmentId = DB::table('departments')
                ->where('department_name', 'like', '%Engineering%')
                ->value('department_id');
        }

        if (!$engrDepartmentId) {
            $engrDepartmentId = DB::table('departments')->insertGetId([
                'department_name' => 'Engineering Office',
                'department_code' => 'ENGR',
                'head_of_office'  => 'Engineering Head',
                'is_active'       => 1,
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);
            $this->command->info("✓ Created Engineering Office department (ID: {$engrDepartmentId})");
        } else {
            $this->command->info("→ Engineering Office already exists (ID: {$engrDepartmentId})");
        }

        // ============================================================
        // 2. USERS — GSO Admin, MO Officer, Engineering Driver
        // ============================================================

        $adminPassword = 'password123';

        // ---- GSO Admin ----
        $upsertUser([
            'department_id' => $gsoDepartmentId,
            'first_name'    => 'GSO',
            'middle_name'   => null,
            'last_name'     => 'Admin',
            'email'         => 'gso@fcms.com',
            'password_hash' => Hash::make($adminPassword),
            'role'          => 'gso_office',
            'can_drive'     => 0,
        ]);

        // ---- Mayor's Office (Disbursing Officer) ----
        $moUserId = $upsertUser([
            'department_id' => $gsoDepartmentId, // MO is under GSO-shared services in this setup
            'first_name'    => 'Maria',
            'middle_name'   => null,
            'last_name'     => 'Santos',
            'email'         => 'mo@fcms.com',
            'password_hash' => Hash::make($adminPassword),
            'role'          => 'mayors_office',
            'can_drive'     => 0,
        ]);

        // ---- Engineering Driver ----
        $driverUserId = $upsertUser([
            'department_id' => $engrDepartmentId,
            'first_name'    => 'Juan',
            'middle_name'   => null,
            'last_name'     => 'Dela Cruz',
            'email'         => 'driver@fcms.com',
            'password_hash' => Hash::make($adminPassword),
            'role'          => 'driver',
            'can_drive'     => 1,
        ]);

        // ============================================================
        // 3. DRIVERS — attach Engineering driver to drivers table
        // ============================================================

        $existingDriver = DB::table('drivers')->where('user_id', $driverUserId)->first();

        if ($existingDriver) {
            DB::table('drivers')
                ->where('driver_id', $existingDriver->driver_id)
                ->update(['status' => 'active', 'updated_at' => now()]);
            $this->command->info("✓ Driver record already exists for Juan Dela Cruz (driver_id: {$existingDriver->driver_id})");
        } else {
            $driverId = DB::table('drivers')->insertGetId([
                'user_id'    => $driverUserId,
                'status'     => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->command->info("✓ Created driver record (driver_id: {$driverId})");
        }

        // ============================================================
        // 4. DEFAULT SYSTEM SETTINGS
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

        // ============================================================
        // 5. SUMMARY
        // ============================================================

        $this->command->newLine();
        $this->command->info('═══════════════════════════════════════════');
        $this->command->info('  PANEL DEMO CREDENTIALS');
        $this->command->info('  ─────────────────────────────────────');
        $this->command->info('  GSO Admin');
        $this->command->info('    Email   : gso@fcms.com');
        $this->command->info('    Password: ' . $adminPassword);
        $this->command->info('');
        $this->command->info('  Mayor\'s Office (Disbursing Officer)');
        $this->command->info('    Email   : mo@fcms.com');
        $this->command->info('    Password: ' . $adminPassword);
        $this->command->info('');
        $this->command->info('  Driver (Engineering Office)');
        $this->command->info('    Email   : driver@fcms.com');
        $this->command->info('    Password: ' . $adminPassword);
        $this->command->info('');
        $this->command->info('  Department: Engineering Office (code: ENGR)');
        $this->command->info('═══════════════════════════════════════════');
    }
}
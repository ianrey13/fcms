<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\Department;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class CreateAdminUser extends Command
{
    protected $signature = 'fcms:create-admin {email} {password}';
    protected $description = 'Create a super admin user for FCMS';
    
    public function handle()
    {
        $email = $this->argument('email');
        $password = $this->argument('password');
        
        // Check if department exists, if not create default
        $department = Department::first();
        if (!$department) {
            $department = Department::create([
                'department_name' => 'System Administration',
                'department_code' => 'SYSADMIN'
            ]);
            $this->info('Created default department: System Administration');
        }
        
        $user = User::create([
            'email' => $email,
            'password_hash' => Hash::make($password),
            'first_name' => 'Super',
            'last_name' => 'Admin',
            'department_id' => $department->department_id,
            'role' => User::ROLE_SUPERADMIN,
            'status' => User::STATUS_ACTIVE
        ]);
        
        $this->info("Super admin user created successfully!");
        $this->info("Email: {$email}");
        $this->info("Password: {$password}");
        
        return Command::SUCCESS;
    }
}
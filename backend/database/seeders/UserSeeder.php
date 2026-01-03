<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // System Admin in QA Office
        User::create([
            'name'          => 'System Admin',
            'email'         => 'admin@example.com',
            'password'      => Hash::make('password'),
            'role_id'       => 1, // Super Admin
            'department_id' => 1, // Quality Assurance Office
            'status'        => 'active',
        ]);

        // Staff in QA
        User::create([
            'name'          => 'CCS Admin User',
            'email'         => 'ccs.admin@example.com',
            'password'      => Hash::make('password'),
            'role_id'       => 2, // Admin
            'department_id' => 2, // QA
            'status'        => 'active',
        ]);

        // Staff in Nursing example (change department_id when you add it)
        User::create([
            'name'          => 'CCS Staff User',
            'email'         => 'ccs.staff@example.com',
            'password'      => Hash::make('password'),
            'role_id'       => 3, // Staff
            'department_id' => 2, // College of Computer Studies
            'status'        => 'active',
        ]);
    }
}

<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // Super Admin in QA
        User::updateOrCreate(
            ['email' => 'superadmin.qa@example.com'],
            [
                'name'          => 'QA Super Admin',
                'password'      => Hash::make('password'),
                'role_id'       => 1, // Super Admin
                'department_id' => 1, // QA
                'status'        => 'active',
            ]
        );

        // Admin in QA
        User::updateOrCreate(
            ['email' => 'admin.qa@example.com'],
            [
                'name'          => 'QA Admin',
                'password'      => Hash::make('password'),
                'role_id'       => 2, // Admin
                'department_id' => 1, // QA
                'status'        => 'active',
            ]
        );

        // Staff in QA
        User::updateOrCreate(
            ['email' => 'staff.qa@example.com'],
            [
                'name'          => 'QA Staff',
                'password'      => Hash::make('password'),
                'role_id'       => 3, // Staff
                'department_id' => 1, // QA
                'status'        => 'active',
            ]
        );

        // Admin in CCS
        User::updateOrCreate(
            ['email' => 'admin.ccs@example.com'],
            [
                'name'          => 'CCS Admin',
                'password'      => Hash::make('password'),
                'role_id'       => 2, // Admin
                'department_id' => 2, // CCS
                'status'        => 'active',
            ]
        );

        // Staff in CCS
        User::updateOrCreate(
            ['email' => 'staff.ccs@example.com'],
            [
                'name'          => 'CCS Staff',
                'password'      => Hash::make('password'),
                'role_id'       => 3, // Staff
                'department_id' => 2, // CCS
                'status'        => 'active',
            ]
        );
    }
}

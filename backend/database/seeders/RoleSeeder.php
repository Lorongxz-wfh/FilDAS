<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        // Explicit IDs so 1/2/3 are stable
        Role::updateOrCreate(
            ['id' => 1],
            ['name' => 'Super Admin', 'description' => 'All access to all departments and settings']
        );

        Role::updateOrCreate(
            ['id' => 2],
            ['name' => 'Admin', 'description' => 'Manage users and files in own department only']
        );

        Role::updateOrCreate(
            ['id' => 3],
            ['name' => 'Staff', 'description' => 'Manage files in own department only']
        );
    }
}

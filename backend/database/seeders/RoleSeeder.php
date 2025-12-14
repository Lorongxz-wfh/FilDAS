<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        Role::insert([
            ['name' => 'Admin', 'description' => 'Full access'],
            ['name' => 'Staff',        'description' => 'Regular user'],
            ['name' => 'Viewer',       'description' => 'Read-only'],
        ]);
    }
}

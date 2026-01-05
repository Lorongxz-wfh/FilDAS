<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            DepartmentTypeSeeder::class,
            DepartmentSeeder::class,
            DocumentTypeSeeder::class,
            UserSeeder::class,
        ]);
    }
}

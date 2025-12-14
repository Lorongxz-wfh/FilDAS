<?php
// database/seeders/DepartmentSeeder.php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Department;

class DepartmentSeeder extends Seeder
{
    public function run(): void
    {
        $departments = [
            ['name' => 'Quality Assurance Office', 'code' => 'QA',],
            ['name' => 'College of Computer Studies', 'code' => 'CCS',],
            ['name' => 'College of Business Administration', 'code' => 'CBA',],
            ['name' => 'College of Teacher Education', 'code' => 'CTE',],
            ['name' => 'Office of Student Affairs', 'code' => 'OSA',],
        ];

        foreach ($departments as $dept) {
            Department::create($dept);
        }
    }
}

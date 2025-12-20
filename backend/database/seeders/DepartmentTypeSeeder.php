<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\DepartmentType;

class DepartmentTypeSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            ['name' => 'Higher Education', 'description' => 'Colleges and academic units'],
            ['name' => 'Basic Education',  'description' => 'Grade school, high school departments'],
            ['name' => 'Office',           'description' => 'Administrative and support offices'],
        ];

        foreach ($types as $type) {
            DepartmentType::create($type);
        }
    }
}

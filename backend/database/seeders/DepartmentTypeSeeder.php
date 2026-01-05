<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\DepartmentType;

class DepartmentTypeSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            ['id' => 1, 'name' => 'Higher Education', 'description' => 'Colleges and academic units'],
            ['id' => 2, 'name' => 'Basic Education',  'description' => 'Grade school, high school departments'],
            ['id' => 3, 'name' => 'Office',           'description' => 'Administrative and support offices'],
        ];

        foreach ($types as $type) {
            DepartmentType::updateOrCreate(
                ['id' => $type['id']],
                ['name' => $type['name'], 'description' => $type['description']]
            );
        }
    }
}

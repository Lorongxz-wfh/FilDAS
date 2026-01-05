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
            [
                'id'                   => 1,
                'name'                 => 'Quality Assurance',
                'code'                 => 'QA',
                'description'          => 'Quality Assurance Office',
                'department_type_id'   => 3,   // Office
                'is_qa'                => true,
                'is_active'            => true,
            ],
            [
                'id'                   => 2,
                'name'                 => 'College of Computer Studies',
                'code'                 => 'CCS',
                'description'          => 'College of Computer Studies',
                'department_type_id'   => 1,   // Higher Education
                'is_qa'                => false,
                'is_active'            => true,
            ],
        ];

        foreach ($departments as $dept) {
            Department::updateOrCreate(
                ['id' => $dept['id']],
                $dept
            );
        }
    }
}

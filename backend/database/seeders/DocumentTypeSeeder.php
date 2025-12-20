<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\DocumentType;

class DocumentTypeSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            ['name' => 'Policy',                'description' => 'Policies and manuals'],
            ['name' => 'Accreditation Evidence', 'description' => 'Evidence files for QA and accreditation'],
            ['name' => 'Report',                'description' => 'Reports and summaries'],
            ['name' => 'Minutes',               'description' => 'Minutes of meetings'],
            ['name' => 'Form/Template',         'description' => 'Blank forms and templates'],
        ];

        foreach ($types as $type) {
            DocumentType::create($type);
        }
    }
}

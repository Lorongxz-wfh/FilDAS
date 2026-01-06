<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_versions', function (Blueprint $table) {
            $table->id();

            // Parent document
            $table->foreignId('document_id')
                ->constrained('documents')
                ->onDelete('cascade');

            // Sequential version number: 1, 2, 3...
            $table->unsignedInteger('version_number');

            // File data for this version
            $table->string('file_path');
            $table->string('original_filename');
            $table->string('mime_type');
            $table->bigInteger('size_bytes');

            // Who uploaded this version
            $table->foreignId('uploaded_by')
                ->constrained('users')
                ->onDelete('cascade');

            $table->timestamps();

            // One version number per document
            $table->unique(['document_id', 'version_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_versions');
    }
};

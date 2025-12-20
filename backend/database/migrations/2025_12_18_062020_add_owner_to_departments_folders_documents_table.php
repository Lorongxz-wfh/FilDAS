<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Departments: optional owner (e.g., department head)
        Schema::table('departments', function (Blueprint $table) {
            $table->foreignId('owner_id')
                ->nullable()
                ->after('description')
                ->constrained('users')
                ->nullOnDelete();
        });

        // Folders: optional owner
        Schema::table('folders', function (Blueprint $table) {
            $table->foreignId('owner_id')
                ->nullable()
                ->after('department_id')
                ->constrained('users')
                ->nullOnDelete();
        });

        // Documents: optional owner (defaults to uploader in code)
        Schema::table('documents', function (Blueprint $table) {
            $table->foreignId('owner_id')
                ->nullable()
                ->after('uploaded_by')
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('owner_id');
        });

        Schema::table('folders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('owner_id');
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('owner_id');
        });
    }
};

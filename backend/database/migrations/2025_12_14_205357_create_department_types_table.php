<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('department_types', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // e.g. Higher Education, Basic Education, Office
            $table->string('description')->nullable();
            $table->timestamps();
        });

        Schema::table('departments', function (Blueprint $table) {
            $table->foreignId('department_type_id')
                ->nullable()
                ->after('id')
                ->constrained('department_types');
        });
    }

    public function down(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->dropForeign(['department_type_id']);
            $table->dropColumn('department_type_id');
        });

        Schema::dropIfExists('department_types');
    }
};

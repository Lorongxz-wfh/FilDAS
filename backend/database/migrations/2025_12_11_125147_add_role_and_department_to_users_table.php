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
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')->nullable()->after('id')->constrained('roles');
            $table->foreignId('department_id')->nullable()->after('role_id')->constrained('departments');

            // Add soft delete column
            $table->softDeletes(); // adds deleted_at
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['role_id']);
            $table->dropColumn('role_id');

            $table->dropForeign(['department_id']);
            $table->dropColumn('department_id');

            $table->dropSoftDeletes();
        });
    }
};

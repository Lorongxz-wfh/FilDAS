<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->string('logo_path')->nullable()->after('owner_id');
            $table->string('theme_color', 20)->nullable()->after('logo_path');
            $table->boolean('is_active')->default(true)->after('theme_color');
        });
    }

    public function down(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->dropColumn(['logo_path', 'theme_color', 'is_active']);
        });
    }
};

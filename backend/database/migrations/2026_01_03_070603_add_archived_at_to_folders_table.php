<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('folders', function (Blueprint $table) {
            // Place next to deleted_at / timestamps for clarity
            $table->timestamp('archived_at')
                ->nullable()
                ->after('deleted_at')
                ->index();
        });
    }

    public function down(): void
    {
        Schema::table('folders', function (Blueprint $table) {
            $table->dropColumn('archived_at');
        });
    }
};

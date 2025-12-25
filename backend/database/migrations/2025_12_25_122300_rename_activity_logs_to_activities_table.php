<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('activity_logs') && ! Schema::hasTable('activities')) {
            Schema::rename('activity_logs', 'activities');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('activities') && ! Schema::hasTable('activity_logs')) {
            Schema::rename('activities', 'activity_logs');
        }
    }
};

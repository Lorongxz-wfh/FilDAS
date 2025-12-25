<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('activity_logs', 'activities');
    }

    public function down(): void
    {
        Schema::rename('activities', 'activity_logs');
    }
};

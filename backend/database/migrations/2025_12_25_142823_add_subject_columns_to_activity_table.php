<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activities', function (Blueprint $table) {
            if (!Schema::hasColumn('activities', 'subject_type')) {
                $table->string('subject_type')->nullable()->after('user_id');
            }
            if (!Schema::hasColumn('activities', 'subject_id')) {
                $table->unsignedBigInteger('subject_id')->nullable()->after('subject_type');
                $table->index(['subject_type', 'subject_id']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('activities', function (Blueprint $table) {
            $table->dropIndex(['subject_type', 'subject_id']);
            $table->dropColumn(['subject_type', 'subject_id']);
        });
    }
};

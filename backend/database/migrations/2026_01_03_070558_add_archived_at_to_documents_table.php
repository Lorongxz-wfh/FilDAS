<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            // archived_at: separate from deleted_at so we can still soft-delete later if needed
            $table->timestamp('archived_at')
                ->nullable()
                ->after('uploaded_at')
                ->index();
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn('archived_at');
        });
    }
};

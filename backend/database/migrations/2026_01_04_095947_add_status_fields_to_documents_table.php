<?php
// database/migrations/xxxx_xx_xx_xxxxxx_add_status_fields_to_documents_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->string('status')
                ->default('pending')
                ->after('document_type_id'); // adjust position if you want

            $table->unsignedBigInteger('approved_by')
                ->nullable()
                ->after('status');

            $table->timestamp('approved_at')
                ->nullable()
                ->after('approved_by');

            $table->foreign('approved_by')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropForeign(['approved_by']);
            $table->dropColumn(['status', 'approved_by', 'approved_at']);
        });
    }
};

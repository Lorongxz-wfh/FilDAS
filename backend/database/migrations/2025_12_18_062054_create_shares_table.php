<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shares', function (Blueprint $table) {
            $table->id();

            // Who owns / initiated the share
            $table->foreignId('owner_id')
                ->constrained('users')
                ->cascadeOnDelete();

            // Who receives access
            $table->foreignId('target_user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            // What is shared: either a document OR a folder
            $table->foreignId('document_id')
                ->nullable()
                ->constrained('documents')
                ->cascadeOnDelete();

            $table->foreignId('folder_id')
                ->nullable()
                ->constrained('folders')
                ->cascadeOnDelete();

            // e.g. 'view', 'edit'
            $table->string('permission')->default('view');

            $table->timestamps();

            // Ensure not both are null at DB level as much as possible
            $table->unique(['target_user_id', 'document_id', 'folder_id'], 'shares_unique_target_item');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shares');
    }
};

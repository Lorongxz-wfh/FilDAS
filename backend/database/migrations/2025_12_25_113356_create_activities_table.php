<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activities', function (Blueprint $table) {
            $table->id();

            // Who did it
            $table->foreignId('user_id')->constrained()->onDelete('cascade');

            // What was affected (polymorphic: can be Document or Folder)
            $table->string('subject_type'); // "App\\Models\\Document" or "App\\Models\\Folder"
            $table->unsignedBigInteger('subject_id');

            // What happened
            $table->string('action'); // "downloaded", "uploaded", "updated", "shared", "deleted"

            // Optional details (e.g., "renamed from X to Y", "shared with user@example.com")
            $table->text('details')->nullable();

            $table->timestamps();

            // Indexes for faster queries
            $table->index(['subject_type', 'subject_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activities');
    }
};

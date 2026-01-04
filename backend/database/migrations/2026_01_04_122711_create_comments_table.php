<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comments', function (Blueprint $table) {
            $table->id();

            // Polymorphic: can attach to documents or folders later
            $table->string('commentable_type');
            $table->unsignedBigInteger('commentable_id');

            $table->unsignedBigInteger('user_id');
            $table->text('body');

            $table->timestamps();

            $table->index(['commentable_type', 'commentable_id']);
            $table->foreign('user_id')
                ->references('id')->on('users')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comments');
    }
};

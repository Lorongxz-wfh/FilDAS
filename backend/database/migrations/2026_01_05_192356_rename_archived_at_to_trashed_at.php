<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB; // ADD THIS


return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->timestamp('trashed_at')->nullable()->after('trashd_at');
        });

        Schema::table('folders', function (Blueprint $table) {
            $table->timestamp('trashed_at')->nullable()->after('trashd_at');
        });

        // Copy existing values
        DB::table('documents')->update(['trashed_at' => DB::raw('trashd_at')]);
        DB::table('folders')->update(['trashed_at' => DB::raw('trashd_at')]);
    }

    public function down()
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn('trashed_at');
        });

        Schema::table('folders', function (Blueprint $table) {
            $table->dropColumn('trashed_at');
        });
    }
};

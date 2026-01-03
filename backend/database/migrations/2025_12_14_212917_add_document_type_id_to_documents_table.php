    <?php

    use Illuminate\Database\Migrations\Migration;
    use Illuminate\Database\Schema\Blueprint;
    use Illuminate\Support\Facades\Schema;

    return new class extends Migration
    {
        /**
         * Run the migrations.
         */
        public function up(): void
        {
            Schema::table('documents', function (Blueprint $table) {
                $table->unsignedBigInteger('document_type_id')->nullable()->after('department_id');
                $table->foreign('document_type_id')->references('id')->on('document_types')->onDelete('set null');
            });
        }

        public function down(): void
        {
            Schema::table('documents', function (Blueprint $table) {
                $table->dropForeign(['document_type_id']);
                $table->dropColumn('document_type_id');
            });
        }
    };

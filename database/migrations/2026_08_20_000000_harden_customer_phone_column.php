<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Phone numbers are identifiers, not quantities. Keeping them as a
        // string preserves country prefixes, leading zeroes, and extensions.
        Schema::table('customers', function (Blueprint $table): void {
            $table->string('phone', 30)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->integer('phone')->nullable()->change();
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Upgrade the original customers table in place. It remains the source of
     * truth for clients so existing customer-products and ticket foreign keys
     * continue to work without a data migration.
     */
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->uuid('uuid')->nullable()->after('id');
            $table->enum('type', ['individual', 'company'])->default('individual')->after('uuid')->index();
            $table->string('tax_identifier', 100)->nullable()->after('email');
            $table->text('notes')->nullable()->after('address');

            $table->index('email');
            $table->index('phone');
            $table->index(['last_name', 'first_name']);
        });

        DB::table('customers')
            ->select('id')
            ->orderBy('id')
            ->each(function (object $customer): void {
                DB::table('customers')
                    ->where('id', $customer->id)
                    ->update(['uuid' => (string) Str::uuid()]);
            });

        DB::table('customers')
            ->whereNotNull('company_name')
            ->where('company_name', '<>', '')
            ->update(['type' => 'company']);

        Schema::table('customers', function (Blueprint $table): void {
            $table->uuid('uuid')->nullable(false)->change();
            $table->unique('uuid');
            $table->unique('tax_identifier');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropUnique(['uuid']);
            $table->dropUnique(['tax_identifier']);
            $table->dropIndex(['type']);
            $table->dropIndex(['email']);
            $table->dropIndex(['phone']);
            $table->dropIndex(['last_name', 'first_name']);
            $table->dropColumn(['uuid', 'type', 'tax_identifier', 'notes']);
        });
    }
};

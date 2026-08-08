<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table): void {
            $table->string('slug')->nullable()->after('name');
            $table->text('description')->nullable()->after('slug');
            $table->boolean('active')->default(true)->after('description')->index();
        });

        Schema::table('brands', function (Blueprint $table): void {
            $table->string('slug')->nullable()->after('name');
            $table->string('logo_path')->nullable()->after('logo');
            $table->boolean('active')->default(true)->after('logo_path')->index();
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->uuid('uuid')->nullable()->after('id');
            $table->string('sku')->nullable()->after('uuid');
            $table->string('slug')->nullable()->after('name');
            $table->unsignedSmallInteger('default_warranty_months')->default(12)->after('description');
            $table->boolean('serial_number_required')->default(true)->after('default_warranty_months');
            $table->boolean('active')->default(true)->after('serial_number_required')->index();
        });

        $this->backfillSlugs('categories');
        $this->backfillSlugs('brands');
        $this->backfillProducts();

        DB::table('brands')
            ->whereNull('logo_path')
            ->whereNotNull('logo')
            ->update(['logo_path' => DB::raw('logo')]);

        Schema::table('categories', function (Blueprint $table): void {
            $table->string('slug')->nullable(false)->change();
            $table->unique('slug');
        });

        Schema::table('brands', function (Blueprint $table): void {
            $table->string('slug')->nullable(false)->change();
            $table->unique('slug');
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->uuid('uuid')->nullable(false)->change();
            $table->string('sku')->nullable(false)->change();
            $table->string('slug')->nullable(false)->change();
            $table->unique('uuid');
            $table->unique('sku');
            $table->unique('slug');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropUnique(['uuid']);
            $table->dropUnique(['sku']);
            $table->dropUnique(['slug']);
            $table->dropIndex(['active']);
            $table->dropColumn(['uuid', 'sku', 'slug', 'default_warranty_months', 'serial_number_required', 'active']);
        });

        Schema::table('brands', function (Blueprint $table): void {
            $table->dropUnique(['slug']);
            $table->dropIndex(['active']);
            $table->dropColumn(['slug', 'logo_path', 'active']);
        });

        Schema::table('categories', function (Blueprint $table): void {
            $table->dropUnique(['slug']);
            $table->dropIndex(['active']);
            $table->dropColumn(['slug', 'description', 'active']);
        });
    }

    private function backfillSlugs(string $table): void
    {
        DB::table($table)
            ->select('id', 'name')
            ->orderBy('id')
            ->each(function (object $record) use ($table): void {
                DB::table($table)
                    ->where('id', $record->id)
                    ->update(['slug' => $this->uniqueSlug($table, (string) $record->name, (int) $record->id)]);
            });
    }

    private function backfillProducts(): void
    {
        DB::table('products')
            ->select('id', 'name')
            ->orderBy('id')
            ->each(function (object $product): void {
                DB::table('products')
                    ->where('id', $product->id)
                    ->update([
                        'uuid' => (string) Str::uuid(),
                        'sku' => sprintf('SKU-%06d', $product->id),
                        'slug' => $this->uniqueSlug('products', (string) $product->name, (int) $product->id),
                    ]);
            });
    }

    private function uniqueSlug(string $table, string $value, int $id): string
    {
        $base = Str::slug($value);
        $base = $base !== '' ? $base : sprintf('%s-%d', Str::singular($table), $id);
        $slug = $base;
        $suffix = 2;

        while (DB::table($table)->where('slug', $slug)->exists()) {
            $slug = sprintf('%s-%d', $base, $suffix);
            $suffix++;
        }

        return $slug;
    }
};

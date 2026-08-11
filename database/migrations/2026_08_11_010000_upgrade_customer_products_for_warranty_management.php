<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * The customer_products table is the established purchase ledger used by
     * tickets and invoice items. It becomes the warranty store in place so
     * those relationships remain intact.
     */
    public function up(): void
    {
        Schema::table('customer_products', function (Blueprint $table): void {
            // MySQL needs a non-unique index to keep the existing foreign key
            // valid after the Stage 7 one-to-one constraint is removed.
            $table->index('invoice_item_id');
            $table->dropUnique(['invoice_item_id']);
            $table->uuid('uuid')->nullable()->after('id');
            $table->date('starts_at')->nullable()->after('purchase_date');
            $table->date('expires_at')->nullable()->after('warranty_end');
            $table->enum('status', ['active', 'expired', 'void', 'replaced'])->default('active')->after('expires_at');
            $table->string('void_reason', 1000)->nullable()->after('status');
            $table->text('notes')->nullable()->after('void_reason');
        });

        $today = now()->toDateString();

        DB::table('customer_products')
            ->select(['id', 'purchase_date', 'warranty_end'])
            ->orderBy('id')
            ->each(function (object $purchase) use ($today): void {
                DB::table('customer_products')
                    ->where('id', $purchase->id)
                    ->update([
                        'uuid' => (string) Str::uuid(),
                        'starts_at' => $purchase->purchase_date,
                        'expires_at' => $purchase->warranty_end,
                        'status' => (string) $purchase->warranty_end < $today ? 'expired' : 'active',
                    ]);
            });

        $this->splitLegacyQuantityRows();

        Schema::table('customer_products', function (Blueprint $table): void {
            $table->uuid('uuid')->nullable(false)->change();
            $table->date('starts_at')->nullable(false)->change();
            $table->date('expires_at')->nullable(false)->change();
            $table->unique('uuid');
            $table->index(['customer_id', 'status']);
            $table->index(['product_id', 'status']);
            $table->index(['status', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::table('customer_products', function (Blueprint $table): void {
            $table->dropUnique(['uuid']);
            $table->dropIndex(['customer_id', 'status']);
            $table->dropIndex(['product_id', 'status']);
            $table->dropIndex(['status', 'expires_at']);
            $table->unique('invoice_item_id');
            $table->dropIndex(['invoice_item_id']);
            $table->dropColumn(['uuid', 'starts_at', 'expires_at', 'status', 'void_reason', 'notes']);
        });
    }

    private function splitLegacyQuantityRows(): void
    {
        DB::table('customer_products')
            ->whereNull('serial_number')
            ->where('quantity', '>', 1)
            ->orderBy('id')
            ->each(function (object $purchase): void {
                $quantity = (int) $purchase->quantity;

                DB::transaction(function () use ($purchase, $quantity): void {
                    DB::table('customer_products')
                        ->where('id', $purchase->id)
                        ->update(['quantity' => 1]);

                    for ($unit = 1; $unit < $quantity; $unit++) {
                        DB::table('customer_products')->insert([
                            'uuid' => (string) Str::uuid(),
                            'customer_id' => $purchase->customer_id,
                            'product_id' => $purchase->product_id,
                            'invoice_item_id' => $purchase->invoice_item_id,
                            'serial_number' => null,
                            'quantity' => 1,
                            'purchase_date' => $purchase->purchase_date,
                            'warranty_end' => $purchase->warranty_end,
                            'starts_at' => $purchase->starts_at,
                            'expires_at' => $purchase->expires_at,
                            'status' => $purchase->status,
                            'void_reason' => $purchase->void_reason,
                            'notes' => $purchase->notes,
                            'created_at' => $purchase->created_at,
                            'updated_at' => $purchase->updated_at,
                        ]);
                    }
                });
            });
    }
};

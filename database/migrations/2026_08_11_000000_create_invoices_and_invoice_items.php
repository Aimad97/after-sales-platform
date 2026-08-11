<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table): void {
            $table->id();
            $table->string('invoice_number', 40)->unique();
            $table->foreignId('client_id')->constrained('customers')->restrictOnDelete();
            $table->date('invoice_date')->index();
            $table->decimal('subtotal_amount', 12, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->default(20);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->enum('status', ['draft', 'issued', 'void'])->default('draft')->index();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['client_id', 'status']);
            $table->index(['client_id', 'invoice_date']);
        });

        Schema::create('invoice_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->string('serial_number', 100)->nullable()->unique();
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 12, 2);
            $table->unsignedSmallInteger('warranty_months')->default(0);
            $table->date('warranty_start_date');
            $table->date('warranty_end_date');
            $table->decimal('line_subtotal', 12, 2);
            $table->decimal('line_tax', 12, 2);
            $table->decimal('line_total', 12, 2);
            $table->timestamps();

            $table->index('product_id');
        });

        Schema::table('customer_products', function (Blueprint $table): void {
            $table->foreignId('invoice_item_id')->nullable()->after('product_id')->constrained('invoice_items')->nullOnDelete();
            $table->string('serial_number')->nullable()->change();
            $table->unsignedInteger('quantity')->default(1)->after('serial_number');
            $table->unique('invoice_item_id');
        });
    }

    public function down(): void
    {
        Schema::table('customer_products', function (Blueprint $table): void {
            $table->dropForeign(['invoice_item_id']);
            $table->dropUnique(['invoice_item_id']);
            $table->dropColumn(['invoice_item_id', 'quantity']);
            $table->string('serial_number')->nullable(false)->change();
        });

        Schema::dropIfExists('invoice_items');
        Schema::dropIfExists('invoices');
    }
};

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
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('customer_id')
                ->constrained();
            $table->foreignId('customer_product_id')
                ->constrained();
            $table->foreignId('status_id')
                ->constrained('ticket_statuses');
            $table->foreignId('priority_id')
                ->constrained('ticket_priorities');
            $table->foreignId('created_by')
                ->constrained('users');
            $table->foreignId('assigned_to')
                ->nullable()
                ->constrained('users');
            $table->string('subject');
            $table->text('description');
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};

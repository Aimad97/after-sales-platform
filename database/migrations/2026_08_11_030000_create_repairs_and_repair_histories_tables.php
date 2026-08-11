<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repairs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('ticket_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('technician_id')->constrained('technicians')->restrictOnDelete();
            $table->text('diagnosis')->nullable();
            $table->text('root_cause')->nullable();
            $table->text('repair_action')->nullable();
            $table->text('internal_notes')->nullable();
            $table->text('customer_notes')->nullable();
            $table->decimal('labor_cost', 12, 2)->default(0);
            $table->decimal('parts_cost', 12, 2)->default(0);
            $table->decimal('total_cost', 12, 2)->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('result', 30)->nullable();
            $table->timestamps();

            $table->index(['technician_id', 'completed_at']);
        });

        Schema::create('repair_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('repair_id')->constrained()->cascadeOnDelete();
            $table->string('event', 50);
            $table->json('changes')->nullable();
            $table->foreignId('changed_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['repair_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('repair_histories');
        Schema::dropIfExists('repairs');
    }
};

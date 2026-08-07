<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('technicians', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('employee_code', 50)->unique();
            $table->string('specialization')->nullable()->index();
            $table->unsignedTinyInteger('skill_level')->default(1);
            $table->enum('availability_status', ['available', 'busy', 'unavailable', 'leave'])->default('available');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['availability_status', 'skill_level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('technicians');
    }
};

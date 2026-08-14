<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_exports', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('report_type', 64);
            $table->string('format', 16);
            $table->json('filters');
            $table->string('status', 24)->index();
            $table->string('disk', 64)->nullable();
            $table->string('path')->nullable();
            $table->string('filename')->nullable();
            $table->string('mime_type', 128)->nullable();
            $table->unsignedBigInteger('row_count')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->string('failure_message', 1000)->nullable();
            $table->timestamps();

            $table->index(['requested_by', 'status'], 'report_exports_requester_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_exports');
    }
};

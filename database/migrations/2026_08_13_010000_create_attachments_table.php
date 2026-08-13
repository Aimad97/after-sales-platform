<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attachments', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->morphs('attachable');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('disk', 50);
            $table->string('path');
            $table->string('original_filename', 255);
            $table->string('stored_filename', 120);
            $table->string('mime_type', 150);
            $table->unsignedBigInteger('size');
            $table->timestamps();
            $table->index(['uploaded_by', 'created_at']);
            $table->unique(['disk', 'path']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attachments');
    }
};

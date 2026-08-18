<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table): void {
            $table->index(['deleted_at', 'received_at', 'id'], 'tickets_active_received_idx');
            $table->index(['status', 'closed_at'], 'tickets_status_closed_idx');
            $table->index(['priority', 'status'], 'tickets_priority_status_idx');
            $table->index('created_at', 'tickets_created_at_idx');
        });

        Schema::table('notifications', function (Blueprint $table): void {
            $table->index(
                ['notifiable_type', 'notifiable_id', 'created_at'],
                'notifications_owner_created_idx',
            );
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table): void {
            $table->dropIndex('notifications_owner_created_idx');
        });

        Schema::table('tickets', function (Blueprint $table): void {
            $table->dropIndex('tickets_active_received_idx');
            $table->dropIndex('tickets_status_closed_idx');
            $table->dropIndex('tickets_priority_status_idx');
            $table->dropIndex('tickets_created_at_idx');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'warranty_expiration_notification_logs';

    private const WARRANTY_THRESHOLD_UNIQUE = 'warranty_expiry_notice_unique';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            Schema::create(self::TABLE, function (Blueprint $table): void {
                $table->id();
                $table->foreignId('warranty_id')->constrained('customer_products')->cascadeOnDelete();
                $table->unsignedSmallInteger('days_before_expiry');
                $table->timestamp('notified_at');
                $table->timestamps();
            });
        }

        if (! Schema::hasIndex(self::TABLE, ['warranty_id', 'days_before_expiry'], 'unique')) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->unique(['warranty_id', 'days_before_expiry'], self::WARRANTY_THRESHOLD_UNIQUE);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists(self::TABLE);
    }
};

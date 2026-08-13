<?php

use App\Models\Ticket;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Preserve historical ticket attachment metadata without deleting the
     * legacy table. Its original storage disk cannot be inferred safely, so
     * deployments can configure ATTACHMENTS_LEGACY_DISK before migrating.
     */
    public function up(): void
    {
        if (! Schema::hasTable('ticket_attachments') || ! Schema::hasTable('attachments')) {
            return;
        }

        DB::table('ticket_attachments')
            ->orderBy('id')
            ->each(function (object $legacy): void {
                $path = ltrim(str_replace('\\', '/', (string) $legacy->path), '/');
                $originalFilename = basename(str_replace('\\', '/', (string) $legacy->file_name));
                $originalFilename = (string) preg_replace('/[\x00-\x1F\x7F]/u', '', $originalFilename);

                if ($path === '' || str_starts_with($path, '..') || str_contains($path, '/../')) {
                    return;
                }

                DB::table('attachments')->insertOrIgnore([
                    'uuid' => (string) Str::uuid(),
                    'attachable_type' => Ticket::class,
                    'attachable_id' => $legacy->ticket_id,
                    'uploaded_by' => null,
                    'disk' => (string) config('attachments.legacy_disk', 'local'),
                    'path' => $path,
                    'original_filename' => Str::limit($originalFilename !== '' ? $originalFilename : 'attachment', 255, ''),
                    'stored_filename' => basename(str_replace('\\', '/', $path)),
                    'mime_type' => (string) $legacy->mime_type,
                    'size' => $legacy->size,
                    'created_at' => $legacy->created_at,
                    'updated_at' => $legacy->updated_at,
                ]);
            });
    }

    public function down(): void
    {
        // The migration is intentionally non-destructive. Historical records
        // may coexist until a deployment explicitly retires the legacy table.
    }
};

<?php

namespace App\Services;

use App\Models\Attachment;
use App\Models\Product;
use App\Models\Repair;
use App\Models\Ticket;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class AttachmentCleanupService
{
    /**
     * Delete attachment metadata with its hard-deleted owner, then remove the
     * private blobs only once the database transaction is committed.
     */
    public function purgeFor(Ticket|Product|Repair $owner): void
    {
        $attachments = $owner->attachments()->get();

        if ($attachments->isEmpty()) {
            return;
        }

        /** @var array<string, list<string>> $pathsByDisk */
        $pathsByDisk = [];

        $attachments->each(function (Attachment $attachment) use (&$pathsByDisk): void {
            $pathsByDisk[$attachment->disk] ??= [];
            $pathsByDisk[$attachment->disk][] = $attachment->path;
            $attachment->delete();
        });

        DB::afterCommit(function () use ($pathsByDisk): void {
            foreach ($pathsByDisk as $disk => $paths) {
                if (! Storage::disk($disk)->delete($paths)) {
                    Log::warning('One or more orphaned attachment files could not be removed.', [
                        'disk' => $disk,
                        'paths' => $paths,
                    ]);
                }
            }
        });
    }
}

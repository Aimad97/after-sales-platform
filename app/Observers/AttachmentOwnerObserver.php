<?php

namespace App\Observers;

use App\Models\Product;
use App\Models\Repair;
use App\Models\Ticket;
use App\Services\AttachmentCleanupService;

class AttachmentOwnerObserver
{
    public function __construct(private readonly AttachmentCleanupService $attachments) {}

    public function deleting(Ticket|Product|Repair $owner): void
    {
        if (! $owner instanceof Ticket || ! $owner->isForceDeleting()) {
            return;
        }

        // The repair row is removed by the ticket's database cascade, which
        // does not dispatch a model observer. Purge its polymorphic files
        // while the row can still be resolved.
        $repair = $owner->repair()->first();

        if ($repair !== null) {
            $this->attachments->purgeFor($repair);
        }
    }

    public function deleted(Ticket|Product|Repair $owner): void
    {
        // Soft-deleted tickets retain their private files so a later restore
        // preserves the service record. Files are purged only on force delete.
        if ($owner instanceof Ticket && ! $owner->isForceDeleting()) {
            return;
        }

        $this->attachments->purgeFor($owner);
    }
}

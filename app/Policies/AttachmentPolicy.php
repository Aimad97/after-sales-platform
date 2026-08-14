<?php

namespace App\Policies;

use App\Models\Attachment;
use App\Models\Product;
use App\Models\Repair;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class AttachmentPolicy
{
    public function view(User $user, Attachment $attachment): Response|bool
    {
        if ($this->canViewTarget($user, $attachment->attachable)) {
            return true;
        }

        if (! $user->hasClientPortalAccess()) {
            return false;
        }

        return $this->isClientOwnedTicketAttachment($user, $attachment)
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function delete(User $user, Attachment $attachment): bool
    {
        return $this->canUpdateTarget($user, $attachment->attachable);
    }

    public function uploadToTicket(User $user, Ticket $ticket): bool
    {
        return $user->can('update', $ticket);
    }

    public function uploadToProduct(User $user, Product $product): bool
    {
        return $user->can('update', $product);
    }

    public function uploadToRepair(User $user, Repair $repair): bool
    {
        return $user->can('update', $repair);
    }

    public function uploadToPortalTicket(User $user, Ticket $ticket): Response
    {
        return $user->belongsToClient($ticket->client_id) && ! $ticket->status->isTerminal()
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    private function canViewTarget(User $user, mixed $target): bool
    {
        return match (true) {
            $target instanceof Ticket => $user->can('view', $target),
            $target instanceof Product => $user->can('view', $target),
            $target instanceof Repair => $user->can('view', $target),
            default => false,
        };
    }

    private function canUpdateTarget(User $user, mixed $target): bool
    {
        return match (true) {
            $target instanceof Ticket => $user->can('update', $target),
            $target instanceof Product => $user->can('update', $target),
            $target instanceof Repair => $user->can('update', $target),
            default => false,
        };
    }

    private function isClientOwnedTicketAttachment(User $user, Attachment $attachment): bool
    {
        if (! $attachment->attachable instanceof Ticket || ! $user->belongsToClient($attachment->attachable->client_id)) {
            return false;
        }

        $attachment->loadMissing('uploadedBy');

        return $attachment->uploadedBy !== null
            && $attachment->uploadedBy->belongsToClient($attachment->attachable->client_id);
    }
}

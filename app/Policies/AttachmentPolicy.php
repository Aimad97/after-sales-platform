<?php

namespace App\Policies;

use App\Models\Attachment;
use App\Models\Product;
use App\Models\Repair;
use App\Models\Ticket;
use App\Models\User;

class AttachmentPolicy
{
    public function view(User $user, Attachment $attachment): bool
    {
        return $this->canViewTarget($user, $attachment->attachable);
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
}

<?php

namespace App\Policies;

use App\Models\Repair;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;

class RepairPolicy
{
    public function viewAny(User $user): bool { return $user->can('repairs.view') && ! $user->hasRole('client'); }
    public function view(User $user, Repair $repair): bool { return $this->viewAny($user) && ($this->isAdmin($user) || $repair->technician->user_id === $user->id); }
    public function startRepair(User $user, Ticket $ticket): bool { return $this->canModifyTicketRepair($user, $ticket); }
    public function update(User $user, Repair $repair): bool { return $this->canModifyTicketRepair($user, $repair->ticket); }
    private function canModifyTicketRepair(User $user, Ticket $ticket): bool { return $this->isAdmin($user) || ($user->can('repairs.update') && $ticket->assignedTechnician?->user_id === $user->id); }
    private function isAdmin(User $user): bool { return $user->hasAnyRole(['admin', 'super_admin']); }
}

<?php

namespace App\Services;

use App\Enums\UserStatus;
use App\Models\Repair;
use App\Models\Ticket;
use App\Models\User;

class RealtimeAudienceService
{
    /**
     * @return list<int>
     */
    public function ticketRecipientUserIds(Ticket $ticket): array
    {
        $ticket->loadMissing('assignedTechnician');
        $directUserIds = array_filter([
            $ticket->created_by,
            $ticket->assignedTechnician?->user_id,
        ]);

        $operationalUserIds = User::query()
            ->role(['super_admin', 'admin', 'sav_agent'])
            ->where('status', UserStatus::Active->value)
            ->pluck('id')
            ->all();

        $activeDirectUserIds = $directUserIds === []
            ? []
            : User::query()
                ->whereIn('id', $directUserIds)
                ->where('status', UserStatus::Active->value)
                ->pluck('id')
                ->all();

        return array_values(array_unique([
            ...array_map('intval', $operationalUserIds),
            ...array_map('intval', $activeDirectUserIds),
        ]));
    }

    /**
     * @return list<int>
     */
    public function repairRecipientUserIds(Repair $repair): array
    {
        $repair->loadMissing('technician');
        $administratorIds = User::query()
            ->role(['super_admin', 'admin'])
            ->where('status', UserStatus::Active->value)
            ->pluck('id')
            ->all();

        $assignedTechnicianUserId = $repair->technician?->user_id;
        $activeTechnicianIds = $assignedTechnicianUserId === null
            ? []
            : User::query()
                ->whereKey($assignedTechnicianUserId)
                ->where('status', UserStatus::Active->value)
                ->pluck('id')
                ->all();

        return array_values(array_unique([
            ...array_map('intval', $administratorIds),
            ...array_map('intval', $activeTechnicianIds),
        ]));
    }
}

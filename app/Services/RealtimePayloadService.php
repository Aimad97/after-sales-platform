<?php

namespace App\Services;

use App\Http\Resources\NotificationResource;
use App\Http\Resources\RepairResource;
use App\Http\Resources\TicketResource;
use App\Models\Repair;
use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class RealtimePayloadService
{
    /**
     * @return array<string, mixed>
     */
    public function ticket(Ticket $ticket): array
    {
        $ticket->loadMissing([
            'client',
            'product',
            'warranty',
            'invoiceItem.invoice',
            'creator',
            'assignedTechnician.user',
            'statusHistory.transitionedBy',
            'history.actor',
        ]);

        return (new TicketResource($ticket))->resolve(new Request);
    }

    /**
     * @return array<string, mixed>
     */
    public function repair(Repair $repair): array
    {
        $repair->loadMissing([
            'ticket.client',
            'ticket.product',
            'technician.user',
            'history.changedBy',
        ]);

        return (new RepairResource($repair))->resolve(new Request);
    }

    /**
     * @return array<string, mixed>
     */
    public function notification(DatabaseNotification $notification): array
    {
        return (new NotificationResource($notification))->resolve(new Request);
    }
}

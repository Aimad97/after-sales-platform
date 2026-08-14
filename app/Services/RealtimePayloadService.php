<?php

namespace App\Services;

use App\Http\Resources\NotificationResource;
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
        $ticket->loadMissing(['product', 'warranty']);

        return [
            'id' => $ticket->id,
            'uuid' => $ticket->uuid,
            'ticket_number' => $ticket->ticket_number,
            'title' => $ticket->title,
            'priority' => $ticket->priority?->value,
            'status' => $ticket->status?->value,
            'warranty_eligible' => $ticket->warranty_eligible,
            'received_at' => $ticket->received_at?->toISOString(),
            'closed_at' => $ticket->closed_at?->toISOString(),
            'product' => $ticket->product === null ? null : [
                'uuid' => $ticket->product->uuid,
                'sku' => $ticket->product->sku,
                'name' => $ticket->product->name,
                'model' => $ticket->product->model,
            ],
            'warranty' => $ticket->warranty === null ? null : [
                'uuid' => $ticket->warranty->uuid,
                'serial_number' => $ticket->warranty->serial_number,
                'status' => $ticket->warranty->effectiveStatus()->value,
            ],
            'updated_at' => $ticket->updated_at?->toISOString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function repair(Repair $repair): array
    {
        return [
            'id' => $repair->id,
            'ticket_id' => $repair->ticket_id,
            'customer_notes' => $repair->customer_notes,
            'started_at' => $repair->started_at?->toISOString(),
            'completed_at' => $repair->completed_at?->toISOString(),
            'result' => $repair->result?->value,
            'updated_at' => $repair->updated_at?->toISOString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function notification(DatabaseNotification $notification): array
    {
        return (new NotificationResource($notification))->resolve(new Request);
    }
}

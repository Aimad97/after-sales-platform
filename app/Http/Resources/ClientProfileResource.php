<?php

namespace App\Http\Resources;

use App\Models\Client;
use App\Models\Intervention;
use App\Models\Ticket;
use App\Models\Warranty;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Client */
class ClientProfileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'client' => new ClientResource($this->resource),
            'purchased_products' => $this->relationLoaded('purchasedProducts')
                ? $this->purchasedProducts->map(fn (Warranty $warranty): array => $this->warranty($warranty))->values()
                : [],
            'active_warranties' => $this->relationLoaded('activeWarranties')
                ? $this->activeWarranties->map(fn (Warranty $warranty): array => $this->warranty($warranty))->values()
                : [],
            'expired_warranties' => $this->relationLoaded('expiredWarranties')
                ? $this->expiredWarranties->map(fn (Warranty $warranty): array => $this->warranty($warranty))->values()
                : [],
            'tickets' => $this->relationLoaded('tickets')
                ? $this->tickets->map(fn (Ticket $ticket): array => $this->ticket($ticket))->values()
                : [],
            'repair_history' => $this->relationLoaded('repairHistory')
                ? $this->repairHistory->map(fn (Intervention $intervention): array => $this->intervention($intervention))->values()
                : [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function warranty(Warranty $warranty): array
    {
        return [
            'id' => $warranty->id,
            'uuid' => $warranty->uuid,
            'serial_number' => $warranty->serial_number,
            'quantity' => $warranty->quantity,
            'starts_at' => $warranty->starts_at?->toDateString(),
            'expires_at' => $warranty->expires_at?->toDateString(),
            'status' => $warranty->effectiveStatus()->value,
            'purchase_date' => $warranty->purchase_date?->toDateString(),
            'warranty_end' => $warranty->warranty_end?->toDateString(),
            'product' => $warranty->product === null ? null : [
                'id' => $warranty->product->id,
                'name' => $warranty->product->name,
                'model' => $warranty->product->model,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function ticket(Ticket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'uuid' => $ticket->uuid,
            'ticket_number' => $ticket->ticket_number,
            'title' => $ticket->title,
            'problem_description' => $ticket->problem_description,
            'priority' => $ticket->priority?->value,
            'status' => $ticket->status?->value,
            'received_at' => $ticket->received_at?->toISOString(),
            'closed_at' => $ticket->closed_at?->toISOString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function intervention(Intervention $intervention): array
    {
        return [
            'id' => $intervention->id,
            'diagnostic' => $intervention->diagnostic,
            'solution' => $intervention->solution,
            'labor_cost' => $intervention->labor_cost,
            'created_at' => $intervention->created_at?->toISOString(),
            'ticket' => $intervention->ticket === null ? null : $this->ticket($intervention->ticket),
        ];
    }
}

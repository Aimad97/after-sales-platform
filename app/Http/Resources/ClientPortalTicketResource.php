<?php

namespace App\Http\Resources;

use App\Models\Ticket;
use App\Models\TicketStatusHistory;
use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Ticket */
class ClientPortalTicketResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'ticket_number' => $this->ticket_number,
            'title' => $this->title,
            'problem_description' => $this->problem_description,
            'priority' => $this->enumValue($this->priority),
            'status' => $this->enumValue($this->status),
            'source' => $this->enumValue($this->source),
            'warranty_eligible' => $this->warranty_eligible,
            'received_at' => $this->received_at?->toISOString(),
            'closed_at' => $this->closed_at?->toISOString(),
            'can_upload_attachments' => ! $this->status->isTerminal(),
            'product' => $this->relationLoaded('product') && $this->product !== null ? [
                'uuid' => $this->product->uuid,
                'sku' => $this->product->sku,
                'name' => $this->product->name,
                'model' => $this->product->model,
            ] : null,
            'warranty' => $this->relationLoaded('warranty') && $this->warranty !== null ? [
                'uuid' => $this->warranty->uuid,
                'serial_number' => $this->warranty->serial_number,
                'status' => $this->warranty->effectiveStatus()->value,
                'starts_at' => $this->warranty->starts_at?->toDateString(),
                'expires_at' => $this->warranty->expires_at?->toDateString(),
            ] : null,
            'assigned_technician' => $this->relationLoaded('assignedTechnician') && $this->assignedTechnician?->user !== null ? [
                'display_name' => trim("{$this->assignedTechnician->user->first_name} {$this->assignedTechnician->user->last_name}"),
            ] : null,
            'status_timeline' => $this->relationLoaded('statusHistory')
                ? $this->statusHistory->map(fn (TicketStatusHistory $history): array => [
                    'from_status' => $this->enumValue($history->from_status),
                    'to_status' => $this->enumValue($history->to_status),
                    'transitioned_at' => $history->transitioned_at?->toISOString(),
                ])->values()
                : [],
            'attachments' => $this->relationLoaded('attachments')
                ? AttachmentResource::collection($this->attachments)
                : [],
            'repair_outcome' => $this->relationLoaded('repair') && $this->repair !== null ? [
                // Diagnosis and repair actions are technician-facing notes. A
                // client receives only the customer-safe outcome fields.
                'customer_notes' => $this->repair->customer_notes,
                'result' => $this->enumValue($this->repair->result),
                'started_at' => $this->repair->started_at?->toISOString(),
                'completed_at' => $this->repair->completed_at?->toISOString(),
            ] : null,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }

    private function enumValue(mixed $value): ?string
    {
        return $value instanceof BackedEnum ? (string) $value->value : $value;
    }
}

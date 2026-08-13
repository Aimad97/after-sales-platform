<?php

namespace App\Http\Resources;

use App\Models\Ticket;
use App\Models\TicketStatusHistory;
use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Ticket */
class TicketResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'ticket_number' => $this->ticket_number,
            'client_id' => $this->client_id,
            'product_id' => $this->product_id,
            'warranty_id' => $this->warranty_id,
            'invoice_item_id' => $this->invoice_item_id,
            'title' => $this->title,
            'problem_description' => $this->problem_description,
            'priority' => $this->enumValue($this->priority),
            'status' => $this->enumValue($this->status),
            'source' => $this->enumValue($this->source),
            'warranty_eligible' => $this->warranty_eligible,
            'created_by' => $this->created_by,
            'assigned_technician_id' => $this->assigned_technician_id,
            'received_at' => $this->received_at?->toISOString(),
            'closed_at' => $this->closed_at?->toISOString(),
            'status_history_count' => $this->whenCounted('statusHistory'),
            'client' => $this->relationLoaded('client') && $this->client !== null ? [
                'id' => $this->client->id,
                'uuid' => $this->client->uuid,
                'display_name' => $this->client->display_name,
                'email' => $this->client->email,
                'phone' => $this->client->phone,
            ] : null,
            'product' => $this->relationLoaded('product') && $this->product !== null ? [
                'id' => $this->product->id,
                'uuid' => $this->product->uuid,
                'sku' => $this->product->sku,
                'name' => $this->product->name,
                'model' => $this->product->model,
            ] : null,
            'warranty' => $this->relationLoaded('warranty') && $this->warranty !== null ? [
                'id' => $this->warranty->id,
                'uuid' => $this->warranty->uuid,
                'serial_number' => $this->warranty->serial_number,
                'status' => $this->warranty->effectiveStatus()->value,
            ] : null,
            'invoice_item' => $this->relationLoaded('invoiceItem') && $this->invoiceItem !== null ? [
                'id' => $this->invoiceItem->id,
                'serial_number' => $this->invoiceItem->serial_number,
                'invoice_number' => $this->invoiceItem->relationLoaded('invoice') && $this->invoiceItem->invoice !== null
                    ? $this->invoiceItem->invoice->invoice_number
                    : null,
            ] : null,
            'created_by_user' => $this->relationLoaded('creator') && $this->creator !== null ? $this->user($this->creator) : null,
            'assigned_technician' => $this->relationLoaded('assignedTechnician') && $this->assignedTechnician !== null ? [
                'id' => $this->assignedTechnician->id,
                'employee_code' => $this->assignedTechnician->employee_code,
                'specialization' => $this->assignedTechnician->specialization,
                'availability_status' => $this->enumValue($this->assignedTechnician->availability_status),
                'user' => $this->assignedTechnician->relationLoaded('user') && $this->assignedTechnician->user !== null
                    ? $this->user($this->assignedTechnician->user)
                    : null,
            ] : null,
            'status_history' => $this->relationLoaded('statusHistory')
                ? $this->statusHistory->map(fn (TicketStatusHistory $history): array => [
                    'id' => $history->id,
                    'from_status' => $this->enumValue($history->from_status),
                    'to_status' => $this->enumValue($history->to_status),
                    'notes' => $history->notes,
                    'transitioned_at' => $history->transitioned_at?->toISOString(),
                    'transitioned_by' => $history->relationLoaded('transitionedBy') && $history->transitionedBy !== null
                        ? $this->user($history->transitionedBy)
                        : null,
                ])->values()
                : [],
            'ticket_history' => $this->relationLoaded('history') ? $this->history->map(fn ($entry): array => ['id' => $entry->id, 'event' => $entry->event, 'description' => $entry->description, 'metadata' => $entry->metadata, 'occurred_at' => $entry->occurred_at?->toISOString(), 'actor' => $entry->relationLoaded('actor') && $entry->actor !== null ? $this->user($entry->actor) : null])->values() : [],
            'attachments' => $this->relationLoaded('attachments')
                ? AttachmentResource::collection($this->attachments)
                : [],
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }

    /**
     * @return array{id: int, uuid: string, display_name: string, email: string}
     */
    private function user(object $user): array
    {
        return [
            'id' => $user->id,
            'uuid' => $user->uuid,
            'display_name' => trim("{$user->first_name} {$user->last_name}"),
            'email' => $user->email,
        ];
    }

    private function enumValue(mixed $value): ?string
    {
        return $value instanceof BackedEnum
            ? (string) $value->value
            : $value;
    }
}

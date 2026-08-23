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
        $status = $this->enumValue($this->status);
        $awaitingApproval = $status === 'awaiting_customer_approval';
        $repair = $this->relationLoaded('repair') ? $this->repair : null;
        $quoteReady = $awaitingApproval
            && $repair !== null
            && filled($repair->diagnosis)
            && $repair->updated_at !== null;

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'ticket_number' => $this->ticket_number,
            'title' => $this->title,
            'problem_description' => $this->problem_description,
            'priority' => $this->enumValue($this->priority),
            'status' => $status,
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
                    'id' => $history->id,
                    'from_status' => $this->enumValue($history->from_status),
                    'to_status' => $this->enumValue($history->to_status),
                    'transitioned_at' => $history->transitioned_at?->toISOString(),
                ])->values()
                : [],
            'attachments' => $this->relationLoaded('attachments')
                ? AttachmentResource::collection($this->attachments)
                : [],
            'approval_required' => $awaitingApproval,
            'can_respond_to_repair_approval' => $quoteReady,
            'repair_quote' => $awaitingApproval && $repair !== null ? [
                'diagnosis' => $repair->diagnosis,
                'customer_notes' => $repair->customer_notes,
                'labor_cost' => $repair->labor_cost,
                'parts_cost' => $repair->parts_cost,
                'total_cost' => $repair->total_cost,
                'currency' => 'MAD',
                'version' => $quoteReady ? $repair->quoteVersion() : null,
                'is_complete' => $quoteReady,
            ] : null,
            'repair_outcome' => $repair !== null ? [
                // Diagnosis and repair actions are technician-facing notes. A
                // client receives only the customer-safe outcome fields.
                'customer_notes' => $repair->customer_notes,
                'result' => $this->enumValue($repair->result),
                'started_at' => $repair->started_at?->toISOString(),
                'completed_at' => $repair->completed_at?->toISOString(),
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

<?php

namespace App\Http\Resources;

use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Invoice */
class InvoiceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'invoice_number' => $this->invoice_number,
            'client_id' => $this->client_id,
            'invoice_date' => $this->invoice_date?->toDateString(),
            'subtotal_amount' => $this->subtotal_amount,
            'tax_rate' => $this->tax_rate,
            'tax_amount' => $this->tax_amount,
            'total_amount' => $this->total_amount,
            'status' => $this->status?->value,
            'notes' => $this->notes,
            'items_count' => $this->whenCounted('items'),
            'client' => $this->relationLoaded('client') && $this->client !== null
                ? new ClientResource($this->client)
                : null,
            'items' => $this->relationLoaded('items')
                ? InvoiceItemResource::collection($this->items)
                : [],
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}

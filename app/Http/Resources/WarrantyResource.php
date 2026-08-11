<?php

namespace App\Http\Resources;

use App\Models\Warranty;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Warranty */
class WarrantyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'client_id' => $this->customer_id,
            'invoice_item_id' => $this->invoice_item_id,
            'product_id' => $this->product_id,
            'serial_number' => $this->serial_number,
            'quantity' => $this->quantity,
            'starts_at' => $this->starts_at?->toDateString(),
            'expires_at' => $this->expires_at?->toDateString(),
            'status' => $this->effectiveStatus()->value,
            'void_reason' => $this->void_reason,
            'notes' => $this->notes,
            'client' => $this->relationLoaded('client') && $this->client !== null ? [
                'id' => $this->client->id,
                'uuid' => $this->client->uuid,
                'display_name' => $this->client->display_name,
            ] : null,
            'product' => $this->relationLoaded('product') && $this->product !== null ? [
                'id' => $this->product->id,
                'uuid' => $this->product->uuid,
                'sku' => $this->product->sku,
                'name' => $this->product->name,
                'model' => $this->product->model,
            ] : null,
            'invoice_item' => $this->relationLoaded('invoiceItem') && $this->invoiceItem !== null ? [
                'id' => $this->invoiceItem->id,
                'invoice_id' => $this->invoiceItem->invoice_id,
                'invoice_number' => $this->invoiceItem->relationLoaded('invoice') && $this->invoiceItem->invoice !== null
                    ? $this->invoiceItem->invoice->invoice_number
                    : null,
            ] : null,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}

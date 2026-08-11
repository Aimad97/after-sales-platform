<?php

namespace App\Http\Resources;

use App\Models\InvoiceItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin InvoiceItem */
class InvoiceItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'serial_number' => $this->serial_number,
            'quantity' => $this->quantity,
            'unit_price' => $this->unit_price,
            'warranty_months' => $this->warranty_months,
            'warranty_start_date' => $this->warranty_start_date?->toDateString(),
            'warranty_end_date' => $this->warranty_end_date?->toDateString(),
            'line_subtotal' => $this->line_subtotal,
            'line_tax' => $this->line_tax,
            'line_total' => $this->line_total,
            'product' => $this->relationLoaded('product') && $this->product !== null ? [
                'id' => $this->product->id,
                'uuid' => $this->product->uuid,
                'sku' => $this->product->sku,
                'name' => $this->product->name,
                'model' => $this->product->model,
                'serial_number_required' => $this->product->serial_number_required,
            ] : null,
        ];
    }
}

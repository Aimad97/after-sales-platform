<?php

namespace App\Http\Resources;

use App\Models\Warranty;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Warranty */
class ClientPortalProductResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'serial_number' => $this->serial_number,
            'quantity' => $this->quantity,
            'purchase_date' => $this->purchase_date?->toDateString(),
            'warranty' => [
                'status' => $this->effectiveStatus()->value,
                'eligible' => $this->isUnderWarranty(),
                'starts_at' => $this->starts_at?->toDateString(),
                'expires_at' => $this->expires_at?->toDateString(),
            ],
            'product' => $this->relationLoaded('product') && $this->product !== null ? [
                'uuid' => $this->product->uuid,
                'sku' => $this->product->sku,
                'name' => $this->product->name,
                'model' => $this->product->model,
                'description' => $this->product->description,
                'brand' => $this->product->relationLoaded('brand') ? $this->product->brand?->name : null,
                'category' => $this->product->relationLoaded('category') ? $this->product->category?->name : null,
            ] : null,
        ];
    }
}

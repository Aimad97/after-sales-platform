<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product */
class ProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'sku' => $this->sku,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'category_id' => $this->category_id,
            'brand_id' => $this->brand_id,
            'model' => $this->model,
            'default_warranty_months' => $this->default_warranty_months,
            'serial_number_required' => $this->serial_number_required,
            'active' => $this->active,
            'category' => $this->whenLoaded('category', fn (): array => [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'slug' => $this->category->slug,
                'active' => $this->category->active,
            ]),
            'brand' => $this->whenLoaded('brand', fn (): array => [
                'id' => $this->brand->id,
                'name' => $this->brand->name,
                'slug' => $this->brand->slug,
                'logo_path' => $this->brand->logo_path,
                'active' => $this->brand->active,
            ]),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}

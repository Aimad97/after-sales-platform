<?php

namespace App\Http\Resources;

use App\Enums\ClientType;
use App\Models\Client;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Client */
class ClientResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $type = $this->type instanceof ClientType ? $this->type->value : $this->type;
        $displayName = $type === ClientType::Company->value && filled($this->company_name)
            ? $this->company_name
            : trim("{$this->first_name} {$this->last_name}");

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'type' => $type,
            'display_name' => $displayName,
            'company_name' => $this->company_name,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->address,
            'city' => $this->city,
            'tax_identifier' => $this->tax_identifier,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}

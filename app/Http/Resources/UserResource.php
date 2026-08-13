<?php

namespace App\Http\Resources;

use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'locale' => $this->locale,
            'timezone' => $this->timezone,
            'client_id' => $this->client_id,
            'client' => $this->whenLoaded('client', fn (): ?array => $this->client === null ? null : [
                'id' => $this->client->id,
                'uuid' => $this->client->uuid,
                'display_name' => $this->client->display_name,
            ]),
            'status' => $this->status instanceof UserStatus ? $this->status->value : $this->status,
            'last_login_at' => $this->last_login_at?->toISOString(),
            'roles' => $this->getRoleNames()->values(),
            'permissions' => $this->getAllPermissions()->pluck('name')->values(),
            'technician' => $this->whenLoaded('technician', fn (): TechnicianResource => new TechnicianResource($this->technician)),
        ];
    }
}

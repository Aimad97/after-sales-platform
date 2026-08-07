<?php

namespace App\Http\Resources;

use App\Enums\TechnicianAvailabilityStatus;
use App\Enums\UserStatus;
use App\Models\Technician;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Technician */
class TechnicianResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'employee_code' => $this->employee_code,
            'specialization' => $this->specialization,
            'skill_level' => $this->skill_level,
            'availability_status' => $this->availability_status instanceof TechnicianAvailabilityStatus
                ? $this->availability_status->value
                : $this->availability_status,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'user' => $this->whenLoaded('user', function (): array {
                $user = $this->user;

                return [
                    'id' => $user->id,
                    'uuid' => $user->uuid,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'status' => $user->status instanceof UserStatus ? $user->status->value : $user->status,
                    'roles' => $user->getRoleNames()->values(),
                ];
            }),
        ];
    }
}

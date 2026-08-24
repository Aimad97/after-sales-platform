<?php

namespace App\Http\Requests\Technicians;

use App\Enums\TechnicianAvailabilityStatus;
use App\Models\Technician;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOwnTechnicianProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if ($user === null) {
            return false;
        }

        $technician = Technician::query()->where('user_id', $user->getKey())->first();

        return $technician !== null && $user->can('updateOwn', $technician);
    }

    /**
     * @return array<string, list<string|object>>
     */
    public function rules(): array
    {
        return [
            'first_name' => ['sometimes', 'required', 'string', 'max:100'],
            'last_name' => ['sometimes', 'required', 'string', 'max:100'],
            'email' => [
                'sometimes',
                'required',
                'email:rfc',
                'max:255',
                Rule::unique('users', 'email')->ignore($this->user()?->getKey()),
            ],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'specialization' => ['sometimes', 'nullable', 'string', 'max:150'],
            'availability_status' => ['sometimes', 'required', Rule::enum(TechnicianAvailabilityStatus::class)],
            'user_id' => ['prohibited'],
            'employee_code' => ['prohibited'],
            'skill_level' => ['prohibited'],
            'notes' => ['prohibited'],
            'status' => ['prohibited'],
            'roles' => ['prohibited'],
        ];
    }
}

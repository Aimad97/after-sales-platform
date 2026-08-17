<?php

namespace App\Http\Requests\Technicians;

use App\Enums\TechnicianAvailabilityStatus;
use App\Models\Technician;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTechnicianRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Technician::class) ?? false;
    }

    /**
     * @return array<string, list<string|object>>
     */
    public function rules(): array
    {
        return [
            'user_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'employee_code' => ['required', 'string', 'max:50', 'alpha_dash:ascii', 'unique:technicians,employee_code'],
            'specialization' => ['nullable', 'string', 'max:150'],
            'skill_level' => ['required', 'integer', 'min:1', 'max:5'],
            'availability_status' => ['required', Rule::enum(TechnicianAvailabilityStatus::class)],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}

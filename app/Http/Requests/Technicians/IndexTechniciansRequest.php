<?php

namespace App\Http\Requests\Technicians;

use App\Enums\TechnicianAvailabilityStatus;
use App\Models\Technician;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexTechniciansRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Technician::class) ?? false;
    }

    /**
     * @return array<string, list<string|object>>
     */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:100'],
            'availability_status' => ['nullable', Rule::enum(TechnicianAvailabilityStatus::class)],
            'skill_level' => ['nullable', 'integer', 'min:1', 'max:5'],
            'sort' => ['nullable', Rule::in(['employee_code', 'specialization', 'skill_level', 'availability_status', 'created_at'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}

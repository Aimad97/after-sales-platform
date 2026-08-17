<?php

namespace App\Http\Requests\Technicians;

use App\Enums\TechnicianAvailabilityStatus;
use App\Models\Technician;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTechnicianRequest extends FormRequest
{
    public function authorize(): bool
    {
        $technician = $this->route('technician');

        return $technician instanceof Technician && ($this->user()?->can('update', $technician) ?? false);
    }

    /**
     * @return array<string, list<string|object>>
     */
    public function rules(): array
    {
        $technician = $this->route('technician');
        $technicianId = $technician instanceof Technician ? $technician->getKey() : null;

        return [
            'employee_code' => ['sometimes', 'required', 'string', 'max:50', 'alpha_dash:ascii', Rule::unique('technicians', 'employee_code')->ignore($technicianId)],
            'specialization' => ['nullable', 'string', 'max:150'],
            'skill_level' => ['sometimes', 'required', 'integer', 'min:1', 'max:5'],
            'availability_status' => ['sometimes', 'required', Rule::enum(TechnicianAvailabilityStatus::class)],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}

<?php

namespace App\Http\Requests\Repairs;

use App\Models\Repair;
use Illuminate\Foundation\Http\FormRequest;

class UpdateRepairRequest extends FormRequest
{
    public function authorize(): bool
    {
        $repair = $this->route('repair');

        return $repair instanceof Repair && ($this->user()?->can('update', $repair) ?? false);
    }

    public function rules(): array
    {
        return [
            'repair_action' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'internal_notes' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'customer_notes' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'labor_cost' => ['sometimes', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999'],
            'parts_cost' => ['sometimes', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999'],
        ];
    }
}

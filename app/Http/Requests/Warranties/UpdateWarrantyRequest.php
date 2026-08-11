<?php

namespace App\Http\Requests\Warranties;

use App\Models\Warranty;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateWarrantyRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $data = [];

        foreach (['void_reason', 'notes'] as $field) {
            if ($this->has($field)) {
                $data[$field] = filled($this->input($field)) ? trim((string) $this->input($field)) : null;
            }
        }

        if ($data !== []) {
            $this->merge($data);
        }
    }

    public function authorize(): bool
    {
        $warranty = $this->route('warranty');

        return $warranty instanceof Warranty && ($this->user()?->can('update', $warranty) ?? false);
    }

    /**
     * @return array<string, list<string|object>>
     */
    public function rules(): array
    {
        return [
            'status' => ['sometimes', Rule::in(['void', 'replaced', 'active', 'expired'])],
            'void_reason' => ['nullable', 'string', 'max:1000', 'required_if:status,void'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}

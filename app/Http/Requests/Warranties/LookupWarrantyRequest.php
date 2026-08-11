<?php

namespace App\Http\Requests\Warranties;

use App\Models\Warranty;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class LookupWarrantyRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('serial_number')) {
            $this->merge([
                'serial_number' => Str::upper(trim((string) $this->input('serial_number'))),
            ]);
        }
    }

    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Warranty::class) ?? false;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'serial_number' => ['required', 'string', 'max:100'],
        ];
    }
}

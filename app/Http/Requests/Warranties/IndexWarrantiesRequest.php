<?php

namespace App\Http\Requests\Warranties;

use App\Models\Warranty;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexWarrantiesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Warranty::class) ?? false;
    }

    /**
     * @return array<string, list<string|object>>
     */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:100'],
            'client_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'status' => ['nullable', Rule::in(['active', 'expired', 'void', 'replaced'])],
            'sort' => ['nullable', Rule::in(['serial_number', 'starts_at', 'expires_at', 'status', 'created_at'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}

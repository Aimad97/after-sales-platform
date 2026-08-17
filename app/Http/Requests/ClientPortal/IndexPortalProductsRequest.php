<?php

namespace App\Http\Requests\ClientPortal;

use App\Enums\WarrantyStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexPortalProductsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasClientPortalAccess() ?? false;
    }

    /** @return array<string, list<string|object>> */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::enum(WarrantyStatus::class)],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}

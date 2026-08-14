<?php

namespace App\Http\Requests\ClientPortal;

use Illuminate\Foundation\Http\FormRequest;

class StorePortalTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'purchased_product_uuid' => ['required', 'uuid'],
            'title' => ['required', 'string', 'min:3', 'max:255'],
            'problem_description' => ['required', 'string', 'min:10', 'max:10000'],
        ];
    }
}

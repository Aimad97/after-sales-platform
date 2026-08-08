<?php

namespace App\Http\Requests\Clients;

use App\Enums\ClientType;
use App\Models\Client;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string|object>>
     */
    public function rules(): array
    {
        $client = $this->route('client');
        $clientId = $client instanceof Client ? $client->getKey() : null;
        $currentType = $client instanceof Client && $client->type instanceof ClientType
            ? $client->type->value
            : null;
        $effectiveType = $this->input('type', $currentType);

        return [
            'type' => ['sometimes', 'required', Rule::enum(ClientType::class)],
            'company_name' => [
                'nullable',
                'string',
                'max:255',
                Rule::requiredIf(fn (): bool => ($this->has('type') && $effectiveType === ClientType::Company->value)
                    || ($this->has('company_name') && $effectiveType === ClientType::Company->value)),
            ],
            'first_name' => ['sometimes', 'required', 'string', 'max:100'],
            'last_name' => ['sometimes', 'required', 'string', 'max:100'],
            'email' => ['sometimes', 'nullable', 'email:rfc', 'max:255'],
            'phone' => ['sometimes', 'required', 'string', 'max:30'],
            'address' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'city' => ['sometimes', 'nullable', 'string', 'max:100'],
            'tax_identifier' => [
                'nullable',
                'string',
                'max:100',
                Rule::requiredIf(fn (): bool => ($this->has('type') && $effectiveType === ClientType::Company->value)
                    || ($this->has('tax_identifier') && $effectiveType === ClientType::Company->value)),
                Rule::unique('customers', 'tax_identifier')->ignore($clientId),
            ],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ];
    }
}

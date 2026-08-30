<?php

namespace App\Http\Requests\Users;

use App\Enums\UserStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexUsersRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $technician = $this->input('technician');

        if (is_string($technician) && in_array(strtolower($technician), ['true', 'false'], true)) {
            $this->merge(['technician' => strtolower($technician) === 'true']);
        }
    }

    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', User::class) ?? false;
    }

    /**
     * @return array<string, list<string|object>>
     */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::enum(UserStatus::class)],
            'role' => ['nullable', 'string', Rule::exists('roles', 'name')->where('guard_name', 'web')],
            'technician' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(['first_name', 'last_name', 'email', 'status', 'last_login_at', 'created_at'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}

<?php

namespace App\Http\Requests\ClientPortal;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RespondToRepairApprovalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasClientPortalAccess() ?? false;
    }

    /** @return array<string, list<string|object>> */
    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::in(['approved', 'changes_requested'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}

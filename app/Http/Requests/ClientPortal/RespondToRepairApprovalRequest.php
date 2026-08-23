<?php

namespace App\Http\Requests\ClientPortal;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RespondToRepairApprovalRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('notes'))) {
            $this->merge(['notes' => trim($this->input('notes'))]);
        }
    }

    public function authorize(): bool
    {
        // Ownership is authorized in the controller so foreign tickets retain
        // the policy's deliberate 404 response instead of becoming a 403.
        return true;
    }

    /** @return array<string, list<string|object>> */
    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::in(['approved', 'changes_requested'])],
            'quote_version' => ['required', 'string', 'size:64'],
            'notes' => ['nullable', 'required_if:decision,changes_requested', 'string', 'min:3', 'max:2000'],
        ];
    }
}

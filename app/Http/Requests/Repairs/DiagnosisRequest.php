<?php

namespace App\Http\Requests\Repairs;

use App\Enums\TicketStatus;
use App\Models\Repair;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DiagnosisRequest extends FormRequest
{
    public function authorize(): bool
    {
        $repair = $this->route('repair');

        return $repair instanceof Repair && ($this->user()?->can('update', $repair) ?? false);
    }

    public function rules(): array
    {
        return [
            'diagnosis' => ['required', 'string', 'min:3', 'max:10000'],
            'root_cause' => ['nullable', 'string', 'max:10000'],
            'customer_notes' => ['nullable', 'string', 'max:10000'],
            'next_status' => ['required', Rule::in([
                TicketStatus::AwaitingCustomerApproval->value,
                TicketStatus::AwaitingPart->value,
                TicketStatus::Repairing->value,
            ])],
        ];
    }
}

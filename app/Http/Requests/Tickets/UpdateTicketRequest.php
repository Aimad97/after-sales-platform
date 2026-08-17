<?php

namespace App\Http\Requests\Tickets;

use App\Enums\TicketSource;
use App\Models\Ticket;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        $ticket = $this->route('ticket');

        return $ticket instanceof Ticket && ($this->user()?->can('update', $ticket) ?? false);
    }

    /**
     * @return array<string, list<string|object>>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'min:3', 'max:255'],
            'problem_description' => ['sometimes', 'required', 'string', 'min:3', 'max:10000'],
            'source' => ['sometimes', 'required', Rule::enum(TicketSource::class)],
            'status' => ['prohibited'],
            'priority' => ['prohibited'],
            'client_id' => ['prohibited'],
            'product_id' => ['prohibited'],
            'warranty_id' => ['prohibited'],
            'invoice_item_id' => ['prohibited'],
            'assigned_technician_id' => ['prohibited'],
        ];
    }
}

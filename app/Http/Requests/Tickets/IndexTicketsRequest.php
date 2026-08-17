<?php

namespace App\Http\Requests\Tickets;

use App\Enums\TicketPriority;
use App\Enums\TicketSource;
use App\Enums\TicketStatus;
use App\Models\Ticket;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexTicketsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('viewAny', Ticket::class) ?? false;
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
            'warranty_id' => ['nullable', 'integer', 'exists:customer_products,id'],
            'assigned_technician_id' => ['nullable', 'integer', Rule::exists('technicians', 'id')->whereNull('deleted_at')],
            'created_by' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'priority' => ['nullable', Rule::enum(TicketPriority::class)],
            'status' => ['nullable', Rule::enum(TicketStatus::class)],
            'source' => ['nullable', Rule::enum(TicketSource::class)],
            'warranty_eligible' => ['nullable', 'boolean'],
            'received_from' => ['nullable', 'date'],
            'received_to' => ['nullable', 'date', 'after_or_equal:received_from'],
            'sort' => ['nullable', Rule::in(['ticket_number', 'priority', 'status', 'received_at', 'closed_at', 'created_at'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}

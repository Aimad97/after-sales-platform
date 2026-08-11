<?php

namespace App\Http\Requests\Tickets;

use App\Enums\TicketPriority;
use App\Enums\TicketSource;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTicketRequest extends FormRequest
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
        return [
            'client_id' => ['required', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'warranty_id' => ['nullable', 'integer', 'exists:customer_products,id'],
            'invoice_item_id' => ['nullable', 'integer', 'exists:invoice_items,id'],
            'title' => ['required', 'string', 'min:3', 'max:255'],
            'problem_description' => ['required', 'string', 'min:3', 'max:10000'],
            'priority' => ['nullable', Rule::enum(TicketPriority::class)],
            'source' => ['nullable', Rule::enum(TicketSource::class)],
        ];
    }
}

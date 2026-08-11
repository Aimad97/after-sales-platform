<?php

namespace App\Http\Requests\Invoices;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

abstract class InvoiceRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $data = [];

        if ($this->has('invoice_number')) {
            $data['invoice_number'] = filled($this->input('invoice_number'))
                ? Str::upper(trim((string) $this->input('invoice_number')))
                : null;
        }

        if (is_array($this->input('items'))) {
            $data['items'] = array_map(function (mixed $item): mixed {
                if (! is_array($item) || ! array_key_exists('serial_number', $item)) {
                    return $item;
                }

                $item['serial_number'] = filled($item['serial_number'])
                    ? Str::upper(trim((string) $item['serial_number']))
                    : null;

                return $item;
            }, $this->input('items'));
        }

        if ($data !== []) {
            $this->merge($data);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string|object>>
     */
    protected function invoiceRules(): array
    {
        return [
            'invoice_number' => ['nullable', 'string', 'max:40'],
            'client_id' => ['required', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'invoice_date' => ['required', 'date'],
            'tax_rate' => ['nullable', 'numeric', 'decimal:0,2', 'min:0', 'max:100'],
            'status' => ['nullable', Rule::in(['draft', 'issued', 'void'])],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.serial_number' => ['nullable', 'string', 'max:100'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:10000'],
            'items.*.unit_price' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:999999'],
            'items.*.warranty_months' => ['nullable', 'integer', 'min:0', 'max:120'],
            'items.*.warranty_start_date' => ['nullable', 'date'],
        ];
    }
}

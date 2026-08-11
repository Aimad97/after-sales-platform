<?php

namespace App\Http\Requests\Invoices;

use App\Models\Invoice;

class StoreInvoiceRequest extends InvoiceRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Invoice::class) ?? false;
    }

    /**
     * @return array<string, list<string|object>>
     */
    public function rules(): array
    {
        return $this->invoiceRules();
    }
}

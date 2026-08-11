<?php

namespace App\Http\Requests\Invoices;

use App\Models\Invoice;

class UpdateInvoiceRequest extends InvoiceRequest
{
    public function authorize(): bool
    {
        $invoice = $this->route('invoice');

        return $invoice instanceof Invoice && ($this->user()?->can('update', $invoice) ?? false);
    }

    /**
     * Draft invoices are edited as complete documents so recalculation and
     * client purchase synchronization remain atomic.
     *
     * @return array<string, list<string|object>>
     */
    public function rules(): array
    {
        return $this->invoiceRules();
    }
}

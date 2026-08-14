<?php

namespace App\Http\Requests\Reports;

use App\Enums\RepairResult;
use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Enums\WarrantyStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexReportRequest extends FormRequest
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
        $statusRule = $this->route('type') === 'repairs'
            ? Rule::enum(RepairResult::class)
            : Rule::enum(TicketStatus::class);

        return [
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'technician_id' => ['nullable', 'integer', Rule::exists('technicians', 'id')->whereNull('deleted_at')],
            'status' => ['nullable', $statusRule],
            'priority' => ['nullable', Rule::enum(TicketPriority::class)],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'warranty_state' => ['nullable', Rule::enum(WarrantyStatus::class)],
            'client_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}

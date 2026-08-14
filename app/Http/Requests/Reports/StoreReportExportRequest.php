<?php

namespace App\Http\Requests\Reports;

class StoreReportExportRequest extends IndexReportRequest
{
    /**
     * @return array<string, list<string|object>>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'format' => ['required', 'string', 'in:csv'],
        ];
    }
}

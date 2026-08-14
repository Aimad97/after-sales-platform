<?php

namespace App\Http\Resources;

use App\Enums\ReportExportStatus;
use App\Models\ReportExport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Route;

/** @mixin ReportExport */
class ReportExportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'report_type' => $this->report_type,
            'format' => $this->format,
            'status' => $this->hasExpired() ? ReportExportStatus::Expired->value : $this->status?->value,
            'download_url' => $this->isDownloadable() && Route::has('reports.exports.download')
                ? route('reports.exports.download', $this->resource)
                : null,
            'row_count' => $this->row_count,
            'expires_at' => $this->expires_at?->toIso8601String(),
            'failure_message' => $this->failure_message,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

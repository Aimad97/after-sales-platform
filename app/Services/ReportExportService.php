<?php

namespace App\Services;

use App\Enums\ReportExportStatus;
use App\Enums\ReportType;
use App\Jobs\GenerateReportExport;
use App\Models\ReportExport;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportExportService
{
    /**
     * Persist an immutable export request and generate it after the transaction
     * commits. Filtered data is intentionally not serialized into the job.
     *
     * @param  array<string, mixed>  $filters
     */
    public function request(User $requester, ReportType|string $reportType, array $filters, string $format = 'csv'): ReportExport
    {
        if ($format !== 'csv') {
            throw ValidationException::withMessages([
                'format' => 'Only CSV report exports are currently supported.',
            ]);
        }

        $reportType = $reportType instanceof ReportType ? $reportType->value : $reportType;

        return DB::transaction(function () use ($requester, $reportType, $filters, $format): ReportExport {
            $export = ReportExport::query()->create([
                'requested_by' => $requester->id,
                'report_type' => $reportType,
                'format' => $format,
                'filters' => $this->filterSnapshot($filters),
                'status' => ReportExportStatus::Queued,
            ]);

            GenerateReportExport::dispatch($export->id)
                ->onQueue((string) config('reports.exports.queue', 'reports'))
                ->afterCommit();

            return $export;
        });
    }

    public function download(ReportExport $export): StreamedResponse
    {
        if ($export->hasExpired()) {
            $export->forceFill(['status' => ReportExportStatus::Expired])->save();

            abort(410, 'This report export has expired.');
        }

        abort_unless($export->status === ReportExportStatus::Completed, 409, 'This report export is not ready yet.');
        abort_unless($export->disk !== null && $export->path !== null && $export->filename !== null, 404);
        abort_unless(Storage::disk($export->disk)->exists($export->path), 404);

        return Storage::disk($export->disk)->download(
            $export->path,
            $export->filename,
            [
                'Content-Type' => $export->mime_type ?? 'text/csv; charset=UTF-8',
                'Cache-Control' => 'private, no-store',
                'X-Content-Type-Options' => 'nosniff',
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function filterSnapshot(array $filters): array
    {
        unset($filters['format'], $filters['page'], $filters['per_page']);

        return $filters;
    }
}

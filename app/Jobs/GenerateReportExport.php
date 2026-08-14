<?php

namespace App\Jobs;

use App\Enums\ReportExportStatus;
use App\Models\ReportExport;
use App\Services\ReportService;
use BackedEnum;
use DateTimeInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Stringable;
use Throwable;

class GenerateReportExport implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 900;

    public function __construct(public readonly int $exportId) {}

    public function handle(ReportService $reports): void
    {
        $export = ReportExport::query()->find($this->exportId);

        if ($export === null || $export->status === ReportExportStatus::Completed) {
            return;
        }

        $export->forceFill([
            'status' => ReportExportStatus::Processing,
            'started_at' => $export->started_at ?? now(),
            'failed_at' => null,
            'failure_message' => null,
        ])->save();

        $disk = (string) config('reports.exports.disk', 'report_exports');
        $filename = $this->filename($export);
        $path = "{$export->uuid}/{$filename}";
        $stream = tmpfile();

        if ($stream === false) {
            throw new \RuntimeException('A temporary report export stream could not be opened.');
        }

        try {
            $columns = $reports->exportColumns($export->report_type);

            if ($columns === []) {
                throw new \LogicException("Report export [{$export->report_type}] has no CSV columns.");
            }

            // Excel recognizes UTF-8 reliably when a BOM is present.
            fwrite($stream, "\xEF\xBB\xBF");
            $this->writeRow($stream, array_values($columns));

            $rowCount = 0;

            foreach ($reports->exportRows($export->report_type, $export->filters ?? []) as $row) {
                $this->writeRow($stream, array_map(
                    fn (string $column): string => $this->csvValue(data_get($row, $column)),
                    array_keys($columns),
                ));

                $rowCount++;
            }

            rewind($stream);

            if (Storage::disk($disk)->writeStream($path, $stream) === false) {
                throw new \RuntimeException('The completed report export could not be stored.');
            }

            $export->forceFill([
                'status' => ReportExportStatus::Completed,
                'disk' => $disk,
                'path' => $path,
                'filename' => $filename,
                'mime_type' => 'text/csv; charset=UTF-8',
                'row_count' => $rowCount,
                'completed_at' => now(),
                'expires_at' => now()->addDays(max(1, (int) config('reports.exports.expiration_days', 7))),
            ])->save();
        } catch (Throwable $exception) {
            Storage::disk($disk)->delete($path);

            throw $exception;
        } finally {
            fclose($stream);
        }
    }

    public function failed(Throwable $exception): void
    {
        $export = ReportExport::query()->find($this->exportId);

        if ($export === null || $export->status === ReportExportStatus::Completed) {
            return;
        }

        $export->forceFill([
            'status' => ReportExportStatus::Failed,
            'failed_at' => now(),
            'failure_message' => 'The report export could not be generated. Please try again.',
        ])->save();

        Log::error('Report export generation failed.', [
            'report_export_id' => $export->id,
            'exception' => $exception,
        ]);
    }

    private function filename(ReportExport $export): string
    {
        $type = Str::slug($export->report_type);

        return sprintf('%s-report-%s.csv', $type !== '' ? $type : 'sav', now()->format('Ymd-His'));
    }

    /**
     * @param  resource  $stream
     * @param  list<string>  $values
     */
    private function writeRow($stream, array $values): void
    {
        if (fputcsv($stream, $values, ',', '"', '') === false) {
            throw new \RuntimeException('A report export row could not be written.');
        }
    }

    private function csvValue(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if ($value instanceof BackedEnum) {
            $value = $value->value;
        } elseif ($value instanceof DateTimeInterface) {
            $value = $value->format(DATE_ATOM);
        } elseif (is_bool($value)) {
            $value = $value ? 'Yes' : 'No';
        } elseif ($value instanceof Stringable) {
            $value = (string) $value;
        } elseif (is_array($value) || is_object($value)) {
            $value = json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        }

        $value = (string) $value;
        $formula = ltrim($value, " \t\r\n");

        // Avoid CSV/Excel formula injection from user-entered values.
        if ($formula !== '' && str_contains('=+-@', $formula[0])) {
            return "'{$formula}";
        }

        return $value;
    }
}

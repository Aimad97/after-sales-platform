<?php

namespace App\Console\Commands;

use App\Models\ReportExport;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class PruneExpiredReportExports extends Command
{
    protected $signature = 'reports:prune-expired';

    protected $description = 'Remove expired private report export files and their metadata.';

    public function handle(): int
    {
        $pruned = 0;
        $failed = 0;
        $expiresBefore = now();

        ReportExport::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', $expiresBefore)
            ->orderBy('id')
            ->chunkById(100, function ($exports) use (&$pruned, &$failed): void {
                foreach ($exports as $export) {
                    if (! $this->removeFile($export)) {
                        $failed++;

                        continue;
                    }

                    try {
                        $export->delete();
                        $pruned++;
                    } catch (Throwable $exception) {
                        $failed++;

                        Log::warning('Expired report export metadata could not be removed.', [
                            'report_export_id' => $export->id,
                            'exception' => $exception,
                        ]);
                    }
                }
            });

        $this->components->info("Pruned {$pruned} expired report export(s).");

        if ($failed > 0) {
            $this->components->warn("{$failed} expired report export(s) were retained and will be retried.");

            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    private function removeFile(ReportExport $export): bool
    {
        if ($export->disk === null && $export->path === null) {
            return true;
        }

        if (! filled($export->disk) || ! filled($export->path) || ! $this->hasOwnedPath($export)) {
            Log::warning('Expired report export has unsafe or incomplete storage metadata.', [
                'report_export_id' => $export->id,
            ]);

            return false;
        }

        try {
            $storage = Storage::disk($export->disk);

            if (! $storage->exists($export->path)) {
                return true;
            }

            if ($storage->delete($export->path)) {
                return true;
            }

            // A concurrent cleanup can make the object disappear after exists().
            if (! $storage->exists($export->path)) {
                return true;
            }
        } catch (Throwable $exception) {
            Log::warning('Expired report export file could not be removed.', [
                'report_export_id' => $export->id,
                'exception' => $exception,
            ]);

            return false;
        }

        Log::warning('Expired report export file deletion was unsuccessful.', [
            'report_export_id' => $export->id,
        ]);

        return false;
    }

    private function hasOwnedPath(ReportExport $export): bool
    {
        $path = str_replace('\\', '/', ltrim((string) $export->path, '/'));

        return str_starts_with($path, "{$export->uuid}/")
            && ! in_array('..', explode('/', $path), true);
    }
}

<?php

namespace Database\Factories;

use App\Enums\ReportExportStatus;
use App\Enums\ReportType;
use App\Models\ReportExport;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<ReportExport> */
class ReportExportFactory extends Factory
{
    protected $model = ReportExport::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'uuid' => (string) Str::uuid(),
            'requested_by' => User::factory(),
            'report_type' => ReportType::Tickets->value,
            'format' => 'csv',
            'filters' => [],
            'status' => ReportExportStatus::Queued,
            'disk' => 'report_exports',
            'path' => null,
            'filename' => null,
            'mime_type' => null,
            'row_count' => null,
            'started_at' => null,
            'completed_at' => null,
            'failed_at' => null,
            'expires_at' => now()->addDay(),
            'failure_message' => null,
        ];
    }

    public function completed(): static
    {
        return $this->state(function (): array {
            $filename = 'tickets-'.Str::lower(Str::random(8)).'.csv';

            return [
                'status' => ReportExportStatus::Completed,
                'path' => 'exports/'.$filename,
                'filename' => $filename,
                'mime_type' => 'text/csv',
                'row_count' => fake()->numberBetween(0, 100),
                'started_at' => now()->subMinute(),
                'completed_at' => now(),
                'expires_at' => now()->addDay(),
            ];
        });
    }

    public function expired(): static
    {
        return $this->completed()->state(fn (): array => [
            'status' => ReportExportStatus::Expired,
            'expires_at' => now()->subMinute(),
        ]);
    }
}

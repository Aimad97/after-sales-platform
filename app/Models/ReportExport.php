<?php

namespace App\Models;

use App\Enums\ReportExportStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ReportExport extends Model
{
    protected $fillable = [
        'uuid',
        'requested_by',
        'report_type',
        'format',
        'filters',
        'status',
        'disk',
        'path',
        'filename',
        'mime_type',
        'row_count',
        'started_at',
        'completed_at',
        'failed_at',
        'expires_at',
        'failure_message',
    ];

    protected function casts(): array
    {
        return [
            'filters' => 'array',
            'status' => ReportExportStatus::class,
            'row_count' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'failed_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $export): void {
            if ($export->uuid === null) {
                $export->uuid = (string) Str::uuid();
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function hasExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function isDownloadable(): bool
    {
        return $this->status === ReportExportStatus::Completed
            && $this->path !== null
            && ! $this->hasExpired();
    }
}

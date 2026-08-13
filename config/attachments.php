<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Private attachment storage
    |--------------------------------------------------------------------------
    |
    | Never point this at the application's public disk. Use the bundled
    | "attachments" disk locally, or the private "attachments_s3" disk in
    | production.
    |
    */
    'disk' => env('ATTACHMENTS_DISK', 'attachments'),
    'legacy_disk' => env('ATTACHMENTS_LEGACY_DISK', 'local'),
    'max_size_kb' => (int) env('ATTACHMENTS_MAX_SIZE_KB', 10240),
    'allowed_types' => [
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png' => ['image/png'],
        'webp' => ['image/webp'],
        'pdf' => ['application/pdf'],
        'txt' => ['text/plain'],
        'csv' => ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'],
        'doc' => ['application/msword', 'application/CDFV2'],
        'docx' => [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/zip',
        ],
        'xls' => ['application/vnd.ms-excel', 'application/CDFV2'],
        'xlsx' => [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/zip',
        ],
    ],
];

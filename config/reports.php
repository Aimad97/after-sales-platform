<?php

return [
    'exports' => [
        /*
        |------------------------------------------------------------------
        | Private report export storage
        |------------------------------------------------------------------
        |
        | The default `report_exports` disk points to a private directory. Files are
        | deliberately downloaded through an authorized API endpoint rather
        | than being exposed through the public storage symlink.
        |
        */
        'disk' => env('REPORT_EXPORT_DISK', 'report_exports'),

        // Dedicated queue so long-running exports do not delay mail or events.
        'queue' => env('REPORT_EXPORT_QUEUE', 'reports'),

        // Completed exports remain downloadable for this many days.
        'expiration_days' => (int) env('REPORT_EXPORT_EXPIRATION_DAYS', 7),
    ],
];

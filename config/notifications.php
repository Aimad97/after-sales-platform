<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Queue names
    |--------------------------------------------------------------------------
    */
    'mail_queue' => env('NOTIFICATIONS_MAIL_QUEUE', 'mail'),

    /*
    |--------------------------------------------------------------------------
    | Warranty expiration alerts
    |--------------------------------------------------------------------------
    |
    | The scheduled command only sends these alerts when explicitly enabled.
    | This avoids unexpectedly emailing existing customer records after a
    | deployment.
    |
    */
    'warranty_expiration' => [
        'enabled' => (bool) env('NOTIFY_WARRANTY_EXPIRATION', false),
        'days_before_expiry' => (int) env('WARRANTY_EXPIRATION_NOTICE_DAYS', 30),
        'schedule' => env('WARRANTY_EXPIRATION_NOTICE_SCHEDULE', '08:00'),
    ],
];

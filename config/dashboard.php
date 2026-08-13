<?php

return [
    /*
     * Dashboard payloads are composed of database aggregates. A short cache
     * prevents the most expensive operational charts from being recalculated
     * for every refresh; model observers advance the cache version on changes.
     */
    'cache_ttl_seconds' => (int) env('DASHBOARD_CACHE_TTL_SECONDS', 60),

    /* A ticket without a deadline is considered overdue after this many days. */
    'overdue_ticket_after_days' => (int) env('DASHBOARD_OVERDUE_TICKET_AFTER_DAYS', 3),
];

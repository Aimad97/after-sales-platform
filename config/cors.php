<?php

$allowedOrigins = array_values(array_filter(array_map(
    static fn (string $origin): string => trim($origin),
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173')),
)));

foreach ($allowedOrigins as $origin) {
    $parts = parse_url($origin);

    if (
        $origin === '*'
        || ! is_array($parts)
        || ! in_array($parts['scheme'] ?? null, ['http', 'https'], true)
        || blank($parts['host'] ?? null)
        || isset($parts['user'])
        || isset($parts['pass'])
        || isset($parts['path'])
        || isset($parts['query'])
        || isset($parts['fragment'])
    ) {
        throw new LogicException('CORS_ALLOWED_ORIGINS must contain explicit HTTP(S) origins without paths.');
    }
}

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'broadcasting/auth'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => $allowedOrigins,
    'allowed_origins_patterns' => [],
    'allowed_headers' => [
        'Accept',
        'Authorization',
        'Content-Type',
        'Origin',
        'X-CSRF-TOKEN',
        'X-Requested-With',
        'X-Socket-ID',
        'X-XSRF-TOKEN',
    ],
    'exposed_headers' => ['Content-Disposition', 'Retry-After'],
    'max_age' => 600,
    'supports_credentials' => true,
];

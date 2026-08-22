<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        // Sanctum identifies same-origin SPA GET requests from their Referer
        // header because browsers generally omit Origin on those requests.
        // Keep that header on our own origin without leaking it cross-origin.
        $response->headers->set('Referrer-Policy', 'same-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        $response->headers->set('X-XSS-Protection', '0');
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        $response->headers->set('Cross-Origin-Resource-Policy', 'same-site');
        $response->headers->set(
            'Content-Security-Policy',
            $this->contentSecurityPolicy(),
        );

        // APP_URL is required to be HTTPS in production. Checking it as well
        // as the request supports deployments behind a TLS-terminating proxy.
        if (app()->environment('production') && ($request->isSecure() || parse_url((string) config('app.url'), PHP_URL_SCHEME) === 'https')) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        if ($request->is('api/*') && $this->isJsonResponse($response)) {
            $response->headers->set('Cache-Control', 'no-store, private');
            $response->headers->set('Pragma', 'no-cache');
        }

        return $response;
    }

    private function isJsonResponse(Response $response): bool
    {
        return str_contains(strtolower((string) $response->headers->get('Content-Type')), 'application/json');
    }

    private function contentSecurityPolicy(): string
    {
        $scriptSources = ["'self'"];
        // Tailwind/React uses a controlled inline width for upload progress.
        // Script execution remains strictly limited in production.
        $styleSources = ["'self'", "'unsafe-inline'"];
        $connectSources = ["'self'"];

        // Vite's development client is only enabled outside production. The
        // production policy consequently has no wildcard or inline scripts.
        if (! app()->environment('production')) {
            $scriptSources = [...$scriptSources, "'unsafe-inline'", 'http://localhost:5173', 'http://127.0.0.1:5173'];
            $connectSources = [...$connectSources, 'http://localhost:5173', 'ws://localhost:8080', 'ws://127.0.0.1:8080'];
        }

        $frontendUrl = (string) config('frontend.url');
        if (filter_var($frontendUrl, FILTER_VALIDATE_URL)) {
            $connectSources[] = rtrim($frontendUrl, '/');
        }

        $reverbScheme = (string) config('broadcasting.connections.reverb.options.scheme', 'http');
        $reverbHost = (string) config('broadcasting.connections.reverb.options.host', 'localhost');
        $reverbPort = (int) config('broadcasting.connections.reverb.options.port', 8080);
        $connectSources[] = sprintf('%s://%s:%d', $reverbScheme === 'https' ? 'wss' : 'ws', $reverbHost, $reverbPort);

        return implode('; ', [
            "default-src 'self'",
            'base-uri \'self\'',
            'object-src \'none\'',
            'frame-ancestors \'none\'',
            'form-action \'self\'',
            'script-src '.implode(' ', array_unique($scriptSources)),
            'style-src '.implode(' ', array_unique($styleSources)),
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            'connect-src '.implode(' ', array_unique($connectSources)),
        ]);
    }
}

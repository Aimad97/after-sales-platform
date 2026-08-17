<?php

namespace App\Providers;

use App\Models\Attachment;
use App\Models\AuditLog;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Repair;
use App\Models\ReportExport;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use App\Observers\AttachmentOwnerObserver;
use App\Observers\AuditObserver;
use App\Observers\DashboardMetricsCacheObserver;
use App\Policies\AttachmentPolicy;
use App\Policies\AuditLogPolicy;
use App\Policies\CatalogPolicy;
use App\Policies\ClientPolicy;
use App\Policies\DashboardPolicy;
use App\Policies\InvoicePolicy;
use App\Policies\RepairPolicy;
use App\Policies\ReportExportPolicy;
use App\Policies\ReportPolicy;
use App\Policies\TechnicianPolicy;
use App\Policies\TicketPolicy;
use App\Policies\UserPolicy;
use App\Policies\WarrantyPolicy;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use LogicException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        PasswordRule::defaults(fn (): PasswordRule => PasswordRule::min(12)->mixedCase()->numbers()->symbols());
        $this->assertSecureProductionConfiguration();

        Gate::policy(Category::class, CatalogPolicy::class);
        Gate::policy(Brand::class, CatalogPolicy::class);
        Gate::policy(Product::class, CatalogPolicy::class);
        Gate::policy(Client::class, ClientPolicy::class);
        Gate::policy(Invoice::class, InvoicePolicy::class);
        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(Technician::class, TechnicianPolicy::class);
        Gate::policy(Ticket::class, TicketPolicy::class);
        Gate::policy(Warranty::class, WarrantyPolicy::class);
        Gate::policy(Repair::class, RepairPolicy::class);
        Gate::policy(AuditLog::class, AuditLogPolicy::class);
        Gate::policy(Attachment::class, AttachmentPolicy::class);
        Gate::policy(ReportExport::class, ReportExportPolicy::class);
        Gate::define('view-dashboard', [DashboardPolicy::class, 'view']);
        Gate::define('view-reports', [ReportPolicy::class, 'view']);
        Ticket::observe(AuditObserver::class);
        Repair::observe(AuditObserver::class);
        Attachment::observe(AuditObserver::class);
        Ticket::observe(AttachmentOwnerObserver::class);
        Product::observe(AttachmentOwnerObserver::class);
        Repair::observe(AttachmentOwnerObserver::class);
        Ticket::observe(DashboardMetricsCacheObserver::class);
        Repair::observe(DashboardMetricsCacheObserver::class);
        Warranty::observe(DashboardMetricsCacheObserver::class);
        Product::observe(DashboardMetricsCacheObserver::class);
        Technician::observe(DashboardMetricsCacheObserver::class);
        User::observe(DashboardMetricsCacheObserver::class);

        Gate::before(function (User $user): ?bool {
            if ($user->hasRole('client') && ! $user->isClientPortalUser()) {
                return false;
            }

            return $user->hasRole('super_admin') ? true : null;
        });

        ResetPassword::createUrlUsing(fn (object $notifiable, string $token): string => sprintf(
            '%s/reset-password?%s',
            rtrim((string) config('frontend.url'), '/'),
            http_build_query(['token' => $token, 'email' => $notifiable->getEmailForPasswordReset()]),
        ));

        RateLimiter::for('login', function (Request $request): array {
            return [
                Limit::perMinute(5)->by(Str::lower((string) $request->input('email')).'|'.$request->ip()),
                Limit::perMinute(20)->by((string) $request->ip()),
            ];
        });

        RateLimiter::for('password-reset', function (Request $request): array {
            return [
                Limit::perMinute(3)->by(Str::lower((string) $request->input('email')).'|'.$request->ip()),
                Limit::perMinute(10)->by((string) $request->ip()),
            ];
        });

        RateLimiter::for('authenticated-api', function (Request $request): Limit {
            return Limit::perMinute(180)->by(($request->user()?->getAuthIdentifier() ?? 'guest').'|'.$request->ip());
        });

        RateLimiter::for('broadcast-auth', function (Request $request): Limit {
            return Limit::perMinute(60)->by(($request->user()?->getAuthIdentifier() ?? 'guest').'|'.$request->ip());
        });

        RateLimiter::for('attachment-upload', function (Request $request): Limit {
            return Limit::perMinute(30)->by(($request->user()?->getAuthIdentifier() ?? 'guest').'|'.$request->ip());
        });

        RateLimiter::for('report-export', function (Request $request): Limit {
            return Limit::perMinute(10)->by(($request->user()?->getAuthIdentifier() ?? 'guest').'|'.$request->ip());
        });

        RateLimiter::for('global-search', function (Request $request): Limit {
            return Limit::perMinute(60)->by(($request->user()?->getAuthIdentifier() ?? 'guest').'|'.$request->ip());
        });
    }

    private function assertSecureProductionConfiguration(): void
    {
        if (! $this->app->environment('production')) {
            return;
        }

        $violations = [];

        if (blank(config('app.key'))) {
            $violations[] = 'APP_KEY must be set';
        }

        if (config('app.debug')) {
            $violations[] = 'APP_DEBUG must be false';
        }

        $appUrl = parse_url((string) config('app.url'));
        if (($appUrl['scheme'] ?? null) !== 'https' || blank($appUrl['host'] ?? null)) {
            $violations[] = 'APP_URL must use HTTPS';
        }

        if (! config('session.encrypt')) {
            $violations[] = 'SESSION_ENCRYPT must be true';
        }

        if (! config('session.secure')) {
            $violations[] = 'SESSION_SECURE_COOKIE must be true';
        }

        if (! config('session.http_only')) {
            $violations[] = 'SESSION_HTTP_ONLY must be true';
        }

        if (config('session.same_site') === 'none' && ! config('session.secure')) {
            $violations[] = 'SESSION_SAME_SITE=none requires secure cookies';
        }

        $allowedOrigins = config('cors.allowed_origins', []);
        if (! is_array($allowedOrigins) || $allowedOrigins === []) {
            $violations[] = 'CORS_ALLOWED_ORIGINS must contain at least one explicit origin';
        } else {
            foreach ($allowedOrigins as $origin) {
                $parts = parse_url((string) $origin);

                if (($parts['scheme'] ?? null) !== 'https' || blank($parts['host'] ?? null)) {
                    $violations[] = 'CORS_ALLOWED_ORIGINS must use HTTPS in production';
                    break;
                }
            }
        }

        $statefulDomains = config('sanctum.stateful', []);
        if (! is_array($statefulDomains) || $statefulDomains === []) {
            $violations[] = 'SANCTUM_STATEFUL_DOMAINS must contain the trusted frontend domain';
        } elseif (collect($statefulDomains)->contains(function (mixed $domain): bool {
            $host = strtolower((string) $domain);

            return in_array($host, ['localhost', 'localhost:3000', 'localhost:5173', '127.0.0.1', '127.0.0.1:8000', '::1'], true);
        })) {
            $violations[] = 'SANCTUM_STATEFUL_DOMAINS must not contain loopback hosts in production';
        }

        if (config('broadcasting.connections.reverb.options.scheme') !== 'https') {
            $violations[] = 'REVERB_SCHEME must be https';
        }

        $reverbKey = (string) config('broadcasting.connections.reverb.key');
        $reverbSecret = (string) config('broadcasting.connections.reverb.secret');
        if (
            blank($reverbKey)
            || blank($reverbSecret)
            || in_array($reverbKey, ['servicedesk-local-key', 'change-me'], true)
            || in_array($reverbSecret, ['change-this-local-secret', 'secret', 'change-me'], true)
        ) {
            $violations[] = 'Reverb credentials must be set';
        }

        if (in_array(config('attachments.disk'), ['public'], true)) {
            $violations[] = 'ATTACHMENTS_DISK must be private';
        }

        if (in_array(config('reports.exports.disk'), ['public'], true)) {
            $violations[] = 'REPORT_EXPORT_DISK must be private';
        }

        if ($violations !== []) {
            throw new LogicException('Insecure production configuration: '.implode('; ', $violations).'.');
        }
    }
}

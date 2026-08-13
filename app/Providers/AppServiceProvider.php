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
        Gate::define('view-dashboard', [DashboardPolicy::class, 'view']);
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

        Gate::before(fn (User $user): ?bool => $user->hasRole('super_admin') ? true : null);

        ResetPassword::createUrlUsing(fn (object $notifiable, string $token): string => sprintf(
            '%s/reset-password?%s',
            rtrim((string) config('frontend.url'), '/'),
            http_build_query(['token' => $token, 'email' => $notifiable->getEmailForPasswordReset()]),
        ));

        RateLimiter::for('login', function (Request $request): Limit {
            return Limit::perMinute(5)->by(Str::lower((string) $request->input('email')).'|'.$request->ip());
        });

        RateLimiter::for('password-reset', function (Request $request): Limit {
            return Limit::perMinute(3)->by(Str::lower((string) $request->input('email')).'|'.$request->ip());
        });

        RateLimiter::for('attachment-upload', function (Request $request): Limit {
            return Limit::perMinute(30)->by(($request->user()?->getAuthIdentifier() ?? 'guest').'|'.$request->ip());
        });
    }
}

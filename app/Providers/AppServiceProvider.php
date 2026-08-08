<?php

namespace App\Providers;

use App\Models\Client;
use App\Models\Technician;
use App\Models\User;
use App\Policies\ClientPolicy;
use App\Policies\TechnicianPolicy;
use App\Policies\UserPolicy;
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
        Gate::policy(Client::class, ClientPolicy::class);
        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(Technician::class, TechnicianPolicy::class);

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
    }
}

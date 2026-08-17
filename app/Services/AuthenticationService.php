<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Contracts\Auth\Factory as AuthFactory;
use Illuminate\Contracts\Auth\StatefulGuard;
use Illuminate\Contracts\Hashing\Hasher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class AuthenticationService
{
    public function __construct(
        private readonly AuthFactory $auth,
        private readonly Hasher $hasher,
        private readonly CredentialRevocationService $credentials,
    ) {}

    public function login(Request $request, string $email, string $password, bool $remember = false): ?User
    {
        if (! $this->guard()->attempt(['email' => Str::lower($email), 'password' => $password, 'status' => 'active'], $remember)) {
            return null;
        }

        $request->session()->regenerate();

        /** @var User $user */
        $user = $this->guard()->user();
        $user->forceFill(['last_login_at' => now()])->save();

        return $user;
    }

    public function logout(Request $request): void
    {
        $this->guard()->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }

    public function sendPasswordResetLink(string $email): void
    {
        Password::sendResetLink(['email' => Str::lower($email)]);
    }

    public function resetPassword(array $credentials): string
    {
        return Password::reset($credentials, function (User $user, string $password): void {
            DB::transaction(function () use ($user, $password): void {
                $user->forceFill([
                    'password' => $this->hasher->make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                $this->credentials->revoke($user);
            });
        });
    }

    public function changePassword(Request $request, User $user, string $password): void
    {
        $sessionId = $request->session()->getId();

        DB::transaction(function () use ($user, $password, $sessionId): void {
            $user->forceFill([
                'password' => $this->hasher->make($password),
                'remember_token' => Str::random(60),
            ])->save();

            $this->credentials->revoke($user, $sessionId);
        });

        $request->session()->regenerate();
    }

    private function guard(): StatefulGuard
    {
        return $this->auth->guard('web');
    }
}

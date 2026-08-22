<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeader('Origin', 'http://localhost:5173');
    }

    private function user(): User
    {
        return User::query()->forceCreate([
            'uuid' => fake()->uuid(),
            'first_name' => 'Amina',
            'last_name' => 'Bennani',
            'email' => 'amina@example.test',
            'password' => Hash::make('Current!Password123'),
        ]);
    }

    public function test_user_can_log_in_with_valid_credentials(): void
    {
        $user = $this->user();

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Current!Password123'])
            ->assertOk()
            ->assertJsonPath('data.email', $user->email);

        $this->assertAuthenticatedAs($user);
        $this->assertNotNull($user->fresh()->last_login_at);
    }

    public function test_same_origin_spa_session_authenticates_a_follow_up_get_request(): void
    {
        $user = $this->user();

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'Current!Password123',
        ])->assertOk()
            ->assertCookie(config('session.cookie'));

        // Browsers normally send Origin for the login POST and Referer for a
        // same-origin GET. Sanctum uses that request context to enable the web
        // session middleware for the API request.
        $this->withoutHeader('Origin')
            ->withHeader('Referer', 'http://localhost:5173/login')
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.email', $user->email);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        $this->user();

        $this->postJson('/api/auth/login', ['email' => 'amina@example.test', 'password' => 'incorrect-password'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'The provided credentials are incorrect.');
    }

    public function test_authenticated_user_can_log_out(): void
    {
        $user = $this->user();

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'Current!Password123',
        ])->assertOk();

        $this->postJson('/api/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logged out successfully.');

        app('auth')->forgetGuards();

        $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_password_reset_requires_a_valid_confirmation(): void
    {
        $this->postJson('/api/auth/reset-password', [
            'email' => 'amina@example.test',
            'token' => 'reset-token',
            'password' => 'Secure!Password123',
            'password_confirmation' => 'different-password',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_non_active_accounts_cannot_authenticate_with_a_valid_password(): void
    {
        $accounts = [
            User::factory()->invited()->create(['password' => 'Current!Password123']),
            User::factory()->suspended()->create(['password' => 'Current!Password123']),
            User::factory()->archived()->create(['password' => 'Current!Password123']),
        ];

        foreach ($accounts as $account) {
            $this->postJson('/api/auth/login', [
                'email' => $account->email,
                'password' => 'Current!Password123',
            ])->assertUnprocessable()
                ->assertJsonPath('message', 'The provided credentials are incorrect.');

            $this->assertGuest();
            $this->assertNull($account->fresh()->last_login_at);
        }
    }

    public function test_login_normalizes_email_case(): void
    {
        $user = User::factory()->create([
            'email' => 'case-sensitive@example.test',
            'password' => 'Current!Password123',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'CASE-SENSITIVE@EXAMPLE.TEST',
            'password' => 'Current!Password123',
        ])->assertOk()->assertJsonPath('data.email', $user->email);

        $this->assertAuthenticatedAs($user);
    }

    public function test_password_change_requires_the_current_password_and_revokes_api_tokens(): void
    {
        $user = User::factory()->create(['password' => 'Current!Password123']);
        $token = $user->createToken('mobile-session');

        $this->actingAs($user)->putJson('/api/auth/password', [
            'current_password' => 'Wrong!Password123',
            'password' => 'NewSecure!Password456',
            'password_confirmation' => 'NewSecure!Password456',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->assertTrue(Hash::check('Current!Password123', $user->fresh()->password));
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $token->accessToken->id]);

        $this->actingAs($user)->putJson('/api/auth/password', [
            'current_password' => 'Current!Password123',
            'password' => 'NewSecure!Password456',
            'password_confirmation' => 'NewSecure!Password456',
        ])->assertOk()->assertJsonPath('message', 'Password changed successfully.');

        $this->assertFalse(Hash::check('Current!Password123', $user->fresh()->password));
        $this->assertTrue(Hash::check('NewSecure!Password456', $user->fresh()->password));
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $token->accessToken->id]);
    }

    public function test_forgot_password_response_does_not_reveal_whether_an_account_exists(): void
    {
        Notification::fake();
        $user = User::factory()->create();
        $message = 'If an account exists for this email address, a password reset link has been sent.';

        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])
            ->assertOk()
            ->assertJsonPath('message', $message);
        $this->postJson('/api/auth/forgot-password', ['email' => 'missing@example.test'])
            ->assertOk()
            ->assertJsonPath('message', $message);
    }
}

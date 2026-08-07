<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
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
}

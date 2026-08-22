<?php

namespace Tests\Feature\Security;

use App\Models\Client;
use App\Models\User;
use App\Services\AuditLogger;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_api_responses_have_browser_and_cache_protections(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertHeader('x-content-type-options', 'nosniff')
            ->assertHeader('x-frame-options', 'DENY')
            ->assertHeader('referrer-policy', 'same-origin')
            ->assertHeader('cache-control', 'no-store, private')
            ->assertHeader('pragma', 'no-cache')
            ->assertHeader('cross-origin-opener-policy', 'same-origin')
            ->assertHeader('cross-origin-resource-policy', 'same-site')
            ->assertHeaderContains('content-security-policy', "default-src 'self'")
            ->assertHeaderContains('content-security-policy', "object-src 'none'")
            ->assertHeaderContains('content-security-policy', "frame-ancestors 'none'");
    }

    public function test_spa_preserves_the_same_origin_referrer_required_by_sanctum(): void
    {
        $this->get('/login')
            ->assertOk()
            ->assertHeader('referrer-policy', 'same-origin');
    }

    public function test_credentialed_cors_never_uses_a_wildcard_origin(): void
    {
        $origins = config('cors.allowed_origins');

        $this->assertIsArray($origins);
        $this->assertNotContains('*', $origins);
        $this->assertNotEmpty($origins);

        foreach ($origins as $origin) {
            $this->assertMatchesRegularExpression('#^https?://[^/]+$#', $origin);
        }
    }

    public function test_api_errors_do_not_return_exception_details_when_debug_is_disabled(): void
    {
        Route::get('/api/testing/security-error', function (): never {
            throw new RuntimeException('database password must never be returned');
        })->middleware('auth:sanctum');

        $user = User::factory()->create();
        $user->assignRole('admin');
        // The API remains generic even if a misconfigured non-production
        // environment accidentally enables debug output.
        config(['app.debug' => true]);

        $this->actingAs($user)->getJson('/api/testing/security-error')
            ->assertStatus(500)
            ->assertJsonPath('message', 'Server error.')
            ->assertJsonMissing(['message' => 'database password must never be returned']);
    }

    public function test_audit_redaction_removes_sensitive_keys_recursively(): void
    {
        $user = User::factory()->create();

        app(AuditLogger::class)->record(
            $user,
            'security.test',
            ['profile' => ['email' => $user->email, 'password' => 'old-secret']],
            ['token' => 'new-secret', 'nested' => ['api_key' => 'secret', 'safe' => 'kept']],
            $user,
        );

        $audit = DB::table('audit_logs')->latest('id')->first();

        $this->assertNotNull($audit);
        $this->assertStringNotContainsString('old-secret', (string) $audit->old_values);
        $this->assertStringNotContainsString('new-secret', (string) $audit->new_values);
        $this->assertStringContainsString('kept', (string) $audit->new_values);
    }

    public function test_client_phone_is_not_lost_by_mass_assignment(): void
    {
        $client = Client::factory()->create(['phone' => '+212600000001']);

        $this->assertSame('+212600000001', $client->fresh()->phone);
    }

    public function test_client_portal_is_denied_before_validation_for_unlinked_accounts(): void
    {
        $clientUser = User::factory()->create();
        $clientUser->assignRole('client');

        $this->actingAs($clientUser)
            ->postJson('/api/client/tickets', [])
            ->assertForbidden();
    }

    public function test_login_attempts_are_rate_limited(): void
    {
        $email = 'rate-limit-'.fake()->unique()->safeEmail();

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/auth/login', [
                'email' => $email,
                'password' => 'Wrong!Password123',
            ])->assertUnprocessable();
        }

        $this->postJson('/api/auth/login', [
            'email' => $email,
            'password' => 'Wrong!Password123',
        ])->assertTooManyRequests();
    }
}

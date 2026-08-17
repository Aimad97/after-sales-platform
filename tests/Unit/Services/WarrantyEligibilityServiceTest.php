<?php

namespace Tests\Unit\Services;

use App\Enums\WarrantyStatus;
use App\Models\Warranty;
use App\Services\WarrantyEligibilityService;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Tests\TestCase;

class WarrantyEligibilityServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-08-17 12:00:00');
        CarbonImmutable::setTestNow('2026-08-17 12:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_coverage_is_eligible_through_the_entire_expiration_date(): void
    {
        $result = $this->service()->evaluate($this->warranty([
            'starts_at' => '2025-08-17',
            'expires_at' => '2026-08-17',
        ]));

        $this->assertTrue($result['is_under_warranty']);
        $this->assertSame(0, $result['remaining_days']);
        $this->assertSame('active', $result['status']);
    }

    public function test_expired_coverage_is_ineligible_even_if_the_stored_status_is_active(): void
    {
        $result = $this->service()->evaluate($this->warranty([
            'expires_at' => '2026-08-16',
            'status' => WarrantyStatus::Active,
        ]));

        $this->assertFalse($result['is_under_warranty']);
        $this->assertSame(0, $result['remaining_days']);
        $this->assertSame('expired', $result['status']);
        $this->assertSame('Warranty expired on 2026-08-16.', $result['reason']);
    }

    public function test_future_coverage_is_not_yet_eligible(): void
    {
        $result = $this->service()->evaluate($this->warranty([
            'starts_at' => '2026-08-18',
            'expires_at' => '2027-08-18',
        ]));

        $this->assertFalse($result['is_under_warranty']);
        $this->assertSame('Warranty coverage starts on 2026-08-18.', $result['reason']);
    }

    public function test_void_and_replaced_decisions_override_valid_dates(): void
    {
        $void = $this->service()->evaluate($this->warranty([
            'status' => WarrantyStatus::Void,
            'void_reason' => 'Unauthorized modification',
        ]));
        $replaced = $this->service()->evaluate($this->warranty([
            'status' => WarrantyStatus::Replaced,
        ]));

        $this->assertFalse($void['is_under_warranty']);
        $this->assertSame('This warranty has been voided: Unauthorized modification', $void['reason']);
        $this->assertFalse($replaced['is_under_warranty']);
        $this->assertSame('This warranty has been replaced.', $replaced['reason']);
    }

    /** @param array<string, mixed> $overrides */
    private function warranty(array $overrides = []): Warranty
    {
        return new Warranty([
            'uuid' => '9bb56b2b-8366-41d5-8862-d7a24bd7b5ef',
            'customer_id' => 1,
            'product_id' => 1,
            'serial_number' => 'UNIT-WARRANTY-001',
            'quantity' => 1,
            'purchase_date' => '2025-08-17',
            'warranty_end' => $overrides['expires_at'] ?? '2027-08-17',
            'starts_at' => '2025-08-17',
            'expires_at' => '2027-08-17',
            'status' => WarrantyStatus::Active,
            ...$overrides,
        ]);
    }

    private function service(): WarrantyEligibilityService
    {
        return new WarrantyEligibilityService;
    }
}

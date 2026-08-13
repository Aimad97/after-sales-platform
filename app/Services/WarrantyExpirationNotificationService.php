<?php

namespace App\Services;

use App\Enums\WarrantyStatus;
use App\Events\WarrantyNearingExpiration;
use App\Models\Warranty;
use Illuminate\Support\Facades\DB;

class WarrantyExpirationNotificationService
{
    public function dispatchNearingExpiration(?int $daysBeforeExpiry = null): int
    {
        if (! config('notifications.warranty_expiration.enabled')) {
            return 0;
        }

        $daysBeforeExpiry ??= (int) config('notifications.warranty_expiration.days_before_expiry');
        $daysBeforeExpiry = max(1, min($daysBeforeExpiry, 365));
        $expirationDate = today()->addDays($daysBeforeExpiry);
        $dispatched = 0;

        Warranty::query()
            ->with(['client', 'product'])
            ->where('status', WarrantyStatus::Active->value)
            ->whereDate('starts_at', '<=', today())
            ->whereDate('expires_at', $expirationDate)
            ->orderBy('id')
            ->each(function (Warranty $warranty) use ($daysBeforeExpiry, &$dispatched): void {
                $inserted = DB::table('warranty_expiration_notification_logs')->insertOrIgnore([
                    'warranty_id' => $warranty->id,
                    'days_before_expiry' => $daysBeforeExpiry,
                    'notified_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                if ($inserted !== 1) {
                    return;
                }

                WarrantyNearingExpiration::dispatch($warranty, $daysBeforeExpiry);
                $dispatched++;
            });

        return $dispatched;
    }
}

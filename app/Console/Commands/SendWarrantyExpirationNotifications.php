<?php

namespace App\Console\Commands;

use App\Services\WarrantyExpirationNotificationService;
use Illuminate\Console\Command;

class SendWarrantyExpirationNotifications extends Command
{
    protected $signature = 'notifications:send-warranty-expiration {--days= : Days before expiration; defaults to configuration}';

    protected $description = 'Send enabled warranty-expiration notifications once per warranty and threshold.';

    public function handle(WarrantyExpirationNotificationService $notifications): int
    {
        $days = $this->option('days');
        $daysBeforeExpiry = is_numeric($days) ? (int) $days : null;

        if ($daysBeforeExpiry !== null && ($daysBeforeExpiry < 1 || $daysBeforeExpiry > 365)) {
            $this->components->error('The --days option must be between 1 and 365.');

            return self::INVALID;
        }

        $count = $notifications->dispatchNearingExpiration($daysBeforeExpiry);

        if (! config('notifications.warranty_expiration.enabled')) {
            $this->components->warn('Warranty expiration notifications are disabled.');

            return self::SUCCESS;
        }

        $this->components->info("Dispatched {$count} warranty expiration notification(s).");

        return self::SUCCESS;
    }
}

<?php

namespace App\Services;

use App\Enums\WarrantyStatus;
use App\Models\Warranty;
use Carbon\CarbonImmutable;

class WarrantyEligibilityService
{
    /**
     * @return array{is_under_warranty: bool, reason: string, starts_at: string, expires_at: string, remaining_days: int, status: string}
     */
    public function evaluate(Warranty $warranty): array
    {
        $today = CarbonImmutable::today();
        $status = $warranty->effectiveStatus();
        $remainingDays = max(0, (int) $today->diffInDays($warranty->expires_at, false));

        if ($status === WarrantyStatus::Void) {
            return $this->result(
                false,
                $warranty->void_reason === null
                    ? 'This warranty has been voided.'
                    : "This warranty has been voided: {$warranty->void_reason}",
                $warranty,
                $remainingDays,
                $status,
            );
        }

        if ($status === WarrantyStatus::Replaced) {
            return $this->result(false, 'This warranty has been replaced.', $warranty, $remainingDays, $status);
        }

        if ($warranty->starts_at->isAfter($today)) {
            return $this->result(
                false,
                "Warranty coverage starts on {$warranty->starts_at->toDateString()}.",
                $warranty,
                $remainingDays,
                $status,
            );
        }

        if ($status === WarrantyStatus::Expired) {
            return $this->result(
                false,
                "Warranty expired on {$warranty->expires_at->toDateString()}.",
                $warranty,
                $remainingDays,
                $status,
            );
        }

        return $this->result(
            true,
            "Warranty is active until {$warranty->expires_at->toDateString()}.",
            $warranty,
            $remainingDays,
            $status,
        );
    }

    /**
     * @return array{is_under_warranty: bool, reason: string, starts_at: string, expires_at: string, remaining_days: int, status: string}
     */
    private function result(
        bool $isUnderWarranty,
        string $reason,
        Warranty $warranty,
        int $remainingDays,
        WarrantyStatus $status,
    ): array {
        return [
            'is_under_warranty' => $isUnderWarranty,
            'reason' => $reason,
            'starts_at' => $warranty->starts_at->toDateString(),
            'expires_at' => $warranty->expires_at->toDateString(),
            'remaining_days' => $remainingDays,
            'status' => $status->value,
        ];
    }
}

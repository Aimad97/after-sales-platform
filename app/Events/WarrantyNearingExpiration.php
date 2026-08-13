<?php

namespace App\Events;

use App\Models\Warranty;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WarrantyNearingExpiration
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Warranty $warranty,
        public readonly int $daysBeforeExpiry,
    ) {}
}

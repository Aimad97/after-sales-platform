<?php

namespace App\Events;

use App\Models\Repair;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DiagnosisCompleted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Repair $repair,
        public readonly User $actor,
    ) {}
}

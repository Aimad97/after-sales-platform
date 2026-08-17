<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class CredentialRevocationService
{
    public function revoke(User $user, ?string $exceptSessionId = null): void
    {
        $user->tokens()->delete();

        if (config('session.driver') !== 'database') {
            return;
        }

        $sessions = DB::connection(config('session.connection'))
            ->table((string) config('session.table', 'sessions'))
            ->where('user_id', $user->getKey());

        if (filled($exceptSessionId)) {
            $sessions->where('id', '!=', $exceptSessionId);
        }

        $sessions->delete();
    }
}

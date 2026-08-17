<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class AuditLogger
{
    private const SENSITIVE = ['password', 'password_confirmation', 'remember_token', 'token', 'access_token', 'refresh_token', 'secret', 'api_key', 'authorization', 'cookie'];

    public function record(Model $entity, string $action, array $old = [], array $new = [], ?User $actor = null): void
    {
        $request = app()->bound('request') ? request() : null;
        AuditLog::query()->create([
            'user_id' => $actor?->id ?? $request?->user()?->id,
            'action' => $action,
            'entity_type' => $entity::class,
            'entity_id' => $entity->getKey(),
            'old_values' => $this->redact($old),
            'new_values' => $this->redact($new),
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'created_at' => now(),
        ]);
    }

    private function redact(array $values): array
    {
        $redacted = [];

        foreach ($values as $key => $value) {
            $normalizedKey = strtolower((string) $key);

            if ($this->isSensitiveKey($normalizedKey)) {
                continue;
            }

            if (in_array($normalizedKey, ['updated_at', 'created_at', 'deleted_at'], true)) {
                continue;
            }

            $redacted[$key] = is_array($value) ? $this->redact($value) : $value;
        }

        return $redacted;
    }

    private function isSensitiveKey(string $key): bool
    {
        return in_array($key, self::SENSITIVE, true)
            || str_contains($key, 'password')
            || str_contains($key, 'secret')
            || str_contains($key, 'token')
            || str_contains($key, 'api_key');
    }
}

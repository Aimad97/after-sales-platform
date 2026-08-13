<?php

namespace App\Services;

use App\Models\User;
use Closure;
use Illuminate\Support\Facades\Cache;

class DashboardCache
{
    private const VERSION_KEY = 'dashboard:snapshot-version';

    /**
     * @param  Closure(): array<string, mixed>  $resolver
     * @return array<string, mixed>
     */
    public function remember(User $user, string $scope, Closure $resolver): array
    {
        $ttl = max(0, (int) config('dashboard.cache_ttl_seconds', 60));

        if ($ttl === 0) {
            return $resolver();
        }

        return Cache::remember(
            sprintf('dashboard:%s:%d:v%d', $scope, $user->id, $this->version()),
            now()->addSeconds($ttl),
            $resolver,
        );
    }

    public function invalidate(): void
    {
        Cache::add(self::VERSION_KEY, 1);
        Cache::increment(self::VERSION_KEY);
    }

    private function version(): int
    {
        Cache::add(self::VERSION_KEY, 1);

        return (int) Cache::get(self::VERSION_KEY, 1);
    }
}

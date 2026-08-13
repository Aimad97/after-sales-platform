<?php

namespace App\Observers;

use App\Services\DashboardCache;
use Illuminate\Database\Eloquent\Model;

class DashboardMetricsCacheObserver
{
    public function saved(Model $model): void
    {
        $this->invalidate();
    }

    public function deleted(Model $model): void
    {
        $this->invalidate();
    }

    public function restored(Model $model): void
    {
        $this->invalidate();
    }

    private function invalidate(): void
    {
        app(DashboardCache::class)->invalidate();
    }
}

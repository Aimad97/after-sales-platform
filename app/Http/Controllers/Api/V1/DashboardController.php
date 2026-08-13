<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\DashboardResource;
use App\Services\DashboardMetricsService;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(private readonly DashboardMetricsService $dashboard) {}

    public function show(Request $request): DashboardResource
    {
        $this->authorize('view-dashboard');

        return new DashboardResource($this->dashboard->for($request->user()));
    }
}

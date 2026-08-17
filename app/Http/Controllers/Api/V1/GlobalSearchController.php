<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Search\GlobalSearchRequest;
use App\Http\Resources\GlobalSearchResource;
use App\Services\GlobalSearchService;

class GlobalSearchController extends Controller
{
    public function __construct(private readonly GlobalSearchService $search) {}

    public function __invoke(GlobalSearchRequest $request): GlobalSearchResource
    {
        $validated = $request->validated();

        return new GlobalSearchResource($this->search->search(
            $request->user(),
            $validated['q'],
            (int) ($validated['limit'] ?? GlobalSearchService::DEFAULT_LIMIT),
        ));
    }
}

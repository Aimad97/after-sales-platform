<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Warranties\IndexWarrantiesRequest;
use App\Http\Requests\Warranties\LookupWarrantyRequest;
use App\Http\Requests\Warranties\UpdateWarrantyRequest;
use App\Http\Resources\WarrantyResource;
use App\Models\Client;
use App\Models\Warranty;
use App\Services\WarrantyEligibilityService;
use App\Services\WarrantyManagementService;
use Illuminate\Http\JsonResponse;

class WarrantyController extends Controller
{
    public function __construct(
        private readonly WarrantyManagementService $warranties,
        private readonly WarrantyEligibilityService $eligibility,
    ) {}

    public function index(IndexWarrantiesRequest $request)
    {
        $this->authorize('viewAny', Warranty::class);

        return WarrantyResource::collection($this->warranties->paginate($request->validated()));
    }

    public function show(Warranty $warranty): WarrantyResource
    {
        $this->authorize('view', $warranty);

        return new WarrantyResource($warranty->load(['client', 'product', 'invoiceItem.invoice']));
    }

    public function lookup(LookupWarrantyRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Warranty::class);

        $warranty = $this->warranties->findBySerial($request->string('serial_number')->toString());

        if ($warranty === null) {
            return response()->json([
                'message' => 'No warranty was found for this serial number.',
            ], 404);
        }

        return response()->json([
            'data' => [
                'warranty' => new WarrantyResource($warranty),
                'eligibility' => $this->eligibility->evaluate($warranty),
            ],
        ]);
    }

    public function eligibility(Warranty $warranty): JsonResponse
    {
        $this->authorize('view', $warranty);

        return response()->json([
            'data' => $this->eligibility->evaluate($warranty),
        ]);
    }

    public function update(UpdateWarrantyRequest $request, Warranty $warranty): JsonResponse
    {
        $this->authorize('update', $warranty);

        $warranty = $this->warranties->update($warranty, $request->validated());

        return response()->json([
            'message' => 'Warranty updated successfully.',
            'data' => new WarrantyResource($warranty),
        ]);
    }

    public function clientWarranties(IndexWarrantiesRequest $request, Client $client)
    {
        $this->authorize('viewAny', Warranty::class);

        return WarrantyResource::collection($this->warranties->paginate([
            ...$request->validated(),
            'client_id' => $client->id,
        ]));
    }
}

<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\IndexBrandsRequest;
use App\Http\Requests\Catalog\StoreBrandRequest;
use App\Http\Requests\Catalog\UpdateBrandRequest;
use App\Http\Resources\BrandResource;
use App\Models\Brand;
use App\Services\BrandManagementService;
use Illuminate\Http\JsonResponse;

class BrandController extends Controller
{
    public function __construct(private readonly BrandManagementService $brands) {}

    public function index(IndexBrandsRequest $request)
    {
        $this->authorize('viewAny', Brand::class);

        return BrandResource::collection($this->brands->paginate($request->validated()));
    }

    public function store(StoreBrandRequest $request): JsonResponse
    {
        $this->authorize('create', Brand::class);

        $brand = $this->brands->create($request->validated());

        return response()->json([
            'message' => 'Brand created successfully.',
            'data' => new BrandResource($brand),
        ], 201);
    }

    public function show(Brand $brand): BrandResource
    {
        $this->authorize('view', $brand);

        return new BrandResource($brand->loadCount('products'));
    }

    public function update(UpdateBrandRequest $request, Brand $brand): JsonResponse
    {
        $this->authorize('update', $brand);

        $brand = $this->brands->update($brand, $request->validated());

        return response()->json([
            'message' => 'Brand updated successfully.',
            'data' => new BrandResource($brand),
        ]);
    }

    public function destroy(Brand $brand): JsonResponse
    {
        $this->authorize('delete', $brand);
        $this->brands->delete($brand);

        return response()->json(['message' => 'Brand deleted successfully.']);
    }
}

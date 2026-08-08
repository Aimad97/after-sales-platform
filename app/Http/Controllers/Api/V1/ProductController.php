<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\IndexProductsRequest;
use App\Http\Requests\Catalog\StoreProductRequest;
use App\Http\Requests\Catalog\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Services\ProductManagementService;
use Illuminate\Http\JsonResponse;

class ProductController extends Controller
{
    public function __construct(private readonly ProductManagementService $products) {}

    public function index(IndexProductsRequest $request)
    {
        $this->authorize('viewAny', Product::class);

        return ProductResource::collection($this->products->paginate($request->validated()));
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        $this->authorize('create', Product::class);

        $product = $this->products->create($request->validated());

        return response()->json([
            'message' => 'Product created successfully.',
            'data' => new ProductResource($product),
        ], 201);
    }

    public function show(Product $product): ProductResource
    {
        $this->authorize('view', $product);

        return new ProductResource($product->load(['category', 'brand']));
    }

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $this->authorize('update', $product);

        $product = $this->products->update($product, $request->validated());

        return response()->json([
            'message' => 'Product updated successfully.',
            'data' => new ProductResource($product),
        ]);
    }

    public function destroy(Product $product): JsonResponse
    {
        $this->authorize('delete', $product);
        $this->products->delete($product);

        return response()->json(['message' => 'Product deleted successfully.']);
    }
}

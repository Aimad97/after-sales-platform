<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\IndexCategoriesRequest;
use App\Http\Requests\Catalog\StoreCategoryRequest;
use App\Http\Requests\Catalog\UpdateCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Services\CategoryManagementService;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function __construct(private readonly CategoryManagementService $categories) {}

    public function index(IndexCategoriesRequest $request)
    {
        $this->authorize('viewAny', Category::class);

        return CategoryResource::collection($this->categories->paginate($request->validated()));
    }

    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $this->authorize('create', Category::class);

        $category = $this->categories->create($request->validated());

        return response()->json([
            'message' => 'Category created successfully.',
            'data' => new CategoryResource($category),
        ], 201);
    }

    public function show(Category $category): CategoryResource
    {
        $this->authorize('view', $category);

        return new CategoryResource($category->loadCount('products'));
    }

    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        $this->authorize('update', $category);

        $category = $this->categories->update($category, $request->validated());

        return response()->json([
            'message' => 'Category updated successfully.',
            'data' => new CategoryResource($category),
        ]);
    }

    public function destroy(Category $category): JsonResponse
    {
        $this->authorize('delete', $category);
        $this->categories->delete($category);

        return response()->json(['message' => 'Category deleted successfully.']);
    }
}

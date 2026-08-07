<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Technicians\IndexTechniciansRequest;
use App\Http\Requests\Technicians\StoreTechnicianRequest;
use App\Http\Requests\Technicians\UpdateTechnicianRequest;
use App\Http\Resources\TechnicianResource;
use App\Models\Technician;
use App\Services\TechnicianManagementService;
use Illuminate\Http\JsonResponse;

class TechnicianController extends Controller
{
    public function __construct(private readonly TechnicianManagementService $technicians) {}

    public function index(IndexTechniciansRequest $request)
    {
        $this->authorize('viewAny', Technician::class);

        return TechnicianResource::collection($this->technicians->paginate($request->validated()));
    }

    public function store(StoreTechnicianRequest $request): JsonResponse
    {
        $this->authorize('create', Technician::class);

        $technician = $this->technicians->create($request->validated());

        return response()->json([
            'message' => 'Technician profile created successfully.',
            'data' => new TechnicianResource($technician),
        ], 201);
    }

    public function show(Technician $technician): TechnicianResource
    {
        $this->authorize('view', $technician);

        return new TechnicianResource($technician->load(['user.roles']));
    }

    public function update(UpdateTechnicianRequest $request, Technician $technician): JsonResponse
    {
        $this->authorize('update', $technician);

        $technician = $this->technicians->update($technician, $request->validated());

        return response()->json([
            'message' => 'Technician profile updated successfully.',
            'data' => new TechnicianResource($technician),
        ]);
    }

    public function destroy(Technician $technician): JsonResponse
    {
        $this->authorize('delete', $technician);
        $this->technicians->delete($technician);

        return response()->json(['message' => 'Technician profile archived successfully.']);
    }
}

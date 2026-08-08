<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Clients\IndexClientsRequest;
use App\Http\Requests\Clients\StoreClientRequest;
use App\Http\Requests\Clients\UpdateClientRequest;
use App\Http\Resources\ClientProfileResource;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use App\Services\ClientManagementService;
use Illuminate\Http\JsonResponse;

class ClientController extends Controller
{
    public function __construct(private readonly ClientManagementService $clients) {}

    public function index(IndexClientsRequest $request)
    {
        $this->authorize('viewAny', Client::class);

        return ClientResource::collection($this->clients->paginate($request->validated()));
    }

    public function store(StoreClientRequest $request): JsonResponse
    {
        $this->authorize('create', Client::class);

        $client = $this->clients->create($request->validated());

        return response()->json([
            'message' => 'Client created successfully.',
            'data' => new ClientResource($client),
        ], 201);
    }

    public function show(Client $client): ClientResource
    {
        $this->authorize('view', $client);

        return new ClientResource($client);
    }

    public function profile(Client $client): ClientProfileResource
    {
        $this->authorize('view', $client);

        return new ClientProfileResource($this->clients->profile($client));
    }

    public function update(UpdateClientRequest $request, Client $client): JsonResponse
    {
        $this->authorize('update', $client);

        $client = $this->clients->update($client, $request->validated());

        return response()->json([
            'message' => 'Client updated successfully.',
            'data' => new ClientResource($client),
        ]);
    }

    public function destroy(Client $client): JsonResponse
    {
        $this->authorize('delete', $client);
        $this->clients->archive($client);

        return response()->json(['message' => 'Client archived successfully.']);
    }
}

<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ClientPortal\IndexPortalProductsRequest;
use App\Http\Requests\ClientPortal\IndexPortalTicketsRequest;
use App\Http\Requests\ClientPortal\RespondToRepairApprovalRequest;
use App\Http\Requests\ClientPortal\StorePortalTicketRequest;
use App\Http\Resources\ClientPortalProductResource;
use App\Http\Resources\ClientPortalProfileResource;
use App\Http\Resources\ClientPortalTicketResource;
use App\Models\Ticket;
use App\Models\Warranty;
use App\Services\ClientPortalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientPortalController extends Controller
{
    public function __construct(private readonly ClientPortalService $portal) {}

    public function profile(Request $request): ClientPortalProfileResource
    {
        $client = $this->portal->clientFor($request->user());
        $this->authorize('viewPortal', $client);

        return new ClientPortalProfileResource($client);
    }

    public function products(IndexPortalProductsRequest $request)
    {
        $client = $this->portal->clientFor($request->user());
        $this->authorize('viewPortal', $client);

        return ClientPortalProductResource::collection($this->portal->products($request->user(), $request->validated()));
    }

    public function product(Request $request, Warranty $warranty): ClientPortalProductResource
    {
        $this->authorize('viewPortal', $warranty);

        return new ClientPortalProductResource($this->portal->product($warranty));
    }

    public function tickets(IndexPortalTicketsRequest $request)
    {
        $client = $this->portal->clientFor($request->user());
        $this->authorize('viewPortal', $client);

        return ClientPortalTicketResource::collection($this->portal->ticketHistory($request->user(), $request->validated()));
    }

    public function storeTicket(StorePortalTicketRequest $request): JsonResponse
    {
        $this->authorize('createPortal', Ticket::class);
        $ticket = $this->portal->createTicket($request->user(), $request->validated());

        return response()->json([
            'message' => 'SAV request submitted successfully.',
            'data' => new ClientPortalTicketResource($this->portal->ticket($request->user(), $ticket)),
        ], 201);
    }

    public function ticket(Request $request, Ticket $ticket): ClientPortalTicketResource
    {
        $this->authorize('viewPortal', $ticket);

        return new ClientPortalTicketResource($this->portal->ticket($request->user(), $ticket));
    }

    public function respondToRepairApproval(RespondToRepairApprovalRequest $request, Ticket $ticket): JsonResponse
    {
        $this->authorize('respondToRepairApproval', $ticket);
        $data = $request->validated();
        $updatedTicket = $this->portal->respondToRepairApproval(
            $request->user(),
            $ticket,
            $data['decision'] === 'approved',
            $data['notes'] ?? null,
        );

        return response()->json([
            'message' => $data['decision'] === 'approved'
                ? 'Repair approval recorded successfully.'
                : 'Requested repair changes recorded successfully.',
            'data' => new ClientPortalTicketResource($updatedTicket),
        ]);
    }
}

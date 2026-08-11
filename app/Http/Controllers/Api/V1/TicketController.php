<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Tickets\AssignTechnicianRequest;
use App\Http\Requests\Tickets\CancelTicketRequest;
use App\Http\Requests\Tickets\IndexTicketsRequest;
use App\Http\Requests\Tickets\StoreTicketRequest;
use App\Http\Requests\Tickets\TransitionTicketRequest;
use App\Http\Requests\Tickets\UpdateTicketPriorityRequest;
use App\Http\Requests\Tickets\UpdateTicketRequest;
use App\Http\Resources\TicketResource;
use App\Models\Ticket;
use App\Services\TicketManagementService;
use Illuminate\Http\JsonResponse;

class TicketController extends Controller
{
    public function __construct(private readonly TicketManagementService $tickets) {}

    public function index(IndexTicketsRequest $request)
    {
        $this->authorize('viewAny', Ticket::class);

        return TicketResource::collection($this->tickets->paginate($request->validated()));
    }

    public function store(StoreTicketRequest $request): JsonResponse
    {
        $this->authorize('create', Ticket::class);

        $ticket = $this->tickets->create($request->validated(), $request->user());

        return response()->json([
            'message' => 'Ticket created successfully.',
            'data' => new TicketResource($ticket),
        ], 201);
    }

    public function show(Ticket $ticket): TicketResource
    {
        $this->authorize('view', $ticket);

        return new TicketResource($ticket->load([
            'client',
            'product',
            'warranty',
            'invoiceItem.invoice',
            'creator',
            'assignedTechnician.user',
            'statusHistory.transitionedBy',
            'history.actor',
        ]));
    }

    public function update(UpdateTicketRequest $request, Ticket $ticket): JsonResponse
    {
        $this->authorize('update', $ticket);

        return response()->json([
            'message' => 'Ticket updated successfully.',
            'data' => new TicketResource($this->tickets->update($ticket, $request->validated())),
        ]);
    }

    public function assign(AssignTechnicianRequest $request, Ticket $ticket): JsonResponse
    {
        $this->authorize('assign', $ticket);

        return response()->json([
            'message' => 'Technician assigned successfully.',
            'data' => new TicketResource($this->tickets->assignTechnician($ticket, (int) $request->validated('assigned_technician_id'))),
        ]);
    }

    public function changePriority(UpdateTicketPriorityRequest $request, Ticket $ticket): JsonResponse
    {
        $this->authorize('update', $ticket);

        return response()->json([
            'message' => 'Ticket priority updated successfully.',
            'data' => new TicketResource($this->tickets->changePriority($ticket, TicketPriority::from($request->validated('priority')))),
        ]);
    }

    public function transition(TransitionTicketRequest $request, Ticket $ticket): JsonResponse
    {
        $this->authorize('transition', $ticket);
        $data = $request->validated();

        return response()->json([
            'message' => 'Ticket status transitioned successfully.',
            'data' => new TicketResource($this->tickets->transition(
                $ticket,
                TicketStatus::from($data['status']),
                $request->user(),
                $data['notes'] ?? null,
            )),
        ]);
    }

    public function cancel(CancelTicketRequest $request, Ticket $ticket): JsonResponse
    {
        $this->authorize('cancel', $ticket);

        return response()->json([
            'message' => 'Ticket cancelled successfully.',
            'data' => new TicketResource($this->tickets->cancel($ticket, $request->user(), $request->validated('reason'))),
        ]);
    }
}

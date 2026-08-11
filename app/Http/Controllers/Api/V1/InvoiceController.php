<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Invoices\IndexInvoicesRequest;
use App\Http\Requests\Invoices\StoreInvoiceRequest;
use App\Http\Requests\Invoices\UpdateInvoiceRequest;
use App\Http\Resources\InvoiceResource;
use App\Models\Client;
use App\Models\Invoice;
use App\Services\InvoiceManagementService;
use Illuminate\Http\JsonResponse;

class InvoiceController extends Controller
{
    public function __construct(private readonly InvoiceManagementService $invoices) {}

    public function index(IndexInvoicesRequest $request)
    {
        $this->authorize('viewAny', Invoice::class);

        return InvoiceResource::collection($this->invoices->paginate($request->validated()));
    }

    public function store(StoreInvoiceRequest $request): JsonResponse
    {
        $this->authorize('create', Invoice::class);

        $invoice = $this->invoices->create($request->validated());

        return response()->json([
            'message' => 'Invoice created successfully.',
            'data' => new InvoiceResource($invoice),
        ], 201);
    }

    public function show(Invoice $invoice): InvoiceResource
    {
        $this->authorize('view', $invoice);

        return new InvoiceResource($invoice->load(['client', 'items.product']));
    }

    public function update(UpdateInvoiceRequest $request, Invoice $invoice): JsonResponse
    {
        $this->authorize('update', $invoice);

        $invoice = $this->invoices->update($invoice, $request->validated());

        return response()->json([
            'message' => 'Invoice updated successfully.',
            'data' => new InvoiceResource($invoice),
        ]);
    }

    public function clientHistory(IndexInvoicesRequest $request, Client $client)
    {
        $this->authorize('viewAny', Invoice::class);
        $this->authorize('view', $client);

        return InvoiceResource::collection($this->invoices->paginate([
            ...$request->validated(),
            'client_id' => $client->id,
        ]));
    }
}

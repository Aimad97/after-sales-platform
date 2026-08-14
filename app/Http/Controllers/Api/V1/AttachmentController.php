<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Attachments\StoreAttachmentRequest;
use App\Http\Resources\AttachmentResource;
use App\Models\Attachment;
use App\Models\Product;
use App\Models\Repair;
use App\Models\Ticket;
use App\Models\User;
use App\Services\AttachmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentController extends Controller
{
    public function __construct(private readonly AttachmentService $attachments) {}

    public function ticketIndex(Ticket $ticket)
    {
        $this->authorize('view', $ticket);

        return AttachmentResource::collection($ticket->attachments()->with('uploadedBy')->get());
    }

    public function productIndex(Product $product)
    {
        $this->authorize('view', $product);

        return AttachmentResource::collection($product->attachments()->with('uploadedBy')->get());
    }

    public function repairIndex(Repair $repair)
    {
        $this->authorize('view', $repair);

        return AttachmentResource::collection($repair->attachments()->with('uploadedBy')->get());
    }

    public function ticketStore(StoreAttachmentRequest $request, Ticket $ticket): JsonResponse
    {
        $this->authorize('uploadToTicket', [Attachment::class, $ticket]);

        return $this->store($request, $ticket);
    }

    public function clientTicketIndex(Request $request, Ticket $ticket)
    {
        $this->authorize('viewPortal', $ticket);
        $clientId = (int) $request->user()->client_id;

        return AttachmentResource::collection(
            $ticket->attachments()
                ->whereHas('uploadedBy', fn ($query) => $query
                    ->where('client_id', $clientId)
                    ->role('client')
                    ->whereDoesntHave('roles', fn ($query) => $query->whereIn('name', ['super_admin', 'admin', 'sav_agent', 'technician'])))
                ->with('uploadedBy')
                ->get(),
        );
    }

    public function clientTicketStore(StoreAttachmentRequest $request, Ticket $ticket): JsonResponse
    {
        $this->authorize('uploadToPortalTicket', [Attachment::class, $ticket]);

        return $this->store($request, $ticket);
    }

    public function productStore(StoreAttachmentRequest $request, Product $product): JsonResponse
    {
        $this->authorize('uploadToProduct', [Attachment::class, $product]);

        return $this->store($request, $product);
    }

    public function repairStore(StoreAttachmentRequest $request, Repair $repair): JsonResponse
    {
        $this->authorize('uploadToRepair', [Attachment::class, $repair]);

        return $this->store($request, $repair);
    }

    public function preview(Attachment $attachment): StreamedResponse
    {
        $attachment->loadMissing('attachable');
        $this->authorize('view', $attachment);
        abort_unless($attachment->isPreviewableImage(), 404);

        return $this->stream($attachment, 'inline');
    }

    public function download(Attachment $attachment): StreamedResponse
    {
        $attachment->loadMissing('attachable');
        $this->authorize('view', $attachment);

        return $this->stream($attachment, 'attachment');
    }

    public function destroy(Request $request, Attachment $attachment): JsonResponse
    {
        $attachment->loadMissing('attachable');
        $this->authorize('delete', $attachment);
        $this->attachments->delete($attachment, $request->user());

        return response()->json([
            'message' => 'Attachment deleted successfully.',
        ]);
    }

    private function store(StoreAttachmentRequest $request, Ticket|Product|Repair $attachable): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        /** @var UploadedFile $file */
        $file = $request->file('file');

        $attachment = $this->attachments->store($attachable, $file, $user);
        $attachment->load('uploadedBy');

        return response()->json([
            'data' => new AttachmentResource($attachment),
        ], 201);
    }

    private function stream(Attachment $attachment, string $disposition): StreamedResponse
    {
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->path), 404);

        return Storage::disk($attachment->disk)->response(
            $attachment->path,
            $attachment->original_filename,
            [
                'Content-Type' => $attachment->mime_type,
                'Cache-Control' => 'private, no-store',
                'X-Content-Type-Options' => 'nosniff',
            ],
            $disposition,
        );
    }
}

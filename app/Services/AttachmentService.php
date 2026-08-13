<?php

namespace App\Services;

use App\Models\Attachment;
use App\Models\Product;
use App\Models\Repair;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AttachmentService
{
    public function __construct(private readonly TicketHistoryService $ticketHistory) {}

    public function store(Ticket|Product|Repair $attachable, UploadedFile $file, User $actor): Attachment
    {
        $mimeType = $this->assertSafe($file);
        $disk = (string) config('attachments.disk');
        $extension = $this->clientExtension($file);
        $storedFilename = Str::uuid()->toString().($extension === '' ? '' : ".{$extension}");
        $path = sprintf(
            '%s/%s/%s',
            Str::snake(class_basename($attachable)),
            $attachable->getKey(),
            $storedFilename,
        );

        try {
            return DB::transaction(function () use (
                $attachable,
                $file,
                $actor,
                $disk,
                $path,
                $storedFilename,
                $mimeType,
            ): Attachment {
                if (Storage::disk($disk)->putFileAs(dirname($path), $file, basename($path)) === false) {
                    throw ValidationException::withMessages([
                        'file' => 'The file could not be stored.',
                    ]);
                }

                $attachment = $attachable->attachments()->create([
                    'uuid' => (string) Str::uuid(),
                    'uploaded_by' => $actor->id,
                    'disk' => $disk,
                    'path' => $path,
                    'original_filename' => $this->safeOriginalName($file->getClientOriginalName()),
                    'stored_filename' => $storedFilename,
                    'mime_type' => $mimeType,
                    'size' => (int) $file->getSize(),
                ]);

                $this->recordTicketHistory(
                    $attachable,
                    'attachment_added',
                    "Attachment added: {$attachment->original_filename}.",
                    $actor,
                );

                return $attachment;
            });
        } catch (\Throwable $exception) {
            Storage::disk($disk)->delete($path);

            throw $exception;
        }
    }

    public function delete(Attachment $attachment, User $actor): void
    {
        $attachment->loadMissing('attachable');
        $attachable = $attachment->attachable;
        $disk = $attachment->disk;
        $path = $attachment->path;
        $filename = $attachment->original_filename;

        DB::transaction(function () use ($attachment, $attachable, $filename, $actor): void {
            $attachment->delete();

            if ($attachable instanceof Ticket || $attachable instanceof Product || $attachable instanceof Repair) {
                $this->recordTicketHistory(
                    $attachable,
                    'attachment_deleted',
                    "Attachment deleted: {$filename}.",
                    $actor,
                );
            }
        });

        // Removing the database record first prevents a failed storage operation from
        // leaving an attachment accessible through the application.
        if (! Storage::disk($disk)->delete($path)) {
            Log::warning('Attachment file could not be removed after metadata deletion.', [
                'disk' => $disk,
                'path' => $path,
            ]);
        }
    }

    private function assertSafe(UploadedFile $file): string
    {
        $extension = $this->clientExtension($file);
        $mimeType = $file->getMimeType();
        $mimeType = is_string($mimeType) ? $mimeType : '';
        $allowedMimeTypes = config("attachments.allowed_types.{$extension}", []);

        if (
            ! is_array($allowedMimeTypes)
            || ! in_array($mimeType, $allowedMimeTypes, true)
        ) {
            throw ValidationException::withMessages([
                'file' => 'This file type is not allowed.',
            ]);
        }

        $maxSizeBytes = (int) config('attachments.max_size_kb') * 1024;

        if ((int) $file->getSize() > $maxSizeBytes) {
            throw ValidationException::withMessages([
                'file' => 'The file exceeds the configured maximum size.',
            ]);
        }

        return $mimeType;
    }

    private function safeOriginalName(string $name): string
    {
        $sanitized = basename(str_replace('\\', '/', $name));
        $sanitized = (string) preg_replace('/[\x00-\x1F\x7F]/u', '', $sanitized);

        return Str::limit($sanitized !== '' ? $sanitized : 'attachment', 255, '');
    }

    private function clientExtension(UploadedFile $file): string
    {
        $name = str_replace('\\', '/', $file->getClientOriginalName());

        return strtolower((string) pathinfo($name, PATHINFO_EXTENSION));
    }

    private function recordTicketHistory(
        Ticket|Product|Repair $attachable,
        string $event,
        string $description,
        User $actor,
    ): void {
        $ticket = $attachable instanceof Ticket
            ? $attachable
            : ($attachable instanceof Repair ? $attachable->ticket : null);

        if ($ticket instanceof Ticket) {
            $this->ticketHistory->record($ticket, $event, $description, $actor);
        }
    }
}

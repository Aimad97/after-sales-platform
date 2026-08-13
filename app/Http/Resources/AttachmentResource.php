<?php

namespace App\Http\Resources;

use App\Models\Attachment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Attachment */
class AttachmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'original_filename' => $this->original_filename,
            'mime_type' => $this->mime_type,
            'size' => $this->size,
            'is_previewable_image' => $this->isPreviewableImage(),
            'download_url' => route('attachments.download', $this),
            'preview_url' => $this->isPreviewableImage()
                ? route('attachments.preview', $this)
                : null,
            'uploaded_by' => $this->relationLoaded('uploadedBy') && $this->uploadedBy !== null
                ? [
                    'id' => $this->uploadedBy->id,
                    'display_name' => trim("{$this->uploadedBy->first_name} {$this->uploadedBy->last_name}"),
                ]
                : null,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}

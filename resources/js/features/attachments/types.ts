export type AttachmentResourceType = 'tickets' | 'repairs' | 'products';

export interface AttachmentUploader {
    id: number;
    uuid?: string;
    display_name: string;
    email?: string;
}

export interface Attachment {
    id: number;
    uuid: string;
    original_filename: string;
    mime_type: string;
    size: number;
    is_previewable_image: boolean;
    download_url: string;
    preview_url: string | null;
    created_at: string | null;
    uploaded_by: AttachmentUploader | null;
}

export interface UploadProgress {
    loaded: number;
    total: number | null;
    percentage: number;
}

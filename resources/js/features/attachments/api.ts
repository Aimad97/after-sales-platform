import { apiClient } from '@/api/client';
import type { Attachment, AttachmentResourceType, UploadProgress } from '@/features/attachments/types';

interface DataResponse<T> {
    data: T;
}

function attachmentCollectionUrl(resourceType: AttachmentResourceType, resourceKey: string | number): string {
    return `/${resourceType}/${resourceKey}/attachments`;
}

export async function listAttachments(resourceType: AttachmentResourceType, resourceKey: string | number): Promise<Attachment[]> {
    const response = await apiClient.get<DataResponse<Attachment[]>>(attachmentCollectionUrl(resourceType, resourceKey));

    return response.data.data;
}

export async function uploadAttachment(
    resourceType: AttachmentResourceType,
    resourceKey: string | number,
    file: File,
    onProgress: (progress: UploadProgress) => void,
): Promise<Attachment> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<DataResponse<Attachment>>(attachmentCollectionUrl(resourceType, resourceKey), formData, {
        onUploadProgress: (event) => {
            const total = event.total ?? null;
            const percentage = total && total > 0 ? Math.round((event.loaded / total) * 100) : 0;

            onProgress({ loaded: event.loaded, total, percentage });
        },
    });

    return response.data.data;
}

export async function downloadAttachment(attachment: Attachment): Promise<Blob> {
    const response = await apiClient.get<Blob>(attachment.download_url, { responseType: 'blob' });

    return response.data;
}

export async function deleteAttachment(attachment: Attachment): Promise<void> {
    await apiClient.delete(`/attachments/${attachment.uuid}`);
}

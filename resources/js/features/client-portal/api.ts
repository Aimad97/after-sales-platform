import { apiClient } from '@/api/client';
import type { Attachment, UploadProgress } from '@/features/attachments/types';
import type {
    PortalProductFilters,
    PortalProfile,
    PortalPurchasedProduct,
    PortalTicket,
    PortalTicketFilters,
    PortalTicketPayload,
} from '@/features/client-portal/types';
import type { PaginatedResponse } from '@/types/pagination';

interface DataResponse<T> {
    data: T;
}

export async function getPortalProfile(): Promise<PortalProfile> {
    const response = await apiClient.get<DataResponse<PortalProfile>>('/client/profile');
    return response.data.data;
}

export async function listPortalProducts(filters: PortalProductFilters): Promise<PaginatedResponse<PortalPurchasedProduct>> {
    const response = await apiClient.get<PaginatedResponse<PortalPurchasedProduct>>('/client/products', { params: filters });
    return response.data;
}

export async function getPortalProduct(uuid: string): Promise<PortalPurchasedProduct> {
    const response = await apiClient.get<DataResponse<PortalPurchasedProduct>>(`/client/products/${uuid}`);
    return response.data.data;
}

export async function listPortalTickets(filters: PortalTicketFilters): Promise<PaginatedResponse<PortalTicket>> {
    const response = await apiClient.get<PaginatedResponse<PortalTicket>>('/client/tickets', { params: filters });
    return response.data;
}

export async function getPortalTicket(uuid: string): Promise<PortalTicket> {
    const response = await apiClient.get<DataResponse<PortalTicket>>(`/client/tickets/${uuid}`);
    return response.data.data;
}

export async function createPortalTicket(payload: PortalTicketPayload): Promise<PortalTicket> {
    const response = await apiClient.post<DataResponse<PortalTicket>>('/client/tickets', payload);
    return response.data.data;
}

export async function uploadPortalTicketAttachment(
    ticketUuid: string,
    file: File,
    onProgress?: (progress: UploadProgress) => void,
): Promise<Attachment> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<DataResponse<Attachment>>(`/client/tickets/${ticketUuid}/attachments`, formData, {
        onUploadProgress: (event) => {
            if (!onProgress) return;
            const total = event.total ?? null;
            onProgress({
                loaded: event.loaded,
                total,
                percentage: total && total > 0 ? Math.round((event.loaded / total) * 100) : 0,
            });
        },
    });

    return response.data.data;
}

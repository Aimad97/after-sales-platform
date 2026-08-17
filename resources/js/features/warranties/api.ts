import { apiClient } from '@/api/client';
import type {
    Warranty,
    WarrantyEligibility,
    WarrantyFilters,
    WarrantyLookupResult,
    WarrantyUpdatePayload,
} from '@/features/warranties/types';
import type { PaginatedResponse } from '@/types/pagination';

interface DataResponse<T> {
    data: T;
}

export async function listWarranties(filters: WarrantyFilters): Promise<PaginatedResponse<Warranty>> {
    const response = await apiClient.get<PaginatedResponse<Warranty>>('/warranties', { params: filters });
    return response.data;
}

export async function listClientWarranties(clientUuid: string, filters: WarrantyFilters): Promise<PaginatedResponse<Warranty>> {
    const response = await apiClient.get<PaginatedResponse<Warranty>>(`/clients/${clientUuid}/warranties`, { params: filters });
    return response.data;
}

export async function getWarranty(uuid: string): Promise<Warranty> {
    const response = await apiClient.get<DataResponse<Warranty>>(`/warranties/${uuid}`);
    return response.data.data;
}

export async function lookupWarranty(serialNumber: string): Promise<WarrantyLookupResult> {
    const response = await apiClient.get<DataResponse<WarrantyLookupResult>>('/warranties/lookup', {
        params: { serial_number: serialNumber },
    });
    return response.data.data;
}

export async function getWarrantyEligibility(uuid: string): Promise<WarrantyEligibility> {
    const response = await apiClient.get<DataResponse<WarrantyEligibility>>(`/warranties/${uuid}/eligibility`);
    return response.data.data;
}

export async function updateWarranty(uuid: string, payload: WarrantyUpdatePayload): Promise<Warranty> {
    const response = await apiClient.patch<DataResponse<Warranty>>(`/warranties/${uuid}`, payload);
    return response.data.data;
}

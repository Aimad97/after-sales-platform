import { apiClient } from '@/api/client';
import type { Client, ClientFilters, ClientPayload, ClientProfile } from '@/features/clients/types';
import type { PaginatedResponse } from '@/types/pagination';

interface DataResponse<T> {
    data: T;
}

export async function listClients(filters: ClientFilters): Promise<PaginatedResponse<Client>> {
    const response = await apiClient.get<PaginatedResponse<Client>>('/clients', { params: filters });
    return response.data;
}

export async function getClient(uuid: string): Promise<Client> {
    const response = await apiClient.get<DataResponse<Client>>(`/clients/${uuid}`);
    return response.data.data;
}

export async function getClientProfile(uuid: string): Promise<ClientProfile> {
    const response = await apiClient.get<DataResponse<ClientProfile>>(`/clients/${uuid}/profile`);
    return response.data.data;
}

export async function createClient(payload: ClientPayload): Promise<Client> {
    const response = await apiClient.post<DataResponse<Client>>('/clients', payload);
    return response.data.data;
}

export async function updateClient(uuid: string, payload: ClientPayload): Promise<Client> {
    const response = await apiClient.patch<DataResponse<Client>>(`/clients/${uuid}`, payload);
    return response.data.data;
}

export async function archiveClient(uuid: string): Promise<void> {
    await apiClient.delete(`/clients/${uuid}`);
}

import { apiClient } from '@/api/client';
import type { ManagedUser, UserFilters, UserPayload } from '@/features/users/types';
import type { PaginatedResponse } from '@/types/pagination';

interface DataResponse<T> {
    data: T;
}

export async function listUsers(filters: UserFilters): Promise<PaginatedResponse<ManagedUser>> {
    const response = await apiClient.get<PaginatedResponse<ManagedUser>>('/users', { params: filters });
    return response.data;
}

export async function getUser(uuid: string): Promise<ManagedUser> {
    const response = await apiClient.get<DataResponse<ManagedUser>>(`/users/${uuid}`);
    return response.data.data;
}

export async function listRoles(): Promise<string[]> {
    const response = await apiClient.get<DataResponse<string[]>>('/users/roles');
    return response.data.data;
}

export async function createUser(payload: UserPayload): Promise<ManagedUser> {
    const response = await apiClient.post<DataResponse<ManagedUser>>('/users', payload);
    return response.data.data;
}

export async function updateUser(uuid: string, payload: UserPayload): Promise<ManagedUser> {
    const response = await apiClient.patch<DataResponse<ManagedUser>>(`/users/${uuid}`, payload);
    return response.data.data;
}

export async function archiveUser(uuid: string): Promise<void> {
    await apiClient.delete(`/users/${uuid}`);
}

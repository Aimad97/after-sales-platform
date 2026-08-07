import { apiClient } from '@/api/client';
import type { TechnicianFilters, TechnicianPayload, TechnicianProfile } from '@/features/technicians/types';
import type { PaginatedResponse } from '@/types/pagination';

interface DataResponse<T> {
    data: T;
}

export async function listTechnicians(filters: TechnicianFilters): Promise<PaginatedResponse<TechnicianProfile>> {
    const response = await apiClient.get<PaginatedResponse<TechnicianProfile>>('/technicians', { params: filters });
    return response.data;
}

export async function getTechnician(id: string): Promise<TechnicianProfile> {
    const response = await apiClient.get<DataResponse<TechnicianProfile>>(`/technicians/${id}`);
    return response.data.data;
}

export async function createTechnician(payload: TechnicianPayload): Promise<TechnicianProfile> {
    const response = await apiClient.post<DataResponse<TechnicianProfile>>('/technicians', payload);
    return response.data.data;
}

export async function updateTechnician(id: number, payload: Omit<TechnicianPayload, 'user_id'>): Promise<TechnicianProfile> {
    const response = await apiClient.patch<DataResponse<TechnicianProfile>>(`/technicians/${id}`, payload);
    return response.data.data;
}

export async function archiveTechnician(id: number): Promise<void> {
    await apiClient.delete(`/technicians/${id}`);
}

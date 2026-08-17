import { apiClient } from '@/api/client';
import type { Repair, RepairCompletionPayload, RepairDiagnosisPayload, RepairFilters, RepairUpdatePayload } from '@/features/repairs/types';
import type { PaginatedResponse } from '@/types/pagination';

interface DataResponse<T> {
    data: T;
}

export async function listRepairs(filters: RepairFilters): Promise<PaginatedResponse<Repair>> {
    const response = await apiClient.get<PaginatedResponse<Repair>>('/repairs', { params: filters });

    return response.data;
}

export async function getRepair(id: number): Promise<Repair> {
    const response = await apiClient.get<DataResponse<Repair>>(`/repairs/${id}`);

    return response.data.data;
}

export async function startDiagnosis(ticketUuid: string): Promise<Repair> {
    const response = await apiClient.post<DataResponse<Repair>>(`/tickets/${ticketUuid}/repair/diagnosis`);

    return response.data.data;
}

export async function recordDiagnosis(id: number, payload: RepairDiagnosisPayload): Promise<Repair> {
    const response = await apiClient.post<DataResponse<Repair>>(`/repairs/${id}/diagnosis`, payload);

    return response.data.data;
}

export async function startRepair(id: number): Promise<Repair> {
    const response = await apiClient.post<DataResponse<Repair>>(`/repairs/${id}/start`);

    return response.data.data;
}

export async function updateRepair(id: number, payload: RepairUpdatePayload): Promise<Repair> {
    const response = await apiClient.patch<DataResponse<Repair>>(`/repairs/${id}`, payload);

    return response.data.data;
}

export async function completeRepair(id: number, payload: RepairCompletionPayload): Promise<Repair> {
    const response = await apiClient.post<DataResponse<Repair>>(`/repairs/${id}/complete`, payload);

    return response.data.data;
}

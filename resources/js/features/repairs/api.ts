import { apiClient } from '@/api/client';
import type { Repair, RepairFilters } from '@/features/repairs/types';
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

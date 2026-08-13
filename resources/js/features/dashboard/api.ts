import { apiClient } from '@/api/client';
import type { Dashboard } from '@/features/dashboard/types';

interface DataResponse<T> {
    data: T;
}

export async function getDashboard(): Promise<Dashboard> {
    const response = await apiClient.get<DataResponse<Dashboard>>('/dashboard');

    return response.data.data;
}

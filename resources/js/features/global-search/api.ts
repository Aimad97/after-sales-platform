import { apiClient } from '@/api/client';
import type { GlobalSearchData } from '@/features/global-search/types';

interface DataResponse<T> {
    data: T;
}

export async function globalSearch(query: string, signal?: AbortSignal): Promise<GlobalSearchData> {
    const response = await apiClient.get<DataResponse<GlobalSearchData>>('/search', {
        params: { q: query },
        signal,
    });

    return response.data.data;
}

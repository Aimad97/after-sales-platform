import axios, { type AxiosError } from 'axios';
import { apiBaseUrl } from '@/api/baseUrl';

export interface ApiErrorResponse {
    message: string;
    errors?: Record<string, string[]>;
}

export const apiClient = axios.create({
    baseURL: apiBaseUrl,
    withCredentials: true,
    withXSRFToken: true,
    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
});

apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiErrorResponse>) => {
        if (error.response?.status === 401) {
            window.dispatchEvent(new Event('auth:unauthenticated'));
        }

        return Promise.reject(error);
    },
);

import axios, { type AxiosError } from 'axios';

export interface ApiErrorResponse { message: string; errors?: Record<string, string[]>; }

export const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
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

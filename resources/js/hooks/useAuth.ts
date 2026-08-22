import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiOrigin } from '@/api/baseUrl';
import { apiClient } from '@/api/client';

export interface AuthUser {
    id: number;
    uuid: string;
    first_name: string;
    last_name: string;
    email: string;
    status: 'active' | 'inactive' | 'suspended';
    roles: string[];
    permissions: string[];
}

interface ApiResponse<T> {
    data: T;
}
interface LoginPayload {
    email: string;
    password: string;
    remember?: boolean;
}

const csrfClient = axios.create({
    baseURL: apiOrigin,
    withCredentials: true,
    withXSRFToken: true,
});

async function fetchCurrentUser(): Promise<AuthUser | null> {
    try {
        const response = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
        return response.data.data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 401) return null;
        throw error;
    }
}

export function useAuth() {
    const queryClient = useQueryClient();
    const userQuery = useQuery({ queryKey: ['auth', 'user'], queryFn: fetchCurrentUser, retry: false });

    const login = useMutation({
        mutationFn: async (payload: LoginPayload): Promise<AuthUser> => {
            await csrfClient.get('/sanctum/csrf-cookie');
            await apiClient.post<ApiResponse<AuthUser>>('/auth/login', payload);
            const authenticatedUser = await fetchCurrentUser();

            if (authenticatedUser === null) {
                throw new Error(
                    'The login succeeded, but the browser did not retain the session cookie. Use the same hostname for the page and API.',
                );
            }

            return authenticatedUser;
        },
        onSuccess: (user) => queryClient.setQueryData(['auth', 'user'], user),
    });

    const logout = useMutation({
        mutationFn: () => apiClient.post('/auth/logout'),
        onSettled: () => queryClient.setQueryData(['auth', 'user'], null),
    });

    return {
        user: userQuery.data ?? null,
        isAuthenticated: userQuery.data !== null && userQuery.data !== undefined,
        isInitializing: userQuery.isLoading,
        error: userQuery.error,
        login,
        logout,
    };
}

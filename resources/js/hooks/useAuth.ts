import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
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

interface ApiResponse<T> { data: T; }
interface LoginPayload { email: string; password: string; remember?: boolean; }

const csrfClient = axios.create({
    baseURL: new URL(import.meta.env.VITE_API_URL).origin,
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
            const response = await apiClient.post<ApiResponse<AuthUser>>('/auth/login', payload);
            return response.data.data;
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

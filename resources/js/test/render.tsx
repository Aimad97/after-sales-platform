import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

export function createTestQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
            mutations: { retry: false },
        },
    });
}

interface ProviderOptions extends Omit<RenderOptions, 'wrapper'> {
    route?: string;
    queryClient?: QueryClient;
}

export function renderWithProviders(
    ui: ReactElement,
    { route = '/', queryClient = createTestQueryClient(), ...options }: ProviderOptions = {},
) {
    function Providers({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
            </QueryClientProvider>
        );
    }

    return { queryClient, ...render(ui, { wrapper: Providers, ...options }) };
}

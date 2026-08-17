import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { ClientRoute, PermissionRoute, ProtectedRoute } from '@/components/RouteGuards';
import { useAuth, type AuthUser } from '@/hooks/useAuth';
import { Can } from '@/hooks/usePermissions';
import { renderWithProviders } from '@/test/render';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
    return {
        id: 1,
        uuid: '4bd95f37-038b-4b23-ad60-b429bbe190ec',
        first_name: 'Amina',
        last_name: 'Client',
        email: 'amina@example.com',
        status: 'active',
        roles: ['client'],
        permissions: [],
        ...overrides,
    };
}

function authResult(user: AuthUser | null, isInitializing = false): ReturnType<typeof useAuth> {
    return {
        user,
        isAuthenticated: user !== null,
        isInitializing,
        error: null,
        login: { mutate: vi.fn(), error: null, isPending: false },
        logout: { mutate: vi.fn(), error: null, isPending: false },
    } as unknown as ReturnType<typeof useAuth>;
}

describe('route and permission protection', () => {
    beforeEach(() => mockedUseAuth.mockReturnValue(authResult(null)));

    it('redirects an unauthenticated visitor away from a protected route', async () => {
        renderWithProviders(
            <Routes>
                <Route
                    path="/private"
                    element={
                        <ProtectedRoute>
                            <p>Private area</p>
                        </ProtectedRoute>
                    }
                />
                <Route path="/login" element={<p>Login destination</p>} />
            </Routes>,
            { route: '/private' },
        );

        expect(await screen.findByText('Login destination')).toBeInTheDocument();
        expect(screen.queryByText('Private area')).not.toBeInTheDocument();
    });

    it('redirects authenticated users who lack a required permission', async () => {
        mockedUseAuth.mockReturnValue(authResult(makeUser({ roles: ['sav_agent'], permissions: ['tickets.view'] })));
        renderWithProviders(
            <Routes>
                <Route
                    path="/users"
                    element={
                        <PermissionRoute permission="users.view">
                            <p>User administration</p>
                        </PermissionRoute>
                    }
                />
                <Route path="/unauthorized" element={<p>Permission denied</p>} />
            </Routes>,
            { route: '/users' },
        );

        expect(await screen.findByText('Permission denied')).toBeInTheDocument();
        expect(screen.queryByText('User administration')).not.toBeInTheDocument();
    });

    it('allows only client-only accounts into the client portal', async () => {
        mockedUseAuth.mockReturnValue(authResult(makeUser()));
        renderWithProviders(
            <Routes>
                <Route
                    path="/client"
                    element={
                        <ClientRoute>
                            <p>Client portal</p>
                        </ClientRoute>
                    }
                />
                <Route path="/unauthorized" element={<p>Permission denied</p>} />
            </Routes>,
            { route: '/client' },
        );

        expect(await screen.findByText('Client portal')).toBeInTheDocument();
    });

    it('hides controls without permission and displays their fallback', () => {
        mockedUseAuth.mockReturnValue(authResult(makeUser({ permissions: [] })));
        renderWithProviders(
            <Can permission="tickets.delete" fallback={<p>Read only</p>}>
                <button type="button">Delete ticket</button>
            </Can>,
        );

        expect(screen.queryByRole('button', { name: 'Delete ticket' })).not.toBeInTheDocument();
        expect(screen.getByText('Read only')).toBeInTheDocument();
    });
});

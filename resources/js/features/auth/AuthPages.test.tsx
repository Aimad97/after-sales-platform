import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '@/features/auth/AuthPages';
import { useAuth } from '@/hooks/useAuth';
import { renderWithProviders } from '@/test/render';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const loginMutate = vi.fn();

function authResult(loginError: unknown = null): ReturnType<typeof useAuth> {
    return {
        user: null,
        isAuthenticated: false,
        isInitializing: false,
        error: null,
        login: { mutate: loginMutate, error: loginError, isPending: false },
        logout: { mutate: vi.fn(), error: null, isPending: false },
    } as unknown as ReturnType<typeof useAuth>;
}

describe('LoginPage', () => {
    beforeEach(() => {
        loginMutate.mockReset();
        mockedUseAuth.mockReturnValue(authResult());
    });

    it('submits valid credentials and does not show a false error initially', async () => {
        const user = userEvent.setup();
        renderWithProviders(<LoginPage />, { route: '/login' });

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        await user.type(screen.getByRole('textbox', { name: 'Email' }), 'agent@ultrapc.com');
        await user.type(screen.getByLabelText('Password'), 'Secret123!');
        await user.click(screen.getByRole('checkbox', { name: 'Remember me' }));
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        await waitFor(() => expect(loginMutate).toHaveBeenCalledTimes(1));
        expect(loginMutate).toHaveBeenCalledWith(
            { email: 'agent@ultrapc.com', password: 'Secret123!', remember: true },
            expect.objectContaining({ onSuccess: expect.any(Function) }),
        );
    });

    it('shows the API message returned for a failed login', () => {
        mockedUseAuth.mockReturnValue(
            authResult({
                isAxiosError: true,
                response: { status: 422, data: { message: 'The provided credentials are incorrect.' } },
            }),
        );

        renderWithProviders(<LoginPage />, { route: '/login' });

        expect(screen.getByRole('alert')).toHaveTextContent('The provided credentials are incorrect.');
    });
});

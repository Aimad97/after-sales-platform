import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/ThemeProvider';
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

function renderLoginPage() {
    return renderWithProviders(
        <ThemeProvider>
            <LoginPage />
        </ThemeProvider>,
        { route: '/login' },
    );
}

describe('LoginPage', () => {
    beforeEach(() => {
        loginMutate.mockReset();
        mockedUseAuth.mockReturnValue(authResult());
    });

    it('submits valid credentials and does not show a false error initially', async () => {
        const user = userEvent.setup();
        renderLoginPage();

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

        renderLoginPage();

        expect(screen.getByRole('alert')).toHaveTextContent('The provided credentials are incorrect.');
    });

    it('associates validation errors with their required fields', async () => {
        const user = userEvent.setup();
        renderLoginPage();

        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        const email = screen.getByRole('textbox', { name: 'Email' });
        const password = screen.getByLabelText('Password');
        expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
        expect(screen.getByText('Password is required.')).toBeInTheDocument();
        expect(email).toHaveAttribute('aria-invalid', 'true');
        expect(email).toHaveAttribute('aria-describedby', 'login-email-error');
        expect(password).toHaveAttribute('aria-invalid', 'true');
        expect(password).toHaveAttribute('aria-describedby', 'login-password-error');
        expect(loginMutate).not.toHaveBeenCalled();
    });

    it('lets the user reveal and hide their password without changing its value', async () => {
        const user = userEvent.setup();
        renderLoginPage();
        const password = screen.getByLabelText('Password');

        await user.type(password, 'Secret123!');
        expect(password).toHaveAttribute('type', 'password');

        await user.click(screen.getByRole('button', { name: 'Show password' }));
        expect(password).toHaveAttribute('type', 'text');
        expect(password).toHaveValue('Secret123!');

        await user.click(screen.getByRole('button', { name: 'Hide password' }));
        expect(password).toHaveAttribute('type', 'password');
        expect(password).toHaveValue('Secret123!');
    });
});

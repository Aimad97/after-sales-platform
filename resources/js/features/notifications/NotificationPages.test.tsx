import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '@/features/notifications/api';
import { NotificationsPage } from '@/features/notifications/NotificationPages';
import { useAuth } from '@/hooks/useAuth';
import { renderWithProviders } from '@/test/render';

vi.mock('@/features/notifications/api', () => ({
    listNotifications: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
    markNotificationAsRead: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

const mockedListNotifications = vi.mocked(listNotifications);
const mockedUseAuth = vi.mocked(useAuth);
const emptyPage = {
    data: [],
    links: {},
    meta: { current_page: 1, from: null, last_page: 1, per_page: 20, to: null, total: 0 },
};

describe('NotificationsPage', () => {
    beforeEach(() => {
        mockedListNotifications.mockReset();
        vi.mocked(markAllNotificationsAsRead).mockReset();
        vi.mocked(markNotificationAsRead).mockReset();
        mockedUseAuth.mockReturnValue({
            user: null,
            isAuthenticated: false,
            isInitializing: false,
            error: null,
            login: { mutate: vi.fn(), error: null, isPending: false },
            logout: { mutate: vi.fn(), error: null, isPending: false },
        } as unknown as ReturnType<typeof useAuth>);
    });

    it('shows an accessible card skeleton while notifications load', () => {
        mockedListNotifications.mockReturnValue(new Promise(() => undefined));

        renderWithProviders(<NotificationsPage />);

        expect(screen.getByRole('status', { name: 'Loading notifications' })).toBeInTheDocument();
    });

    it('shows a useful empty state and exposes pressed filter state', async () => {
        const user = userEvent.setup();
        mockedListNotifications.mockResolvedValue(emptyPage);

        renderWithProviders(<NotificationsPage />);

        expect(await screen.findByRole('heading', { name: 'No notifications match this view.' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Unread' })).toHaveAttribute('aria-pressed', 'false');

        await user.click(screen.getByRole('button', { name: 'Unread' }));

        await waitFor(() => expect(mockedListNotifications).toHaveBeenCalledWith({ per_page: 20, unread: true }));
        expect(screen.getByRole('button', { name: 'Unread' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders a retryable error state when the list request fails', async () => {
        const user = userEvent.setup();
        mockedListNotifications.mockRejectedValue(new Error('The notification service is unavailable.'));

        renderWithProviders(<NotificationsPage />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load notifications');
        expect(screen.getByRole('alert')).toHaveTextContent('The notification service is unavailable.');

        await user.click(screen.getByRole('button', { name: 'Try again' }));

        await waitFor(() => expect(mockedListNotifications).toHaveBeenCalledTimes(2));
    });
});

import { LayoutDashboard, Ticket } from 'lucide-react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { AppShell, type AppShellNavigationItem } from '@/components/AppShell';
import { renderWithProviders } from '@/test/render';

vi.mock('@/components/GlobalSearchPalette', () => ({
    GlobalSearchPalette: () => <button type="button">Search</button>,
}));
vi.mock('@/components/NotificationBell', () => ({
    NotificationBell: () => <button type="button">Notifications</button>,
}));
vi.mock('@/components/ThemeToggle', () => ({
    ThemeToggle: () => <button type="button">Theme</button>,
}));

const navigationItems: readonly AppShellNavigationItem[] = [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Tickets', to: '/admin/tickets', icon: Ticket },
];

function renderShell(route = '/admin') {
    const onSignOut = vi.fn();
    const result = renderWithProviders(
        <Routes>
            <Route
                path="/admin"
                element={
                    <AppShell
                        variant="admin"
                        userName="Amina Agent"
                        userEmail="amina@example.com"
                        navigationItems={navigationItems}
                        onSignOut={onSignOut}
                    />
                }
            >
                <Route index element={<p>Dashboard content</p>} />
                <Route path="tickets" element={<p>Ticket content</p>} />
            </Route>
        </Routes>,
        { route },
    );

    return { ...result, onSignOut };
}

describe('AppShell', () => {
    it('renders shell landmarks, utilities, current navigation, and route content', async () => {
        const user = userEvent.setup();
        const { onSignOut } = renderShell('/admin/tickets');

        expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content');
        expect(document.querySelector('main#main-content')).toHaveTextContent('Ticket content');
        expect(
            within(screen.getByRole('navigation', { name: 'Primary navigation' })).getByRole('link', { name: /Tickets/ }),
        ).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Tickets');
        expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');

        await user.click(screen.getByRole('button', { name: 'Sign out' }));
        expect(onSignOut).toHaveBeenCalledOnce();
    });

    it('closes the mobile drawer with Escape and restores menu focus', async () => {
        const user = userEvent.setup();
        renderShell();
        const menuButton = screen.getByRole('button', { name: 'Open navigation' });

        await user.click(menuButton);
        const drawer = screen.getByRole('dialog', { name: /UltraPC Care/ });
        expect(menuButton).toHaveAttribute('aria-expanded', 'true');
        expect(within(drawer).getByRole('button', { name: 'Close navigation' })).toHaveFocus();

        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog', { name: /UltraPC Care/ })).not.toBeInTheDocument();
        expect(menuButton).toHaveFocus();
        expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes from the backdrop and restores menu focus', async () => {
        const user = userEvent.setup();
        renderShell();
        const menuButton = screen.getByRole('button', { name: 'Open navigation' });

        await user.click(menuButton);
        await user.click(screen.getByRole('button', { name: 'Dismiss navigation' }));

        expect(screen.queryByRole('dialog', { name: /UltraPC Care/ })).not.toBeInTheDocument();
        expect(menuButton).toHaveFocus();
    });

    it('closes after mobile navigation and keeps the current route announced', async () => {
        const user = userEvent.setup();
        renderShell();
        const menuButton = screen.getByRole('button', { name: 'Open navigation' });

        await user.click(menuButton);
        const drawer = screen.getByRole('dialog', { name: /UltraPC Care/ });
        await user.click(within(drawer).getByRole('link', { name: 'Tickets' }));

        expect(await screen.findByText('Ticket content')).toBeInTheDocument();
        expect(screen.queryByRole('dialog', { name: /UltraPC Care/ })).not.toBeInTheDocument();
        await waitFor(() => expect(menuButton).toHaveFocus());
        expect(
            within(screen.getByRole('navigation', { name: 'Primary navigation' })).getByRole('link', { name: /Tickets/ }),
        ).toHaveAttribute('aria-current', 'page');
    });
});

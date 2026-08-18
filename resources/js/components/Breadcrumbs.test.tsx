import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Breadcrumbs, buildBreadcrumbItems } from '@/components/Breadcrumbs';
import { renderWithProviders } from '@/test/render';

describe('Breadcrumbs', () => {
    it('builds clear contextual labels for record and form routes', () => {
        expect(buildBreadcrumbItems('/admin/users/7b11f9ac/edit', 'admin')).toEqual([
            { label: 'Dashboard', to: '/admin' },
            { label: 'Users', to: '/admin/users' },
            { label: 'User details', to: '/admin/users/7b11f9ac' },
            { label: 'Edit user', to: '/admin/users/7b11f9ac/edit' },
        ]);

        expect(buildBreadcrumbItems('/client/tickets/new', 'client')).toEqual([
            { label: 'Overview', to: '/client' },
            { label: 'Tickets', to: '/client/tickets' },
            { label: 'New ticket', to: '/client/tickets/new' },
        ]);
    });

    it('supports record labels and marks the final crumb as current', () => {
        renderWithProviders(<Breadcrumbs variant="client" labels={{ 'ticket-42': 'SAV-2026-0042' }} />, {
            route: '/client/tickets/ticket-42',
        });

        const breadcrumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
        expect(within(breadcrumbs).getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/client');
        expect(within(breadcrumbs).getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/client/tickets');
        expect(within(breadcrumbs).getByText('SAV-2026-0042')).toHaveAttribute('aria-current', 'page');
    });
});

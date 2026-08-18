import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { TicketDetailsPage } from '@/features/tickets/TicketPages';
import { cancelTicket, getTicket } from '@/features/tickets/api';
import type { Ticket } from '@/features/tickets/types';
import { listTechnicians } from '@/features/technicians/api';
import { WarrantyDetailsPage } from '@/features/warranties/WarrantyPages';
import { getWarranty, getWarrantyEligibility, updateWarranty } from '@/features/warranties/api';
import type { Warranty } from '@/features/warranties/types';
import { useAuth, type AuthUser } from '@/hooks/useAuth';
import { renderWithProviders } from '@/test/render';

vi.mock('@/components/AttachmentPanel', () => ({ AttachmentPanel: () => null }));
vi.mock('@/hooks/useRealtime', () => ({ useTicketRealtime: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/catalog/api', () => ({ listProducts: vi.fn() }));
vi.mock('@/features/clients/api', () => ({ listClients: vi.fn() }));
vi.mock('@/features/repairs/api', () => ({ startDiagnosis: vi.fn() }));
vi.mock('@/features/technicians/api', () => ({ listTechnicians: vi.fn() }));
vi.mock('@/features/tickets/api', () => ({
    assignTicketTechnician: vi.fn(),
    cancelTicket: vi.fn(),
    changeTicketPriority: vi.fn(),
    createTicket: vi.fn(),
    getTicket: vi.fn(),
    listTickets: vi.fn(),
    transitionTicket: vi.fn(),
    updateTicket: vi.fn(),
}));
vi.mock('@/features/warranties/api', () => ({
    getWarranty: vi.fn(),
    getWarrantyEligibility: vi.fn(),
    listClientWarranties: vi.fn(),
    listWarranties: vi.fn(),
    lookupWarranty: vi.fn(),
    updateWarranty: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

const user: AuthUser = {
    id: 1,
    uuid: '2ec5bf9b-bfac-46ac-bcd7-fde5d4173a8c',
    first_name: 'Sofia',
    last_name: 'Agent',
    email: 'sofia@example.com',
    status: 'active',
    roles: ['sav_agent'],
    permissions: ['tickets.close', 'warranties.manage'],
};

const ticket: Ticket = {
    id: 18,
    uuid: '70d1daa6-e0b9-4fa1-ac9c-6fe056a30e67',
    ticket_number: 'SAV-2026-0018',
    client_id: 3,
    product_id: 9,
    warranty_id: null,
    invoice_item_id: null,
    title: 'Display flickers',
    problem_description: 'The display flickers after startup.',
    priority: 'normal',
    status: 'opened',
    source: 'web',
    warranty_eligible: false,
    created_by: 1,
    assigned_technician_id: null,
    received_at: '2026-08-01T09:00:00Z',
    closed_at: null,
    client: null,
    product: null,
    warranty: null,
    invoice_item: null,
    created_by_user: null,
    assigned_technician: null,
    status_history: [],
    ticket_history: [],
    created_at: '2026-08-01T09:00:00Z',
    updated_at: '2026-08-01T09:00:00Z',
};

const warranty: Warranty = {
    id: 24,
    uuid: '387e5bb4-0aa6-4819-badc-9f5732432373',
    client_id: 3,
    invoice_item_id: 12,
    product_id: 9,
    serial_number: 'SN-ULTRA-24',
    quantity: 1,
    starts_at: '2026-01-01',
    expires_at: '2027-01-01',
    status: 'active',
    void_reason: null,
    notes: null,
    client: { id: 3, uuid: '18e96784-5973-4159-87d2-40fdd04582f0', display_name: 'Nadia Benali' },
    product: { id: 9, uuid: 'a494424a-eae1-43b7-a027-b4a6705dbb7c', sku: 'MON-27', name: 'UltraView', model: 'UV27' },
    invoice_item: { id: 12, invoice_id: 7, invoice_number: 'INV-2026-0007' },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
};

describe('irreversible workflow confirmations', () => {
    beforeEach(() => {
        mockedUseAuth.mockReturnValue({ user, isInitializing: false } as unknown as ReturnType<typeof useAuth>);
        vi.mocked(getTicket).mockResolvedValue(ticket);
        vi.mocked(listTechnicians).mockResolvedValue({
            data: [],
            links: {},
            meta: { current_page: 1, from: null, last_page: 1, per_page: 100, to: null, total: 0 },
        });
        vi.mocked(cancelTicket).mockResolvedValue({ ...ticket, status: 'cancelled' });
        vi.mocked(getWarranty).mockResolvedValue(warranty);
        vi.mocked(getWarrantyEligibility).mockResolvedValue({
            is_under_warranty: true,
            reason: 'Coverage is active.',
            starts_at: warranty.starts_at,
            expires_at: warranty.expires_at,
            remaining_days: 136,
            status: 'active',
        });
        vi.mocked(updateWarranty).mockResolvedValue({ ...warranty, status: 'replaced' });
    });

    it('does not cancel a ticket until the agent confirms the irreversible action', async () => {
        const interaction = userEvent.setup();
        renderWithProviders(
            <Routes>
                <Route path="/admin/tickets/:uuid" element={<TicketDetailsPage />} />
            </Routes>,
            { route: `/admin/tickets/${ticket.uuid}` },
        );

        await screen.findByRole('heading', { name: ticket.ticket_number });
        await interaction.type(screen.getByRole('textbox', { name: 'Cancellation reason' }), 'Duplicate service request');
        await interaction.click(screen.getByRole('button', { name: 'Cancel ticket' }));

        const dialog = screen.getByRole('dialog', { name: 'Cancel ticket' });
        expect(cancelTicket).not.toHaveBeenCalled();

        await interaction.click(within(dialog).getByRole('button', { name: 'Cancel ticket' }));
        await waitFor(() => expect(cancelTicket).toHaveBeenCalledWith(ticket.uuid, 'Duplicate service request'));
    });

    it('does not replace a warranty until the lifecycle decision is confirmed', async () => {
        const interaction = userEvent.setup();
        renderWithProviders(
            <Routes>
                <Route path="/admin/warranties/:uuid" element={<WarrantyDetailsPage />} />
            </Routes>,
            { route: `/admin/warranties/${warranty.uuid}` },
        );

        await screen.findByRole('heading', { name: warranty.serial_number ?? 'Warranty record' });
        await interaction.selectOptions(screen.getByRole('combobox', { name: 'New status' }), 'replaced');
        await interaction.click(screen.getByRole('button', { name: 'Save warranty decision' }));

        const dialog = screen.getByRole('dialog', { name: 'Mark warranty as replaced' });
        expect(updateWarranty).not.toHaveBeenCalled();

        await interaction.click(within(dialog).getByRole('button', { name: 'Mark as replaced' }));
        await waitFor(() =>
            expect(updateWarranty).toHaveBeenCalledWith(warranty.uuid, {
                status: 'replaced',
                void_reason: undefined,
                notes: null,
            }),
        );
    });
});

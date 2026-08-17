import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WarrantiesPage } from '@/features/warranties/WarrantyPages';
import { listProducts } from '@/features/catalog/api';
import { listClients } from '@/features/clients/api';
import { listWarranties, lookupWarranty } from '@/features/warranties/api';
import type { Warranty } from '@/features/warranties/types';
import { renderWithProviders } from '@/test/render';

vi.mock('@/features/warranties/api', () => ({
    getWarranty: vi.fn(),
    getWarrantyEligibility: vi.fn(),
    listClientWarranties: vi.fn(),
    listWarranties: vi.fn(),
    lookupWarranty: vi.fn(),
    updateWarranty: vi.fn(),
}));
vi.mock('@/features/clients/api', () => ({ listClients: vi.fn() }));
vi.mock('@/features/catalog/api', () => ({ listProducts: vi.fn() }));

const warranty: Warranty = {
    id: 9,
    uuid: '0274a341-f4cd-4db2-a6c9-53eb16bb647d',
    client_id: 5,
    invoice_item_id: 12,
    product_id: 7,
    serial_number: 'EXPIRED-SN-55',
    quantity: 1,
    starts_at: '2024-01-01',
    expires_at: '2025-01-01',
    status: 'expired',
    void_reason: null,
    notes: null,
    client: { id: 5, uuid: '9b77bced-a8a1-4e19-95de-099ccba6b13b', display_name: 'Nadia Benali' },
    product: {
        id: 7,
        uuid: '377051ca-9599-4e27-951f-1e97df53029b',
        sku: 'MON-27',
        name: 'UltraView 27',
        model: 'UV27',
    },
    invoice_item: { id: 12, invoice_id: 8, invoice_number: 'INV-2024-008' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
};

const emptyPage = {
    data: [],
    links: {},
    meta: { current_page: 1, from: null, last_page: 1, per_page: 100, to: null, total: 0 },
};

describe('warranty lookup flow', () => {
    beforeEach(() => {
        vi.mocked(listWarranties).mockResolvedValue({ ...emptyPage, meta: { ...emptyPage.meta, per_page: 10 } });
        vi.mocked(listClients).mockResolvedValue(emptyPage);
        vi.mocked(listProducts).mockResolvedValue(emptyPage);
        vi.mocked(lookupWarranty).mockResolvedValue({
            warranty,
            eligibility: {
                is_under_warranty: false,
                reason: 'Coverage expired on January 1, 2025.',
                starts_at: warranty.starts_at,
                expires_at: warranty.expires_at,
                remaining_days: 0,
                status: 'expired',
            },
        });
    });

    it('looks up a serial number and displays its eligibility reason', async () => {
        const user = userEvent.setup();
        renderWithProviders(<WarrantiesPage />, { route: '/admin/warranties' });

        await user.type(screen.getByRole('textbox', { name: 'Serial number' }), warranty.serial_number ?? '');
        await user.click(screen.getByRole('button', { name: 'Check warranty' }));

        await waitFor(() => expect(lookupWarranty).toHaveBeenCalledWith('EXPIRED-SN-55'));
        expect(await screen.findByText('Coverage expired on January 1, 2025.')).toBeInTheDocument();
        expect(screen.getByText(/UltraView 27/)).toBeInTheDocument();
    });
});

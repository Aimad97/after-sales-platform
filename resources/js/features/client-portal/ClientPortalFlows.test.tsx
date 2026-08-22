import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { ClientTicketDetailsPage, ClientTicketFormPage } from '@/features/client-portal/ClientPortalPages';
import {
    createPortalTicket,
    getPortalProduct,
    getPortalTicket,
    listPortalProducts,
    respondToPortalRepairApproval,
    uploadPortalTicketAttachment,
} from '@/features/client-portal/api';
import type { PortalPurchasedProduct, PortalTicket } from '@/features/client-portal/types';
import { renderWithProviders } from '@/test/render';

vi.mock('@/features/client-portal/api', () => ({
    createPortalTicket: vi.fn(),
    getPortalProduct: vi.fn(),
    getPortalProfile: vi.fn(),
    getPortalTicket: vi.fn(),
    listPortalProducts: vi.fn(),
    listPortalTickets: vi.fn(),
    respondToPortalRepairApproval: vi.fn(),
    uploadPortalTicketAttachment: vi.fn(),
}));
vi.mock('@/hooks/useRealtime', () => ({ useTicketRealtime: vi.fn() }));
vi.mock('@/components/AttachmentPanel', () => ({
    AttachmentPanel: () => <section aria-label="Ticket attachments">Attachments</section>,
}));

const purchasedProduct: PortalPurchasedProduct = {
    uuid: '132972c1-e4b2-4ca1-ad9a-85fd523abf18',
    serial_number: 'SN-ULTRA-100',
    quantity: 1,
    purchase_date: '2026-07-01',
    warranty: {
        status: 'active',
        eligible: true,
        starts_at: '2026-07-01',
        expires_at: '2027-07-01',
    },
    product: {
        uuid: '482670db-85bc-47cd-a41e-282af32db676',
        sku: 'LAP-100',
        name: 'UltraBook Pro',
        model: 'UBP-14',
        description: null,
        brand: 'UltraPC',
        category: 'Laptops',
    },
};

const createdTicket: PortalTicket = {
    id: 44,
    uuid: '55de609c-a72d-4b97-870d-ea627f1bf3b9',
    ticket_number: 'SAV-2026-0044',
    title: 'Laptop does not power on',
    problem_description: 'The laptop stopped powering on after normal use.',
    priority: 'normal',
    status: 'opened',
    source: 'web',
    warranty_eligible: true,
    received_at: '2026-08-17T10:00:00Z',
    closed_at: null,
    can_upload_attachments: true,
    can_respond_to_repair_approval: false,
    product: { uuid: purchasedProduct.product?.uuid ?? '', sku: 'LAP-100', name: 'UltraBook Pro', model: 'UBP-14' },
    warranty: {
        uuid: '75a580be-c75b-4ddf-8ac5-203819576336',
        serial_number: 'SN-ULTRA-100',
        status: 'active',
        starts_at: '2026-07-01',
        expires_at: '2027-07-01',
    },
    assigned_technician: null,
    status_timeline: [],
    attachments: [],
    repair_outcome: null,
    created_at: '2026-08-17T10:00:00Z',
    updated_at: '2026-08-17T10:00:00Z',
};

const mockedListProducts = vi.mocked(listPortalProducts);
const mockedGetProduct = vi.mocked(getPortalProduct);
const mockedCreateTicket = vi.mocked(createPortalTicket);
const mockedUpload = vi.mocked(uploadPortalTicketAttachment);
const mockedGetTicket = vi.mocked(getPortalTicket);
const mockedRespondToApproval = vi.mocked(respondToPortalRepairApproval);

describe('client ticket flows', () => {
    beforeEach(() => {
        mockedListProducts.mockResolvedValue({
            data: [purchasedProduct],
            links: {},
            meta: { current_page: 1, from: 1, last_page: 1, per_page: 50, to: 1, total: 1 },
        });
        mockedGetProduct.mockResolvedValue(purchasedProduct);
        mockedCreateTicket.mockResolvedValue(createdTicket);
        mockedUpload.mockResolvedValue({
            id: 1,
            uuid: 'b56db369-a6e1-42b7-b9ac-625589960e43',
            original_filename: 'power-light.jpg',
            mime_type: 'image/jpeg',
            size: 5,
            is_previewable_image: true,
            download_url: '/api/client/tickets/file/download',
            preview_url: '/api/client/tickets/file/preview',
            created_at: '2026-08-17T10:01:00Z',
            uploaded_by: null,
        });
        mockedGetTicket.mockResolvedValue(createdTicket);
        mockedRespondToApproval.mockReset();
    });

    it('lists purchased products, submits a request, and uploads its attachment', async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <Routes>
                <Route path="/client/tickets/new" element={<ClientTicketFormPage />} />
                <Route path="/client/tickets/:uuid" element={<p>Request created</p>} />
            </Routes>,
            { route: '/client/tickets/new' },
        );

        const productSelect = await screen.findByRole('combobox', { name: 'Purchased product' });
        expect(await screen.findByRole('option', { name: /UltraBook Pro.*SN-ULTRA-100/ })).toBeInTheDocument();
        await user.selectOptions(productSelect, purchasedProduct.uuid);
        await user.type(screen.getByRole('textbox', { name: 'Issue summary' }), createdTicket.title);
        await user.type(screen.getByRole('textbox', { name: 'Problem description' }), createdTicket.problem_description);
        const photo = new File(['photo'], 'power-light.jpg', { type: 'image/jpeg' });
        await user.upload(screen.getByLabelText(/Photos or documents/), photo);
        await user.click(screen.getByRole('button', { name: 'Submit request' }));

        await waitFor(() =>
            expect(mockedCreateTicket).toHaveBeenCalledWith({
                purchased_product_uuid: purchasedProduct.uuid,
                title: createdTicket.title,
                problem_description: createdTicket.problem_description,
            }),
        );
        await waitFor(() => expect(mockedUpload).toHaveBeenCalledWith(createdTicket.uuid, photo, expect.any(Function)));
        expect(await screen.findByText('Request created')).toBeInTheDocument();
    });

    it('shows customer-safe status history and the repair outcome', async () => {
        mockedGetTicket.mockResolvedValue({
            ...createdTicket,
            status: 'ready_for_pickup',
            status_timeline: [
                { id: 1, from_status: 'repairing', to_status: 'testing', transitioned_at: '2026-08-17T12:00:00Z' },
                { id: 2, from_status: 'testing', to_status: 'repaired', transitioned_at: '2026-08-17T13:00:00Z' },
                { id: 3, from_status: 'repaired', to_status: 'ready_for_pickup', transitioned_at: '2026-08-17T14:00:00Z' },
            ],
            repair_outcome: {
                diagnosis: 'The power board failed.',
                repair_action: 'Power board replaced and tested.',
                customer_notes: 'Device is ready for collection.',
                result: 'repaired',
                started_at: '2026-08-17T11:00:00Z',
                completed_at: '2026-08-17T13:00:00Z',
            },
        });

        renderWithProviders(
            <Routes>
                <Route path="/client/tickets/:uuid" element={<ClientTicketDetailsPage />} />
            </Routes>,
            { route: `/client/tickets/${createdTicket.uuid}` },
        );

        expect(await screen.findByText('Repair outcome')).toBeInTheDocument();
        expect(screen.getAllByText('Ready For Pickup').length).toBeGreaterThan(0);
        expect(screen.getByText('The power board failed.')).toBeInTheDocument();
        expect(screen.getByText('Power board replaced and tested.')).toBeInTheDocument();
        expect(screen.getByText('Device is ready for collection.')).toBeInTheDocument();
        expect(screen.queryByText(/internal technician/i)).not.toBeInTheDocument();
    });

    it('lets the customer approve a pending repair plan and refreshes the ticket status', async () => {
        const user = userEvent.setup();
        const awaitingApprovalTicket: PortalTicket = {
            ...createdTicket,
            status: 'awaiting_customer_approval',
            can_respond_to_repair_approval: true,
            repair_outcome: {
                diagnosis: null,
                repair_action: null,
                customer_notes: 'Please approve replacement of the paper-feed assembly.',
                result: null,
                started_at: null,
                completed_at: null,
            },
        };
        mockedGetTicket.mockResolvedValue(awaitingApprovalTicket);
        mockedRespondToApproval.mockResolvedValue({
            ...awaitingApprovalTicket,
            status: 'diagnosing',
            can_respond_to_repair_approval: false,
        });

        renderWithProviders(
            <Routes>
                <Route path="/client/tickets/:uuid" element={<ClientTicketDetailsPage />} />
            </Routes>,
            { route: `/client/tickets/${createdTicket.uuid}` },
        );

        expect(await screen.findByRole('heading', { name: 'Your approval is required' })).toBeInTheDocument();
        expect(screen.getByText('Please approve replacement of the paper-feed assembly.')).toBeInTheDocument();
        await user.type(screen.getByRole('textbox', { name: 'Message to the technician (optional)' }), 'Approved, please continue.');
        await user.click(screen.getByRole('button', { name: 'Approve repair' }));

        await waitFor(() =>
            expect(mockedRespondToApproval).toHaveBeenCalledWith(createdTicket.uuid, {
                decision: 'approved',
                notes: 'Approved, please continue.',
            }),
        );
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Approve repair' })).not.toBeInTheDocument());
        expect(screen.getAllByText('Diagnosing').length).toBeGreaterThan(0);
    });
});

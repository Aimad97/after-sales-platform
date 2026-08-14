import type { Attachment } from '@/features/attachments/types';
import type { TicketPriority, TicketSource, TicketStatus } from '@/features/tickets/types';

export type PortalWarrantyStatus = 'active' | 'expired' | 'void' | 'replaced';

export interface PortalProfile {
    uuid: string;
    type: 'individual' | 'company';
    display_name: string;
    company_name: string | null;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string;
    address: string | null;
    city: string | null;
    tax_identifier: string | null;
    customer_since: string | null;
}

export interface PortalPurchasedProduct {
    uuid: string;
    serial_number: string | null;
    quantity: number;
    purchase_date: string | null;
    warranty: {
        status: PortalWarrantyStatus;
        eligible: boolean;
        starts_at: string | null;
        expires_at: string | null;
    };
    product: {
        uuid: string;
        sku: string;
        name: string;
        model: string | null;
        description: string | null;
        brand: string | null;
        category: string | null;
    } | null;
}

export interface PortalTicketTimelineEntry {
    id: number;
    from_status: TicketStatus | null;
    to_status: TicketStatus;
    transitioned_at: string | null;
}

export interface PortalRepairOutcome {
    diagnosis: string | null;
    repair_action: string | null;
    customer_notes: string | null;
    result: 'repaired' | 'partially_repaired' | 'unrepairable' | 'replacement_required' | null;
    started_at: string | null;
    completed_at: string | null;
}

export interface PortalTicket {
    id: number;
    uuid: string;
    ticket_number: string;
    title: string;
    problem_description: string;
    priority: TicketPriority;
    status: TicketStatus;
    source: TicketSource;
    warranty_eligible: boolean;
    received_at: string | null;
    closed_at: string | null;
    can_upload_attachments: boolean;
    product: { uuid: string; sku: string; name: string; model: string | null } | null;
    warranty: { uuid: string; serial_number: string | null; status: PortalWarrantyStatus; starts_at: string | null; expires_at: string | null } | null;
    assigned_technician: { display_name: string } | null;
    status_timeline: PortalTicketTimelineEntry[];
    attachments: Attachment[];
    repair_outcome: PortalRepairOutcome | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface PortalProductFilters {
    search?: string;
    status?: PortalWarrantyStatus | '';
    per_page?: number;
    page?: number;
}

export interface PortalTicketFilters {
    search?: string;
    status?: TicketStatus | '';
    per_page?: number;
    page?: number;
}

export interface PortalTicketPayload {
    purchased_product_uuid: string;
    title: string;
    problem_description: string;
}

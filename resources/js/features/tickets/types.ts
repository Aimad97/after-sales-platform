import type { Client } from '@/features/clients/types';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketStatus =
    | 'opened'
    | 'received'
    | 'awaiting_diagnosis'
    | 'diagnosing'
    | 'awaiting_customer_approval'
    | 'awaiting_part'
    | 'repairing'
    | 'testing'
    | 'repaired'
    | 'ready_for_pickup'
    | 'delivered'
    | 'closed'
    | 'cancelled';
export type TicketSource = 'store' | 'phone' | 'email' | 'web';

export interface TicketProduct {
    id: number;
    uuid: string;
    sku: string;
    name: string;
    model: string | null;
}

export interface TicketWarranty {
    id: number;
    uuid: string;
    serial_number: string | null;
    status: string;
}

export interface TicketInvoiceItem {
    id: number;
    serial_number: string | null;
    invoice_number: string | null;
}

export interface TicketUser {
    id: number;
    uuid: string;
    display_name: string;
    email: string;
}

export interface TicketTechnician {
    id: number;
    employee_code: string;
    specialization: string | null;
    availability_status: string;
    user: TicketUser | null;
}

export interface TicketStatusHistory {
    id: number;
    from_status: TicketStatus | null;
    to_status: TicketStatus;
    notes: string | null;
    transitioned_at: string | null;
    transitioned_by: TicketUser | null;
}

export interface TicketHistoryActor {
    display_name: string;
}

export interface TicketHistory {
    id: number;
    event: string;
    description: string;
    metadata: unknown | null;
    occurred_at: string | null;
    actor: TicketHistoryActor | null;
}

export interface Ticket {
    id: number;
    uuid: string;
    ticket_number: string;
    client_id: number;
    product_id: number;
    warranty_id: number | null;
    invoice_item_id: number | null;
    title: string;
    problem_description: string;
    priority: TicketPriority;
    status: TicketStatus;
    source: TicketSource;
    warranty_eligible: boolean;
    created_by: number;
    assigned_technician_id: number | null;
    received_at: string | null;
    closed_at: string | null;
    status_history_count?: number;
    client: Client | null;
    product: TicketProduct | null;
    warranty: TicketWarranty | null;
    invoice_item: TicketInvoiceItem | null;
    created_by_user: TicketUser | null;
    assigned_technician: TicketTechnician | null;
    status_history: TicketStatusHistory[];
    ticket_history?: TicketHistory[];
    created_at: string | null;
    updated_at: string | null;
}

export interface TicketFilters {
    search?: string;
    client_id?: number | '';
    product_id?: number | '';
    warranty_id?: number | '';
    assigned_technician_id?: number | '';
    priority?: TicketPriority | '';
    status?: TicketStatus | '';
    source?: TicketSource | '';
    warranty_eligible?: boolean | '';
    received_from?: string;
    received_to?: string;
    sort?: 'ticket_number' | 'priority' | 'status' | 'received_at' | 'closed_at' | 'created_at';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}

export interface TicketPayload {
    client_id: number;
    product_id: number;
    warranty_id: number | null;
    invoice_item_id?: number | null;
    title: string;
    problem_description: string;
    priority: TicketPriority;
    source: TicketSource;
}

export interface TicketUpdatePayload {
    title?: string;
    problem_description?: string;
    source?: TicketSource;
}

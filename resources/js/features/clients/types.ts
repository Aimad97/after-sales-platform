export type ClientType = 'individual' | 'company';

export interface Client {
    id: number;
    uuid: string;
    type: ClientType;
    display_name: string;
    company_name: string | null;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string;
    address: string | null;
    city: string | null;
    tax_identifier: string | null;
    notes: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface ClientFilters {
    search?: string;
    type?: ClientType | '';
    sort?: 'first_name' | 'last_name' | 'company_name' | 'email' | 'phone' | 'city' | 'type' | 'created_at';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}

export interface ClientPayload {
    type: ClientType;
    company_name: string | null;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string;
    address: string | null;
    city: string | null;
    tax_identifier: string | null;
    notes: string | null;
}

export interface ClientProduct {
    id: number;
    name: string;
    model: string;
}

export interface ClientWarranty {
    id: number;
    uuid: string;
    serial_number: string | null;
    quantity: number;
    starts_at: string | null;
    expires_at: string | null;
    status: 'active' | 'expired' | 'void' | 'replaced';
    purchase_date: string | null;
    warranty_end: string | null;
    product: ClientProduct | null;
}

export interface ClientTicket {
    id: number;
    uuid: string;
    subject: string;
    description: string;
    status: { id: number; name: string } | null;
    opened_at: string | null;
    closed_at: string | null;
}

export interface ClientRepair {
    id: number;
    diagnostic: string;
    solution: string | null;
    labor_cost: number | string;
    created_at: string | null;
    ticket: ClientTicket | null;
}

export interface ClientProfile {
    client: Client;
    purchased_products: ClientWarranty[];
    active_warranties: ClientWarranty[];
    expired_warranties: ClientWarranty[];
    tickets: ClientTicket[];
    repair_history: ClientRepair[];
}

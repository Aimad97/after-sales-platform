export type WarrantyStatus = 'active' | 'expired' | 'void' | 'replaced';

export interface WarrantyClient {
    id: number;
    uuid: string;
    display_name: string;
}

export interface WarrantyProduct {
    id: number;
    uuid: string;
    sku: string;
    name: string;
    model: string;
}

export interface WarrantyInvoiceItem {
    id: number;
    invoice_id: number;
    invoice_number: string | null;
}

export interface Warranty {
    id: number;
    uuid: string;
    client_id: number;
    invoice_item_id: number | null;
    product_id: number;
    serial_number: string | null;
    quantity: number;
    starts_at: string;
    expires_at: string;
    status: WarrantyStatus;
    void_reason: string | null;
    notes: string | null;
    client: WarrantyClient | null;
    product: WarrantyProduct | null;
    invoice_item: WarrantyInvoiceItem | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface WarrantyEligibility {
    is_under_warranty: boolean;
    reason: string;
    starts_at: string;
    expires_at: string;
    remaining_days: number;
    status: WarrantyStatus;
}

export interface WarrantyLookupResult {
    warranty: Warranty;
    eligibility: WarrantyEligibility;
}

export interface WarrantyFilters {
    search?: string;
    client_id?: number | '';
    product_id?: number | '';
    status?: WarrantyStatus | '';
    sort?: 'serial_number' | 'starts_at' | 'expires_at' | 'status' | 'created_at';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}

export interface WarrantyUpdatePayload {
    status?: 'void' | 'replaced';
    void_reason?: string | null;
    notes?: string | null;
}

import type { Client } from '@/features/clients/types';

export type InvoiceStatus = 'draft' | 'issued' | 'void';

export interface InvoiceProduct {
    id: number;
    uuid: string;
    sku: string;
    name: string;
    model: string;
    serial_number_required: boolean;
}

export interface InvoiceItem {
    id: number;
    product_id: number;
    serial_number: string | null;
    quantity: number;
    unit_price: number | string;
    warranty_months: number;
    warranty_start_date: string | null;
    warranty_end_date: string | null;
    line_subtotal: number | string;
    line_tax: number | string;
    line_total: number | string;
    product: InvoiceProduct | null;
}

export interface Invoice {
    id: number;
    invoice_number: string;
    client_id: number;
    invoice_date: string;
    subtotal_amount: number | string;
    tax_rate: number | string;
    tax_amount: number | string;
    total_amount: number | string;
    status: InvoiceStatus;
    notes: string | null;
    items_count?: number;
    client: Client | null;
    items: InvoiceItem[];
    created_at: string | null;
    updated_at: string | null;
}

export interface InvoiceFilters {
    search?: string;
    client_id?: number | '';
    status?: InvoiceStatus | '';
    date_from?: string;
    date_to?: string;
    sort?: 'invoice_number' | 'invoice_date' | 'subtotal_amount' | 'tax_amount' | 'total_amount' | 'status' | 'created_at';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}

export interface InvoiceItemPayload {
    product_id: number;
    serial_number: string | null;
    quantity: number;
    unit_price: number;
    warranty_months: number;
    warranty_start_date: string | null;
}

export interface InvoicePayload {
    invoice_number: string | null;
    client_id: number;
    invoice_date: string;
    tax_rate: number;
    status: InvoiceStatus;
    notes: string | null;
    items: InvoiceItemPayload[];
}

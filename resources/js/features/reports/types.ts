import type { PaginationMeta } from '@/types/pagination';

export const reportTypes = [
    'tickets',
    'repairs',
    'warranties',
    'technician_performance',
    'defective_products',
    'client_history',
] as const;

export type ReportType = (typeof reportTypes)[number];

export type ReportExportFormat = 'csv';

export interface ReportFilters {
    date_from?: string;
    date_to?: string;
    technician_id?: number;
    status?: string;
    priority?: string;
    brand_id?: number;
    category_id?: number;
    product_id?: number;
    warranty_state?: string;
    client_id?: number;
    per_page?: number;
    page?: number;
}

export interface ReportFilterFormValues {
    date_from: string;
    date_to: string;
    technician_id: string;
    status: string;
    priority: string;
    brand_id: string;
    category_id: string;
    product_id: string;
    warranty_state: string;
    client_id: string;
}

export interface ReportRow {
    id?: number | string;
    [key: string]: unknown;
}

export type ReportColumns = Record<string, string>;

export interface ReportResponse {
    data: ReportRow[];
    columns: ReportColumns;
    meta: PaginationMeta;
}

export interface ReportExport {
    uuid: string;
    report_type: ReportType;
    format: ReportExportFormat;
    status: string;
    download_url: string | null;
    row_count?: number | null;
    expires_at?: string | null;
    failure_message?: string | null;
    created_at: string | null;
    updated_at: string | null;
}

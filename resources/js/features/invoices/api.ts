import { apiClient } from '@/api/client';
import type { Invoice, InvoiceFilters, InvoicePayload } from '@/features/invoices/types';
import type { PaginatedResponse } from '@/types/pagination';

interface DataResponse<T> {
    data: T;
}

export async function listInvoices(filters: InvoiceFilters): Promise<PaginatedResponse<Invoice>> {
    const response = await apiClient.get<PaginatedResponse<Invoice>>('/invoices', { params: filters });
    return response.data;
}

export async function listClientInvoices(clientUuid: string, filters: InvoiceFilters): Promise<PaginatedResponse<Invoice>> {
    const response = await apiClient.get<PaginatedResponse<Invoice>>(`/clients/${clientUuid}/invoices`, { params: filters });
    return response.data;
}

export async function getInvoice(id: number): Promise<Invoice> {
    const response = await apiClient.get<DataResponse<Invoice>>(`/invoices/${id}`);
    return response.data.data;
}

export async function createInvoice(payload: InvoicePayload): Promise<Invoice> {
    const response = await apiClient.post<DataResponse<Invoice>>('/invoices', payload);
    return response.data.data;
}

export async function updateInvoice(id: number, payload: InvoicePayload): Promise<Invoice> {
    const response = await apiClient.patch<DataResponse<Invoice>>(`/invoices/${id}`, payload);
    return response.data.data;
}

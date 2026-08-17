import { apiClient } from '@/api/client';
import type { Ticket, TicketFilters, TicketPayload, TicketPriority, TicketStatus, TicketUpdatePayload } from '@/features/tickets/types';
import type { PaginatedResponse } from '@/types/pagination';

interface DataResponse<T> {
    data: T;
}

export async function listTickets(filters: TicketFilters): Promise<PaginatedResponse<Ticket>> {
    const response = await apiClient.get<PaginatedResponse<Ticket>>('/tickets', { params: filters });
    return response.data;
}

export async function getTicket(uuid: string): Promise<Ticket> {
    const response = await apiClient.get<DataResponse<Ticket>>(`/tickets/${uuid}`);
    return response.data.data;
}

export async function createTicket(payload: TicketPayload): Promise<Ticket> {
    const response = await apiClient.post<DataResponse<Ticket>>('/tickets', payload);
    return response.data.data;
}

export async function updateTicket(uuid: string, payload: TicketUpdatePayload): Promise<Ticket> {
    const response = await apiClient.patch<DataResponse<Ticket>>(`/tickets/${uuid}`, payload);
    return response.data.data;
}

export async function assignTicketTechnician(uuid: string, assignedTechnicianId: number): Promise<Ticket> {
    const response = await apiClient.post<DataResponse<Ticket>>(`/tickets/${uuid}/assign`, {
        assigned_technician_id: assignedTechnicianId,
    });
    return response.data.data;
}

export async function changeTicketPriority(uuid: string, priority: TicketPriority): Promise<Ticket> {
    const response = await apiClient.post<DataResponse<Ticket>>(`/tickets/${uuid}/priority`, { priority });
    return response.data.data;
}

export async function transitionTicket(uuid: string, status: TicketStatus, notes: string | null): Promise<Ticket> {
    const response = await apiClient.post<DataResponse<Ticket>>(`/tickets/${uuid}/transition`, { status, notes });
    return response.data.data;
}

export async function cancelTicket(uuid: string, reason: string): Promise<Ticket> {
    const response = await apiClient.post<DataResponse<Ticket>>(`/tickets/${uuid}/cancel`, { reason });
    return response.data.data;
}

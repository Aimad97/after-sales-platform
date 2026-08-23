import type { TicketStatus } from '@/features/tickets/types';

export type RepairResult = 'repaired' | 'partially_repaired' | 'unrepairable' | 'replacement_required';
export type RepairStateFilter = 'current' | 'completed' | '';

export interface RepairTicket {
    uuid: string;
    ticket_number: string;
    title: string;
    status: TicketStatus | null;
    client: string | null;
    product: string | null;
}

export interface RepairTechnician {
    id: number;
    employee_code: string;
    name: string | null;
}

export interface RepairHistoryEntry {
    id: number;
    event: string;
    changes: unknown | null;
    occurred_at: string | null;
    changed_by: string | null;
}

export interface Repair {
    id: number;
    ticket_id: number;
    technician_id: number;
    diagnosis: string | null;
    root_cause: string | null;
    repair_action: string | null;
    internal_notes: string | null;
    customer_notes: string | null;
    labor_cost: string;
    parts_cost: string;
    total_cost: string;
    started_at: string | null;
    completed_at: string | null;
    result: RepairResult | null;
    ticket: RepairTicket | null;
    technician: RepairTechnician | null;
    history?: RepairHistoryEntry[];
    created_at: string | null;
    updated_at: string | null;
}

export interface RepairFilters {
    technician_id?: number | '';
    state?: RepairStateFilter;
    per_page?: number;
    page?: number;
}

export interface RepairDiagnosisPayload {
    diagnosis: string;
    root_cause: string | null;
    customer_notes: string | null;
    labor_cost: string;
    parts_cost: string;
    next_status: 'awaiting_customer_approval' | 'awaiting_part' | 'repairing';
}

export interface RepairUpdatePayload {
    repair_action?: string | null;
    internal_notes?: string | null;
    customer_notes?: string | null;
    labor_cost?: string;
    parts_cost?: string;
}

export interface RepairCompletionPayload {
    result: RepairResult;
    customer_notes: string | null;
}

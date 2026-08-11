export interface AuditLogActor {
    id: number;
    display_name: string;
}

export interface AuditLog {
    id: number;
    user: AuditLogActor | null;
    action: string;
    entity_type: string;
    entity_id: number | string;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string | null;
}

export interface AuditLogFilters {
    user_id?: number | '';
    action?: string;
    entity_type?: string;
    date_from?: string;
    date_to?: string;
    per_page?: number;
    page?: number;
}

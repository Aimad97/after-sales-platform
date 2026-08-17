export interface MetricPoint {
    key: string;
    value: number;
}

export interface AdminDashboard {
    role: 'admin';
    generated_at: string;
    kpis: {
        open_tickets: number;
        tickets_created_today: number;
        tickets_resolved_today: number;
        urgent_tickets: number;
        average_resolution_seconds: number | null;
        active_warranties: number;
        expired_warranties: number;
    };
    charts: {
        tickets_by_status: MetricPoint[];
        tickets_by_priority: MetricPoint[];
        tickets_by_month: MetricPoint[];
        warranty_claims: { covered: number; out_of_warranty: number };
    };
    technicians: {
        workload: Array<{ id: number; name: string; employee_code: string; value: number }>;
        performance: Array<{
            id: number;
            name: string;
            employee_code: string;
            completed_count: number;
            average_repair_seconds: number | null;
        }>;
    };
    defective_products: Array<{ id: number; name: string; sku: string; value: number }>;
}

export interface TechnicianDashboard {
    role: 'technician';
    generated_at: string;
    profile_available: boolean;
    kpis: {
        assigned_tickets: number;
        overdue_tickets: number;
        repairs_in_progress: number;
        completed_today: number;
        average_repair_seconds: number | null;
    };
    charts: {
        assigned_tickets_by_status: MetricPoint[];
    };
}

export interface ClientRepairUpdate {
    ticket_uuid: string | null;
    ticket_number: string | null;
    ticket_title: string | null;
    ticket_status: string | null;
    product_name: string | null;
    customer_notes: string | null;
    result: string | null;
    completed_at: string | null;
    updated_at: string | null;
}

export interface ClientDashboard {
    role: 'client';
    generated_at: string;
    account_linked: boolean;
    kpis: {
        my_products: number;
        active_warranties: number;
        active_tickets: number;
    };
    recent_repair_updates: ClientRepairUpdate[];
}

export type Dashboard = AdminDashboard | TechnicianDashboard | ClientDashboard;

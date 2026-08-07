export type UserStatus = 'active' | 'invited' | 'suspended' | 'archived';

export interface UserTechnicianSummary {
    id: number;
    employee_code: string;
    availability_status: string;
}

export interface ManagedUser {
    id: number;
    uuid: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    locale: string;
    timezone: string;
    status: UserStatus;
    last_login_at: string | null;
    roles: string[];
    permissions: string[];
    technician?: UserTechnicianSummary | null;
}

export interface UserFilters {
    search?: string;
    status?: UserStatus | '';
    role?: string;
    technician?: boolean;
    sort?: 'first_name' | 'last_name' | 'email' | 'status' | 'last_login_at' | 'created_at';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}

export interface UserPayload {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    status: UserStatus;
    locale: string;
    timezone: string;
    roles: string[];
    password?: string;
    password_confirmation?: string;
}

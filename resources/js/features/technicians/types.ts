export type TechnicianAvailabilityStatus = 'available' | 'busy' | 'unavailable' | 'leave';

export interface TechnicianUser {
    id: number;
    uuid: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    status: string;
    roles: string[];
}

export interface TechnicianProfile {
    id: number;
    user_id: number;
    employee_code: string;
    specialization: string | null;
    skill_level: number;
    availability_status: TechnicianAvailabilityStatus;
    notes: string | null;
    created_at: string;
    updated_at: string;
    user?: TechnicianUser;
}

export interface TechnicianFilters {
    search?: string;
    availability_status?: TechnicianAvailabilityStatus | '';
    skill_level?: number | '';
    sort?: 'employee_code' | 'specialization' | 'skill_level' | 'availability_status' | 'created_at';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}

export interface TechnicianPayload {
    user_id: number;
    employee_code: string;
    specialization: string | null;
    skill_level: number;
    availability_status: TechnicianAvailabilityStatus;
    notes: string | null;
}

export interface TechnicianSelfProfilePayload {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    specialization: string | null;
    availability_status: TechnicianAvailabilityStatus;
}

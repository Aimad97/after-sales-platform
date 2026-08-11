import { apiClient } from '@/api/client';
import type { AuditLog, AuditLogFilters } from '@/features/audit-logs/types';
import type { PaginatedResponse } from '@/types/pagination';

export async function listAuditLogs(filters: AuditLogFilters): Promise<PaginatedResponse<AuditLog>> {
    const response = await apiClient.get<PaginatedResponse<AuditLog>>('/audit-logs', { params: filters });

    return response.data;
}

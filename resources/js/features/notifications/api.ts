import { apiClient } from '@/api/client';
import type { AppNotification, NotificationFilters, UnreadNotificationCount } from '@/features/notifications/types';
import type { PaginatedResponse } from '@/types/pagination';

interface DataResponse<T> {
    data: T;
}

export async function listNotifications(filters: NotificationFilters = {}): Promise<PaginatedResponse<AppNotification>> {
    const response = await apiClient.get<PaginatedResponse<AppNotification>>('/notifications', { params: filters });

    return response.data;
}

export async function getUnreadNotificationCount(): Promise<UnreadNotificationCount> {
    const response = await apiClient.get<DataResponse<UnreadNotificationCount>>('/notifications/unread-count');

    return response.data.data;
}

export async function markNotificationAsRead(id: string): Promise<AppNotification> {
    const response = await apiClient.patch<DataResponse<AppNotification>>('/notifications/' + id + '/read');

    return response.data.data;
}

export async function markAllNotificationsAsRead(): Promise<number> {
    const response = await apiClient.post<DataResponse<{ marked_as_read: number }>>('/notifications/mark-all-read');

    return response.data.data.marked_as_read;
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '@/components/Pagination';
import {
    listNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from '@/features/notifications/api';
import type { AppNotification, NotificationFilters } from '@/features/notifications/types';
import { formatDate } from '@/utils/format';

function ErrorMessage({ error }: { error: unknown }) {
    return error instanceof Error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error.message}</p> : null;
}

function NotificationRow({
    notification,
    onRead,
}: {
    notification: AppNotification;
    onRead: (notification: AppNotification) => void;
}) {
    const detail = (
        <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-slate-900">{notification.title}</h3>
                {notification.read_at === null ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Unread</span> : <span className="text-xs text-slate-500">Read</span>}
            </div>
            <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
            <p className="mt-2 text-xs text-slate-500">{formatDate(notification.created_at)}</p>
        </div>
    );
    const rowClass = notification.read_at === null
        ? 'rounded-xl border border-blue-200 bg-blue-50/30 p-5 shadow-sm'
        : 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';

    return (
        <article className={rowClass}>
            <div className="flex flex-wrap items-start justify-between gap-4">
                {notification.action_url ? <Link className="min-w-0 flex-1" to={notification.action_url} onClick={() => onRead(notification)}>{detail}</Link> : <div className="min-w-0 flex-1">{detail}</div>}
                {notification.read_at === null && <button className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white" type="button" onClick={() => onRead(notification)}><Check size={16} />Mark read</button>}
            </div>
        </article>
    );
}

export function NotificationsPage() {
    const queryClient = useQueryClient();
    const [filters, setFilters] = useState<NotificationFilters>({ per_page: 20 });
    const notificationsQuery = useQuery({
        queryKey: ['notifications', 'list', filters],
        queryFn: () => listNotifications(filters),
    });
    const markReadMutation = useMutation({
        mutationFn: markNotificationAsRead,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
    const markAllMutation = useMutation({
        mutationFn: markAllNotificationsAsRead,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
    const markRead = (notification: AppNotification) => {
        if (notification.read_at === null) {
            markReadMutation.mutate(notification.id);
        }
    };
    const unreadClass = filters.unread === true
        ? 'rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white'
        : 'rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100';
    const allClass = filters.unread === undefined
        ? 'rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white'
        : 'rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100';

    return (
        <section className="max-w-5xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div><h2 className="text-2xl font-bold text-slate-900">Notifications</h2><p className="mt-1 text-sm text-slate-600">Review ticket, repair, and warranty updates assigned to you.</p></div>
                <button className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-50" type="button" disabled={markAllMutation.isPending} onClick={() => markAllMutation.mutate()}><CheckCheck size={17} />Mark all as read</button>
            </div>
            <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <button className={unreadClass} type="button" onClick={() => setFilters({ per_page: 20, unread: true })}>Unread</button>
                <button className={allClass} type="button" onClick={() => setFilters({ per_page: 20 })}>All</button>
            </div>
            {notificationsQuery.isLoading ? <p className="text-sm text-slate-600">Loading notifications...</p> : <><ErrorMessage error={notificationsQuery.error} /><div className="space-y-3">{notificationsQuery.data?.data.map((notification) => <NotificationRow key={notification.id} notification={notification} onRead={markRead} />)}{!notificationsQuery.error && (notificationsQuery.data?.data.length ?? 0) === 0 && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No notifications match this view.</p>}</div>{notificationsQuery.data && <Pagination meta={notificationsQuery.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />}</>}
        </section>
    );
}

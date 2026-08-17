import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    getUnreadNotificationCount,
    listNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from '@/features/notifications/api';
import { notificationActionUrl, type AppNotification } from '@/features/notifications/types';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/utils/format';

function NotificationItem({
    notification,
    onRead,
    isClient,
}: {
    notification: AppNotification;
    onRead: (notification: AppNotification) => void;
    isClient: boolean;
}) {
    const content = (
        <>
            <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-slate-900">{notification.title}</p>
                {notification.read_at === null && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{notification.message}</p>
            <p className="mt-2 text-xs text-slate-500">{formatDate(notification.created_at)}</p>
        </>
    );

    const actionUrl = notificationActionUrl(notification, isClient);
    if (actionUrl) {
        return (
            <Link className="block p-4 hover:bg-slate-50" to={actionUrl} onClick={() => onRead(notification)}>
                {content}
            </Link>
        );
    }

    return (
        <button className="block w-full p-4 text-left hover:bg-slate-50" type="button" onClick={() => onRead(notification)}>
            {content}
        </button>
    );
}

export function NotificationBell() {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();
    const isClient = user?.roles.includes('client') ?? false;
    const countQuery = useQuery({
        queryKey: ['notifications', 'unread-count'],
        queryFn: getUnreadNotificationCount,
        refetchInterval: 30_000,
    });
    const notificationsQuery = useQuery({
        queryKey: ['notifications', 'recent'],
        queryFn: () => listNotifications({ per_page: 8 }),
        enabled: isOpen,
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
    const unreadCount = countQuery.data?.count ?? 0;
    const ariaLabel = unreadCount > 0 ? 'Notifications, ' + unreadCount + ' unread' : 'Notifications';

    const markRead = (notification: AppNotification) => {
        if (notification.read_at === null) {
            markReadMutation.mutate(notification.id);
        }
    };

    return (
        <div className="relative">
            <button
                className="relative rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50"
                type="button"
                aria-label={ariaLabel}
                aria-expanded={isOpen}
                onClick={() => setIsOpen((open) => !open)}
            >
                <Bell size={19} />
                {unreadCount > 0 && (
                    <span className="absolute -right-2 -top-2 grid min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-5 text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <section className="absolute right-0 z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                        <div>
                            <h2 className="font-bold text-slate-900">Notifications</h2>
                            <p className="text-xs text-slate-500">{unreadCount} unread</p>
                        </div>
                        <button
                            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 disabled:opacity-50"
                            type="button"
                            disabled={unreadCount === 0 || markAllMutation.isPending}
                            onClick={() => markAllMutation.mutate()}
                        >
                            <CheckCheck size={16} />
                            Mark all read
                        </button>
                    </header>
                    <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                        {notificationsQuery.isLoading && <p className="p-4 text-sm text-slate-600">Loading notifications...</p>}
                        {notificationsQuery.error && (
                            <p className="m-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">Unable to load notifications.</p>
                        )}
                        {!notificationsQuery.isLoading &&
                            !notificationsQuery.error &&
                            (notificationsQuery.data?.data.length ?? 0) === 0 && (
                                <p className="p-4 text-sm text-slate-600">You are all caught up.</p>
                            )}
                        {notificationsQuery.data?.data.map((notification) => (
                            <NotificationItem key={notification.id} notification={notification} onRead={markRead} isClient={isClient} />
                        ))}
                    </div>
                    <Link
                        className="block border-t border-slate-200 px-4 py-3 text-center text-sm font-semibold text-blue-700 hover:bg-blue-50"
                        to={isClient ? '/client/notifications' : '/admin/notifications'}
                        onClick={() => setIsOpen(false)}
                    >
                        View all notifications
                    </Link>
                </section>
            )}
        </div>
    );
}

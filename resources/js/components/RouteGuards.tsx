import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

interface ChildrenProps {
    children: ReactNode;
}

export function LoadingScreen() {
    return (
        <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground" role="status">
            <div className="flex flex-col items-center text-center">
                <span
                    className="grid size-11 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground shadow-sm"
                    aria-hidden="true"
                >
                    U
                </span>
                <span className="mt-4 text-sm font-semibold">Loading UltraPC Desk...</span>
                <span className="mt-3 h-1 w-32 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-full w-1/2 animate-pulse rounded-full bg-primary" />
                </span>
            </div>
        </main>
    );
}

export function ProtectedRoute({ children }: ChildrenProps) {
    const { isAuthenticated, isInitializing } = useAuth();
    if (isInitializing) return <LoadingScreen />;

    return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export function GuestRoute({ children }: ChildrenProps) {
    const { isAuthenticated, isInitializing } = useAuth();
    if (isInitializing) return <LoadingScreen />;

    return isAuthenticated ? <Navigate to="/" replace /> : children;
}

export function PermissionRoute({ permission, children }: ChildrenProps & { permission: string }) {
    const { can, isLoading } = usePermissions();
    if (isLoading) return <LoadingScreen />;

    return can(permission) ? children : <Navigate to="/unauthorized" replace />;
}

export function ClientRoute({ children }: ChildrenProps) {
    const { user, isInitializing } = useAuth();
    if (isInitializing) return <LoadingScreen />;

    const isClientOnly =
        user?.roles.includes('client') && !user.roles.some((role) => ['super_admin', 'admin', 'sav_agent', 'technician'].includes(role));

    return isClientOnly ? children : <Navigate to="/unauthorized" replace />;
}

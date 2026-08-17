import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

interface ChildrenProps {
    children: ReactNode;
}

export function LoadingScreen() {
    return (
        <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600" role="status">
            Loading UltraPC Desk...
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

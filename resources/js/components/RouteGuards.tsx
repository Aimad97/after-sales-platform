import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { BrandLoader } from '@/components/BrandLogo';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

interface ChildrenProps {
    children: ReactNode;
}

export function LoadingScreen() {
    return (
        <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-6 text-foreground">
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-primary/10 to-transparent"
                aria-hidden="true"
            />
            <BrandLoader className="relative" />
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

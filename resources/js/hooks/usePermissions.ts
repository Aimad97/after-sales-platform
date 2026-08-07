import { type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function usePermissions() {
    const { user, isInitializing } = useAuth();
    const permissions = new Set(user?.permissions ?? []);

    return {
        can: (permission: string): boolean => permissions.has(permission),
        canAny: (requiredPermissions: string[]): boolean => requiredPermissions.some((permission) => permissions.has(permission)),
        roles: user?.roles ?? [],
        isLoading: isInitializing,
    };
}

interface CanProps {
    permission: string;
    children: ReactNode;
    fallback?: ReactNode;
}

export function Can({ permission, children, fallback = null }: CanProps): ReactNode {
    const { can } = usePermissions();

    return can(permission) ? children : fallback;
}

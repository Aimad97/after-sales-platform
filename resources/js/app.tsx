import './bootstrap';
import '../css/app.css';

import { lazy, StrictMode, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    BarChart3,
    Bell,
    ContactRound,
    FileQuestion,
    FolderTree,
    HardHat,
    LayoutDashboard,
    Package,
    ReceiptText,
    ScrollText,
    ShieldCheck,
    Tags,
    Ticket,
    UserRound,
    Users,
    Wrench,
} from 'lucide-react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AppShell, type AppShellNavigationItem } from '@/components/AppShell';
import { ClientRoute, GuestRoute, LoadingScreen, PermissionRoute, ProtectedRoute } from '@/components/RouteGuards';
import { ThemeProvider } from '@/components/ThemeProvider';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useRealtime } from '@/hooks/useRealtime';

const LoginPage = lazy(() => import('@/features/auth/AuthPages').then((module) => ({ default: module.LoginPage })));
const ForgotPasswordPage = lazy(() => import('@/features/auth/AuthPages').then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/features/auth/AuthPages').then((module) => ({ default: module.ResetPasswordPage })));
const CategoriesPage = lazy(() => import('@/features/catalog/CatalogEntityPages').then((module) => ({ default: module.CategoriesPage })));
const BrandsPage = lazy(() => import('@/features/catalog/CatalogEntityPages').then((module) => ({ default: module.BrandsPage })));
const ProductsPage = lazy(() => import('@/features/catalog/ProductPages').then((module) => ({ default: module.ProductsPage })));
const ProductFormPage = lazy(() => import('@/features/catalog/ProductPages').then((module) => ({ default: module.ProductFormPage })));
const ProductDetailsPage = lazy(() => import('@/features/catalog/ProductPages').then((module) => ({ default: module.ProductDetailsPage })));
const ClientsPage = lazy(() => import('@/features/clients/ClientPages').then((module) => ({ default: module.ClientsPage })));
const ClientFormPage = lazy(() => import('@/features/clients/ClientPages').then((module) => ({ default: module.ClientFormPage })));
const ClientDetailsPage = lazy(() => import('@/features/clients/ClientPages').then((module) => ({ default: module.ClientDetailsPage })));
const InvoicesPage = lazy(() => import('@/features/invoices/InvoicePages').then((module) => ({ default: module.InvoicesPage })));
const InvoiceFormPage = lazy(() => import('@/features/invoices/InvoicePages').then((module) => ({ default: module.InvoiceFormPage })));
const InvoiceDetailsPage = lazy(() =>
    import('@/features/invoices/InvoicePages').then((module) => ({ default: module.InvoiceDetailsPage })),
);
const WarrantiesPage = lazy(() => import('@/features/warranties/WarrantyPages').then((module) => ({ default: module.WarrantiesPage })));
const WarrantyDetailsPage = lazy(() =>
    import('@/features/warranties/WarrantyPages').then((module) => ({ default: module.WarrantyDetailsPage })),
);
const UsersPage = lazy(() => import('@/features/users/UsersPages').then((module) => ({ default: module.UsersPage })));
const UserFormPage = lazy(() => import('@/features/users/UsersPages').then((module) => ({ default: module.UserFormPage })));
const UserDetailsPage = lazy(() => import('@/features/users/UsersPages').then((module) => ({ default: module.UserDetailsPage })));
const TechniciansPage = lazy(() =>
    import('@/features/technicians/TechnicianPages').then((module) => ({ default: module.TechniciansPage })),
);
const TechnicianFormPage = lazy(() =>
    import('@/features/technicians/TechnicianPages').then((module) => ({ default: module.TechnicianFormPage })),
);
const TechnicianDetailsPage = lazy(() =>
    import('@/features/technicians/TechnicianPages').then((module) => ({ default: module.TechnicianDetailsPage })),
);
const TicketsPage = lazy(() => import('@/features/tickets/TicketPages').then((module) => ({ default: module.TicketsPage })));
const TicketFormPage = lazy(() => import('@/features/tickets/TicketPages').then((module) => ({ default: module.TicketFormPage })));
const TicketDetailsPage = lazy(() => import('@/features/tickets/TicketPages').then((module) => ({ default: module.TicketDetailsPage })));
const RepairsPage = lazy(() => import('@/features/repairs/RepairPages').then((module) => ({ default: module.RepairsPage })));
const RepairDetailsPage = lazy(() => import('@/features/repairs/RepairPages').then((module) => ({ default: module.RepairDetailsPage })));
const AuditLogsPage = lazy(() => import('@/features/audit-logs/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })));
const NotificationsPage = lazy(() =>
    import('@/features/notifications/NotificationPages').then((module) => ({ default: module.NotificationsPage })),
);
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPages').then((module) => ({ default: module.DashboardPage })));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const UnauthorizedPage = lazy(() => import('@/pages/UnauthorizedPage').then((module) => ({ default: module.UnauthorizedPage })));
const ClientOverviewPage = lazy(() =>
    import('@/features/client-portal/ClientPortalPages').then((module) => ({ default: module.ClientOverviewPage })),
);
const ClientProfilePage = lazy(() =>
    import('@/features/client-portal/ClientPortalPages').then((module) => ({ default: module.ClientProfilePage })),
);
const ClientProductsPage = lazy(() =>
    import('@/features/client-portal/ClientPortalPages').then((module) => ({ default: module.ClientProductsPage })),
);
const ClientProductDetailsPage = lazy(() =>
    import('@/features/client-portal/ClientPortalPages').then((module) => ({ default: module.ClientProductDetailsPage })),
);
const ClientTicketsPage = lazy(() =>
    import('@/features/client-portal/ClientPortalPages').then((module) => ({ default: module.ClientTicketsPage })),
);
const ClientTicketFormPage = lazy(() =>
    import('@/features/client-portal/ClientPortalPages').then((module) => ({ default: module.ClientTicketFormPage })),
);
const ClientTicketDetailsPage = lazy(() =>
    import('@/features/client-portal/ClientPortalPages').then((module) => ({ default: module.ClientTicketDetailsPage })),
);

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
        mutations: { retry: 0 },
    },
});

interface PermissionNavigationItem extends AppShellNavigationItem {
    permission: string;
}

const adminNavigationItems: readonly PermissionNavigationItem[] = [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true, group: 'Workspace', permission: 'dashboard.view' },
    { label: 'Tickets', to: '/admin/tickets', icon: Ticket, group: 'Workspace', permission: 'tickets.view' },
    { label: 'Clients', to: '/admin/clients', icon: ContactRound, group: 'Workspace', permission: 'clients.view' },
    { label: 'Products', to: '/admin/products', icon: Package, group: 'Workspace', permission: 'products.view' },
    { label: 'Warranties', to: '/admin/warranties', icon: ShieldCheck, group: 'Workspace', permission: 'warranties.view' },
    { label: 'Invoices', to: '/admin/invoices', icon: ReceiptText, group: 'Workspace', permission: 'invoices.view' },
    { label: 'Repairs', to: '/admin/repairs', icon: Wrench, group: 'Operations', permission: 'repairs.view' },
    { label: 'Technicians', to: '/admin/technicians', icon: HardHat, group: 'Operations', permission: 'users.view' },
    { label: 'Reports', to: '/admin/reports', icon: BarChart3, group: 'Insights', permission: 'reports.view' },
    { label: 'Users', to: '/admin/users', icon: Users, group: 'Administration', permission: 'users.view' },
    { label: 'Categories', to: '/admin/categories', icon: FolderTree, group: 'Administration', permission: 'products.view' },
    { label: 'Brands', to: '/admin/brands', icon: Tags, group: 'Administration', permission: 'products.view' },
    { label: 'Audit logs', to: '/admin/audit-logs', icon: ScrollText, group: 'Administration', permission: 'audit_logs.view' },
];

const clientNavigationItems: readonly AppShellNavigationItem[] = [
    { label: 'Overview', to: '/client', icon: LayoutDashboard, end: true },
    { label: 'My profile', to: '/client/profile', icon: UserRound },
    { label: 'Products & warranties', to: '/client/products', icon: Package },
    { label: 'SAV requests', to: '/client/tickets', icon: Ticket },
    { label: 'Notifications', to: '/client/notifications', icon: Bell },
];

function AdminLayout() {
    const { user, logout } = useAuth();
    const { can } = usePermissions();
    const visibleNavigationItems = adminNavigationItems.filter((item) => can(item.permission));

    return (
        <AppShell
            variant="admin"
            userName={[user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Team member'}
            userEmail={user?.email}
            navigationItems={visibleNavigationItems}
            isSigningOut={logout.isPending}
            onSignOut={() => logout.mutate()}
        />
    );
}

function ClientLayout() {
    const { user, logout } = useAuth();

    return (
        <AppShell
            variant="client"
            userName={[user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Client'}
            userEmail={user?.email}
            navigationItems={clientNavigationItems}
            isSigningOut={logout.isPending}
            onSignOut={() => logout.mutate()}
        />
    );
}

function WorkspaceRedirect() {
    const { user, isInitializing } = useAuth();
    if (isInitializing) return <LoadingScreen />;
    return <Navigate to={user?.roles.includes('client') ? '/client' : '/admin'} replace />;
}

function NotFoundPage() {
    return (
        <main className="grid min-h-screen place-items-center bg-background p-6 text-center text-foreground">
            <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
                <span className="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground" aria-hidden="true">
                    <FileQuestion />
                </span>
                <p className="mt-5 text-sm font-bold uppercase tracking-widest text-primary">Error 404</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">Page not found</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">The page may have moved, or you may not have a valid link.</p>
                <Link
                    className="mt-6 inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-sm transition-[filter] hover:brightness-95"
                    to="/"
                >
                    Go home
                </Link>
            </section>
        </main>
    );
}

function AuthFailureHandler() {
    const navigate = useNavigate();
    useEffect(() => {
        const handleUnauthorized = () => {
            queryClient.setQueryData(['auth', 'user'], null);
            navigate('/login');
        };

        window.addEventListener('auth:unauthenticated', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthenticated', handleUnauthorized);
    }, [navigate]);

    return null;
}

function RealtimeSync() {
    useRealtime();

    return null;
}

function App() {
    return (
        <BrowserRouter>
            <AuthFailureHandler />
            <RealtimeSync />
            <Routes>
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <WorkspaceRedirect />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/login"
                    element={
                        <GuestRoute>
                            <LoginPage />
                        </GuestRoute>
                    }
                />
                <Route
                    path="/forgot-password"
                    element={
                        <GuestRoute>
                            <ForgotPasswordPage />
                        </GuestRoute>
                    }
                />
                <Route
                    path="/reset-password"
                    element={
                        <GuestRoute>
                            <ResetPasswordPage />
                        </GuestRoute>
                    }
                />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                <Route
                    path="/admin"
                    element={
                        <ProtectedRoute>
                            <PermissionRoute permission="dashboard.view">
                                <AdminLayout />
                            </PermissionRoute>
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<DashboardPage />} />
                    <Route
                        path="users"
                        element={
                            <PermissionRoute permission="users.view">
                                <UsersPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="users/new"
                        element={
                            <PermissionRoute permission="users.create">
                                <UserFormPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="users/:uuid"
                        element={
                            <PermissionRoute permission="users.view">
                                <UserDetailsPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="users/:uuid/edit"
                        element={
                            <PermissionRoute permission="users.update">
                                <UserFormPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="technicians"
                        element={
                            <PermissionRoute permission="users.view">
                                <TechniciansPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="technicians/new"
                        element={
                            <PermissionRoute permission="users.create">
                                <TechnicianFormPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="technicians/:id"
                        element={
                            <PermissionRoute permission="users.view">
                                <TechnicianDetailsPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="technicians/:id/edit"
                        element={
                            <PermissionRoute permission="users.update">
                                <TechnicianFormPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="clients"
                        element={
                            <PermissionRoute permission="clients.view">
                                <ClientsPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="clients/new"
                        element={
                            <PermissionRoute permission="clients.create">
                                <ClientFormPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="clients/:uuid"
                        element={
                            <PermissionRoute permission="clients.view">
                                <ClientDetailsPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="clients/:uuid/edit"
                        element={
                            <PermissionRoute permission="clients.update">
                                <ClientFormPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="invoices"
                        element={
                            <PermissionRoute permission="invoices.view">
                                <InvoicesPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="invoices/new"
                        element={
                            <PermissionRoute permission="invoices.create">
                                <InvoiceFormPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="invoices/:id"
                        element={
                            <PermissionRoute permission="invoices.view">
                                <InvoiceDetailsPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="invoices/:id/edit"
                        element={
                            <PermissionRoute permission="invoices.update">
                                <InvoiceFormPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="warranties"
                        element={
                            <PermissionRoute permission="warranties.view">
                                <WarrantiesPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="warranties/:uuid"
                        element={
                            <PermissionRoute permission="warranties.view">
                                <WarrantyDetailsPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="tickets"
                        element={
                            <PermissionRoute permission="tickets.view">
                                <TicketsPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="tickets/new"
                        element={
                            <PermissionRoute permission="tickets.create">
                                <TicketFormPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="tickets/:uuid"
                        element={
                            <PermissionRoute permission="tickets.view">
                                <TicketDetailsPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="repairs"
                        element={
                            <PermissionRoute permission="repairs.view">
                                <RepairsPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="repairs/:id"
                        element={
                            <PermissionRoute permission="repairs.view">
                                <RepairDetailsPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="reports"
                        element={
                            <PermissionRoute permission="reports.view">
                                <ReportsPage />
                            </PermissionRoute>
                        }
                    />
                    <Route path="notifications" element={<NotificationsPage />} />
                    <Route
                        path="audit-logs"
                        element={
                            <PermissionRoute permission="audit_logs.view">
                                <AuditLogsPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="products"
                        element={
                            <PermissionRoute permission="products.view">
                                <ProductsPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="products/new"
                        element={
                            <PermissionRoute permission="products.create">
                                <ProductFormPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="products/:uuid"
                        element={
                            <PermissionRoute permission="products.view">
                                <ProductDetailsPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="products/:uuid/edit"
                        element={
                            <PermissionRoute permission="products.update">
                                <ProductFormPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="categories"
                        element={
                            <PermissionRoute permission="products.view">
                                <CategoriesPage />
                            </PermissionRoute>
                        }
                    />
                    <Route
                        path="brands"
                        element={
                            <PermissionRoute permission="products.view">
                                <BrandsPage />
                            </PermissionRoute>
                        }
                    />
                </Route>
                <Route
                    path="/client"
                    element={
                        <ProtectedRoute>
                            <ClientRoute>
                                <ClientLayout />
                            </ClientRoute>
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<ClientOverviewPage />} />
                    <Route path="profile" element={<ClientProfilePage />} />
                    <Route path="products" element={<ClientProductsPage />} />
                    <Route path="products/:uuid" element={<ClientProductDetailsPage />} />
                    <Route path="tickets" element={<ClientTicketsPage />} />
                    <Route path="tickets/new" element={<ClientTicketFormPage />} />
                    <Route path="tickets/:uuid" element={<ClientTicketDetailsPage />} />
                    <Route path="notifications" element={<NotificationsPage />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </BrowserRouter>
    );
}

const root = document.getElementById('app');
if (!root) throw new Error('Application root element was not found.');
createRoot(root).render(
    <StrictMode>
        <ThemeProvider>
            <QueryClientProvider client={queryClient}>
                <Suspense fallback={<LoadingScreen />}>
                    <App />
                </Suspense>
            </QueryClientProvider>
        </ThemeProvider>
    </StrictMode>,
);

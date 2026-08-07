import './bootstrap';
import '../css/app.css';

import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage } from '@/features/auth/AuthPages';
import { UserDetailsPage, UserFormPage, UsersPage } from '@/features/users/UsersPages';
import { TechnicianDetailsPage, TechnicianFormPage, TechniciansPage } from '@/features/technicians/TechnicianPages';
import { useAuth } from '@/hooks/useAuth';
import { Can, usePermissions } from '@/hooks/usePermissions';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
        mutations: { retry: 0 },
    },
});

function LoadingScreen() {
    return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600">Loading ServiceDesk...</main>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isInitializing } = useAuth();
    if (isInitializing) return <LoadingScreen />;
    return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isInitializing } = useAuth();
    if (isInitializing) return <LoadingScreen />;
    return isAuthenticated ? <Navigate to="/" replace /> : children;
}

function PermissionRoute({ permission, children }: { permission: string; children: React.ReactNode }) {
    const { can, isLoading } = usePermissions();
    if (isLoading) return <LoadingScreen />;
    return can(permission) ? children : <Navigate to="/unauthorized" replace />;
}

function AdminLayout() {
    const { user, logout } = useAuth();
    const navigationClass = ({ isActive }: { isActive: boolean }) => `rounded-md px-3 py-2 font-medium ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;

    return (
        <main className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-6">
            <section className="mx-auto max-w-7xl">
                <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div><p className="text-sm font-semibold text-blue-600">ServiceDesk</p><h1 className="mt-1 text-2xl font-bold">Welcome, {user?.first_name}</h1></div>
                        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50" onClick={() => logout.mutate()}>Sign out</button>
                    </div>
                    <nav className="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Workspace navigation">
                        <Can permission="dashboard.view"><NavLink className={navigationClass} to="/admin" end>Dashboard</NavLink></Can>
                        <Can permission="users.view"><NavLink className={navigationClass} to="/admin/users">Users</NavLink></Can>
                        <Can permission="users.view"><NavLink className={navigationClass} to="/admin/technicians">Technicians</NavLink></Can>
                        <Can permission="tickets.view"><span className="rounded-md px-3 py-2 text-slate-400">Tickets (coming soon)</span></Can>
                    </nav>
                </header>
                <div className="mt-6"><Outlet /></div>
            </section>
        </main>
    );
}

function ClientLayout() {
    const { user, logout } = useAuth();
    return <main className="min-h-screen bg-slate-50 p-6 text-slate-900"><section className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-blue-600">ServiceDesk</p><h1 className="mt-1 text-2xl font-bold">Hello, {user?.first_name}</h1></div><button className="rounded-md border px-4 py-2 text-sm font-medium" onClick={() => logout.mutate()}>Sign out</button></div><nav className="mt-6 flex gap-3 text-sm" aria-label="Client navigation"><Can permission="tickets.view"><span className="rounded-md bg-blue-50 px-3 py-2 font-medium text-blue-700">My tickets</span></Can><Can permission="warranties.view"><span className="rounded-md px-3 py-2 text-slate-600">My warranties</span></Can></nav><p className="mt-5 text-slate-600">Your support requests and warranty information will appear here as the SAV modules are added.</p></section></main>;
}

function DashboardPage() {
    return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-2xl font-bold">Operations dashboard</h2><p className="mt-2 text-slate-600">User and technician management are ready. SAV operational dashboards will be added in a later stage.</p></section>;
}

function WorkspaceRedirect() {
    const { user, isInitializing } = useAuth();
    if (isInitializing) return <LoadingScreen />;
    return <Navigate to={user?.roles.includes('client') ? '/client' : '/admin'} replace />;
}

function NotFoundPage() {
    return <main className="grid min-h-screen place-items-center p-6 text-center"><section><p className="text-sm font-semibold text-blue-600">404</p><h1 className="mt-2 text-3xl font-bold">Page not found</h1><Link className="mt-5 inline-block rounded-md bg-blue-600 px-4 py-2 font-medium text-white" to="/">Go home</Link></section></main>;
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

function App() {
    return (
        <BrowserRouter>
            <AuthFailureHandler />
            <Routes>
                <Route path="/" element={<ProtectedRoute><WorkspaceRedirect /></ProtectedRoute>} />
                <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
                <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
                <Route path="/reset-password" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                <Route path="/admin" element={<ProtectedRoute><PermissionRoute permission="dashboard.view"><AdminLayout /></PermissionRoute></ProtectedRoute>}>
                    <Route index element={<DashboardPage />} />
                    <Route path="users" element={<PermissionRoute permission="users.view"><UsersPage /></PermissionRoute>} />
                    <Route path="users/new" element={<PermissionRoute permission="users.create"><UserFormPage /></PermissionRoute>} />
                    <Route path="users/:uuid" element={<PermissionRoute permission="users.view"><UserDetailsPage /></PermissionRoute>} />
                    <Route path="users/:uuid/edit" element={<PermissionRoute permission="users.update"><UserFormPage /></PermissionRoute>} />
                    <Route path="technicians" element={<PermissionRoute permission="users.view"><TechniciansPage /></PermissionRoute>} />
                    <Route path="technicians/new" element={<PermissionRoute permission="users.create"><TechnicianFormPage /></PermissionRoute>} />
                    <Route path="technicians/:id" element={<PermissionRoute permission="users.view"><TechnicianDetailsPage /></PermissionRoute>} />
                    <Route path="technicians/:id/edit" element={<PermissionRoute permission="users.update"><TechnicianFormPage /></PermissionRoute>} />
                </Route>
                <Route path="/client" element={<ProtectedRoute><PermissionRoute permission="tickets.view"><ClientLayout /></PermissionRoute></ProtectedRoute>} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </BrowserRouter>
    );
}

const root = document.getElementById('app');
if (!root) throw new Error('Application root element was not found.');
createRoot(root).render(<StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></StrictMode>);

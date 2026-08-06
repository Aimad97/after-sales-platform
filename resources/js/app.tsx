import './bootstrap';
import '../css/app.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 }, mutations: { retry: 0 } },
});

function FoundationPage({ audience }: { audience: 'Operations' | 'Client' }) {
    return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-blue-600">{audience}</p><h1 className="mt-2 text-2xl font-bold">ServiceDesk foundation is ready</h1><p className="mt-3 text-slate-600">Authentication and SAV business workflows will be added in the next stages.</p></section>;
}

function AdminLayout() {
    return <div className="min-h-screen bg-slate-50 text-slate-900 lg:grid lg:grid-cols-[16rem_1fr]"><aside className="border-b bg-white p-5 lg:min-h-screen lg:border-r"><p className="text-lg font-bold">ServiceDesk</p><p className="mt-1 text-sm text-slate-500">SAV operations</p><nav className="mt-8 flex gap-2 lg:flex-col" aria-label="Main navigation"><NavLink className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white" to="/admin">Dashboard</NavLink><span className="rounded-md px-3 py-2 text-sm text-slate-400">Tickets · coming soon</span></nav></aside><main className="p-4 sm:p-6"><FoundationPage audience="Operations" /></main></div>;
}

function ClientLayout() {
    return <div className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b bg-white px-6 py-4"><NavLink className="text-lg font-bold" to="/client">ServiceDesk</NavLink></header><main className="mx-auto max-w-6xl p-4 sm:p-6"><FoundationPage audience="Client" /></main></div>;
}

function NotFoundPage() {
    return <main className="grid min-h-screen place-items-center p-6 text-center"><section><p className="text-sm font-semibold text-blue-600">404</p><h1 className="mt-2 text-3xl font-bold">Page not found</h1><Link className="mt-5 inline-block rounded-md bg-blue-600 px-4 py-2 font-medium text-white" to="/admin">Go to dashboard</Link></section></main>;
}

function App() {
    return <BrowserRouter><Routes><Route path="/" element={<Navigate to="/admin" replace />} /><Route path="/admin" element={<AdminLayout />} /><Route path="/client" element={<ClientLayout />} /><Route path="*" element={<NotFoundPage />} /></Routes></BrowserRouter>;
}

const root = document.getElementById('app');
if (!root) throw new Error('Application root element was not found.');
createRoot(root).render(<StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></StrictMode>);

import { Link } from 'react-router-dom';

export function UnauthorizedPage() {
    return (
        <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center">
            <section>
                <p className="text-sm font-semibold text-red-600">403</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">Access denied</h1>
                <p className="mt-2 text-slate-600">You do not have permission to access this area.</p>
                <Link className="mt-5 inline-block rounded-md bg-blue-600 px-4 py-2 font-medium text-white" to="/">Return to workspace</Link>
            </section>
        </main>
    );
}

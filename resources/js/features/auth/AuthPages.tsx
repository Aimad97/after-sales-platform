import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { apiClient } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';

const password = z.string().min(12, 'Use at least 12 characters.').regex(/[a-z]/, 'Include a lowercase letter.').regex(/[A-Z]/, 'Include an uppercase letter.').regex(/\d/, 'Include a number.').regex(/[^A-Za-z0-9]/, 'Include a symbol.');
const loginSchema = z.object({ email: z.string().email('Enter a valid email address.'), password: z.string().min(1, 'Password is required.'), remember: z.boolean() });
const forgotSchema = z.object({ email: z.string().email('Enter a valid email address.') });
const resetSchema = z.object({ email: z.string().email(), token: z.string().min(1), password, password_confirmation: z.string() }).refine((data) => data.password === data.password_confirmation, { path: ['password_confirmation'], message: 'Passwords do not match.' });

function Card({ children }: { children: React.ReactNode }) { return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{children}</section></main>; }
function FieldError({ message }: { message?: string }) { return message ? <p className="mt-1 text-sm text-red-600">{message}</p> : null; }
function ErrorMessage({ error }: { error: unknown }) { return error instanceof Error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</p> : null; }

export function LoginPage() {
    const navigate = useNavigate(); const { login } = useAuth();
    const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '', remember: false } });
    return <Card><p className="text-sm font-semibold text-blue-600">ServiceDesk</p><h1 className="mt-2 text-2xl font-bold">Sign in</h1><p className="mt-2 text-sm text-slate-600">Manage your after-sales service operations.</p><form className="mt-6 space-y-4" onSubmit={form.handleSubmit((data) => login.mutate(data, { onSuccess: () => navigate('/') }))}><label className="block text-sm font-medium">Email<input className="mt-1 w-full rounded-md border p-2" type="email" autoComplete="email" {...form.register('email')} /></label><FieldError message={form.formState.errors.email?.message} /><label className="block text-sm font-medium">Password<input className="mt-1 w-full rounded-md border p-2" type="password" autoComplete="current-password" {...form.register('password')} /></label><FieldError message={form.formState.errors.password?.message} /><label className="flex gap-2 text-sm"><input type="checkbox" {...form.register('remember')} /> Remember me</label><ErrorMessage error={login.error} /><button className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50" disabled={login.isPending}>{login.isPending ? 'Signing in…' : 'Sign in'}</button></form><Link className="mt-5 block text-sm text-blue-600" to="/forgot-password">Forgot password?</Link></Card>;
}

export function ForgotPasswordPage() {
    const form = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });
    const request = useMutation({ mutationFn: (data: z.infer<typeof forgotSchema>) => apiClient.post('/auth/forgot-password', data) });
    return <Card><h1 className="text-2xl font-bold">Reset your password</h1><p className="mt-2 text-sm text-slate-600">We’ll send a reset link if the account exists.</p>{request.isSuccess ? <p className="mt-5 rounded-md bg-green-50 p-3 text-sm text-green-700">Check your email for a reset link.</p> : <form className="mt-6 space-y-4" onSubmit={form.handleSubmit((data) => request.mutate(data))}><label className="block text-sm font-medium">Email<input className="mt-1 w-full rounded-md border p-2" type="email" autoComplete="email" {...form.register('email')} /></label><FieldError message={form.formState.errors.email?.message} /><ErrorMessage error={request.error} /><button className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white" disabled={request.isPending}>Send reset link</button></form>}<Link className="mt-5 block text-sm text-blue-600" to="/login">Back to sign in</Link></Card>;
}

export function ResetPasswordPage() {
    const navigate = useNavigate(); const [params] = useSearchParams();
    const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { email: params.get('email') ?? '', token: params.get('token') ?? '', password: '', password_confirmation: '' } });
    const reset = useMutation({ mutationFn: (data: z.infer<typeof resetSchema>) => apiClient.post('/auth/reset-password', data), onSuccess: () => navigate('/login') });
    return <Card><h1 className="text-2xl font-bold">Choose a new password</h1><form className="mt-6 space-y-4" onSubmit={form.handleSubmit((data) => reset.mutate(data))}><input type="hidden" {...form.register('token')} /><label className="block text-sm font-medium">Email<input className="mt-1 w-full rounded-md border p-2" type="email" {...form.register('email')} /></label><FieldError message={form.formState.errors.email?.message} /><label className="block text-sm font-medium">New password<input className="mt-1 w-full rounded-md border p-2" type="password" autoComplete="new-password" {...form.register('password')} /></label><FieldError message={form.formState.errors.password?.message} /><label className="block text-sm font-medium">Confirm password<input className="mt-1 w-full rounded-md border p-2" type="password" autoComplete="new-password" {...form.register('password_confirmation')} /></label><FieldError message={form.formState.errors.password_confirmation?.message} /><ErrorMessage error={reset.error} /><button className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white" disabled={reset.isPending}>Reset password</button></form></Card>;
}

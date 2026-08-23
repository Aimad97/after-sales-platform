import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { apiClient } from '@/api/client';
import { ApiErrorAlert as ErrorMessage } from '@/components/ApiErrorAlert';
import { BrandLogo } from '@/components/BrandLogo';
import { FormField } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';

const password = z
    .string()
    .min(12, 'Use at least 12 characters.')
    .regex(/[a-z]/, 'Include a lowercase letter.')
    .regex(/[A-Z]/, 'Include an uppercase letter.')
    .regex(/\d/, 'Include a number.')
    .regex(/[^A-Za-z0-9]/, 'Include a symbol.');
const loginSchema = z.object({
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(1, 'Password is required.'),
    remember: z.boolean(),
});
const forgotSchema = z.object({ email: z.string().email('Enter a valid email address.') });
const resetSchema = z
    .object({ email: z.string().email(), token: z.string().min(1), password, password_confirmation: z.string() })
    .refine((data) => data.password === data.password_confirmation, {
        path: ['password_confirmation'],
        message: 'Passwords do not match.',
    });

function AuthCard({ children }: { children: ReactNode }) {
    return (
        <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-10 sm:px-6">
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 to-transparent"
                aria-hidden="true"
            />
            <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
                <ThemeToggle />
            </div>
            <div className="relative w-full max-w-md">
                <Card className="overflow-hidden shadow-xl shadow-slate-950/5 dark:shadow-black/20">
                    <CardHeader className="border-b border-border bg-muted/35 pb-5">
                        <div>
                            <BrandLogo frameClassName="w-full max-w-[15rem]" />
                            <p className="mt-2 text-xs text-muted-foreground">UltraPC Care - After-sales service desk</p>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">{children}</CardContent>
                </Card>
                <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
                    Secure access to your service and warranty workspace.
                </p>
            </div>
        </main>
    );
}

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    toggleLabel: string;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(({ className, toggleLabel, id, ...props }, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const action = isVisible ? 'Hide' : 'Show';

    return (
        <div className="relative">
            <Input ref={ref} id={id} className={cn('pr-11', className)} type={isVisible ? 'text' : 'password'} {...props} />
            <Button
                className="absolute right-1 top-1/2 size-8 min-h-8 -translate-y-1/2 text-muted-foreground"
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${action} ${toggleLabel}`}
                aria-controls={id}
                aria-pressed={isVisible}
                title={`${action} ${toggleLabel}`}
                onClick={() => setIsVisible((visible) => !visible)}
            >
                {isVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
        </div>
    );
});
PasswordInput.displayName = 'PasswordInput';

export function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '', remember: false },
    });

    return (
        <AuthCard>
            <PageHeader title="Sign in" description="Manage your after-sales service operations." />
            <form
                className="mt-6 space-y-5"
                noValidate
                aria-busy={login.isPending}
                onSubmit={form.handleSubmit((data) => login.mutate(data, { onSuccess: () => navigate('/') }))}
            >
                <FormField label="Email" error={form.formState.errors.email?.message} required>
                    <Input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        {...form.register('email')}
                    />
                </FormField>
                <FormField label="Password" error={form.formState.errors.password?.message} required>
                    <PasswordInput
                        id="login-password"
                        toggleLabel="password"
                        aria-label="Password"
                        autoComplete="current-password"
                        required
                        {...form.register('password')}
                    />
                </FormField>
                <label className="flex w-fit items-center gap-2.5 text-sm font-medium text-foreground">
                    <input
                        className="size-4 rounded border-input accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                        type="checkbox"
                        {...form.register('remember')}
                    />
                    Remember me
                </label>
                <ErrorMessage error={login.error} />
                <Button className="w-full" type="submit" size="lg" disabled={login.isPending}>
                    {login.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                    {login.isPending ? 'Signing in...' : 'Sign in'}
                </Button>
            </form>
            <Link className={cn(buttonVariants({ variant: 'link' }), 'mt-3 px-0')} to="/forgot-password">
                Forgot password?
            </Link>
        </AuthCard>
    );
}

export function ForgotPasswordPage() {
    const form = useForm<z.infer<typeof forgotSchema>>({
        resolver: zodResolver(forgotSchema),
        defaultValues: { email: '' },
    });
    const request = useMutation({ mutationFn: (data: z.infer<typeof forgotSchema>) => apiClient.post('/auth/forgot-password', data) });

    return (
        <AuthCard>
            <PageHeader title="Reset your password" description="We'll send a reset link if the account exists." />
            {request.isSuccess ? (
                <Alert className="mt-6 border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40" role="status">
                    <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                        Check your email for a reset link.
                    </AlertDescription>
                </Alert>
            ) : (
                <form
                    className="mt-6 space-y-5"
                    noValidate
                    aria-busy={request.isPending}
                    onSubmit={form.handleSubmit((data) => request.mutate(data))}
                >
                    <FormField label="Email" error={form.formState.errors.email?.message} required>
                        <Input
                            id="forgot-email"
                            type="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            required
                            {...form.register('email')}
                        />
                    </FormField>
                    <ErrorMessage error={request.error} />
                    <Button className="w-full" type="submit" size="lg" disabled={request.isPending}>
                        {request.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                        {request.isPending ? 'Sending reset link...' : 'Send reset link'}
                    </Button>
                </form>
            )}
            <Link className={cn(buttonVariants({ variant: 'link' }), 'mt-3 gap-1 px-0')} to="/login">
                <ArrowLeft aria-hidden="true" />
                Back to sign in
            </Link>
        </AuthCard>
    );
}

export function ResetPasswordPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const form = useForm<z.infer<typeof resetSchema>>({
        resolver: zodResolver(resetSchema),
        defaultValues: {
            email: params.get('email') ?? '',
            token: params.get('token') ?? '',
            password: '',
            password_confirmation: '',
        },
    });
    const reset = useMutation({
        mutationFn: (data: z.infer<typeof resetSchema>) => apiClient.post('/auth/reset-password', data),
        onSuccess: () => navigate('/login'),
    });

    return (
        <AuthCard>
            <PageHeader title="Choose a new password" description="Create a strong password that you do not use for another account." />
            <form
                className="mt-6 space-y-5"
                noValidate
                aria-busy={reset.isPending}
                onSubmit={form.handleSubmit((data) => reset.mutate(data))}
            >
                <input type="hidden" {...form.register('token')} />
                <FormField label="Email" error={form.formState.errors.email?.message} required>
                    <Input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        {...form.register('email')}
                    />
                </FormField>
                <FormField
                    label="New password"
                    error={form.formState.errors.password?.message}
                    hint="Use at least 12 characters with uppercase, lowercase, number, and symbol."
                    required
                >
                    <PasswordInput
                        id="reset-password"
                        toggleLabel="new password"
                        aria-label="New password"
                        autoComplete="new-password"
                        required
                        {...form.register('password')}
                    />
                </FormField>
                <FormField label="Confirm password" error={form.formState.errors.password_confirmation?.message} required>
                    <PasswordInput
                        id="reset-password-confirmation"
                        toggleLabel="confirmed password"
                        aria-label="Confirm password"
                        autoComplete="new-password"
                        required
                        {...form.register('password_confirmation')}
                    />
                </FormField>
                <ErrorMessage error={reset.error} />
                <Button className="w-full" type="submit" size="lg" disabled={reset.isPending}>
                    {reset.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                    {reset.isPending ? 'Resetting password...' : 'Reset password'}
                </Button>
            </form>
        </AuthCard>
    );
}

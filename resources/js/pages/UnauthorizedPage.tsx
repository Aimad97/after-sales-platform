import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/utils/cn';

export function UnauthorizedPage() {
    return (
        <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-12 text-center sm:px-6">
            <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
                <ThemeToggle />
            </div>
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-destructive/10 to-transparent"
                aria-hidden="true"
            />
            <Card className="relative w-full max-w-lg shadow-xl shadow-slate-950/5 dark:shadow-black/20">
                <CardContent className="flex flex-col items-center px-6 py-10 sm:px-10 sm:py-12">
                    <span
                        className="grid size-14 place-items-center rounded-2xl bg-rose-100 text-destructive dark:bg-rose-950/60 dark:text-rose-300"
                        aria-hidden="true"
                    >
                        <LockKeyhole size={27} />
                    </span>
                    <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-destructive">Error 403</p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Access denied</h1>
                    <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
                        You do not have permission to access this area. Return to your workspace or contact an administrator if you need
                        access.
                    </p>
                    <Link className={cn(buttonVariants({ size: 'lg' }), 'mt-7 w-full sm:w-auto')} to="/">
                        <ArrowLeft aria-hidden="true" />
                        Return to workspace
                    </Link>
                </CardContent>
            </Card>
        </main>
    );
}

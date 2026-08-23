import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, X } from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Breadcrumbs, type WorkspaceVariant } from '@/components/Breadcrumbs';
import { ApplicationBrand } from '@/components/BrandLogo';
import { GlobalSearchPalette } from '@/components/GlobalSearchPalette';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';

export interface AppShellNavigationItem {
    label: string;
    to: string;
    icon: LucideIcon;
    end?: boolean;
    group?: string;
}

export interface AppShellProps {
    variant: WorkspaceVariant;
    userName: string;
    userEmail?: string | null;
    navigationItems: readonly AppShellNavigationItem[];
    onSignOut: () => void;
    isSigningOut?: boolean;
    breadcrumbLabels?: Readonly<Record<string, string>>;
}

interface NavigationProps {
    items: readonly AppShellNavigationItem[];
    onNavigate?: () => void;
    label: string;
}

const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

function Navigation({ items, onNavigate, label }: NavigationProps) {
    return (
        <nav className="space-y-1" aria-label={label}>
            {items.map((item, index) => {
                const Icon = item.icon;

                const startsGroup = item.group && item.group !== items[index - 1]?.group;

                return (
                    <Fragment key={item.to}>
                        {startsGroup && (
                            <p
                                className={`${index === 0 ? '' : 'pt-4'} px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground`}
                            >
                                {item.group}
                            </p>
                        )}
                        <NavLink
                            className={({ isActive }) =>
                                `group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                                    isActive
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                }`
                            }
                            to={item.to}
                            end={item.end}
                            onClick={onNavigate}
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon className="size-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                                    <span>{item.label}</span>
                                    {isActive && <span className="sr-only"> (current page)</span>}
                                </>
                            )}
                        </NavLink>
                    </Fragment>
                );
            })}
        </nav>
    );
}

export function AppShell({
    variant,
    userName,
    userEmail,
    navigationItems,
    onSignOut,
    isSigningOut = false,
    breadcrumbLabels = {},
}: AppShellProps) {
    const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const drawerRef = useRef<HTMLElement>(null);
    const shouldRestoreMenuFocusRef = useRef(false);

    const closeMobileNavigation = useCallback((restoreMenuFocus = true) => {
        shouldRestoreMenuFocusRef.current = restoreMenuFocus;
        setIsMobileNavigationOpen(false);
    }, []);

    const openMobileNavigation = () => {
        shouldRestoreMenuFocusRef.current = false;
        setIsMobileNavigationOpen(true);
    };

    useEffect(() => {
        if (isMobileNavigationOpen) {
            closeButtonRef.current?.focus();
            return;
        }

        if (shouldRestoreMenuFocusRef.current) {
            shouldRestoreMenuFocusRef.current = false;
            menuButtonRef.current?.focus();
        }
    }, [isMobileNavigationOpen]);

    useEffect(() => {
        if (!isMobileNavigationOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeMobileNavigation();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [closeMobileNavigation, isMobileNavigationOpen]);

    useEffect(() => {
        const desktopMedia = window.matchMedia('(min-width: 1024px)');
        const handleDesktopViewport = (event: MediaQueryListEvent) => {
            if (event.matches) closeMobileNavigation(false);
        };

        desktopMedia.addEventListener('change', handleDesktopViewport);
        return () => desktopMedia.removeEventListener('change', handleDesktopViewport);
    }, [closeMobileNavigation]);

    const handleDrawerKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Tab') return;

        const focusableElements = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).filter(
            (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
        );

        if (focusableElements.length === 0) {
            event.preventDefault();
            drawerRef.current?.focus();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (!firstElement || !lastElement) return;

        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <a
                className="sr-only z-[100] rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                href="#main-content"
            >
                Skip to main content
            </a>

            <div className="min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
                <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-card lg:flex">
                    <Link
                        className="border-b border-border px-5 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        to={variant === 'admin' ? '/admin' : '/client'}
                    >
                        <ApplicationBrand variant={variant} />
                    </Link>
                    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                        <Navigation items={navigationItems} label="Primary navigation" />
                    </div>
                    <div className="border-t border-border p-4">
                        <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
                        {userEmail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{userEmail}</p>}
                    </div>
                </aside>

                <div className="min-w-0">
                    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                        <div className="flex min-h-16 items-center justify-between gap-2 px-3 sm:px-5 lg:px-8">
                            <div className="flex min-w-0 items-center gap-2">
                                <button
                                    ref={menuButtonRef}
                                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden"
                                    type="button"
                                    aria-label="Open navigation"
                                    aria-controls="mobile-navigation"
                                    aria-expanded={isMobileNavigationOpen}
                                    onClick={openMobileNavigation}
                                >
                                    <Menu className="size-5" aria-hidden="true" />
                                </button>
                                <div className="hidden sm:block lg:hidden">
                                    <ApplicationBrand variant={variant} compact />
                                </div>
                                <div className="hidden min-w-0 xl:block">
                                    <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
                                    {userEmail && <p className="truncate text-xs text-muted-foreground">{userEmail}</p>}
                                </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                                <GlobalSearchPalette />
                                <NotificationBell />
                                <ThemeToggle />
                                <button
                                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 sm:px-3"
                                    type="button"
                                    aria-label={isSigningOut ? 'Signing out' : 'Sign out'}
                                    disabled={isSigningOut}
                                    onClick={onSignOut}
                                >
                                    <LogOut className="size-4" aria-hidden="true" />
                                    <span className="hidden md:inline">{isSigningOut ? 'Signing out…' : 'Sign out'}</span>
                                </button>
                            </div>
                        </div>
                    </header>

                    <main
                        id="main-content"
                        className={`mx-auto w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-8 ${variant === 'client' ? 'max-w-7xl' : 'max-w-[96rem]'}`}
                        tabIndex={-1}
                    >
                        <Breadcrumbs className="mb-5" variant={variant} labels={breadcrumbLabels} />
                        <Outlet />
                    </main>
                </div>
            </div>

            {isMobileNavigationOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button
                        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-sm"
                        type="button"
                        tabIndex={-1}
                        aria-label="Dismiss navigation"
                        onMouseDown={() => closeMobileNavigation()}
                    />
                    <aside
                        ref={drawerRef}
                        id="mobile-navigation"
                        className="relative flex h-full w-[min(20rem,calc(100vw-3rem))] flex-col border-r border-border bg-card shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="mobile-navigation-title"
                        tabIndex={-1}
                        onKeyDown={handleDrawerKeyDown}
                    >
                        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
                            <div id="mobile-navigation-title">
                                <ApplicationBrand variant={variant} />
                            </div>
                            <button
                                ref={closeButtonRef}
                                className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                type="button"
                                aria-label="Close navigation"
                                onClick={() => closeMobileNavigation()}
                            >
                                <X className="size-5" aria-hidden="true" />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                            <Navigation
                                items={navigationItems}
                                label="Mobile primary navigation"
                                onNavigate={() => closeMobileNavigation()}
                            />
                        </div>

                        <div className="border-t border-border p-4">
                            <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
                            {userEmail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{userEmail}</p>}
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}

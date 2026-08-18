import type { ApexOptions } from 'apexcharts';
import { BarChart3 } from 'lucide-react';
import { Component, lazy, Suspense, type ReactNode, useId } from 'react';
import { EmptyState, ErrorState } from '@/components/PageStates';
import { useTheme } from '@/components/ThemeProvider';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const Chart = lazy(() => import('react-apexcharts'));

type ChartType = 'bar' | 'donut' | 'line';

interface DashboardChartProps {
    title: string;
    description?: string;
    type: ChartType;
    categories: string[];
    series: Array<{ name: string; data: number[] }> | number[];
    empty?: boolean;
}

class ChartRenderBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
    public state = { hasError: false };

    public static getDerivedStateFromError(): { hasError: boolean } {
        return { hasError: true };
    }

    public render(): ReactNode {
        if (this.state.hasError) {
            return (
                <ErrorState
                    className="flex min-h-72 items-center"
                    title="Chart unavailable"
                    description="This chart could not be rendered. Dashboard metrics are still available above."
                />
            );
        }

        return this.props.children;
    }
}

function ChartSkeleton() {
    return (
        <div className="flex h-72 flex-col justify-end gap-3 px-2 pb-4" role="status" aria-label="Loading chart">
            <span className="sr-only">Loading chart...</span>
            <div className="flex flex-1 items-end gap-3" aria-hidden="true">
                {[42, 68, 54, 82, 63, 74].map((height, index) => (
                    <Skeleton key={index} className="min-w-0 flex-1 rounded-t-md" style={{ height: `${height}%` }} />
                ))}
            </div>
            <Skeleton className="h-px w-full" />
            <div className="grid grid-cols-6 gap-3" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                    <Skeleton key={index} className="h-3 w-full" />
                ))}
            </div>
        </div>
    );
}

export function DashboardChart({ title, description, type, categories, series, empty = false }: DashboardChartProps) {
    const titleId = useId();
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';
    const labelColor = isDark ? '#cbd5e1' : '#475569';
    const mutedColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const options: ApexOptions = {
        chart: {
            type,
            toolbar: { show: false },
            background: 'transparent',
            foreColor: labelColor,
            fontFamily: 'inherit',
        },
        theme: { mode: resolvedTheme },
        colors: isDark
            ? ['#60a5fa', '#22d3ee', '#a78bfa', '#fbbf24', '#fb7185', '#34d399']
            : ['#2563eb', '#0891b2', '#8b5cf6', '#f59e0b', '#e11d48', '#10b981'],
        dataLabels: { enabled: type === 'donut' },
        xaxis: {
            categories,
            axisBorder: { color: gridColor },
            axisTicks: { color: gridColor },
            labels: {
                rotate: -35,
                trim: true,
                style: { colors: mutedColor },
            },
        },
        yaxis: {
            forceNiceScale: true,
            min: 0,
            decimalsInFloat: 0,
            labels: { style: { colors: [mutedColor] } },
        },
        stroke: { curve: type === 'line' ? 'smooth' : 'straight', width: type === 'line' ? 3 : 1 },
        plotOptions: type === 'bar' ? { bar: { borderRadius: 5, columnWidth: '55%' } } : undefined,
        legend: {
            position: type === 'donut' ? 'bottom' : 'top',
            labels: { colors: labelColor },
        },
        noData: { text: 'No data available' },
        tooltip: {
            theme: resolvedTheme,
            y: { formatter: (value: number) => Math.round(value).toLocaleString() },
        },
        grid: { borderColor: gridColor },
        responsive: [
            {
                breakpoint: 640,
                options: {
                    chart: { height: 250 },
                    legend: { position: 'bottom' },
                    xaxis: { labels: { rotate: -45, hideOverlappingLabels: true } },
                },
            },
        ],
    };

    return (
        <Card className="min-w-0" role="region" aria-labelledby={titleId}>
            <CardHeader className="border-b border-border">
                <div>
                    <h2 id={titleId} className="font-semibold tracking-tight text-foreground">
                        {title}
                    </h2>
                    {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
                </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
                {empty ? (
                    <EmptyState
                        className="h-72 min-h-0"
                        compact
                        icon={BarChart3}
                        title="No data available yet."
                        description="Metrics will appear here when matching records are available."
                    />
                ) : (
                    <ChartRenderBoundary key={`${type}-${resolvedTheme}`}>
                        <Suspense fallback={<ChartSkeleton />}>
                            <div className="overflow-hidden" role="img" aria-label={`${title}${description ? `. ${description}` : ''}`}>
                                <Chart options={options} series={series} type={type} height={280} />
                            </div>
                        </Suspense>
                    </ChartRenderBoundary>
                )}
            </CardContent>
        </Card>
    );
}

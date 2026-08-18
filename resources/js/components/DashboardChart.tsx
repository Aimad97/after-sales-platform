import type { ApexOptions } from 'apexcharts';
import { Component, lazy, type ReactNode, Suspense } from 'react';

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
                <div className="grid h-72 place-items-center text-center text-sm text-slate-500">
                    This chart could not be rendered. Dashboard metrics are still available above.
                </div>
            );
        }

        return this.props.children;
    }
}

export function DashboardChart({ title, description, type, categories, series, empty = false }: DashboardChartProps) {
    const options: ApexOptions = {
        chart: { type, toolbar: { show: false }, fontFamily: 'inherit' },
        colors: ['#2563eb', '#0891b2', '#8b5cf6', '#f59e0b', '#e11d48', '#10b981'],
        dataLabels: { enabled: type === 'donut' },
        xaxis: { categories, labels: { rotate: -35, trim: true } },
        yaxis: { forceNiceScale: true, min: 0, decimalsInFloat: 0 },
        stroke: { curve: type === 'line' ? 'smooth' : 'straight', width: type === 'line' ? 3 : 1 },
        plotOptions: type === 'bar' ? { bar: { borderRadius: 5, columnWidth: '55%' } } : undefined,
        legend: { position: type === 'donut' ? 'bottom' : 'top' },
        noData: { text: 'No data available' },
        tooltip: { y: { formatter: (value: number) => Math.round(value).toLocaleString() } },
        grid: { borderColor: '#e2e8f0' },
    };

    return (
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
                <h3 className="font-semibold text-slate-900">{title}</h3>
                {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
            </div>
            {empty ? (
                <div className="grid h-72 place-items-center text-sm text-slate-500">No data available yet.</div>
            ) : (
                <div className="mt-4 overflow-hidden">
                    <ChartRenderBoundary>
                        <Suspense
                            fallback={
                                <div className="grid h-72 place-items-center text-sm text-slate-500" aria-busy="true">
                                    Loading chart...
                                </div>
                            }
                        >
                            <Chart options={options} series={series} type={type} height={280} />
                        </Suspense>
                    </ChartRenderBoundary>
                </div>
            )}
        </article>
    );
}

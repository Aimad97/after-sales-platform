import { apiClient } from '@/api/client';
import type { ReportExport, ReportExportFormat, ReportFilters, ReportResponse, ReportType } from '@/features/reports/types';

interface DataResponse<T> {
    data: T;
}

export async function getReport(type: ReportType, filters: ReportFilters): Promise<ReportResponse> {
    const response = await apiClient.get<ReportResponse>(`/reports/${type}`, { params: filters });

    return response.data;
}

export async function requestReportExport(type: ReportType, filters: ReportFilters, format: ReportExportFormat = 'csv'): Promise<ReportExport> {
    const response = await apiClient.post<DataResponse<ReportExport>>(`/reports/${type}/exports`, { ...filters, format });

    return response.data.data;
}

export async function getReportExport(uuid: string): Promise<ReportExport> {
    const response = await apiClient.get<DataResponse<ReportExport>>(`/reports/exports/${uuid}`);

    return response.data.data;
}

function fileNameFromDisposition(value: string | undefined): string | null {
    if (!value) return null;

    const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

    const basicMatch = value.match(/filename="?([^";]+)"?/i);

    return basicMatch?.[1] ?? null;
}

export async function downloadReportExport(uuid: string): Promise<void> {
    const response = await apiClient.get<Blob>(`/reports/exports/${uuid}/download`, { responseType: 'blob' });
    const objectUrl = URL.createObjectURL(response.data);
    const link = document.createElement('a');

    link.href = objectUrl;
    link.download = fileNameFromDisposition(response.headers['content-disposition']) ?? `report-${uuid}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
}

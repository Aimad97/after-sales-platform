<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ReportType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Reports\IndexReportRequest;
use App\Http\Requests\Reports\StoreReportExportRequest;
use App\Http\Resources\ReportExportResource;
use App\Models\ReportExport;
use App\Services\ReportExportService;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(
        private readonly ReportService $reports,
        private readonly ReportExportService $exports,
    ) {}

    public function index(IndexReportRequest $request, string $type): JsonResponse
    {
        $this->authorize('view-reports');
        $reportType = $this->reportType($type);
        $filters = $request->validated();
        $paginator = $this->reports->paginate($reportType, $filters);

        return response()->json([
            'report_type' => $reportType->value,
            'columns' => $this->reports->exportColumns($reportType),
            'filters' => $filters,
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'from' => $paginator->firstItem(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'to' => $paginator->lastItem(),
                'total' => $paginator->total(),
            ],
            'links' => [
                'first' => $paginator->url(1),
                'last' => $paginator->url($paginator->lastPage()),
                'next' => $paginator->nextPageUrl(),
                'prev' => $paginator->previousPageUrl(),
            ],
        ]);
    }

    public function export(StoreReportExportRequest $request, string $type): JsonResponse
    {
        $this->authorize('view-reports');
        $reportType = $this->reportType($type);
        $export = $this->exports->request(
            $request->user(),
            $reportType,
            $request->validated(),
            (string) $request->validated('format'),
        );

        return (new ReportExportResource($export))
            ->response()
            ->setStatusCode(202);
    }

    public function exportStatus(ReportExport $export): ReportExportResource
    {
        $this->authorize('view', $export);

        return new ReportExportResource($export);
    }

    public function download(ReportExport $export): StreamedResponse
    {
        $this->authorize('view', $export);

        return $this->exports->download($export);
    }

    private function reportType(string $type): ReportType
    {
        return ReportType::tryFrom($type) ?? abort(404, 'Unknown report type.');
    }
}

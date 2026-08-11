<?php
namespace App\Http\Controllers\Api\V1;
use App\Http\Controllers\Controller;
use App\Http\Requests\Audits\IndexAuditLogsRequest;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Services\AuditLogService;
class AuditLogController extends Controller { public function __construct(private readonly AuditLogService $audits) {} public function index(IndexAuditLogsRequest $request) { $this->authorize('viewAny',AuditLog::class); return AuditLogResource::collection($this->audits->paginate($request->validated())); } }

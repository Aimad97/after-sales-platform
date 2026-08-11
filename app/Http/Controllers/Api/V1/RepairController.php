<?php
namespace App\Http\Controllers\Api\V1;
use App\Http\Controllers\Controller;
use App\Http\Requests\Repairs\CompleteRepairRequest;
use App\Http\Requests\Repairs\DiagnosisRequest;
use App\Http\Requests\Repairs\IndexRepairsRequest;
use App\Http\Requests\Repairs\UpdateRepairRequest;
use App\Http\Resources\RepairResource;
use App\Http\Resources\TicketResource;
use App\Models\Repair;
use App\Models\Ticket;
use App\Services\RepairManagementService;
use Illuminate\Http\JsonResponse;
class RepairController extends Controller { public function __construct(private readonly RepairManagementService $repairs) {} public function index(IndexRepairsRequest $request) { $this->authorize('viewAny',Repair::class); return RepairResource::collection($this->repairs->paginate($request->validated(),$request->user())); } public function show(Repair $repair): RepairResource { $this->authorize('view',$repair); return new RepairResource($repair->load(['ticket.client','ticket.product','technician.user','history.changedBy'])); } public function myTickets() { $this->authorize('viewAny',Repair::class); return TicketResource::collection($this->repairs->assignedTickets(request()->user())); } public function startDiagnosis(Ticket $ticket): JsonResponse { $this->authorize('startRepair',[Repair::class,$ticket]); return response()->json(['data'=>new RepairResource($this->repairs->startDiagnosis($ticket,request()->user()))],201); } public function diagnose(DiagnosisRequest $request, Repair $repair): JsonResponse { $this->authorize('update',$repair); return response()->json(['data'=>new RepairResource($this->repairs->recordDiagnosis($repair,$request->validated(),$request->user()))]); } public function start(Repair $repair): JsonResponse { $this->authorize('update',$repair); return response()->json(['data'=>new RepairResource($this->repairs->startRepair($repair,request()->user()))]); } public function update(UpdateRepairRequest $request, Repair $repair): JsonResponse { $this->authorize('update',$repair); return response()->json(['data'=>new RepairResource($this->repairs->update($repair,$request->validated(),$request->user()))]); } public function complete(CompleteRepairRequest $request, Repair $repair): JsonResponse { $this->authorize('update',$repair); return response()->json(['data'=>new RepairResource($this->repairs->complete($repair,$request->validated(),$request->user()))]); } }

<?php
namespace App\Services;
use App\Models\AuditLog;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
class AuditLogService { public function paginate(array $filters): LengthAwarePaginator { return AuditLog::query()->with('user')->when($filters['user_id']??null,fn($q,$v)=>$q->where('user_id',$v))->when($filters['action']??null,fn($q,$v)=>$q->where('action',$v))->when($filters['entity_type']??null,fn($q,$v)=>$q->where('entity_type',$v))->when($filters['date_from']??null,fn($q,$v)=>$q->whereDate('created_at','>=',$v))->when($filters['date_to']??null,fn($q,$v)=>$q->whereDate('created_at','<=',$v))->latest('created_at')->latest('id')->paginate($filters['per_page']??25)->withQueryString(); } }

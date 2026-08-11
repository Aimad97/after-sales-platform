<?php
namespace App\Observers;
use App\Services\AuditLogger;
use Illuminate\Database\Eloquent\Model;
class AuditObserver { public function __construct(private readonly AuditLogger $audit) {} public function created(Model $model): void { $this->audit->record($model,'created',[], $model->getAttributes()); } public function updated(Model $model): void { $changes=$model->getChanges(); unset($changes['updated_at']); if ($changes !== []) $this->audit->record($model,'updated', array_intersect_key($model->getRawOriginal(),$changes),$changes); } public function deleted(Model $model): void { $this->audit->record($model,'deleted',$model->getOriginal(),[]); } }

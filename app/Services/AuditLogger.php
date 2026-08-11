<?php
namespace App\Services;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
class AuditLogger
{
    private const SENSITIVE = ['password','password_confirmation','remember_token','token','access_token','refresh_token','secret','api_key'];
    public function record(Model $entity, string $action, array $old=[], array $new=[], ?User $actor=null): void
    {
        $request = app()->bound('request') ? request() : null;
        AuditLog::query()->create(['user_id'=>$actor?->id ?? $request?->user()?->id,'action'=>$action,'entity_type'=>$entity::class,'entity_id'=>$entity->getKey(),'old_values'=>$this->redact($old),'new_values'=>$this->redact($new),'ip_address'=>$request?->ip(),'user_agent'=>$request?->userAgent(),'created_at'=>now()]);
    }
    private function redact(array $values): array { return Arr::except($values, array_merge(self::SENSITIVE, ['updated_at','created_at','deleted_at'])); }
}

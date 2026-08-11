<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RepairHistory extends Model
{
    protected $fillable = ['repair_id', 'event', 'changes', 'changed_by', 'occurred_at'];
    protected function casts(): array { return ['changes' => 'array', 'occurred_at' => 'datetime']; }
    public function repair(): BelongsTo { return $this->belongsTo(Repair::class); }
    public function changedBy(): BelongsTo { return $this->belongsTo(User::class, 'changed_by'); }
}

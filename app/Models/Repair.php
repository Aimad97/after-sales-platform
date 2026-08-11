<?php

namespace App\Models;

use App\Enums\RepairResult;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Repair extends Model
{
    protected $fillable = ['ticket_id', 'technician_id', 'diagnosis', 'root_cause', 'repair_action', 'internal_notes', 'customer_notes', 'labor_cost', 'parts_cost', 'total_cost', 'started_at', 'completed_at', 'result'];

    protected function casts(): array
    {
        return ['labor_cost' => 'decimal:2', 'parts_cost' => 'decimal:2', 'total_cost' => 'decimal:2', 'started_at' => 'datetime', 'completed_at' => 'datetime', 'result' => RepairResult::class];
    }

    public function ticket(): BelongsTo { return $this->belongsTo(Ticket::class); }
    public function technician(): BelongsTo { return $this->belongsTo(Technician::class); }
    public function history(): HasMany { return $this->hasMany(RepairHistory::class)->orderBy('occurred_at')->orderBy('id'); }
}

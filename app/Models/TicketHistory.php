<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class TicketHistory extends Model { protected $fillable=['ticket_id','event','description','metadata','actor_id','occurred_at']; protected function casts(): array { return ['metadata'=>'array','occurred_at'=>'datetime']; } public function ticket(): BelongsTo { return $this->belongsTo(Ticket::class); } public function actor(): BelongsTo { return $this->belongsTo(User::class,'actor_id'); } }

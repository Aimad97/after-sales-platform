<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Upgrade the original lookup-table ticket schema to the SAV workflow schema.
     */
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table): void {
            $table->string('ticket_number', 40)->nullable()->after('uuid');
            $table->foreignId('client_id')->nullable()->after('customer_id');
            $table->foreignId('warranty_id')->nullable()->after('customer_product_id');
            $table->foreignId('product_id')->nullable()->after('warranty_id');
            $table->foreignId('invoice_item_id')->nullable()->after('product_id');
            $table->string('title')->nullable()->after('subject');
            $table->text('problem_description')->nullable()->after('description');
            $table->string('priority', 20)->nullable()->after('problem_description');
            $table->string('status', 40)->nullable()->after('priority');
            $table->string('source', 20)->default('web')->after('status');
            $table->boolean('warranty_eligible')->default(false)->after('source');
            $table->foreignId('assigned_technician_id')->nullable()->after('created_by');
            $table->timestamp('received_at')->nullable()->after('assigned_technician_id');
        });

        $statusNames = DB::table('ticket_statuses')->pluck('name', 'id');
        $priorityNames = DB::table('ticket_priorities')->pluck('name', 'id');
        $techniciansByUser = DB::table('technicians')->pluck('id', 'user_id');

        DB::table('tickets')->orderBy('id')->eachById(function (object $ticket) use ($statusNames, $priorityNames, $techniciansByUser): void {
            $warranty = DB::table('customer_products')
                ->select(['product_id', 'invoice_item_id'])
                ->where('id', $ticket->customer_product_id)
                ->first();

            DB::table('tickets')->where('id', $ticket->id)->update([
                'ticket_number' => sprintf('TKT-%08d', $ticket->id),
                'client_id' => $ticket->customer_id,
                'warranty_id' => $ticket->customer_product_id,
                'product_id' => $warranty?->product_id,
                'invoice_item_id' => $warranty?->invoice_item_id,
                'title' => $ticket->subject,
                'problem_description' => $ticket->description,
                'priority' => $this->priorityValue($priorityNames->get($ticket->priority_id)),
                'status' => $this->statusValue($statusNames->get($ticket->status_id)),
                'assigned_technician_id' => $ticket->assigned_to === null ? null : $techniciansByUser->get($ticket->assigned_to),
                'received_at' => $ticket->opened_at ?? $ticket->created_at,
            ]);
        });

        Schema::table('tickets', function (Blueprint $table): void {
            $table->foreignId('client_id')->nullable(false)->change();
            $table->foreignId('product_id')->nullable(false)->change();
            $table->string('ticket_number', 40)->nullable(false)->change();
            $table->string('priority', 20)->nullable(false)->change();
            $table->string('status', 40)->nullable(false)->change();
            $table->timestamp('received_at')->nullable(false)->change();

            $table->foreign('client_id')->references('id')->on('customers')->restrictOnDelete();
            $table->foreign('warranty_id')->references('id')->on('customer_products')->nullOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
            $table->foreign('invoice_item_id')->references('id')->on('invoice_items')->nullOnDelete();
            $table->foreign('assigned_technician_id')->references('id')->on('technicians')->nullOnDelete();
            $table->unique('ticket_number');
            $table->index(['client_id', 'status']);
            $table->index(['assigned_technician_id', 'status']);
            $table->index(['product_id', 'status']);
            $table->index('warranty_id');
            $table->index('invoice_item_id');

            $table->foreignId('customer_product_id')->nullable()->change();
            $table->foreignId('status_id')->nullable()->change();
            $table->foreignId('priority_id')->nullable()->change();
            $table->string('subject')->nullable()->change();
            $table->text('description')->nullable()->change();
            $table->timestamp('opened_at')->nullable()->change();
        });

        Schema::create('ticket_status_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('ticket_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 40)->nullable();
            $table->string('to_status', 40);
            $table->foreignId('transitioned_by')->constrained('users')->restrictOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('transitioned_at');
            $table->timestamps();

            $table->index(['ticket_id', 'transitioned_at']);
        });

        DB::table('tickets')->orderBy('id')->eachById(function (object $ticket): void {
            DB::table('ticket_status_histories')->insert([
                'ticket_id' => $ticket->id,
                'from_status' => null,
                'to_status' => $ticket->status,
                'transitioned_by' => $ticket->created_by,
                'notes' => 'Migrated from the legacy ticket workflow.',
                'transitioned_at' => $ticket->received_at,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });
    }

    public function down(): void
    {
        throw new \RuntimeException('The ticket workflow migration is irreversible because it converts legacy ticket state and relationship data. Restore a database backup to roll it back.');
    }

    private function statusValue(?string $legacyStatus): string
    {
        return match (Str::slug((string) $legacyStatus)) {
            'received' => 'received',
            'awaiting-diagnosis' => 'awaiting_diagnosis',
            'diagnosing', 'in-progress' => 'diagnosing',
            'awaiting-customer-approval' => 'awaiting_customer_approval',
            'awaiting-part' => 'awaiting_part',
            'repairing' => 'repairing',
            'testing' => 'testing',
            'repaired' => 'repaired',
            'ready-for-pickup' => 'ready_for_pickup',
            'delivered' => 'delivered',
            'closed', 'resolved' => 'closed',
            'cancelled', 'canceled' => 'cancelled',
            default => 'opened',
        };
    }

    private function priorityValue(?string $legacyPriority): string
    {
        return match (Str::lower(trim((string) $legacyPriority))) {
            'low' => 'low',
            'high' => 'high',
            'urgent' => 'urgent',
            default => 'normal',
        };
    }
};

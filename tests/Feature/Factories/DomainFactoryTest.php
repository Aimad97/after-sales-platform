<?php

namespace Tests\Feature\Factories;

use App\Models\Attachment;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Product;
use App\Models\Repair;
use App\Models\ReportExport;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\Warranty;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DomainFactoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_factories_build_a_consistent_sales_to_repair_domain_graph(): void
    {
        $client = Client::factory()->create();
        $product = Product::factory()->create();
        $invoice = Invoice::factory()->for($client)->create();
        $invoiceItem = InvoiceItem::factory()
            ->for($invoice)
            ->for($product)
            ->create();
        $warranty = Warranty::factory()
            ->for($client, 'client')
            ->for($product)
            ->create(['invoice_item_id' => $invoiceItem->id]);
        $ticket = Ticket::factory()->forWarranty($warranty)->create();
        $technician = Technician::factory()->create();
        $repair = Repair::factory()
            ->for($ticket)
            ->for($technician, 'technician')
            ->create();
        $attachment = Attachment::factory()->for($ticket, 'attachable')->create();
        $export = ReportExport::factory()->completed()->create();

        $this->assertTrue($invoice->client->is($client));
        $this->assertTrue($invoiceItem->invoice->is($invoice));
        $this->assertTrue($invoiceItem->product->is($product));
        $this->assertTrue($warranty->client->is($client));
        $this->assertTrue($ticket->warranty->is($warranty));
        $this->assertTrue($ticket->client->is($client));
        $this->assertTrue($ticket->product->is($product));
        $this->assertTrue($repair->ticket->is($ticket));
        $this->assertSame($technician->id, $ticket->fresh()->assigned_technician_id);
        $this->assertTrue($attachment->attachable->is($ticket));
        $this->assertTrue($export->isDownloadable());
    }
}

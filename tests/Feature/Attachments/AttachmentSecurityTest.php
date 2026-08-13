<?php

namespace Tests\Feature\Attachments;

use App\Models\Attachment;
use App\Models\Client;
use App\Models\Product;
use App\Models\Repair;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class AttachmentSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        config(['attachments.disk' => 'attachments']);
        Storage::fake('attachments');
    }

    public function test_an_authorized_user_can_upload_a_randomized_private_ticket_attachment(): void
    {
        $admin = $this->user('admin');
        $ticket = $this->ticket($admin);

        $response = $this->actingAs($admin)->post("/api/tickets/{$ticket->uuid}/attachments", [
            'file' => UploadedFile::fake()->create('damaged-front-panel.jpg', 120, 'image/jpeg'),
        ], ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('data.original_filename', 'damaged-front-panel.jpg')
            ->assertJsonPath('data.mime_type', 'image/jpeg')
            ->assertJsonPath('data.is_previewable_image', true);

        $attachment = Attachment::query()->firstOrFail();
        $this->assertNotSame($attachment->original_filename, $attachment->stored_filename);
        $this->assertStringStartsWith("ticket/{$ticket->id}/", $attachment->path);
        Storage::disk('attachments')->assertExists($attachment->path);
    }

    public function test_executable_and_oversized_uploads_are_rejected(): void
    {
        $admin = $this->user('admin');
        $ticket = $this->ticket($admin);

        $this->actingAs($admin)->post("/api/tickets/{$ticket->uuid}/attachments", [
            'file' => UploadedFile::fake()->create('shell.php', 5, 'application/x-php'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');

        // An attacker can declare a safe MIME type. The original extension is
        // independently checked before the file is persisted.
        $this->actingAs($admin)->post("/api/tickets/{$ticket->uuid}/attachments", [
            'file' => UploadedFile::fake()->create('shell.php', 5, 'image/jpeg'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');

        config(['attachments.max_size_kb' => 1]);
        $this->actingAs($admin)->post("/api/tickets/{$ticket->uuid}/attachments", [
            'file' => UploadedFile::fake()->create('large-proof.pdf', 2, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');

        $this->assertDatabaseCount('attachments', 0);
    }

    public function test_authorized_users_can_attach_files_to_products_and_repairs(): void
    {
        $admin = $this->user('admin');
        $ticket = $this->ticket($admin);
        $product = $ticket->product;
        $technician = Technician::query()->create([
            'user_id' => User::factory()->create()->id,
            'employee_code' => 'TECH-ATT-001',
            'skill_level' => 2,
            'availability_status' => 'available',
        ]);
        $repair = Repair::query()->create([
            'ticket_id' => $ticket->id,
            'technician_id' => $technician->id,
        ]);

        $this->actingAs($admin)->post("/api/products/{$product->uuid}/attachments", [
            'file' => UploadedFile::fake()->create('manual.pdf', 20, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();
        $this->assertDatabaseHas('attachments', [
            'attachable_type' => Product::class,
            'attachable_id' => $product->id,
        ]);

        $this->actingAs($admin)->post("/api/repairs/{$repair->id}/attachments", [
            'file' => UploadedFile::fake()->create('diagnostic.png', 20, 'image/png'),
        ], ['Accept' => 'application/json'])->assertCreated();
        $this->assertDatabaseHas('attachments', [
            'attachable_type' => Repair::class,
            'attachable_id' => $repair->id,
        ]);
    }

    public function test_download_and_deletion_require_authorization(): void
    {
        $admin = $this->user('admin');
        $clientUser = $this->user('client');
        $ticket = $this->ticket($admin);
        $attachment = $this->upload($admin, $ticket);

        $this->actingAs($clientUser)->get("/api/attachments/{$attachment->uuid}/preview")->assertForbidden();
        $this->actingAs($clientUser)->get("/api/attachments/{$attachment->uuid}/download")->assertForbidden();
        $this->actingAs($clientUser)->deleteJson("/api/attachments/{$attachment->uuid}")->assertForbidden();

        $this->actingAs($admin)->get("/api/attachments/{$attachment->uuid}/preview")
            ->assertOk()
            ->assertHeader('x-content-type-options', 'nosniff');
        $this->actingAs($admin)->get("/api/attachments/{$attachment->uuid}/download")
            ->assertOk()
            ->assertHeader('content-disposition')
            ->assertHeader('x-content-type-options', 'nosniff');
        $this->actingAs($admin)->deleteJson("/api/attachments/{$attachment->uuid}")->assertOk();
        Storage::disk('attachments')->assertMissing($attachment->path);
    }

    public function test_attachment_endpoints_require_authentication(): void
    {
        $admin = $this->user('admin');
        $ticket = $this->ticket($admin);
        $this->app['auth']->forgetGuards();

        $this->postJson("/api/tickets/{$ticket->uuid}/attachments", [
            'file' => UploadedFile::fake()->create('proof.pdf', 10, 'application/pdf'),
        ])->assertUnauthorized();
    }

    public function test_missing_private_file_is_not_streamed(): void
    {
        $admin = $this->user('admin');
        $ticket = $this->ticket($admin);
        $attachment = $this->upload($admin, $ticket);
        Storage::disk('attachments')->delete($attachment->path);

        $this->actingAs($admin)
            ->get("/api/attachments/{$attachment->uuid}/download")
            ->assertNotFound();
    }

    public function test_attachment_metadata_is_purged_when_a_product_is_hard_deleted(): void
    {
        $now = now();
        $brandId = DB::table('brands')->insertGetId([
            'name' => 'Cleanup Brand',
            'slug' => 'cleanup-brand',
            'active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $categoryId = DB::table('categories')->insertGetId([
            'name' => 'Cleanup Category',
            'slug' => 'cleanup-category',
            'active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $product = Product::query()->create([
            'uuid' => (string) Str::uuid(),
            'sku' => 'ATT-CLEANUP',
            'name' => 'Cleanup Product',
            'slug' => 'cleanup-product',
            'brand_id' => $brandId,
            'category_id' => $categoryId,
            'model' => 'ATT-CLEANUP',
            'default_warranty_months' => 12,
            'serial_number_required' => false,
            'active' => true,
        ]);
        $attachment = $product->attachments()->create([
            'uuid' => (string) Str::uuid(),
            'disk' => 'attachments',
            'path' => "product/{$product->id}/cleanup.pdf",
            'original_filename' => 'cleanup.pdf',
            'stored_filename' => 'cleanup.pdf',
            'mime_type' => 'application/pdf',
            'size' => 1,
        ]);

        $product->delete();

        $this->assertDatabaseMissing('attachments', ['id' => $attachment->id]);
    }

    private function upload(User $actor, Ticket $ticket): Attachment
    {
        $this->actingAs($actor)->post("/api/tickets/{$ticket->uuid}/attachments", [
            'file' => UploadedFile::fake()->create('evidence.png', 20, 'image/png'),
        ], ['Accept' => 'application/json'])->assertCreated();

        return Attachment::query()->firstOrFail();
    }

    private function ticket(User $actor): Ticket
    {
        $client = Client::factory()->create();
        $now = now();
        $brandId = DB::table('brands')->insertGetId(['name' => 'Attachment Brand', 'slug' => 'attachment-brand', 'active' => true, 'created_at' => $now, 'updated_at' => $now]);
        $categoryId = DB::table('categories')->insertGetId(['name' => 'Attachment Category', 'slug' => 'attachment-category', 'active' => true, 'created_at' => $now, 'updated_at' => $now]);
        $product = Product::query()->create(['uuid' => (string) Str::uuid(), 'sku' => 'ATT-100', 'name' => 'Attachment Product', 'slug' => 'attachment-product', 'brand_id' => $brandId, 'category_id' => $categoryId, 'model' => 'ATT-100', 'default_warranty_months' => 24, 'serial_number_required' => true, 'active' => true]);
        $warranty = Warranty::query()->create(['uuid' => (string) Str::uuid(), 'customer_id' => $client->id, 'product_id' => $product->id, 'serial_number' => 'ATT-SN-001', 'quantity' => 1, 'purchase_date' => today()->subMonth(), 'warranty_end' => today()->addYear(), 'starts_at' => today()->subMonth(), 'expires_at' => today()->addYear(), 'status' => 'active']);

        $this->actingAs($actor)->postJson('/api/tickets', ['client_id' => $client->id, 'product_id' => $product->id, 'warranty_id' => $warranty->id, 'title' => 'Attachment test ticket', 'problem_description' => 'A ticket used to test secure attachments.'])->assertCreated();

        return Ticket::query()->firstOrFail();
    }

    private function user(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}

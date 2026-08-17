<?php

namespace Database\Factories;

use App\Models\Attachment;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Attachment> */
class AttachmentFactory extends Factory
{
    protected $model = Attachment::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $uuid = (string) Str::uuid();
        $storedFilename = $uuid.'.jpg';

        return [
            'uuid' => $uuid,
            'attachable_type' => Ticket::class,
            'attachable_id' => Ticket::factory(),
            'uploaded_by' => User::factory(),
            'disk' => 'attachments',
            'path' => 'tickets/'.now()->format('Y/m').'/'.$storedFilename,
            'original_filename' => 'device-photo.jpg',
            'stored_filename' => $storedFilename,
            'mime_type' => 'image/jpeg',
            'size' => fake()->numberBetween(1024, 2 * 1024 * 1024),
        ];
    }

    public function document(): static
    {
        return $this->state(function (): array {
            $storedFilename = Str::uuid().'.pdf';

            return [
                'path' => 'documents/'.now()->format('Y/m').'/'.$storedFilename,
                'original_filename' => 'service-document.pdf',
                'stored_filename' => $storedFilename,
                'mime_type' => 'application/pdf',
            ];
        });
    }
}

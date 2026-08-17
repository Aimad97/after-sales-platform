<?php

namespace App\Http\Requests\Attachments;

use App\Models\Attachment;
use App\Models\Product;
use App\Models\Repair;
use App\Models\Ticket;
use Illuminate\Foundation\Http\FormRequest;

class StoreAttachmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $ticket = $this->route('ticket');
        $product = $this->route('product');
        $repair = $this->route('repair');

        if ($ticket instanceof Ticket) {
            // Preserve the portal policy's deny-as-not-found response for a
            // ticket belonging to another client. The controller performs the
            // definitive object check after validation.
            if ($this->routeIs('client.tickets.attachments.store')) {
                return $user?->hasClientPortalAccess() ?? false;
            }

            return $user?->can('uploadToTicket', [Attachment::class, $ticket]) ?? false;
        }

        if ($product instanceof Product) {
            return $user?->can('uploadToProduct', [Attachment::class, $product]) ?? false;
        }

        if ($repair instanceof Repair) {
            return $user?->can('uploadToRepair', [Attachment::class, $repair]) ?? false;
        }

        return false;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'file' => [
                'required',
                'file',
                'max:'.(int) config('attachments.max_size_kb'),
            ],
        ];
    }
}

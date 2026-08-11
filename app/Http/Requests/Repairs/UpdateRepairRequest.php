<?php
namespace App\Http\Requests\Repairs;
use Illuminate\Foundation\Http\FormRequest;
class UpdateRepairRequest extends FormRequest { public function authorize(): bool { return true; } public function rules(): array { return ['repair_action' => ['sometimes','nullable','string','max:10000'], 'internal_notes' => ['sometimes','nullable','string','max:10000'], 'customer_notes' => ['sometimes','nullable','string','max:10000'], 'labor_cost' => ['sometimes','numeric','decimal:0,2','min:0','max:9999999'], 'parts_cost' => ['sometimes','numeric','decimal:0,2','min:0','max:9999999']]; } }

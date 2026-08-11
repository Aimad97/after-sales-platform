<?php
namespace App\Http\Requests\Repairs;
use App\Enums\RepairResult;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
class CompleteRepairRequest extends FormRequest { public function authorize(): bool { return true; } public function rules(): array { return ['result' => ['required',Rule::enum(RepairResult::class)], 'customer_notes' => ['nullable','string','max:10000']]; } }

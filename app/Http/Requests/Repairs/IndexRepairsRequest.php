<?php
namespace App\Http\Requests\Repairs;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
class IndexRepairsRequest extends FormRequest { public function authorize(): bool { return true; } public function rules(): array { return ['technician_id' => ['nullable','integer',Rule::exists('technicians','id')->whereNull('deleted_at')], 'state' => ['nullable',Rule::in(['current','completed'])], 'per_page' => ['nullable','integer','min:1','max:100']]; } }

<?php
namespace App\Http\Requests\Audits;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
class IndexAuditLogsRequest extends FormRequest { public function authorize(): bool { return true; } public function rules(): array { return ['user_id'=>['nullable','integer',Rule::exists('users','id')->whereNull('deleted_at')],'action'=>['nullable','string','max:100'],'entity_type'=>['nullable','string','max:150'],'date_from'=>['nullable','date'],'date_to'=>['nullable','date','after_or_equal:date_from'],'per_page'=>['nullable','integer','min:1','max:100']]; } }

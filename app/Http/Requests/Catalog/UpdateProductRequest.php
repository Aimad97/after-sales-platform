<?php

namespace App\Http\Requests\Catalog;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('sku')) {
            $this->merge(['sku' => Str::upper(trim((string) $this->input('sku')))]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string|object>>
     */
    public function rules(): array
    {
        $product = $this->route('product');
        $productId = $product instanceof Product ? $product->getKey() : null;

        return [
            'sku' => ['sometimes', 'required', 'string', 'max:100', Rule::unique('products', 'sku')->ignore($productId)],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'category_id' => ['sometimes', 'required', 'integer', 'exists:categories,id'],
            'brand_id' => ['sometimes', 'required', 'integer', 'exists:brands,id'],
            'model' => ['sometimes', 'required', 'string', 'max:255'],
            'default_warranty_months' => ['sometimes', 'required', 'integer', 'min:0', 'max:120'],
            'serial_number_required' => ['sometimes', 'required', 'boolean'],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}

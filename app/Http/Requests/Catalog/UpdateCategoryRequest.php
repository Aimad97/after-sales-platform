<?php

namespace App\Http\Requests\Catalog;

use App\Models\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string|object>>
     */
    public function rules(): array
    {
        $category = $this->route('category');
        $categoryId = $category instanceof Category ? $category->getKey() : null;

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('categories', 'name')->ignore($categoryId)],
            'slug' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}

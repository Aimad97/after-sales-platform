<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class UniqueSlugService
{
    public function resolve(string $table, ?string $requestedSlug, string $fallback, ?int $ignoreId = null): string
    {
        $requestedSlug = filled($requestedSlug) ? Str::slug((string) $requestedSlug) : null;

        if ($requestedSlug !== null) {
            if ($this->exists($table, $requestedSlug, $ignoreId)) {
                throw ValidationException::withMessages([
                    'slug' => 'The slug has already been taken.',
                ]);
            }

            return $requestedSlug;
        }

        $base = Str::slug($fallback);
        if ($base === '') {
            throw ValidationException::withMessages([
                'slug' => 'A slug could not be generated from the name.',
            ]);
        }

        $slug = $base;
        $suffix = 2;

        while ($this->exists($table, $slug, $ignoreId)) {
            $slug = sprintf('%s-%d', $base, $suffix);
            $suffix++;
        }

        return $slug;
    }

    private function exists(string $table, string $slug, ?int $ignoreId): bool
    {
        return DB::table($table)
            ->where('slug', $slug)
            ->when($ignoreId !== null, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists();
    }
}

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->index('company_name', 'customers_company_name_search_idx');
            $table->index('first_name', 'customers_first_name_search_idx');
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->index('name', 'products_name_search_idx');
            $table->index('model', 'products_model_search_idx');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->index('first_name', 'users_first_name_search_idx');
            $table->index('last_name', 'users_last_name_search_idx');
        });

    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex('users_first_name_search_idx');
            $table->dropIndex('users_last_name_search_idx');
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->dropIndex('products_name_search_idx');
            $table->dropIndex('products_model_search_idx');
        });

        Schema::table('customers', function (Blueprint $table): void {
            $table->dropIndex('customers_company_name_search_idx');
            $table->dropIndex('customers_first_name_search_idx');
        });
    }
};

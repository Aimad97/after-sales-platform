<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->where('status', 'inactive')->update(['status' => 'archived']);

        Schema::table('users', function (Blueprint $table): void {
            $table->enum('status', ['active', 'invited', 'suspended', 'archived'])->default('active')->change();
            $table->timestamp('last_login_at')->nullable()->after('status');
            $table->index('last_login_at');
        });
    }

    public function down(): void
    {
        DB::table('users')->whereIn('status', ['invited', 'archived'])->update(['status' => 'inactive']);

        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex(['last_login_at']);
            $table->dropColumn('last_login_at');
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active')->change();
        });
    }
};

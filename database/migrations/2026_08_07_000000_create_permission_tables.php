<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('roles', 'guard_name')) {
            Schema::table('roles', function (Blueprint $table): void {
                $table->string('guard_name')->default('web')->after('name');
            });
        }

        $legacyPermissionsTable = Schema::hasTable('permissions');

        if (! $legacyPermissionsTable) {
            Schema::create('permissions', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
                $table->string('guard_name');
                $table->timestamps();
                $table->unique(['name', 'guard_name']);
            });
        } else {
            Schema::table('permissions', function (Blueprint $table): void {
                if (! Schema::hasColumn('permissions', 'name')) {
                    $table->string('name')->nullable()->after('id');
                }

                if (! Schema::hasColumn('permissions', 'guard_name')) {
                    $table->string('guard_name')->default('web')->after('name');
                }

                if (! Schema::hasColumn('permissions', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });

            if (Schema::hasColumn('permissions', 'code')) {
                DB::table('permissions')
                    ->whereNull('name')
                    ->update(['name' => DB::raw('`code`')]);
            }

            if (! Schema::hasIndex('permissions', ['name', 'guard_name'], 'unique')) {
                Schema::table('permissions', function (Blueprint $table): void {
                    $table->unique(['name', 'guard_name']);
                });
            }
        }

        if (! Schema::hasTable('model_has_permissions')) {
            Schema::create('model_has_permissions', function (Blueprint $table): void {
                $table->foreignId('permission_id')->constrained('permissions')->cascadeOnDelete();
                $table->string('model_type');
                $table->unsignedBigInteger('model_id');
                $table->index(['model_id', 'model_type']);
                $table->primary(['permission_id', 'model_id', 'model_type']);
            });
        }

        if (! Schema::hasTable('model_has_roles')) {
            Schema::create('model_has_roles', function (Blueprint $table): void {
                $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
                $table->string('model_type');
                $table->unsignedBigInteger('model_id');
                $table->index(['model_id', 'model_type']);
                $table->primary(['role_id', 'model_id', 'model_type']);
            });
        }

        if (! Schema::hasTable('role_has_permissions')) {
            Schema::create('role_has_permissions', function (Blueprint $table): void {
                $table->foreignId('permission_id')->constrained('permissions')->cascadeOnDelete();
                $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
                $table->primary(['permission_id', 'role_id']);
            });
        }

        if (Schema::hasTable('role_user')) {
            DB::table('role_user')
                ->orderBy('user_id')
                ->orderBy('role_id')
                ->chunk(1000, function ($assignments): void {
                    foreach ($assignments as $assignment) {
                        DB::table('model_has_roles')->insertOrIgnore([
                            'role_id' => $assignment->role_id,
                            'model_type' => 'App\\Models\\User',
                            'model_id' => $assignment->user_id,
                        ]);
                    }
                });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('role_has_permissions');
        Schema::dropIfExists('model_has_roles');
        Schema::dropIfExists('model_has_permissions');
        if (Schema::hasTable('permissions') && ! Schema::hasColumn('permissions', 'code')) {
            Schema::drop('permissions');
        }

        Schema::table('roles', function (Blueprint $table): void {
            $table->dropUnique(['name', 'guard_name']);
            $table->dropColumn('guard_name');
        });
    }
};

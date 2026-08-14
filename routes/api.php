<?php

use App\Http\Controllers\Api\V1\AttachmentController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BrandController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\ClientController;
use App\Http\Controllers\Api\V1\ClientPortalController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\InvoiceController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\RepairController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\TechnicianController;
use App\Http\Controllers\Api\V1\TicketController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\WarrantyController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class)->name('api.health');

Route::prefix('auth')->group(function (): void {
    Route::post('/login', [AuthController::class, 'login'])->middleware(['guest', 'throttle:login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware(['guest', 'throttle:password-reset']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware(['guest', 'throttle:password-reset']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/password', [AuthController::class, 'changePassword']);
    });
});

Route::middleware('auth:sanctum')->group(function (): void {
    Route::prefix('client')->name('client.')->group(function (): void {
        Route::get('/profile', [ClientPortalController::class, 'profile'])->name('profile');
        Route::get('/products', [ClientPortalController::class, 'products'])->name('products.index');
        Route::get('/products/{warranty}', [ClientPortalController::class, 'product'])->name('products.show');
        Route::get('/warranties/{warranty}', [ClientPortalController::class, 'product'])->name('warranties.show');
        Route::get('/tickets', [ClientPortalController::class, 'tickets'])->name('tickets.index');
        Route::post('/tickets', [ClientPortalController::class, 'storeTicket'])->name('tickets.store');
        Route::get('/tickets/{ticket}', [ClientPortalController::class, 'ticket'])->name('tickets.show');
        Route::get('/tickets/{ticket}/attachments', [AttachmentController::class, 'clientTicketIndex'])->name('tickets.attachments.index');
        Route::post('/tickets/{ticket}/attachments', [AttachmentController::class, 'clientTicketStore'])
            ->middleware('throttle:attachment-upload')
            ->name('tickets.attachments.store');
    });

    Route::get('/dashboard', [DashboardController::class, 'show']);
    Route::get('/reports/exports/{export}', [ReportController::class, 'exportStatus']);
    Route::get('/reports/exports/{export}/download', [ReportController::class, 'download'])->name('reports.exports.download');
    Route::get('/reports/{type}', [ReportController::class, 'index']);
    Route::post('/reports/{type}/exports', [ReportController::class, 'export'])->middleware('throttle:report-export');
    Route::get('/audit-logs', [AuditLogController::class, 'index']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllAsRead']);
    Route::get('/attachments/{attachment}/preview', [AttachmentController::class, 'preview'])->name('attachments.preview');
    Route::get('/attachments/{attachment}/download', [AttachmentController::class, 'download'])->name('attachments.download');
    Route::delete('/attachments/{attachment}', [AttachmentController::class, 'destroy']);
    Route::get('/tickets/{ticket}/attachments', [AttachmentController::class, 'ticketIndex']);
    Route::get('/products/{product}/attachments', [AttachmentController::class, 'productIndex']);
    Route::get('/repairs/{repair}/attachments', [AttachmentController::class, 'repairIndex']);
    Route::middleware('throttle:attachment-upload')->group(function (): void {
        Route::post('/tickets/{ticket}/attachments', [AttachmentController::class, 'ticketStore']);
        Route::post('/products/{product}/attachments', [AttachmentController::class, 'productStore']);
        Route::post('/repairs/{repair}/attachments', [AttachmentController::class, 'repairStore']);
    });
    Route::apiResource('categories', CategoryController::class);
    Route::apiResource('brands', BrandController::class);
    Route::apiResource('products', ProductController::class);
    Route::get('/warranties/lookup', [WarrantyController::class, 'lookup']);
    Route::get('/warranties/{warranty}/eligibility', [WarrantyController::class, 'eligibility']);
    Route::apiResource('warranties', WarrantyController::class)->only(['index', 'show', 'update']);
    Route::get('/clients/{client}/profile', [ClientController::class, 'profile']);
    Route::get('/clients/{client}/invoices', [InvoiceController::class, 'clientHistory']);
    Route::get('/clients/{client}/warranties', [WarrantyController::class, 'clientWarranties']);
    Route::post('/tickets/{ticket}/assign', [TicketController::class, 'assign']);
    Route::post('/tickets/{ticket}/priority', [TicketController::class, 'changePriority']);
    Route::post('/tickets/{ticket}/transition', [TicketController::class, 'transition']);
    Route::post('/tickets/{ticket}/cancel', [TicketController::class, 'cancel']);
    Route::get('/repairs/my-tickets', [RepairController::class, 'myTickets']);
    Route::post('/tickets/{ticket}/repair/diagnosis', [RepairController::class, 'startDiagnosis']);
    Route::post('/repairs/{repair}/diagnosis', [RepairController::class, 'diagnose']);
    Route::post('/repairs/{repair}/start', [RepairController::class, 'start']);
    Route::post('/repairs/{repair}/complete', [RepairController::class, 'complete']);
    Route::apiResource('repairs', RepairController::class)->only(['index', 'show', 'update']);
    Route::apiResource('tickets', TicketController::class)->only(['index', 'store', 'show', 'update']);
    Route::apiResource('clients', ClientController::class);
    Route::apiResource('invoices', InvoiceController::class)->except(['destroy']);
    Route::get('/users/roles', [UserController::class, 'roles']);
    Route::apiResource('users', UserController::class);
    Route::apiResource('technicians', TechnicianController::class);
});

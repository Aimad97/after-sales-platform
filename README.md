# ServiceDesk — SAV & Warranty Management

ServiceDesk is a Laravel 12 and React/TypeScript platform for managing after-sales support, warranties, repairs, customer communication, traceability, and secure files. The implemented modules are documented below; each API action is protected by server-side authorization.

## Stack

- PHP 8.3+, Laravel 12, MySQL 8, Sanctum, Reverb, Redis queues
- React, TypeScript, Vite, Tailwind CSS, shadcn/ui-compatible setup
- React Router, TanStack Query, Axios, React Hook Form, Zod, ApexCharts, Laravel Echo

## Prerequisites

- PHP 8.3+ with MySQL and Redis extensions
- Composer 2, Node.js 20+, MySQL 8+, Redis

## Setup

```bash
cd plateforme_SAV
copy .env.example .env
php artisan key:generate
composer install
npm install
```

Create a MySQL database named `plateforme_sav`, then update `DB_*`, Redis, Reverb, CORS, `VITE_*`, and (if required) `INVOICE_DEFAULT_TAX_RATE` values in `.env`. The included defaults target a Laravel API at `http://localhost:8000`, a Vite client at `http://localhost:5173`, and Reverb at `localhost:8080`.

For uploads, set PHP's `upload_max_filesize` and `post_max_size` above `ATTACHMENTS_MAX_SIZE_KB` (plus request overhead), then restart PHP/FPM or Apache. The application enforces its own lower configurable limit as well.

```bash
php artisan migrate
npm run build
```

For local development, run these processes in separate terminals:

```bash
php artisan serve
php artisan queue:work --queue=reports,mail,default
php artisan schedule:work
php artisan reverb:start
npm run dev
```

## Verification

```bash
php artisan test
vendor/bin/pint --test
npm run test:frontend
npm run build
```

`GET /api/health` returns the API status without authentication.

## Real-time updates

Real-time delivery uses Laravel Reverb with the `reverb` broadcast connection and queued broadcast events. Set matching server and Vite values in `.env`; `BROADCAST_CONNECTION` must be `reverb` (not `log` or `null`), and `VITE_REVERB_APP_KEY` must match `REVERB_APP_KEY`.

```dotenv
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=servicedesk-local
REVERB_APP_KEY=servicedesk-local-key
REVERB_APP_SECRET=change-this-local-secret
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SCHEME=http
VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"
```

Run `php artisan reverb:start` and a queue worker that includes `reports`, `mail`, and `default` (for example, `php artisan queue:work --queue=reports,mail,default`). The `composer dev` command now starts Reverb as well. Laravel Echo authorizes `private-user.{userId}` and `private-ticket.{ticketId}` through `POST /api/broadcasting/auth` with Sanctum. Reconnection is automatic; on reconnect the SPA refreshes active ticket, repair, notification, and future dashboard queries without reloading the page.

Ticket, technician assignment, repair, and notification broadcasts are private. Staff ticket access uses the staff policy while linked client-role users may authorize only channels for tickets owned by their client profile. Client-facing broadcast payloads contain no internal notes, costs, actor details, or staff-only history.

## Roles and permissions

RBAC uses `spatie/laravel-permission` with the `web` guard used by Sanctum's stateful SPA requests. The roles are `super_admin`, `admin`, `sav_agent`, `technician`, and `client`. Permissions cover users, clients, products, tickets, repairs, warranties, reports, and dashboards.

Apply the migration and seed the role matrix after deployment:

```bash
php artisan migrate
php artisan db:seed --class=RolesAndPermissionsSeeder
```

To create the initial super administrator, set a strong password in your local environment and run its explicit seeder. A password is never committed to the repository.

```powershell
$env:SUPER_ADMIN_PASSWORD = 'use-a-long-unique-password'
php artisan db:seed --class=SuperAdminSeeder
```

The seeder defaults to `superadmin@servicedesk.test`; override `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_FIRST_NAME`, and `SUPER_ADMIN_LAST_NAME` when needed. Backend routes must use Laravel policies or the `permission`, `role`, or `role_or_permission` middleware aliases. Hiding controls in the React UI is only a usability measure and is not authorization.

## Users and technicians

Users are exposed by public UUID and support server-side search, filtering, sorting, pagination, status changes, and soft deletion. Technician profiles are one-to-one with a user, require the `technician` role, and track an employee code, specialization, skill level (1–5), and availability (`available`, `busy`, `unavailable`, or `leave`).

The authenticated management API provides:

- `GET, POST /api/users`, `GET, PATCH, DELETE /api/users/{uuid}`, and `GET /api/users/roles`
- `GET, POST /api/technicians` and `GET, PATCH, DELETE /api/technicians/{id}`

Only a `super_admin` can assign or manage `admin` and `super_admin` accounts. The restriction is enforced in the server-side service layer as well as hidden in the UI.

## Clients

Clients reuse the existing `customers` and `customer_products` records, preserving current foreign keys from purchases and SAV tickets. Each client now has a public UUID, individual/company type, optional company tax identifier, notes, server-side search/filter/sort/pagination, and soft-delete archiving.

The authenticated management API provides:

- `GET, POST /api/clients`
- `GET, PATCH, DELETE /api/clients/{uuid}`
- `GET /api/clients/{uuid}/profile`

The profile endpoint aggregates the client's identity and contact details, purchased products, active and expired warranty coverage, SAV ticket history, and recorded interventions. Access is enforced by the existing `clients.view`, `clients.create`, `clients.update`, and `clients.delete` permissions.

## Product catalog

Categories, brands, and products are protected by the existing `products.view`, `products.create`, `products.update`, and `products.delete` permissions. Catalog records support server-side search, filters, sorting, pagination, unique slugs, and active/inactive status. Products use public UUIDs and have a unique SKU, category, brand, default warranty duration, and serial-number requirement.

The authenticated management API provides:

- `GET, POST /api/categories` and `GET, PATCH, DELETE /api/categories/{id}`
- `GET, POST /api/brands` and `GET, PATCH, DELETE /api/brands/{id}`
- `GET, POST /api/products` and `GET, PATCH, DELETE /api/products/{uuid}`

Existing purchase/warranty records retain their product foreign keys. A category or brand cannot be deleted while products reference it, and a product cannot be deleted while purchase or warranty records reference it. `logo_path` is catalog metadata; asset upload/storage is intentionally handled by the future files module.

## Invoices and sold products

Invoices are protected by the `invoices.view`, `invoices.create`, and `invoices.update` permissions. Super administrators, administrators, and SAV agents receive these permissions through the standard role seeder. Invoice numbers and non-null serial numbers are unique. The API calculates line totals, subtotal, tax, and final total on the server; client-supplied total fields are ignored.

The authenticated management API provides:

- `GET, POST /api/invoices`
- `GET, PATCH /api/invoices/{id}`
- `GET /api/clients/{uuid}/invoices`

Each invoice item creates a linked entry in the existing `customer_products` ledger, associating the sold product with its client and warranty coverage. Creation and draft edits run inside a database transaction. Drafts may be edited; issued and void invoices remain immutable through this API.

## Warranty management

The established `customer_products` purchase ledger is also the warranty store, preserving ticket and invoice foreign keys while exposing warranties through public UUIDs. New invoice quantities create individual warranty records. A warranty has server-evaluated `active`, `expired`, `void`, or `replaced` status; expiration is based on the current date, and voiding requires a reason.

The authenticated staff API provides:

- `GET /api/warranties` with serial/client/product/status filters and pagination
- `GET /api/warranties/lookup?serial_number={serial}`
- `GET /api/warranties/{uuid}` and `GET /api/warranties/{uuid}/eligibility`
- `PATCH /api/warranties/{uuid}` for `warranties.manage` users
- `GET /api/clients/{uuid}/warranties`

`WarrantyEligibilityService` returns whether coverage applies, an explanatory reason, coverage dates, and remaining days. Client-role users cannot browse the global warranty API; the client portal exposes only purchase and warranty records owned by the authenticated user's linked client profile.

## SAV tickets

Tickets have a public UUID and a human-readable `TKT-YYYYMMDD-XXXXXX` number. They capture client, product, optional warranty and invoice-item context, intake source, priority, warranty eligibility snapshot, assigned technician profile, and a full immutable status timeline. Ticket creation and every transition are transactional.

The authenticated staff API provides:

- `GET, POST /api/tickets`
- `GET, PATCH /api/tickets/{uuid}`
- `POST /api/tickets/{uuid}/assign`
- `POST /api/tickets/{uuid}/priority`
- `POST /api/tickets/{uuid}/transition`
- `POST /api/tickets/{uuid}/cancel`

`TicketWorkflowService` is the sole authority for state changes. It permits the repair path from `opened` through `closed`, plus cancellation before a terminal state; direct status and priority updates are rejected. Each transition writes a `ticket_status_histories` record with the actor, timestamp, source state, target state, and optional note. Client-role users remain blocked from the global ticket API and use sanitized portal endpoints scoped to their linked client profile.

## Secure attachments

Attachments are polymorphic records for tickets, products, and repairs. File metadata is audited, and ticket/repair file changes also create business-visible ticket-history entries. Files use randomized UUID filenames and are stored on a dedicated private disk; the database never exposes a raw storage path.

The default disk is `attachments`, rooted at `storage/app/private/attachments`. Do not set `ATTACHMENTS_DISK` to `public`. For S3, install dependencies with Composer (already included in this project), set `ATTACHMENTS_DISK=attachments_s3`, configure `ATTACHMENTS_AWS_BUCKET`, and keep the bucket private—access should be granted only to the application's credentials, not through a public bucket policy.

The maximum upload size is set by `ATTACHMENTS_MAX_SIZE_KB` (10 MB by default). Allowed files are JPEG, PNG, WebP, PDF, TXT, CSV, DOC/DOCX, and XLS/XLSX. Both the original extension and server-detected MIME type are checked; executable files are rejected. Uploads are rate-limited per authenticated user and IP address.

The authenticated API provides:

- `GET, POST /api/tickets/{uuid}/attachments`
- `GET, POST /api/products/{uuid}/attachments`
- `GET, POST /api/repairs/{id}/attachments`
- `GET /api/attachments/{uuid}/preview` for authorized image previews
- `GET /api/attachments/{uuid}/download`
- `DELETE /api/attachments/{uuid}`

Every collection, upload, preview, download, and deletion action delegates to the owning ticket, product, or repair policy. The React `AttachmentPanel` provides drag-and-drop uploads with per-file progress, image previews, downloads, and confirmed deletion; it is mounted on ticket and product details and can be reused by the repair workspace.

The historical `ticket_attachments` table is retained non-destructively. The attachment migration backfills its metadata into the polymorphic table using `ATTACHMENTS_LEGACY_DISK` (default `local`); verify that disk setting before migrating a deployment with historical files.

## Notifications

Ticket creation, technician assignment, ticket status transitions, diagnosis completion, repair completion, customer-approval requests, and ready-for-pickup status emit reusable notifications. Authenticated operational users and active client accounts linked to the ticket's client receive database notifications for the SPA bell and inbox; email is queued on `NOTIFICATIONS_MAIL_QUEUE` so mail delivery never happens in the HTTP request. The client email remains a fallback when no linked portal account uses that address.

The authenticated API provides:

- `GET /api/notifications?unread=true&per_page=20`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/{id}/read`
- `POST /api/notifications/mark-all-read`

To enable warranty-expiration reminders, set `NOTIFY_WARRANTY_EXPIRATION=true` and configure `WARRANTY_EXPIRATION_NOTICE_DAYS` (default `30`). `php artisan notifications:send-warranty-expiration` is scheduled daily at `WARRANTY_EXPIRATION_NOTICE_SCHEDULE`; run a queue worker and Laravel scheduler in production. The expiration log makes each warranty/day reminder idempotent.

## Client portal

Client portal accounts use the exclusive `client` role and must have `users.client_id` linked to a non-archived client record. Administrators create or update that link in user management. The React workspace at `/client` provides the client's profile, purchased products and warranty status, SAV request submission and history, private customer attachments, real-time progress, notifications, and customer-safe repair outcomes.

The authenticated portal API provides:

- `GET /api/client/profile`
- `GET /api/client/products` and `GET /api/client/products/{warrantyUuid}`
- `GET /api/client/warranties/{warrantyUuid}`
- `GET, POST /api/client/tickets` and `GET /api/client/tickets/{ticketUuid}`
- `GET, POST /api/client/tickets/{ticketUuid}/attachments`

Every list query starts from the authenticated user's linked client record. Object endpoints additionally enforce portal-specific policy abilities and return `404` for foreign records. Portal resources omit client administration notes, status-transition notes and actors, ticket audit history, repair history, technician internal notes, root-cause analysis, and repair costs. Client downloads are limited to ticket files uploaded by accounts linked to that same client; staff-only ticket attachments are not exposed.

## Reports and exports

Administrators can view database-aggregated reports for tickets, repairs, warranties, technician performance, defective products, and client SAV history. Each report accepts date, technician, ticket status/priority, catalog, product, warranty state, and client filters where relevant. The API provides:

- `GET /api/reports/{tickets|repairs|warranties|technician_performance|defective_products|client_history}`
- `POST /api/reports/{type}/exports` with `{ "format": "csv", ...filters }`
- `GET /api/reports/exports/{uuid}` and `GET /api/reports/exports/{uuid}/download`

CSV exports are intentionally queued on the `reports` queue, so export generation never holds an HTTP request open. The current dependency set does not include a compatible Excel or PDF renderer, so only CSV is exposed. Files are stored on the private `report_exports` disk and can only be downloaded through the authorized API. Set `REPORT_EXPORT_DISK`, `REPORT_EXPORT_QUEUE`, and `REPORT_EXPORT_EXPIRATION_DAYS` to configure the deployment; do not point the export disk at `public`. The scheduler runs `reports:prune-expired` daily to remove expired private files and export metadata.

## Project organization

Laravel domain extensions live under `app/Domain`, `Services`, `Repositories`, `Events`, `Listeners`, `Notifications`, `Policies`, and `Enums`; HTTP API code is versioned under `app/Http/Controllers/Api/V1`.

The React application is under `resources/js`. It includes the API client, realtime service, base layouts, and router foundation. Future modules should use `features/`, with shared code in `components/`, `hooks/`, `schemas/`, `stores/`, `types/`, and `utils/`.

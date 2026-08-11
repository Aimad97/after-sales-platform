# ServiceDesk — SAV & Warranty Management

ServiceDesk is a Laravel 12 and React/TypeScript platform for managing after-sales support, warranties, repairs, and customer communication. Stages 1 through 9 provide the project foundation, Sanctum SPA authentication, server-enforced RBAC, user/technician management, client management, product catalog management, invoice-backed sold-product tracking, warranty lifecycle management, and SAV ticket workflow.

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

```bash
php artisan migrate
npm run build
```

For local development, run these processes in separate terminals:

```bash
php artisan serve
php artisan queue:work redis
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

`WarrantyEligibilityService` returns whether coverage applies, an explanatory reason, coverage dates, and remaining days. Users with only the client role cannot browse global warranty records because the application has no client-user ownership mapping yet.

## SAV tickets

Tickets have a public UUID and a human-readable `TKT-YYYYMMDD-XXXXXX` number. They capture client, product, optional warranty and invoice-item context, intake source, priority, warranty eligibility snapshot, assigned technician profile, and a full immutable status timeline. Ticket creation and every transition are transactional.

The authenticated staff API provides:

- `GET, POST /api/tickets`
- `GET, PATCH /api/tickets/{uuid}`
- `POST /api/tickets/{uuid}/assign`
- `POST /api/tickets/{uuid}/priority`
- `POST /api/tickets/{uuid}/transition`
- `POST /api/tickets/{uuid}/cancel`

`TicketWorkflowService` is the sole authority for state changes. It permits the repair path from `opened` through `closed`, plus cancellation before a terminal state; direct status and priority updates are rejected. Each transition writes a `ticket_status_histories` record with the actor, timestamp, source state, target state, and optional note. Client-role users cannot access the global ticket API until a client-user ownership mapping exists; this prevents cross-client data exposure.

## Project organization

Laravel domain extensions live under `app/Domain`, `Services`, `Repositories`, `Events`, `Listeners`, `Notifications`, `Policies`, and `Enums`; HTTP API code is versioned under `app/Http/Controllers/Api/V1`.

The React application is under `resources/js`. It includes the API client, realtime service, base layouts, and router foundation. Future modules should use `features/`, with shared code in `components/`, `hooks/`, `schemas/`, `stores/`, `types/`, and `utils/`.

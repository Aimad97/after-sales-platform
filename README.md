# ServiceDesk — SAV & Warranty Management

ServiceDesk is a Laravel 12 and React/TypeScript platform for managing after-sales support, warranties, repairs, and customer communication. Stages 1 through 5 provide the project foundation, Sanctum SPA authentication, server-enforced RBAC, user/technician management, and client management.

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

Create a MySQL database named `plateforme_sav`, then update `DB_*`, Redis, Reverb, CORS, and `VITE_*` values in `.env`. The included defaults target a Laravel API at `http://localhost:8000`, a Vite client at `http://localhost:5173`, and Reverb at `localhost:8080`.

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

## Project organization

Laravel domain extensions live under `app/Domain`, `Services`, `Repositories`, `Events`, `Listeners`, `Notifications`, `Policies`, and `Enums`; HTTP API code is versioned under `app/Http/Controllers/Api/V1`.

The React application is under `resources/js`. It includes the API client, realtime service, base layouts, and router foundation. Future modules should use `features/`, with shared code in `components/`, `hooks/`, `schemas/`, `stores/`, `types/`, and `utils/`.

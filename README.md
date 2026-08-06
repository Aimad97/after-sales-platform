# ServiceDesk — SAV & Warranty Management

ServiceDesk is a Laravel 12 and React/TypeScript platform for managing after-sales support, warranties, repairs, and customer communication. Stage 1 provides the technical foundation only; business modules are intentionally not implemented yet.

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
npm run build
```

`GET /api/health` returns the API status without authentication.

## Project organization

Laravel domain extensions live under `app/Domain`, `Services`, `Repositories`, `Events`, `Listeners`, `Notifications`, `Policies`, and `Enums`; HTTP API code is versioned under `app/Http/Controllers/Api/V1`.

The React application is under `resources/js`. It includes the API client, realtime service, base layouts, and router foundation. Future modules should use `features/`, with shared code in `components/`, `hooks/`, `schemas/`, `stores/`, `types/`, and `utils/`.

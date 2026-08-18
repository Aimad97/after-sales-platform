# Application performance

This document records the Stage 26 performance profile, the changes made from that evidence, and the operational settings that affect performance.

## Profiling method

The backend profile used Laravel's `DB::listen()` around representative API/service calls on the test database. Query-count regression tests live in `tests/Feature/Performance/QueryPerformanceTest.php`. Query builders, API resources, eager-loading graphs, pagination, cache invalidation, queued work, and database migrations were also reviewed statically.

The frontend baseline and final measurements came from `npm run build` using Vite 7.3.6. API hooks, TanStack Query keys, debounce behavior, polling, React render paths, and static imports were reviewed before changing the bundle graph.

## Baseline findings

| Area                      |                     Baseline | Finding                                                                                         |
| ------------------------- | ---------------------------: | ----------------------------------------------------------------------------------------------- |
| Users API, 1 record       |                    9 queries | Fixed request overhead plus resource serialization.                                             |
| Users API, 15 records     |                   20 queries | `UserResource::getAllPermissions()` lazily queried direct permissions once per serialized user. |
| Uncached admin dashboard  |                   15 queries | Five separate ticket queries populated five KPI cards.                                          |
| Frontend entry JavaScript | 1,574.20 kB / 446.36 kB gzip | Every page and ApexCharts loaded in one initial bundle.                                         |
| Frontend CSS              |     63.98 kB / 12.68 kB gzip | No material issue.                                                                              |

The profile also confirmed several existing good practices:

- All primary collection endpoints are paginated with validated upper bounds.
- Ticket, warranty, invoice, repair, product, technician, and portal queries already eager-load the relationships used by their API resources.
- Dashboard data already has a short versioned cache, invalidated by domain-model observers.
- Global search is prefix-based, authorization-aware, limited, and debounced on the frontend.
- TanStack Query already deduplicates requests and uses a 30-second default stale time with window-focus refetching disabled.
- Report exports and notification email delivery already use queues.
- Notification details are requested only when the popover opens; unread polling is bounded to 30 seconds and realtime invalidation remains available.

## Backend improvements

### Removed the users endpoint N+1

`UserManagementService` now eager-loads direct `permissions` together with `roles.permissions`, `technician`, and `client`. The 15-user profile changes from 15 individual direct-permission queries to one eager-load query. The regression test ensures page size no longer causes query-count growth.

### Consolidated dashboard ticket KPIs

The admin dashboard now calculates open, created-today, resolved-today, urgent, and average-resolution metrics with conditional aggregates in one query. This removes four database round trips and reduces the uncached dashboard profile from 15 queries to at most the enforced 12-query budget (11 with the profiled fixture). The existing 60-second cache and observer-driven invalidation remain unchanged.

### Reduced global-search row width

Global search now selects only the columns required to build categorized results, including constrained selects on related clients, products, brands, and users. Result limits, authorization, URLs, and response shape are unchanged.

### Added operational indexes

Migration `2026_08_21_000000_add_operational_query_indexes.php` adds:

| Table           | Index                                          | Query pattern                                                |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| `tickets`       | `(deleted_at, received_at, id)`                | Default active-ticket pagination and stable ordering.        |
| `tickets`       | `(status, closed_at)`                          | Status grouping/filtering and resolved-date metrics/reports. |
| `tickets`       | `(priority, status)`                           | Urgent/open-ticket filters.                                  |
| `tickets`       | `(created_at)`                                 | Intake trend and date-filtered reporting.                    |
| `notifications` | `(notifiable_type, notifiable_id, created_at)` | Current-user notification history ordered by newest.         |

Existing indexes for client/status, technician/status, product/status, warranties, invoices, global search, repairs, audit logs, and unread notifications were retained; duplicate indexes were not added.

## Frontend improvements

All route page modules now use `React.lazy` behind a shared `Suspense` loading state. A user downloads the application shell and only the feature modules required by the visited route. ApexCharts is dynamically loaded behind a chart-specific loading boundary, so client dashboards and routes without charts do not download the chart renderer.

Final production build:

| Asset                 |            Before |                      After |                           Change |
| --------------------- | ----------------: | -------------------------: | -------------------------------: |
| Entry JavaScript      |       1,574.20 kB |                  423.88 kB |                    73.1% smaller |
| Entry JavaScript gzip |         446.36 kB |                  133.56 kB |                    70.1% smaller |
| Dashboard page module | Included in entry |    12.37 kB / 3.45 kB gzip |                 Loaded on demand |
| Feature page chunks   | Included in entry |         3.83–23.18 kB each |               Loaded per feature |
| ApexCharts renderer   | Included in entry | 863.37 kB / 249.00 kB gzip | Loaded only when a chart renders |

The ApexCharts chunk remains large because it contains the selected charting library, but it is no longer on the initial or client-dashboard path. Replacing the mandated chart library or introducing fragile vendor-specific chunking was not justified by the profile.

No broad `React.memo` or callback memoization was added. The reviewed lists are paginated, the notification preview is small, global-search derivations already use `useMemo`, and additional memoization would add complexity without demonstrated render cost.

## Cache and queue operation

- Configure `DASHBOARD_CACHE_TTL_SECONDS` (default `60`). Set it to `0` only for debugging or profiling.
- Use Redis for production cache and queue connections.
- Run workers for the configured `reports`, `mail`, and `default` queues. Report exports and email delivery should not execute synchronously in production.
- After deployment, warm Laravel's configuration/routes/views as appropriate for the environment (`php artisan optimize`). Do not cache configuration before deployment environment variables are final.

## Verification

```powershell
C:\php83\php.exe artisan test
npm run typecheck
npm run lint
npm run test
npm run build
```

The final verification passed 123 backend tests (1,049 assertions), 27 frontend tests, TypeScript strict checking, ESLint, Pint, and the Vite production build.

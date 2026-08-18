# REST API reference

This guide documents the API implemented in `routes/api.php`. The machine-readable contract is [OpenAPI 3.0](./openapi.yaml). The API is mounted at `/api`; examples below assume `http://127.0.0.1:8000`.

## Authentication, CSRF, and response conventions

The application uses Laravel Sanctum's stateful cookie authentication. A browser client must first request `GET /sanctum/csrf-cookie` with credentials enabled, then send the `X-XSRF-TOKEN` header and cookies on state-changing requests. Login creates the session; it does not return an API bearer token.

Protected endpoints use `auth:sanctum` and are limited to 180 requests per minute per user and IP. Login is limited to 5 attempts per email/IP and 20 per IP per minute. Password-reset endpoints allow 3 per email/IP and 10 per IP per minute. Search allows 60, attachment uploads 30, and report exports 10 requests per minute per user/IP.

Single resources use Laravel's `{ "data": ... }` envelope. Collections are paginated and include `data`, `links`, and `meta`. Validation failures return HTTP 422:

```json
{
    "message": "The given data was invalid.",
    "errors": { "field": ["Validation message."] }
}
```

Other standard errors are 401 `Unauthenticated.`, 403 `This action is unauthorized.`, 404 `Resource not found.`, 419 `Page expired.`, 429 `Too many requests.`, and 500 `Server error.` Client-portal ownership failures deliberately return 404, which prevents resource enumeration.

Identifiers named `{user}`, `{client}`, `{product}`, `{ticket}`, `{warranty}`, `{attachment}`, `{export}`, and `{notification}` are UUIDs. Category, brand, invoice, technician, and repair identifiers are integer IDs. Dates use `YYYY-MM-DD`; timestamps use ISO 8601. Money is returned as two-decimal strings.

## Permission model

The tables below name the effective policy requirement. `Client owner` means the authenticated user must have client-portal access and the resource must belong to that user's linked client. `Assigned technician` means the repair is assigned to the current user's technician record; admins and super admins have the policy override implemented by the application. Notification operations are always scoped to the current user.

## Auth

| Method | Endpoint                    | Authentication | Permission/scope   | Contract                                                                                               |
| ------ | --------------------------- | -------------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| `POST` | `/api/auth/login`           | Guest + CSRF   | None               | Email and password required; optional boolean `remember`; returns the user. Invalid credentials: 422.  |
| `POST` | `/api/auth/forgot-password` | Guest + CSRF   | None               | Required RFC email, max 255; always returns a generic success message.                                 |
| `POST` | `/api/auth/reset-password`  | Guest + CSRF   | None               | Required token, email, password and matching `password_confirmation`; Laravel password defaults apply. |
| `POST` | `/api/auth/logout`          | Sanctum        | Authenticated user | Invalidates the session and regenerates the CSRF token.                                                |
| `GET`  | `/api/auth/me`              | Sanctum        | Authenticated user | Returns the current user, roles, permissions, and optional client/technician links.                    |
| `PUT`  | `/api/auth/password`        | Sanctum + CSRF | Authenticated user | Requires `current_password`, password, and matching confirmation.                                      |

## Users

| Method      | Endpoint            | Permission     | Contract                                                                                                                                    |
| ----------- | ------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`       | `/api/users/roles`  | `users.view`   | Returns available roles.                                                                                                                    |
| `GET`       | `/api/users`        | `users.view`   | Filters: `search`, `status`, `role`, `technician`, `sort`, `direction`, `per_page` (1–100).                                                 |
| `POST`      | `/api/users`        | `users.create` | Creates a user. Required name, email, status, locale, timezone, password confirmation, and at least one valid role. Optional linked client. |
| `GET`       | `/api/users/{user}` | `users.view`   | Returns one user.                                                                                                                           |
| `PUT/PATCH` | `/api/users/{user}` | `users.update` | Partial user update; unique email and valid roles enforced. Password is optional but must be confirmed when present.                        |
| `DELETE`    | `/api/users/{user}` | `users.delete` | Soft-deletes the user; returns a message.                                                                                                   |

### Technicians

| Method      | Endpoint                        | Permission     | Contract                                                                                                         |
| ----------- | ------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET`       | `/api/technicians`              | `users.view`   | Filters: search, availability, skill 1–5, sort, direction, pagination.                                           |
| `POST`      | `/api/technicians`              | `users.create` | Required user ID, unique ASCII alpha-dash employee code, skill 1–5, availability; optional specialization/notes. |
| `GET`       | `/api/technicians/{technician}` | `users.view`   | Returns one technician.                                                                                          |
| `PUT/PATCH` | `/api/technicians/{technician}` | `users.update` | Updates technician metadata; employee code remains unique.                                                       |
| `DELETE`    | `/api/technicians/{technician}` | `users.delete` | Soft-deletes the technician.                                                                                     |

## Clients

| Method      | Endpoint                        | Permission       | Contract                                                                                                                |
| ----------- | ------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GET`       | `/api/clients`                  | `clients.view`   | Filters: search, type, sort, direction, pagination.                                                                     |
| `POST`      | `/api/clients`                  | `clients.create` | Creates an individual/company. Company name and unique tax ID are required for companies; names and phone are required. |
| `GET`       | `/api/clients/{client}`         | `clients.view`   | Returns one client.                                                                                                     |
| `PUT/PATCH` | `/api/clients/{client}`         | `clients.update` | Partial update with conditional company validation.                                                                     |
| `DELETE`    | `/api/clients/{client}`         | `clients.delete` | Soft-deletes the client.                                                                                                |
| `GET`       | `/api/clients/{client}/profile` | `clients.view`   | Returns client details with summary/profile data.                                                                       |
| `GET`       | `/api/client/profile`           | Client owner     | Returns only the authenticated client's portal-safe profile.                                                            |

## Products

Categories and brands use integer IDs. Products use UUID route identifiers.

| Method                 | Endpoint                          | Permission                                              | Contract                                                                                        |
| ---------------------- | --------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET/POST`             | `/api/categories`                 | `products.view` / `products.create`                     | List or create categories. Name is required/unique; optional slug, description, active flag.    |
| `GET/PUT/PATCH/DELETE` | `/api/categories/{category}`      | `products.view` / `products.update` / `products.delete` | Read, update, or delete a category.                                                             |
| `GET/POST`             | `/api/brands`                     | `products.view` / `products.create`                     | List or create brands. Name is required/unique; optional slug, logo path, active flag.          |
| `GET/PUT/PATCH/DELETE` | `/api/brands/{brand}`             | `products.view` / `products.update` / `products.delete` | Read, update, or delete a brand.                                                                |
| `GET`                  | `/api/products`                   | `products.view`                                         | Filters: search, category/brand ID, active, sort, direction, pagination.                        |
| `POST`                 | `/api/products`                   | `products.create`                                       | Required unique SKU, name, category, brand, model, warranty months (0–120), serial-number flag. |
| `GET`                  | `/api/products/{product}`         | `products.view`                                         | Returns one product.                                                                            |
| `PUT/PATCH`            | `/api/products/{product}`         | `products.update`                                       | Partial update; SKU remains unique.                                                             |
| `DELETE`               | `/api/products/{product}`         | `products.delete`                                       | Deletes the product when business constraints allow it.                                         |
| `GET`                  | `/api/client/products`            | Client owner                                            | Purchased-product filters: search, warranty status, page, `per_page` 1–50.                      |
| `GET`                  | `/api/client/products/{warranty}` | Client owner                                            | Returns one purchased product/warranty; another client's UUID returns 404.                      |

## Invoices

Invoice totals and warranty dates are calculated by the server. Clients must not send or rely on `subtotal_amount`, `tax_amount`, `total_amount`, `line_subtotal`, or `warranty_end_date`.

| Method      | Endpoint                         | Permission                       | Contract                                                                                                                              |
| ----------- | -------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`       | `/api/invoices`                  | `invoices.view`                  | Filters: search, client, status, date range, sort, direction, pagination.                                                             |
| `POST`      | `/api/invoices`                  | `invoices.create`                | Complete document required: client, date, and 1–100 item lines. Quantity 1–10,000; price 0–999,999; tax 0–100; warranty 0–120 months. |
| `GET`       | `/api/invoices/{invoice}`        | `invoices.view`                  | Returns invoice and items.                                                                                                            |
| `PUT/PATCH` | `/api/invoices/{invoice}`        | `invoices.update`                | Replaces a draft invoice as a complete document and atomically recalculates totals/purchases.                                         |
| `GET`       | `/api/clients/{client}/invoices` | `invoices.view` + `clients.view` | Paginated invoice history for the selected client.                                                                                    |

## Warranties

| Method      | Endpoint                                   | Permission                         | Contract                                                                                  |
| ----------- | ------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET`       | `/api/warranties`                          | `warranties.view`                  | Filters implemented in the OpenAPI query schema; paginated.                               |
| `GET`       | `/api/warranties/lookup?serial_number=...` | `warranties.view`                  | Serial number required, uppercased, max 100; not found: 404.                              |
| `GET`       | `/api/warranties/{warranty}`               | `warranties.view`                  | Returns a warranty/purchased product.                                                     |
| `GET`       | `/api/warranties/{warranty}/eligibility`   | `warranties.view`                  | Returns current eligibility and reason.                                                   |
| `PUT/PATCH` | `/api/warranties/{warranty}`               | `warranties.manage`                | Status: active, expired, void, replaced. `void_reason` required for void; optional notes. |
| `GET`       | `/api/clients/{client}/warranties`         | `warranties.view` + `clients.view` | Client warranty history.                                                                  |
| `GET`       | `/api/client/warranties/{warranty}`        | Client owner                       | Alias of the portal purchased-product detail.                                             |

## Tickets

| Method      | Endpoint                           | Permission       | Contract                                                                                                                                                                |
| ----------- | ---------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`       | `/api/tickets`                     | `tickets.view`   | Filters include client/product/warranty/technician/creator, priority, status, source, eligibility, received dates, sort, pagination.                                    |
| `POST`      | `/api/tickets`                     | `tickets.create` | Required client, product, title (3–255), problem (3–10,000); optional linked warranty/invoice item, priority, source. Cross-entity ownership is checked by the service. |
| `GET`       | `/api/tickets/{ticket}`            | `tickets.view`   | Returns ticket, relationships, histories, repair, and staff-authorized details.                                                                                         |
| `PUT/PATCH` | `/api/tickets/{ticket}`            | `tickets.update` | Only title, problem, and source may change. Status, priority, ownership, assignment, and product links are prohibited.                                                  |
| `POST`      | `/api/tickets/{ticket}/assign`     | `tickets.assign` | Required valid `assigned_technician_id`; creates/updates the repair assignment transactionally.                                                                         |
| `POST`      | `/api/tickets/{ticket}/priority`   | `tickets.update` | Required priority: low, normal, high, urgent.                                                                                                                           |
| `POST`      | `/api/tickets/{ticket}/transition` | `tickets.update` | Required target status and optional notes. Invalid workflow transitions return 422.                                                                                     |
| `POST`      | `/api/tickets/{ticket}/cancel`     | `tickets.close`  | Required cancellation reason, 3–5,000 characters.                                                                                                                       |
| `GET`       | `/api/client/tickets`              | Client owner     | Portal-safe ticket history; filters search/status/page, max 50 per page.                                                                                                |
| `POST`      | `/api/client/tickets`              | Client owner     | Required owned `purchased_product_uuid`, title (3–255), problem (10–10,000). Returns 201; unowned purchase is hidden as 404.                                            |
| `GET`       | `/api/client/tickets/{ticket}`     | Client owner     | Portal-safe progress/history/repair outcome; internal technician notes are never serialized.                                                                            |

## Repairs

| Method      | Endpoint                                 | Permission/scope                                               | Contract                                                                                                                |
| ----------- | ---------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GET`       | `/api/repairs`                           | `repairs.view`                                                 | Filters technician, state (`current`/`completed`), `per_page` 1–100.                                                    |
| `GET`       | `/api/repairs/{repair}`                  | Admin/super admin or assigned technician                       | Returns repair details and history.                                                                                     |
| `PUT/PATCH` | `/api/repairs/{repair}`                  | Admin/super admin or assigned technician with `repairs.update` | Updates action, internal/customer notes and costs; total is server-calculated.                                          |
| `GET`       | `/api/repairs/my-tickets`                | Authenticated technician                                       | Paginated assigned tickets.                                                                                             |
| `POST`      | `/api/tickets/{ticket}/repair/diagnosis` | Assigned technician / admin override                           | Starts diagnosis; no body.                                                                                              |
| `POST`      | `/api/repairs/{repair}/diagnosis`        | Assigned technician / admin override                           | Diagnosis required (3–10,000), optional root cause/customer notes, and next status awaiting approval/part or repairing. |
| `POST`      | `/api/repairs/{repair}/start`            | Assigned technician / admin override                           | Starts repair; no body.                                                                                                 |
| `POST`      | `/api/repairs/{repair}/complete`         | Assigned technician / admin override                           | Required result; optional customer notes. Invalid workflow state returns 422.                                           |

## Attachments

Uploads use `multipart/form-data` field `file`, maximum 10,240 KiB by default. Allowed types are JPEG, PNG, WebP, PDF, TXT, CSV, DOC/DOCX, XLS/XLSX. Files are stored privately; preview/download always re-authorize the parent resource.

| Method     | Endpoint                                   | Permission/scope                                                                                    |
| ---------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `GET`      | `/api/{tickets/{ticket}                    | products/{product}                                                                                  | repairs/{repair}}/attachments` | View permission for the parent resource.   |
| `POST`     | `/api/{tickets/{ticket}                    | products/{product}                                                                                  | repairs/{repair}}/attachments` | Update permission for the parent resource. |
| `GET`      | `/api/attachments/{attachment}/preview`    | View permission for parent; returns inline binary response.                                         |
| `GET`      | `/api/attachments/{attachment}/download`   | View permission for parent; returns download binary response.                                       |
| `DELETE`   | `/api/attachments/{attachment}`            | Update permission for parent; returns a message.                                                    |
| `GET/POST` | `/api/client/tickets/{ticket}/attachments` | Client owner; portal uploads are rejected for terminal tickets and other clients are hidden as 404. |

## Notifications

All notification queries and route binding are scoped to the authenticated user; IDs belonging to another user return 404.

| Method  | Endpoint                                 | Contract                                         |
| ------- | ---------------------------------------- | ------------------------------------------------ |
| `GET`   | `/api/notifications`                     | Filters `unread` (boolean) and `per_page` 1–100. |
| `GET`   | `/api/notifications/unread-count`        | Returns `{ "data": { "count": n } }`.            |
| `PATCH` | `/api/notifications/{notification}/read` | Marks one current-user notification read.        |
| `POST`  | `/api/notifications/mark-all-read`       | Returns the number marked read.                  |

## Dashboard

| Method | Endpoint         | Permission/scope                        | Contract                                                                          |
| ------ | ---------------- | --------------------------------------- | --------------------------------------------------------------------------------- |
| `GET`  | `/api/dashboard` | `dashboard.view`, or client-portal user | Returns a role-aware dashboard. Client metrics are isolated to the linked client. |

## Reports

Report type is one of `tickets`, `repairs`, `warranties`, `technician_performance`, `defective_products`, `client_history`.

| Method | Endpoint                                 | Permission                                            | Contract                                                                                                                         |
| ------ | ---------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/reports/{type}`                    | `reports.view`                                        | Filters date range, technician, status, priority, brand/category/product, warranty state, client, pagination. Unknown type: 404. |
| `POST` | `/api/reports/{type}/exports`            | `reports.view`                                        | Same filters plus required `format=csv`; queues export and returns 202.                                                          |
| `GET`  | `/api/reports/exports/{export}`          | `reports.view` + requester ownership (admin override) | Returns export status.                                                                                                           |
| `GET`  | `/api/reports/exports/{export}/download` | `reports.view` + requester ownership (admin override) | Downloads only completed, non-expired exports; otherwise 409/410.                                                                |

## Supplemental implemented endpoints

| Module     | Method | Endpoint                      | Authentication/permission                                       | Contract                                                                                                                     |
| ---------- | ------ | ----------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| System     | `GET`  | `/api/health`                 | Public                                                          | Service health and timestamp.                                                                                                |
| Search     | `GET`  | `/api/search?q=...&limit=...` | Sanctum; result categories filtered by the caller's permissions | Query length 2–100; category limit 1–10; returns categorized results.                                                        |
| Audit Logs | `GET`  | `/api/audit-logs`             | Admin or super admin                                            | Filters actor, action, entity type, date range, pagination. Clients and technicians cannot access administrative audit data. |

## Status values

- User: `active`, `invited`, `suspended`, `archived`.
- Warranty: `active`, `expired`, `void`, `replaced`.
- Ticket priority: `low`, `normal`, `high`, `urgent`.
- Ticket source: `store`, `phone`, `email`, `web`.
- Ticket status: `opened`, `received`, `awaiting_diagnosis`, `diagnosing`, `awaiting_customer_approval`, `awaiting_part`, `repairing`, `testing`, `repaired`, `ready_for_pickup`, `delivered`, `closed`, `cancelled`.
- Repair result: `repaired`, `partially_repaired`, `unrepairable`, `replacement_required`.
- Technician availability: `available`, `busy`, `unavailable`, `leave`.
- Report export status: `queued`, `processing`, `completed`, `failed`, `expired`.

For precise property schemas, required fields, formats, enums, success codes, and per-operation error responses, use `docs/openapi.yaml` in Swagger UI, Redoc, Stoplight, or another OpenAPI 3.0-compatible tool.

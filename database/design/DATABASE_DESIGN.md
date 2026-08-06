# ServiceDesk / SAV database design

**Engine:** MySQL 8.0.21+ / InnoDB / `utf8mb4_0900_ai_ci`. The implementation is in [servicedesk_mysql_8.sql](servicedesk_mysql_8.sql). All timestamps are UTC. Internal primary keys are `BIGINT UNSIGNED` for compact joins; externally exposed records additionally have time-sortable UUIDs stored in `BINARY(16)`.

## ER diagram

```mermaiderDiagram
  USERS ||--o{ USER_ROLES : receives
  ROLES ||--o{ USER_ROLES : assigned
  ROLES ||--o{ ROLE_PERMISSIONS : grants
  PERMISSIONS ||--o{ ROLE_PERMISSIONS : includes
  USERS ||--o| TECHNICIANS : profile
  CLIENTS ||--o{ CLIENT_ADDRESSES : has
  CLIENTS ||--o{ TICKETS : opens
  BRANDS ||--o{ PRODUCTS : makes
  CATEGORIES ||--o{ PRODUCTS : classifies
  CATEGORIES ||--o{ CATEGORIES : parent_of
  PRODUCTS ||--o{ WARRANTIES : covered_by
  CLIENTS ||--o{ WARRANTIES : owns
  TICKETS ||--o{ TICKET_PRODUCTS : concerns
  PRODUCTS ||--o{ TICKET_PRODUCTS : reported_on
  TICKETS ||--o| REPAIRS : leads_to
  TECHNICIANS ||--o{ REPAIRS : performs
  REPAIRS ||--o{ REPAIR_HISTORY : records
  CLIENTS ||--o{ INVOICES : billed
  REPAIRS ||--o| INVOICES : billed_for
  INVOICES ||--o{ INVOICE_ITEMS : contains
  USERS ||--o{ NOTIFICATIONS : receives
  FILES ||--o| FILE_ATTACHMENTS : attached_as
```

## Normalization and relationship rules

The operational model is in third normal form (3NF): entity attributes depend on their table key only; many-to-many authorization is separated into `user_roles` and `role_permissions`; repeating invoice lines, ticket products, repair events, addresses, and attachments are child relations. Product catalog data is not copied into tickets or invoices (invoice lines retain a legal description/price snapshot intentionally). `dashboard_daily_statistics` is a derived read model, not the source of truth.

`ON DELETE CASCADE` is limited to true dependents (role grants, addresses, lines, history, attachments). Business records use `SET NULL` or are retained; application-level soft deletion is used for clients, users, and tickets. No FK points to a polymorphic field: `file_attachments` has nullable explicit targets plus a one-target check.

## Table catalogue

| Table | Purpose | Core columns / datatype | Indexes | Validation rules |
|---|---|---|---|---|
| `roles` | RBAC roles | `id bigint`, `code varchar`, `name varchar`, `is_system bool` | unique `code` | lower machine code regex |
| `permissions` | Atomic RBAC capabilities | `id bigint`, `code varchar`, `description varchar` | unique `code` | machine code regex |
| `users` | Authenticated staff/accounts | `id bigint`, `public_id binary(16)`, `email varchar`, `password varchar`, names, `status enum` | unique public ID/email; status/date | valid email shape; password is a hash only |
| `user_roles` | User-to-role grant | `user_id bigint`, `role_id bigint`, `assigned_by bigint` | composite PK | unique grant; all FKs required except assigner |
| `role_permissions` | Role-to-permission grant | `role_id bigint`, `permission_id bigint` | composite PK | unique grant; both FKs required |
| `clients` | Individual/business customer | IDs, identity fields, contact, `tax_id`, `status` | unique public ID/tax ID; name/email | individual needs first/last name; business needs company |
| `client_addresses` | Customer addresses | `client_id`, address fields, ISO country, default flag | unique generated default-client key | ISO-3166 alpha-2; at most one default address per client |
| `brands` | Product manufacturers | `name`, `slug`, website | unique name/slug | canonical unique slug |
| `categories` | Hierarchical catalog grouping | `parent_id`, `name`, `slug` | unique slug, parent | self-reference; service prevents cycles |
| `products` | Product catalog | public ID, brand/category, SKU, name/model | unique public ID/SKU; brand/category | category required; SKU canonicalized |
| `warranties` | Purchased serialized product coverage | product/client, serial, dates/status | unique serial; client/status; expiry | end >= start >= purchase; ownership required |
| `technicians` | Technician capacity/profile | `user_id`, employee code, capacity, availability | unique user/code | positive capacity; user requires technician role in service |
| `tickets` | Customer support case | public ID/number, client, assignee, subject, priority/status | unique IDs; status queue; client; assignee; due | required subject/details; valid lifecycle times |
| `ticket_products` | Products affected by ticket | ticket/product/warranty, serial, notes | composite PK | product belongs to ticket once; service validates warranty/product match |
| `repairs` | Execution of a repair | public ID/number, ticket, technician, costs, status/dates | unique IDs/ticket; technician queue; received | nonnegative costs; chronological dates |
| `repair_history` | Append-only repair timeline | repair, actor, event/statuses, JSON metadata | repair/date; actor/date | mutation only via service/audit policy |
| `invoices` | Billing document | IDs/number, client/repair, status, currency, totals | unique IDs/number/repair; client/status; due | ISO currency; total=subtotal+tax; payment bounds |
| `invoice_items` | Immutable invoiced line | invoice/product, quantity, unit/tax/line totals | invoice | quantity positive, monetary totals consistent |
| `notifications` | Deliverable/in-app message | user, channel, title/body, read/send state | inbox, delivery retry | recipient/title/body required; controlled channels |
| `files` | Object-storage metadata | public ID, disk/key, MIME, byte count, SHA-256 | unique public ID/object; uploader/date | size > 0; SHA-256 lowercase hex; content scan before attach |
| `file_attachments` | Explicit attachment relation | file and one target FK | primary file, target lookups | exactly one target required |
| `activity_logs` | Security/operational audit log | timestamp, actor/action, entity, request/IP, JSON before/after | entity/date; actor/date; date | append-only; redact sensitive fields |
| `dashboard_daily_statistics` | Precomputed dashboard metrics | date, metric/dimensions, decimal value | primary composite; metric/date | refreshed only by trusted aggregate job |

## Scalability and operating guidance

- All foreign-key columns and dashboard access paths are indexed; avoid duplicate indexes that only repeat a left-most prefix.
- Use keyset pagination (`created_at, id`) for tickets, repair history, notifications, and logs. Do not paginate these with deep offsets.
- Generate human numbers (`TKT-YYYY-...`, `RPR-...`, `INV-...`) atomically from a per-period counter in the application transaction; UUIDs are the public API identifier.
- Files are metadata only: put bytes in S3/MinIO and scan, authorize, then issue short-lived download URLs.
- Recompute the daily statistics table from source data via an idempotent scheduled job. Cache short-lived dashboard responses separately.
- Retain and partition `activity_logs` monthly by `occurred_at` when volume warrants it; archive old partitions to cold storage. Back up with point-in-time recovery, test restores, and encrypt database/object-store backups.
- Enforce status transitions, authorization, totals recomputation, and cross-table ownership checks in a transactional service layer; database constraints provide the final integrity boundary.

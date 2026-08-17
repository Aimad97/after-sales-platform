# Security model

This application is a Laravel 12 API with a first-party React SPA. Security is
enforced server-side; frontend route guards and hidden controls are only user
interface conveniences and are not authorization boundaries.

## Authentication and sessions

- The SPA uses Laravel Sanctum's stateful `web` guard. It first obtains the
  `XSRF-TOKEN` cookie and sends the session cookie with credentialed requests.
- Login, password-reset requests, attachment uploads, report exports, search,
  broadcasting authorization, and authenticated API traffic have independent
  rate limits.
- Login regenerates the session ID. Logout invalidates the session and rotates
  the CSRF token. Password changes and resets rotate the remember token and
  revoke Sanctum tokens and other database sessions for the account.
- Passwords use Laravel's default password rule configured to require at least
  12 characters, mixed case, a number, and a symbol. Passwords and reset tokens
  are never returned in API resources.
- If personal access tokens are introduced, Sanctum tokens expire after the
  configured `SANCTUM_TOKEN_EXPIRATION` period (24 hours by default) and use
  the `sav_` secret-scanning prefix.

## Authorization and IDOR protection

- Every protected route requires `auth:sanctum`; resource actions call a
  policy, and sensitive form requests repeat the policy check before input is
  validated.
- Staff permissions are managed by Spatie roles and permissions. Super admin
  is the only role allowed to assign or manage privileged accounts.
- Client portal accounts must have exactly the `client` role and a linked
  customer. Portal queries always add the authenticated user's `client_id`
  constraint before loading products, warranties, tickets, attachments, or
  dashboard data.
- Client portal object policies deny cross-client resources as not found. This
  avoids confirming whether another customer's UUID exists.
- Public-facing routes use UUID route keys where available. Client resources do
  not expose internal numeric IDs; staff-only resources may use IDs for their
  operational workflows.
- Internal repair fields (`internal_notes`, `root_cause`, technician history,
  audit logs, and staff attachments) are excluded from client resources and
  realtime payloads. Client attachment listings include only files uploaded by
  that client's portal accounts.
- Private attachment and report disks are streamed only after policy checks.
  Files are stored under randomized names and never exposed through the public
  storage symlink.
- Reverb channels are private. User channels require the same user ID, and
  ticket channels require either the relevant staff policy or the linked
  client's portal policy.

## Request, browser, and data protections

- Laravel's stateful API middleware validates CSRF tokens for browser requests;
  CORS allows only an explicit configured origin list and credentials never use
  `*`.
- API input is validated with Form Requests. Controllers pass only validated
  data to services, and services use explicit field lists and database
  transactions for multi-record operations.
- Dynamic sort columns are allow-listed. Search/filter values are bound query
  parameters, so user input is not interpolated into SQL.
- Responses include `nosniff`, frame and referrer protections, a restrictive
  Content-Security-Policy, cross-origin isolation headers, and `no-store` for
  JSON API responses. Production also requires HTTPS and HSTS.
- Uploaded files are checked by extension, detected MIME type, and size before
  storage. Original names are sanitized and generated storage names are not
  user-controlled.
- Audit records recursively redact credentials, tokens, cookies, and other
  sensitive keys. Audit logs are restricted to administrators.

## Production requirements

Before deploying, set these values from a secret manager or protected runtime
environment (never commit them):

1. A unique `APP_KEY`; `APP_DEBUG=false`; an HTTPS `APP_URL`.
2. `SESSION_ENCRYPT=true`, `SESSION_HTTP_ONLY=true`,
   `SESSION_SECURE_COOKIE=true`, and an appropriate SameSite policy.
3. HTTPS-only `CORS_ALLOWED_ORIGINS` and matching
   `SANCTUM_STATEFUL_DOMAINS` for the real frontend.
4. Private attachment and report disks (`attachments_s3` and a private report
   bucket are recommended), TLS for Reverb, and non-default Reverb secrets.
5. A non-root database account with only the privileges required by the app,
   encrypted database/Redis connections where supported, and centralized log
   access controls.

The application fails fast during production boot when required secure settings
are missing. `.env` files, runtime logs, storage files, and generated builds
must remain outside source control. Rotate any credential immediately if it is
ever exposed.

## Reporting and verification

Run the feature test suite and frontend build before release. Security-sensitive
changes should include a regression test for the affected policy, request
authorization, or resource serialization. Report suspected vulnerabilities to
the project maintainers privately; do not open a public issue containing
credentials or customer data.

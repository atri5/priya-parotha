# Account storage

Initial scale: fewer than 500 accounts and at most 50 simultaneous signed-in users. Accounts use the existing Neon PostgreSQL database accessed by the Cloudflare Worker through the backend-only `DATABASE_URL` secret.

## Tables

| Table | Purpose |
| --- | --- |
| `users` | Generated UUID text ID, required email, first/last names, email verification flag, optional username, application role, creation time |
| `password_credentials` | One encoded, salted password hash per user, with a password update time |
| `oauth_accounts` | A Google account's stable `sub` claim linked to one user |
| `sessions` | SHA-256 digest of a random session token, user ID, creation and expiration times |
| `oauth_states` | Single-use Google state and browser-token digests, PKCE verifier, nonce, and expiration |

Emails and usernames are unique regardless of capitalization and cannot contain whitespace or be empty. The current registration and login forms use email/password; usernames remain optional for later use. Google-only users may have no username or password credential. A user may have both a password credential and a Google identity in storage, but there is no public route for linking existing credentials. Each user can link one Google identity, and each Google identity belongs to only one user. Deleting a user deletes their credentials, linked identity, and sessions.

Email/password registration also requires `firstName` and `lastName`, trimmed and limited to 1–100 Unicode characters without control characters. They are stored as `first_name` and `last_name` and returned with the user in registration, login, and session responses. Google registration uses the verified ID token's `given_name` and `family_name` claims when supplied; missing names stay null. Existing Google accounts fill missing names on their next Google sign-in, preserving names already saved. Existing email/password accounts without names are preserved. The shared header greets signed-in users with `Hi <first_name>`, falling back to `Hi there` when no first name is available; long names are visually truncated and all names are rendered as text.

Password hashing and verification run in Neon's supported `pgcrypto` extension, using bcrypt (`gen_salt('bf', 12)`). This keeps the expensive password work out of Workers Free's CPU budget. Passwords pass from the browser to the Worker over HTTPS and to Neon over the serverless driver's HTTPS connection as query parameters; they are never persisted or logged by this application. Database administrators and the trusted Neon service are inside the authentication trust boundary. `password_hash` contains the encoded hash, salt, and cost. Never log query parameters or request bodies in authentication code.

New passwords require at least 15 Unicode characters and at most 72 UTF-8 bytes, with no NUL characters, to avoid bcrypt truncation. Emails are trimmed and lowercased. SQL queries are parameterized. Email/password accounts start with `email_verified = false`; registration creates a signed-in customer session but does not establish verified ownership of that email. Email verification and password recovery remain deferred. Google access, refresh, and ID tokens are never persisted.

Google identity lookup uses `(provider, provider_user_id)`, with the latter taken from the validated ID token's `sub` claim. The `jose` library verifies the signature against Google's JWKS, issuer, audience, expiration, issue time, nonce, authorized party when present, and verified email. OAuth uses authorization code flow with PKCE S256 and a browser-bound, single-use database state expiring after 10 minutes. A collision with an existing login account prompts the user to use its existing login method. The only automatic claim is a trusted, manually provisioned Gmail account: after validating the Google token, the backend may link the matching address only if the stored account is unverified and has no password credential, OAuth identity, or sessions. This claim atomically verifies the email and attaches the stable Google subject, preserving the preassigned role and names. It does not merge existing login accounts. Claiming is limited to `@gmail.com`, where [Google is authoritative for email ownership](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token); other email domains require a separate linking process. New Google identities create customer accounts. Google verification happens on the backend.

## Roles and access

`role` accepts exactly `customer` and `admin`, defaulting to `customer`. These are application roles, separate from PostgreSQL roles or Cloudflare account permissions. Public signup must always assign `customer`, ignoring or rejecting any client-supplied role. There is no automatic first-user admin.

All five tables have row level security enabled, no public policies, and no `PUBLIC` grants. Only the trusted database owner/backend may access them. The Worker verifies a real, unexpired database session and the user's current `admin` role before serving the dashboard, its JavaScript/CSS, or accepting product mutations. This check also applies on localhost. Client-supplied roles, headers, email addresses, and local storage do not authorize access. Deployed product writes remain disabled by the development-only feature flag; local admin writes additionally require loopback, same-origin, and operation-header checks.

Signed-in admins see an Admin tag beside their email and a Dashboard link above Sign out. Customers and visitors do not see these controls. Every request except an exact list of public static files (`cloudflare.config.ts`) runs through the Worker before static asset serving. Dashboard paths, extensionless/trailing-slash aliases, and dashboard asset paths are checked after bounded URL decoding and path normalization. Unauthorized dashboard navigation redirects to the homepage with an admin sign-in message; protected asset/API requests return 401 for missing/invalid sessions or 403 for customers. Authentication/storage failures return 503 and never serve protected content. `/api/admin/*` is reserved behind the same guard; no management endpoints are implemented there yet.

Protected responses use `Cache-Control: private, no-store` and `Vary: Cookie`, with browser frame embedding disabled. The dashboard hides a history-cached document when leaving and rechecks the session before showing a restored page. Session revocation, expiry, and role changes affect the next protected request without signing in again. The existing public product/tag reads remain public; product creation and changes always require an admin session. Use the Worker development server or Worker deployment for these protections; a standalone static-file server cannot enforce backend authorization.

To promote a verified account, a database administrator can run this with its actual user ID. It changes nothing unless the email is verified and returns the promoted row, so an empty result means it was refused:

```sql
update public.users set role = 'admin' where id = '<registered-user-id>' and email_verified returning id, email, role;
```

A trusted database administrator may provision an unverified Gmail user with names and a role, without credentials or sessions. Its first verified Google sign-in claims that record while retaining the assigned role. Provisioning alone does not grant an authenticated session. Never mark a provisioned account verified before it is claimed.

Email/password accounts stay unverified until email verification is implemented, so today only Google-created or Google-claimed accounts qualify for the verified-account promotion query. An administrator who has confirmed ownership of a password account out of band can set `email_verified = true` on it first.

## Sessions and routes

The Sign in button opens a nonmodal dropdown shared across the homepage, Menu, Contact, and 404 pages. It supports email/password login and registration, Google when configured, and account/logout state. All successful authentication returns to `/`; callers cannot choose a redirect destination. The dashboard is not a login destination yet.

Session tokens contain 32 random bytes. Only their SHA-256 digests are stored. Cookies are `__Host-priya_session`, `Secure`, `HttpOnly`, `SameSite=Lax`, and `Path=/`, with a fixed seven-day lifetime. Local HTTP on localhost/loopback uses `priya_session` without `Secure`. A successful sign-in issues a fresh token and revokes the previous browser session. Logout deletes the current server session and clears its cookie. Session lookup joins the current user row, so role changes apply immediately; expired sessions are rejected. Expired rows are removed when creating sessions or OAuth states. There is no sliding renewal or browser token storage in JavaScript.

All authentication responses use `Cache-Control: no-store`. POST routes require a matching `Origin`, and JSON password requests are limited to 4 KiB. Deployment requests must match `APP_ORIGIN`; HTTP is allowed only for local development. A Cloudflare rate-limiter binding throttles attempts by hashed IP and, for passwords, hashed email, to approximately 10 per minute per Cloudflare location. This is an abuse guard, not a strict worldwide limit. Password errors do not reveal whether an account exists. Logs redact query strings and only include generic errors and error codes.

See [API_SPEC.md](API_SPEC.md) for endpoints. Auth unit tests use an injected in-memory storage fake and signed test Google tokens. `npm run test:auth-db` checks real Neon hashing, session expiration/rotation, OAuth state consumption, and account collision behavior using temporary accounts deleted afterward.

## Setup

From `backend/`, with the existing private `.env`:

```sh
npm run db:accounts
```

This applies the SQL files in `neon/migrations/` in filename order, each in its own transaction: accounts, sessions/OAuth states, the pgcrypto extension, and nullable account names. These initial migrations are idempotent, create no accounts, and leave products alone. Future schema changes need separate explicit migrations; rerunning this command does not modify existing columns or constraints. This runner has no migration ledger, so future files must also be safe to rerun.

Cloudflare supports the existing [Neon serverless driver](https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/); Neon documents its [pgcrypto password functions](https://neon.com/docs/extensions/pgcrypto). This approach preserves the existing Free plans. The Worker has placement configured near the database's recorded AWS US West (Oregon) region. Production CPU and request latency should still be measured after deployment; local development does not reproduce production CPU enforcement.

## Enable Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), configure the OAuth consent screen, then create an OAuth client of type **Web application**. Add test users while the app is in Google's testing mode.
2. Add the exact authorized redirect URI `https://priya-parotha.priya-parotha.workers.dev/api/auth/google/callback`. For development, also add the origin printed by `npm run dev`, followed by `/api/auth/google/callback` (for example, `http://localhost:5173/api/auth/google/callback`). The scheme, host, and port must match the address used in the browser. JavaScript origins are not needed for this server-side authorization-code flow.
3. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in ignored `backend/.env` and `backend/.dev.vars`. Restart development after adding them. Never put the secret in frontend files or Git.
4. When deploying, upload them along with `DATABASE_URL` using the existing `npm run deploy -- --secrets-file .env` workflow. Keep `.env` limited to intended Worker secrets. Update `APP_ORIGIN` and Google's redirect URI together if a custom domain is added.

Without both Google values, email/password authentication still works and the dropdown shows Google as unavailable. The development CLI may warn that the declared Google secrets are missing; this is expected until configured. A real Google sign-in cannot be verified until those credentials and authorized redirect URIs exist. Google documents its [OpenID Connect requirements](https://developers.google.com/identity/openid-connect/openid-connect).

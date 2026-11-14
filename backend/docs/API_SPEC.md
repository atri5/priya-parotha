# HTTP API

The Cloudflare Worker implements the public GET routes below as a thin JSON wrapper over the existing product functions, using Neon storage. Product creation is mounted for local development only; deployed writes remain disabled. Scope: the current 20–30 product catalog.

## Routes

| Method | Path | Existing function | Success response | Access |
| --- | --- | --- | --- | --- |
| GET | `/api/tags` | `getTags()` | `200`, unique nonblank tag string array | Public |
| GET | `/api/products` | `getProducts()` | `200`, Product array | Public |
| GET | `/api/products/:id` | `getProduct(id)` | `200`, Product | Public |
| POST | `/api/products` | `createProduct(data)` | `201`, created Product | Local development only |
| PATCH | `/api/products/:id` | `editProduct(id, body)` | `200`, updated Product | Backend only |
| DELETE | `/api/products/:id` | `deleteProduct(id)` | `204`, no body | Backend only |

Return the Product or array directly as JSON, without an extra response envelope. Product fields are `id`, `name`, `price`, `q_available`, `desc`, `photos`, `tags`, and `published`. Tags are an array of strings and default to `[]`; `published` is a boolean and defaults to `false`. Price and quantity remain strings; photos remain an array.

## Request bodies

POST requires the five original editable fields and optionally accepts `tags` (a string array defaulting to `[]`):

```json
{
  "name": "Aloo Parotha",
  "tags": ["Parotha", "Lunch"],
  "price": "5.00",
  "q_available": "20",
  "desc": "Potato-stuffed flatbread.",
  "photos": ["https://example.com/aloo-parotha.jpg"]
}
```

GET responses include `tags`. An empty array means uncategorized. PATCH replaces the array when `tags` is supplied; omitting it preserves the existing categories. Scalars, null, blank members, and nonstring members are invalid. Exact duplicates are removed.

PATCH sends only changes, for example `{"price":"6.00"}`. The proposed authenticated POST and PATCH routes accept JSON objects with `Content-Type: application/json`. Pass the parsed body directly to the existing function; keep product validation and ID generation in the existing product layer. Creation replaces a caller-supplied ID; editing an ID is rejected.

## Access

- Product reads use public GET routes.
- Writes are for trusted backend callers only. Do not mount write routes on the public server until backend-only authorization is configured; browser login alone must not permit product edits.
- Neon database credentials and any backend authorization secrets stay on the server. CORS is not authorization.
- Authentication routes are described below. Product database grants and row-level policies are defined in `neon/schema.sql`.

## Errors

Use a consistent JSON shape: `{"error":"name must be a nonempty string"}`.

| Condition | Status |
| --- | --- |
| Malformed request JSON, non-object body, or product validation `TypeError` | `400` |
| Existing product function throws `Product not found` | `404` |
| Unmatched route | `404` |
| Unsupported method on a mounted route | `405`, with an `Allow` header |
| Unsupported POST/PATCH content type | `415` |
| Storage failure or another unexpected exception | `500`, generic message |

Distinguish request parsing errors from storage parsing failures. Never include file paths, credentials, or stack traces in public error responses. Unmounted write methods remain unavailable; do not call a product function for those requests.

## Implementation outline

1. `backend/src/worker.js` serves assets and matches the GET routes, decoding IDs and serializing results/errors. Unsupported methods receive 405 without calling product functions.
2. The Worker constructs `createProductApi(new NeonProductDatabase(env.DATABASE_URL))`. It does not read CSV or implement product validation rules itself. Missing database configuration returns 503; unexpected database failures return a generic 500.
3. The menu fetches `/api/products` on the same origin and displays products with `published: true`.

Frontend read example:

```js
const response = await fetch('/api/products');
if (!response.ok) throw new Error('Could not load products');
const products = await response.json();
```

Product routes do not add pagination; local multipart creation and image handling are described below. Authentication endpoints are documented separately below.

HTTP references: [status and response semantics](https://www.rfc-editor.org/rfc/rfc9110.html#name-status-codes), [PATCH](https://www.rfc-editor.org/rfc/rfc5789.html#section-2).

`GET /api/tags` returns a sorted JSON array such as `["Parotha", "Sides"]`, or `[]` when no tags are in use. Tags are flattened from every product’s `tags` array, with exact duplicates removed. Creating, editing, or deleting a product affects this list automatically.

## Local dashboard write endpoints

The dashboard sends `POST /api/products` as multipart form data: `name`, `desc`, `price`, `q_available`, optional `tags` (JSON array string), and repeated `photos` file fields. It requires a valid database admin session, `LOCAL_PRODUCT_WRITES=true`, a loopback request hostname, an exact matching `Origin`, and `X-Product-Request: create`. Production configuration keeps the additional feature flag false and omits the image bucket binding.

For editing, the dashboard sends `PATCH /api/products` as multipart form data with an `edits` JSON field containing up to 50 `{ before, changes }` entries, plus optional repeated `photos:<product-id>` file fields. Each `before` value is the product snapshot returned by GET; `changes` contains only edited fields. This route uses the same admin-session, local-only, loopback, Origin, and request-header checks, with `X-Product-Request: edit`. Updates are applied as one batch; a stale snapshot returns 409 and no product changes are saved. Uploaded images share the 20 MB request limit, and each product may have up to 10 photos.

The endpoint validates all fields before writing. Price must be a nonnegative decimal with up to two decimal places and quantity a nonnegative whole number. Accept 0–10 JPEG/PNG/WebP images with matching file signatures, up to 10 MB each and 20 MB total. The request stream is capped at 21 MB including multipart overhead. Invalid input returns 400; oversized requests return 413; unsupported content type returns 415. Storage failures return a generic 500 and trigger image cleanup.

Images are stored in the persistent local R2 emulator. Their `/api/images/:key` URLs are saved in Neon and served by the local Worker. Product details are real database writes; local images are not available in production. Connect deployed storage before publishing these products. `GET /api/images/:key` returns image bytes or 404.

On creation success, the form clears and refreshes Products. On failure it keeps entered data and selected images. Product text, tag, price, quantity, photos, and Publish changes can be staged together and saved with the Products page Save changes button. Delete remains deferred.

Images are optional for multipart creation. If none are submitted, the server saves `/assets/images/flower.svg` as the default photo, preserving the model’s nonempty `photos` array. Uploaded images still undergo the same validation.

## Local batch update endpoint

`PATCH /api/products` accepts multipart form data with `edits` containing a JSON array of `{ before: Product, changes: Partial<Product> }` and repeated `photos:<id>` upload fields. Requires the same local development, loopback, and exact Origin checks as creation, plus `X-Product-Request: edit`. Up to 50 products, 10 photos per product, 20 MB new images per save. `published` must be boolean. All field and file validation precedes writes; the database update is atomic. Returns the updated Product array, 400 for invalid input, 409 for a changed/deleted product, or a generic 500. Failed saves preserve frontend edits. Deployed PATCH remains forbidden.

## Authentication

Dashboard pages (including extensionless and encoded aliases), dashboard JavaScript/CSS, product mutation methods, and `/api/admin/*` require a current server-side admin session. Dashboard navigation redirects non-admins to `/?auth_error=admin_required`; protected assets and APIs return 401 for absent/invalid/expired sessions, 403 for customers, or 503 if access cannot be verified. Protected responses use `Cache-Control: private, no-store` and `Vary: Cookie`. Public product/tag GET routes retain their existing read access.

All routes below are handled by the same Worker. POST requests must include a matching `Origin` header. Password routes accept JSON; Google start is a normal POST form. All successful sign-ins return to `/`.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/auth/session` | `{ user: { id, email, username, role, first_name, last_name } \| null, googleEnabled }`; clears invalid/expired cookies |
| POST | `/api/auth/register` | `{ email, password, firstName, lastName }`; requires both names, creates a customer and session; returns `{ user, redirectTo: '/' }` |
| POST | `/api/auth/login` | `{ email, password }`; creates a fresh session; returns `{ user, redirectTo: '/' }` |
| POST | `/api/auth/logout` | Revokes the current session and clears its cookie; returns `{ redirectTo: '/' }` |
| POST | `/api/auth/google` | Creates browser-bound state and redirects to Google; requires Google secrets |
| GET | `/api/auth/google/callback` | Consumes state, verifies Google identity, creates a session, and redirects to `/` |

Failures use `{ error }` with 400 (invalid fields), 401 (incorrect credentials), 403 (origin rejected), 405 (wrong method), 409 (registration collision), 413 (oversized body), 415 (wrong content type), 429 (rate limit), 503 (configuration unavailable), or a generic 500. Google callback failures redirect to `/?auth_error=<known-code>`; the frontend displays the message and removes the query parameter. Authentication responses are never cached. No tokens or password hashes are returned in JSON.

See [ACCOUNT_CONTRACT.md](ACCOUNT_CONTRACT.md) for session guarantees, the password policy, and Google configuration.

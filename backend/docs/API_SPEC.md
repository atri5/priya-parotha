# Product HTTP API plan

The Cloudflare Worker implements the two public GET routes below as a thin JSON wrapper over the existing product functions, using Neon storage. Write routes remain proposed and unmounted. Scope: the current 20–30 product catalog.

## Routes

| Method | Path | Existing function | Success response | Access |
| --- | --- | --- | --- | --- |
| GET | `/api/products` | `getProducts()` | `200`, Product array | Public |
| GET | `/api/products/:id` | `getProduct(id)` | `200`, Product | Public |
| POST | `/api/products` | `createProduct(body)` | `201`, created Product | Backend only |
| PATCH | `/api/products/:id` | `editProduct(id, body)` | `200`, updated Product | Backend only |
| DELETE | `/api/products/:id` | `deleteProduct(id)` | `204`, no body | Backend only |

Return the Product or array directly as JSON, without an extra response envelope. Product fields remain `id`, `name`, `price`, `q_available`, `desc`, and `photos`. Price and quantity remain strings; photos remain an array.

## Request bodies

POST requires the five editable fields:

```json
{
  "name": "Aloo Parotha",
  "price": "5.00",
  "q_available": "20",
  "desc": "Potato-stuffed flatbread.",
  "photos": ["https://example.com/aloo-parotha.jpg"]
}
```

PATCH sends only changes, for example `{"price":"6.00"}`. POST and PATCH accept JSON objects with `Content-Type: application/json`. Pass the parsed body directly to the existing function; keep product validation and ID generation in the existing product layer. Creation replaces a caller-supplied ID; editing an ID is rejected.

## Access

- The public frontend uses only GET routes.
- Writes are for trusted backend callers only. Do not mount write routes on the public server until backend-only authorization is configured; browser login alone must not permit product edits.
- Neon database credentials and any backend authorization secrets stay on the server. CORS is not authorization.
- No user authentication system is added. Database grants and row-level policies are defined in `neon/schema.sql`.

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

1. `backend/src/worker.js` serves assets and matches the two GET routes, decoding IDs and serializing results/errors. Unsupported methods receive 405 without calling product functions.
2. The Worker constructs `createProductApi(new NeonProductDatabase(env.DATABASE_URL))`. It does not read CSV or implement product validation rules itself. Missing database configuration returns 503; unexpected database failures return a generic 500.
3. Future menu-page requests can use `/api/products` on the same origin. The current frontend remains a homepage with separate menu/contact placeholders.

Frontend read example:

```js
const response = await fetch('/api/products');
if (!response.ok) throw new Error('Could not load products');
const products = await response.json();
```

No pagination, search, uploads, account endpoints, database adapter changes, or new business rules are included. Existing product tests stay unchanged.

HTTP references: [status and response semantics](https://www.rfc-editor.org/rfc/rfc9110.html#name-status-codes), [PATCH](https://www.rfc-editor.org/rfc/rfc5789.html#section-2).

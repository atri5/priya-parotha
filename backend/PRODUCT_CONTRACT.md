# Product backend contract

This file preserves the agreed backend requirements. The Product model and API use a database interface with CSV and hosted Neon implementations.

## Product fields

| Field | Type | Requirement |
| --- | --- | --- |
| `id` | string | Required on a Product; generated uniquely by `createProduct` |
| `name` | string | Required and nonempty |
| `price` | string | Required and nonempty |
| `q_available` | string | Required and nonempty |
| `desc` | string | Required and nonempty |
| `photos` | array | Required and nonempty |

The user's `''` and `[]` examples describe the field types, not valid default values. Missing, `undefined`, `null`, empty, and incorrectly typed fields must cause an error. Whitespace-only strings count as empty. Price and quantity stay strings; `'0'` is nonempty and valid under the current rules. Photo element formats and numeric formatting rules have not been specified.

## API behavior

- `getProducts()` lists products; `getProduct(id)` retrieves one product.
- `createProduct(data)` requires the five editable fields and generates a unique, nonempty string `id` on every successful call. Callers do not need to supply an ID.
- `editProduct(id, changes)` accepts partial updates. Omitted fields keep their existing values. Any supplied field must satisfy its validation rules.
- `deleteProduct(id)` removes the selected product.
- The functions must throw or reject with an Error when required input is absent or empty. Validation errors should identify the affected field.

## Storage interface

`ProductDatabase` defines `list`, `get`, `create`, `update`, and `delete`. Child classes provide storage-specific behavior; `update` must validate the merged Product and persist it without partial changes on validation failure. Methods may return values or promises.

`CsvProductDatabase` implements this interface using `backend/data/products.csv`. Configure a different existing CSV with `PRODUCT_CSV_PATH` or its constructor's file path. It reads and writes synchronously and replaces the file through a temporary file. It is intended for a single backend process at the agreed 20–30 product scale.

The two existing tests cover core functionality and representative validation using a temporary CSV copy.

`NeonProductDatabase(connectionString)` implements the same interface over hosted PostgreSQL. It validates merged Products before updates, uses parameterized queries, and writes only changed columns to preserve unrelated concurrent edits. The public Cloudflare Worker injects this adapter into the existing product functions.

- `new Product(data)` accepts all six fields; the API assigns `id` before constructing a Product.
- `createProductApi(database)` accepts a storage child-class instance and defaults to the configured CSV. API instances using the same file share persisted products.
- Creation and editing return the resulting Product. Deletion has no required return value.
- Creation replaces any caller-supplied ID with a generated one. IDs cannot be edited.
- Failed edits leave the stored product unchanged. Unknown IDs, including already deleted IDs, produce an error containing “not found”.
- Validation errors identify fields in their messages; no custom error class or HTTP status is prescribed.
- Edits reject unknown fields and changes to `id`.

## Online storage and hosting

Neon Free is the selected online database. `../neon/schema.sql` defines `public.products` with exactly the six fields above and `id` as its primary key. IDs are text with a generated UUID string as the database default. Photos use a nonempty JSON array; price and quantity remain text. The intended initial scale is 20–30 products. `../neon/project.json` records the created project without credentials.

Cloudflare serves the frontend and public `GET /api/products` and `GET /api/products/:id` routes. No public product writes are mounted. Database credentials stay in server-only secrets. The Neon schema grants general database roles read access only; the trusted database owner performs backend writes. Supabase migrations are retained as historical alternatives, not applied to Neon.

User authentication, photo uploads, public write endpoints, and menu-page integration remain deferred. Both unit tests should pass against the CSV-backed implementation; online storage is also checked directly against Neon.

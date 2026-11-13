# Backend

Product CRUD with Neon online storage and a CSV adapter for local fixtures. Requirements are saved in [docs/PRODUCT_CONTRACT.md](docs/PRODUCT_CONTRACT.md).

The Cloudflare Worker serves the website, public product GET routes, and authentication routes documented in [docs/API_SPEC.md](docs/API_SPEC.md). Local development supports product creation and batch edits; deployed product writes remain disabled.

## Run tests

From the repository root:

```sh
cd backend
npm ci
npm test
```

Tests use Node's built-in runner. Product API tests use a temporary CSV copy, and local write-handler tests use isolated storage mocks; authentication tests cover routes and Google token verification. The Neon integration test is skipped without `DATABASE_URL`; run `npm run test:auth-db` to load it from `.env` and check real password hashing and sessions. It creates temporary accounts and deletes them afterward. CSV parsing and serialization use `csv-parse` and `csv-stringify`.

## Usage

From a backend JavaScript module:

```js
import { createProductApi } from './src/product/product-api.js';
import { CsvProductDatabase } from './src/product/storage/csv-product-database.js';

const api = createProductApi(); // Defaults to data/products.csv.
const products = await api.getProducts();
const product = await api.getProduct(products[0].id);

// Alternatively, use a different existing CSV file:
const customApi = createProductApi(new CsvProductDatabase('/absolute/path/products.csv'));
```

For online storage, pass `new NeonProductDatabase(process.env.DATABASE_URL)` from `./src/product/storage/neon-product-database.js` instead. The database connection is server-only.

`createProduct(data)`, `editProduct(id, changes)`, and `deleteProduct(id)` persist to that file. Creation generates IDs; edits accept partial changes and preserve the ID. Set `PRODUCT_CSV_PATH` to change the default path.

To add another database, extend `ProductDatabase` with `list`, `get`, `create`, `update`, and `delete`, then pass its instance to `createProductApi`. No API changes are needed.

The CSV adapter is intended for one backend process with 20–30 products. Use separate working copies when experimenting with writes.

## Cloudflare development and deployment

Use a supported Node LTS release: Node 22.23+, 24.22+, or 26.12+. `.nvmrc` selects Node 22. The machine's older Node 23 does not support this Cloudflare toolchain; it can run it with `npx --yes --package=node@22 -- npm run build` without changing the global Node installation.

`cloudflare.config.ts` uses the official `cf` CLI and Workers Static Assets. `vite.config.ts` packages the existing frontend without publishing internal Markdown notes. The frontend files remain buildless when served on their own.

```sh
npm run dev
npm run build
npm run deploy -- --secrets-file .env
```

Keep the Neon connection in ignored `.env` for backend scripts and `.dev.vars` for local Worker development. Deployment uploads it as the Worker's `DATABASE_URL` secret. Never put it in the frontend, command arguments, or Git. Secrets files should contain only values intended for that Worker.

The online schema and optional sample import are described in [../neon/README.md](../neon/README.md). The initial database is on Neon Free; no paid Cloudflare subscription is required for this small deployment. No custom domain is purchased or configured.

Authentication uses the same Neon database. Run `npm run db:accounts` to create the private account/session tables and enable `pgcrypto`. The shared Sign in dropdown supports email/password registration, login, logout, and Google when configured, returning users to `/`. New accounts are customers; admin promotion stays trusted/backend-only. Password hashing and verification run in Neon to keep the Worker on the Free plan. Sessions use revocable database records and private cookies with a seven-day expiry. See [docs/ACCOUNT_CONTRACT.md](docs/ACCOUNT_CONTRACT.md) for Google OAuth setup, password policy, security behavior, and the deferred email verification/recovery work.

Live deployment: https://priya-parotha.priya-parotha.workers.dev. Product reads are at `/api/products` and `/api/products/:id`; POST, PATCH, and DELETE return 405. Initial application source: `31a95b3`; Cloudflare version: `adf7ddf4-2788-445a-a9d4-6a1d74b760c7`.

## Layout

- `docs/` — product contract and HTTP API specification
- `scripts/` — database setup and optional sample import
- `data/products.csv` — five sample products for local queries, including one out of stock; prices, quantities, and photo URLs are illustrative. `photos` contains a JSON array inside each CSV cell. Parse it as JSON; keep other fields as strings.
- `src/product/product.js` — Product fields and validation
- `src/product/product-api.js` — read, create, edit, and delete functions
- `src/product/storage/product-database.js` — storage interface base class
- `src/product/storage/csv-product-database.js` — CSV storage child class
- `src/product/storage/neon-product-database.js` — hosted PostgreSQL storage child class
- `src/worker.js` — public read-only API and static asset handling
- `test/product/product.test.js` — product field and validation tests
- `test/product/product-api.test.js` — API validation, ID, partial edit, and deletion tests
- `test-support/product/` — shared test fixtures

The old Supabase migrations are retained as alternatives; production uses Neon. The menu and contact pages remain placeholders and do not query the API yet.

The dashboard renders products from `/api/products` and loads category suggestions from `/api/tags`. Dashboard pages, its JavaScript/CSS, and all product mutations require a real admin session verified by the Worker on each request. Unauthorized navigation returns to the homepage; protected APIs/assets return 401 or 403, and failed authorization lookups deny access with 503. Private responses are not cached. Run the Worker development server for dashboard testing; the standalone Python frontend server does not enforce these protections. Local admin Create and Edit save to Neon; the Products page stages edits and Publish changes for its Save changes button. Deployed writes and Delete remain deferred.

Local creation is enabled only in development mode and accepts same-origin requests on loopback. Uploaded photos persist in local R2 storage under ignored Cloudflare state; do not remove this state if you want to keep those images. Deploying the application does not upload these images. Production builds disable creation and omit the local image binding.

`npm run db:setup` also installs `neon/apply-product-edits.sql` for atomic batch edits and adds the `published` boolean. No authentication bypass is enabled in production.

# Backend context

Before implementing or changing the backend, read [docs/PRODUCT_CONTRACT.md](docs/PRODUCT_CONTRACT.md) and the tests in `test/product/`. They record the user's agreed product fields, string types, generated unique IDs, nonempty validation, and partial edits.

Product source files live in `src/product/`; storage interfaces and adapters live in `src/product/storage/`. API specifications and requirements live in `docs/`. ProductDatabase has CSV and Neon child classes. Use Neon for online storage and CSV for local fixtures. Keep storage-specific code out of the product API. Public product GET routes remain available. Dashboard pages/assets and product mutations require a current database admin session, including on localhost. Local product writes additionally require development mode, loopback, same-origin, and operation-header checks; deployed writes remain disabled by the feature flag. Keep assets.runWorkerFirst enabled so static assets cannot bypass authorization.

Authentication lives in `src/auth/`; read `docs/ACCOUNT_CONTRACT.md` before changing it. Neon pgcrypto handles password hashing and verification so the Worker can stay on the Free plan. Sessions and OAuth states are private, expiring database records. All sign-in methods and registration return to `/`. Google credentials remain optional until configured.

Use the project-local `cf` CLI and `cloudflare.config.ts` for Cloudflare. Cloudflare requires a supported Node LTS version; `.nvmrc` selects Node 22. Keep DATABASE_URL in ignored backend configuration and deployed Worker secrets, never in the frontend.

Install dependencies with `npm ci`, then run `npm test` from this directory. Keep product and Worker tests focused; product API tests must use a temporary CSV copy. Authentication has focused route and Google verification tests, plus `npm run test:auth-db` for a real Neon integration check using temporary accounts that are deleted afterward.

Keep unit tests minimal: one focused test per source file covering core functionality and representative validation. The user explicitly requested this scope instead of exhaustive validation matrices.

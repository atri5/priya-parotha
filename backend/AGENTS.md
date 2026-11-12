# Backend context

Before implementing or changing the backend, read [PRODUCT_CONTRACT.md](PRODUCT_CONTRACT.md) and the tests in `test/product/`. They record the user's agreed product fields, string types, generated unique IDs, nonempty validation, and partial edits.

Product source files live in `src/product/`. ProductDatabase has CSV and Neon child classes. Use Neon for online storage and CSV for local fixtures. Keep storage-specific code out of the product API. The Cloudflare Worker exposes public GET routes only; writes remain backend-only until authentication is implemented.

Use the project-local `cf` CLI and `cloudflare.config.ts` for Cloudflare. Cloudflare requires a supported Node LTS version; `.nvmrc` selects Node 22. Keep DATABASE_URL in ignored backend configuration and deployed Worker secrets, never in the frontend.

Install dependencies with `npm ci`, then run `npm test` from this directory. Keep the two focused tests; API tests must use a temporary CSV copy.

Keep unit tests minimal: one focused test per source file covering core functionality and representative validation. The user explicitly requested this scope instead of exhaustive validation matrices.

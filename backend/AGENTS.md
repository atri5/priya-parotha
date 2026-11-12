# Backend context

Before implementing or changing the backend, read [PRODUCT_CONTRACT.md](PRODUCT_CONTRACT.md) and the tests in `test/product/`. They record the user's agreed product fields, string types, generated unique IDs, nonempty validation, and partial edits.

Product source files live in `src/product/`. The Product model and API are implemented through a ProductDatabase interface, with CsvProductDatabase as the current storage child class. Keep storage-specific code out of the API. Supabase schema migrations exist, but a live Supabase adapter and HTTP endpoints are not implemented.

Install dependencies with `npm ci`, then run `npm test` from this directory. Keep the two focused tests; API tests must use a temporary CSV copy.

Keep unit tests minimal: one focused test per source file covering core functionality and representative validation. The user explicitly requested this scope instead of exhaustive validation matrices.

# Backend context

Before implementing or changing the backend, read [PRODUCT_CONTRACT.md](PRODUCT_CONTRACT.md) and the tests in `test/`. They record the user's agreed product fields, string types, generated unique IDs, nonempty validation, and partial edits.

The current task is test-first scaffolding. Do not implement the product model, API, or persistence merely to make the intentionally failing tests pass unless the user requests implementation.

Run the tests with `npm test` from this directory. The test runner is built into Node; no dependency installation is needed.

Keep unit tests minimal: one focused test per source file covering core functionality and representative validation. The user explicitly requested this scope instead of exhaustive validation matrices.

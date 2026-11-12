# Backend

Test-first scaffolding for the product model and API. The agreed requirements are saved in [PRODUCT_CONTRACT.md](PRODUCT_CONTRACT.md).

## Run tests

From the repository root:

```sh
cd backend
npm test
```

Node's built-in test runner requires no third-party dependencies or installation step.

There are only two tests: one for the Product class and one for the API's create/edit/delete flow, with representative validation checks. They intentionally fail against the unimplemented interfaces in `src/`. Product validation and CRUD functionality will be implemented separately.

## Layout

- `src/product.js` — Product class interface placeholder
- `src/product-api.js` — create, edit, and delete interface placeholders
- `test/product.test.js` — product field and validation tests
- `test/product-api.test.js` — API validation, ID, partial edit, and deletion tests
- `test-support/` — shared test fixtures

No HTTP server or persistence is configured. The frontend still runs independently as a static website.

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

- `data/products.csv` — five sample products for local queries, including one out of stock; prices, quantities, and photo URLs are illustrative. `photos` contains a JSON array inside each CSV cell. Parse it as JSON; keep other fields as strings.
- `src/product.js` — Product class interface placeholder
- `src/product-api.js` — create, edit, and delete interface placeholders
- `test/product.test.js` — product field and validation tests
- `test/product-api.test.js` — API validation, ID, partial edit, and deletion tests
- `test-support/` — shared test fixtures

The Supabase table migration and setup instructions are in [../supabase/README.md](../supabase/README.md). The API is not connected to it yet. The frontend still runs independently as a static website.

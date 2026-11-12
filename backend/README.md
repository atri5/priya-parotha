# Backend

Product CRUD backed by a configurable CSV database. Requirements are saved in [PRODUCT_CONTRACT.md](PRODUCT_CONTRACT.md).

## Run tests

From the repository root:

```sh
cd backend
npm ci
npm test
```

The two tests use Node's built-in runner and a temporary CSV copy. CSV parsing and serialization use `csv-parse` and `csv-stringify`.

## Usage

From a backend JavaScript module:

```js
import { createProductApi } from './src/product-api.js';
import { CsvProductDatabase } from './src/csv-product-database.js';

const api = createProductApi(); // Defaults to data/products.csv.
const products = await api.getProducts();
const product = await api.getProduct(products[0].id);

// Alternatively, use a different existing CSV file:
const customApi = createProductApi(new CsvProductDatabase('/absolute/path/products.csv'));
```

`createProduct(data)`, `editProduct(id, changes)`, and `deleteProduct(id)` persist to that file. Creation generates IDs; edits accept partial changes and preserve the ID. Set `PRODUCT_CSV_PATH` to change the default path.

To add another database, extend `ProductDatabase` with `list`, `get`, `create`, `update`, and `delete`, then pass its instance to `createProductApi`. No API changes are needed.

The CSV adapter is intended for one backend process with 20–30 products. Use separate working copies when experimenting with writes.

## Layout

- `data/products.csv` — five sample products for local queries, including one out of stock; prices, quantities, and photo URLs are illustrative. `photos` contains a JSON array inside each CSV cell. Parse it as JSON; keep other fields as strings.
- `src/product.js` — Product fields and validation
- `src/product-api.js` — read, create, edit, and delete functions
- `src/product-database.js` — storage interface base class
- `src/csv-product-database.js` — CSV storage child class
- `test/product.test.js` — product field and validation tests
- `test/product-api.test.js` — API validation, ID, partial edit, and deletion tests
- `test-support/` — shared test fixtures

Supabase table migrations are in [../supabase/README.md](../supabase/README.md); a Supabase adapter is deferred. No HTTP endpoints are exposed, and the frontend still runs independently.

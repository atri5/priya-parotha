# Product backend contract

This file preserves the requirements agreed with the user for future backend implementation. This change defines tests and interface placeholders only.

## Product fields

| Field | Type | Requirement |
| --- | --- | --- |
| `id` | string | Required on a Product; generated uniquely by `createProduct` |
| `name` | string | Required and nonempty |
| `price` | string | Required and nonempty |
| `q_available` | string | Required and nonempty |
| `desc` | string | Required and nonempty |
| `photos` | array | Required and nonempty |

The user's `''` and `[]` examples describe the field types, not valid default values. Missing, `undefined`, `null`, empty, and incorrectly typed fields must cause an error. Tests treat whitespace-only strings as empty. Price and quantity stay strings; `'0'` is nonempty and valid under the current rules. Photo element formats and numeric formatting rules have not been specified.

## API behavior

- `createProduct(data)` requires the five editable fields and generates a unique, nonempty string `id` on every successful call. Callers do not need to supply an ID.
- `editProduct(id, changes)` accepts partial updates. Omitted fields keep their existing values. Any supplied field must satisfy its validation rules.
- `deleteProduct(id)` removes the selected product.
- The functions must throw or reject with an Error when required input is absent or empty. Validation errors should identify the affected field.

## Interface choices captured by the tests

These choices make the requirements executable and can be reviewed before implementation:

- `new Product(data)` accepts all six fields; the API assigns `id` before constructing a Product.
- `createProductApi()` supplies isolated `createProduct`, `editProduct`, and `deleteProduct` methods. Tests await results so storage may become asynchronous later.
- Creation and editing return the resulting Product. Deletion has no required return value.
- Creation replaces any caller-supplied ID with a generated one. IDs cannot be edited.
- Failed edits leave the stored product unchanged. Unknown IDs, including already deleted IDs, produce an error containing “not found”.
- Validation errors identify fields in their messages; no custom error class or HTTP status is prescribed.

## Deliberately deferred

There is no implemented product logic, database, HTTP server, framework, authentication, photo upload, or deployed backend. Empty update objects and additional unknown fields have no specified behavior yet. Tests must remain active and are expected to fail against the placeholders until the backend is implemented.

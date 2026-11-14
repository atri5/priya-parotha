# Priya Parotha

A responsive homepage for Priya Parotha, a home cooking business in Windemere, San Ramon. The frontend uses plain HTML, CSS, and minimal JavaScript, with no build step or runtime dependencies.

## Preview locally

Open `frontend/index.html` directly in your browser, or run a local server from the repository root:

```sh
python3 -m http.server 8000 --directory frontend
```

Then open <http://localhost:8000>.

## Hosting

Live site: [priya-parotha.priya-parotha.workers.dev](https://priya-parotha.priya-parotha.workers.dev)

Read-only sample product API: [/api/products](https://priya-parotha.priya-parotha.workers.dev/api/products)

Cloudflare Workers Static Assets hosts the frontend, read-only product API, and authentication routes; Neon Free hosts the database and password verification. The Sign in dropdown supports email/password registration, login, and sessions; Google sign-in requires OAuth credentials. Successful authentication returns to the landing page. See [backend/README.md](backend/README.md) for development/deployment and [neon/README.md](neon/README.md) for the schema. The menu shows published products; contact and phone ordering details remain to be completed.

The `frontend/` folder can also be hosted by itself on a static service, with no build command; doing so does not include the product API. The menu fetches products from the API and shows only entries whose database `published` field is `true`.

## Files

- `frontend/index.html` — page content and metadata
- `frontend/assets/css/styles.css` — responsive page styles
- `frontend/assets/js/main.js` — reduced-motion-aware tagline reveal
- `frontend/assets/js/auth.js` — shared account dropdown, registration/login, and session state
- `frontend/assets/js/menu.js` — published product loading and tag filtering
- `frontend/menu.html` — published product menu with tag filtering
- `frontend/contact.html` — separate placeholder page
- `frontend/assets/` — styles, scripts, images, and fonts grouped by type
- `frontend/docs/TODO.md` — remaining content and website work, including customer reviews
- `backend/` — product functions, authentication/session routes, CSV/Neon adapters, Cloudflare configuration, and focused tests
- `neon/` — online product schema and non-secret project metadata

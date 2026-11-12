# Priya Parotha

A responsive homepage for Priya Parotha, a home cooking business in Windemere, San Ramon. The frontend uses plain HTML, CSS, and minimal JavaScript, with no build step or runtime dependencies.

## Preview locally

Open `frontend/index.html` directly in your browser, or run a local server from the repository root:

```sh
python3 -m http.server 8000 --directory frontend
```

Then open <http://localhost:8000>.

## Hosting

Cloudflare Workers Static Assets hosts the frontend and read-only product API; Neon Free hosts the online database. See [backend/README.md](backend/README.md) for development/deployment and [neon/README.md](neon/README.md) for the schema. The menu/contact placeholders and phone ordering setup remain unchanged.

The `frontend/` folder can also be hosted by itself on a static service, with no build command; doing so does not include the product API.

## Files

- `frontend/index.html` — page content and metadata
- `frontend/styles.css` — responsive page styles
- `frontend/main.js` — reduced-motion-aware tagline reveal
- `frontend/menu.html`, `frontend/contact.html` — separate placeholder pages
- `frontend/assets/` — local images, font, and favicon
- `frontend/TODO.md` — remaining content and website work, including customer reviews
- `backend/` — product functions, CSV/Neon adapters, Cloudflare configuration, and two unit tests
- `neon/` — online product schema and non-secret project metadata

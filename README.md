# Priya Parotha

A responsive homepage for Priya Parotha, a home cooking business in Windemere, San Ramon. The frontend uses plain HTML, CSS, and minimal JavaScript, with no build step or runtime dependencies.

## Preview locally

Open `frontend/index.html` directly in your browser, or run a local server from the repository root:

```sh
python3 -m http.server 8000 --directory frontend
```

Then open <http://localhost:8000>.

## Hosting

Deploy the `frontend/` folder to a static hosting service. Use `frontend` as the publish directory and leave the build command empty. The entry point is `index.html` inside that folder.

## Files

- `frontend/index.html` — page content and metadata
- `frontend/styles.css` — responsive page styles
- `frontend/main.js` — reduced-motion-aware tagline reveal
- `frontend/menu.html`, `frontend/contact.html` — separate placeholder pages
- `frontend/assets/` — local images, font, and favicon
- `frontend/TODO.md` — remaining content and website work, including customer reviews
- `backend/` — CSV-backed product API, database interface, and two unit tests; see [backend/README.md](backend/README.md)

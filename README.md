# Priya Parotha

A minimal, responsive hello-world website built with plain HTML and CSS. No dependencies or build step required.

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
- `backend/` — CSV-backed product API, database interface, and two unit tests; see [backend/README.md](backend/README.md)

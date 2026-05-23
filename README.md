# Financial dashboard

Utility tool to estimate how long it will take to reach financial goals given income, expenses, and inflation.

**Live site:** [shantanukawale.github.io/financial-dashboard](https://shantanukawale.github.io/financial-dashboard/)

## Repository layout

| Path        | Role |
|-------------|------|
| [`frontend/`](frontend/) | Create React App — local dev, tests, and **GitHub Pages** build output |
| [`backend/`](backend/)   | Reserved for the API (Stage 2 — not wired on this branch) |

## Quick start (frontend)

From the repository root:

```bash
npm install
npm start
```

Or from `frontend/`:

```bash
cd frontend && npm install && npm start
```

- **Build:** `npm run build` (root) or `cd frontend && npm run build` → output in `frontend/build/`
- **Deploy to GitHub Pages:** `npm run deploy` from root (runs `gh-pages` on `frontend/build`)

See [`frontend/README.md`](frontend/README.md) for Create React App details.

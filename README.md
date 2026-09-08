# Wing Foil Launch Conditions

A dashboard that scores wing foiling launch spots by day, using live wind
forecasts from Open-Meteo (no API key required), a shared Supabase-backed
spot database, and a NOAA observed-wind cross-check on the current day.

## Structure

### Pages (`src/`)
- `App.jsx` — top-level shell: nav bar, page routing, merges official spots
  with community-approved ones fetched from `/api/spots`.
- `Dashboard.jsx` — the main dashboard: day tabs, map, hourly wind chart
  (scoring rules, live forecast fetching, Windfinder cross-check widget, NOAA
  observed-wind overlay).
- `AddSpotPage.jsx` — the "suggest a launch" submission form.
- `DirectoryPage.jsx` — alphabetical spot list with mini-maps.
- `NotificationsPage.jsx` — notification preference form (sending itself
  isn't wired up yet; this just saves preferences).
- `AboutPage.jsx` — methodology, sources, and project notes.
- `AdminPage.jsx` — passphrase-gated review queue for pending spot
  submissions. Not linked in the public nav; visit with `#admin` in the URL.

### Shared modules (`src/`)
- `theme.js` — shared color tokens.
- `ui.js` — shared layout/typography/form style tokens for the content pages.
- `spotData.js` — the curated "official" spot list.
- `compass.js` — converts stored degree sectors back into compass labels.
- `main.jsx` — mounts the app.

### Backend (`api/`)
Vercel serverless functions, all using `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` env vars (never exposed to the browser):
- `spots.js` — GET approved spots / POST a new submission (status: pending).
- `subscribe.js` — POST notification preferences.
- `resolve-location.js` — resolves a pasted Google Maps link to lat/lon.
- `observed.js` — fetches recent NOAA station observations for the observed
  wind overlay.
- `admin/pending.js`, `admin/review.js` — passphrase-gated (`ADMIN_PASSWORD`
  env var) endpoints for listing/approving/rejecting pending submissions.

## Local development (optional)
If you ever want to run this on your own machine instead of just editing
through Claude:

```
npm install
npm run dev
```

## Deployment
Deploys on Vercel with zero configuration — Vercel auto-detects the Vite
build and the `/api` serverless functions. Requires the three environment
variables above to be set for the database-backed features (spot
submissions, admin review, notification signups) to work.

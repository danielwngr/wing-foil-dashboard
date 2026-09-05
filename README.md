# Wing Foil Launch Conditions

A dashboard that scores wing foiling launch spots by day, using live wind
forecasts from Open-Meteo (no API key required).

## Structure
- `src/App.jsx` — the dashboard itself: spot list, wind-direction/speed
  scoring rules, the hourly chart, and the map.
- `src/main.jsx` — mounts the app.
- Everything else is standard Vite + React project scaffolding.

## Local development (optional)
If you ever want to run this on your own machine instead of just editing
through Claude:

```
npm install
npm run dev
```

## Deployment
This project is designed to deploy on Vercel with zero configuration —
Vercel auto-detects the Vite build.

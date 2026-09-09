# Context for working on this project

This file exists specifically to carry context from the original build
conversation (in claude.ai chat) into this repo, since a new Claude Code
session has no memory of that conversation. Read this before making changes.

## What this is

A personal, informal wing foiling conditions dashboard for a small group of
friends in Minnesota/Wisconsin. See README.md for full architecture. The
person behind this explicitly wants it to stay rough and free-tier where
possible -- this isn't a commercial product, don't over-engineer it.

## Things that aren't obvious from the code alone

- **Scoring logic is duplicated in two places on purpose**:
  `src/Dashboard.jsx` (client-side) and `api/_lib/scoring.js` (server-side,
  used by the notification cron). This is intentional -- the server side
  can't import Dashboard.jsx without pulling in React/browser code. If the
  scoring thresholds (12-28mph = good, etc.) ever change, **both places need
  to change together**, or the dashboard and the email notifications will
  quietly disagree with each other.
- **Only daylight hours (6am-8pm) count toward "good day" scoring**,
  everywhere, even though the dashboard's chart displays all 24 hours (with
  night hours visually dimmed). Don't let night-time wind start counting
  toward day-tab summaries, best-window calculations, or notification
  matches -- that was a deliberate choice, not an oversight.
- **SMS/text notifications are deliberately not implemented.** The `methods`
  field is hardcoded to `['email']` in both `api/subscribe.js` and
  `api/manage.js`, on purpose -- real SMS options all involve either
  meaningful recurring cost (~$11-15+/month via Twilio) or a fragile
  "keep a dedicated phone online" setup. Don't casually wire up SMS without
  discussing the tradeoff first.
- **A recurring bug pattern to watch for**: writing `\u2014` (or similar
  escape sequences) directly as raw JSX text instead of inside a JS string
  renders literally as the text `\u2014` instead of an em dash. This has
  bitten this project many times. Always use the actual Unicode character
  (—) directly in JSX text, and escape sequences only inside quoted
  strings/template literals.
- **No em dashes or en dashes anywhere in user-facing copy**, per explicit
  request -- use periods, commas, or "to" for ranges instead. This applies
  to the About page and the notification emails specifically.
- **Forecast consensus logic**: the dashboard's default forecast mode
  ("Consensus") fetches GFS, ICON, and ECMWF, checks pairwise agreement, and
  falls back to HRRR directly for short-range hours. This exists because a
  GFS-only forecast was observed to diverge significantly from ICON/ECMWF on
  at least one real day. Don't quietly revert to a single-model default.
- **The observed-wind line on today's chart** pulls from NOAA's api.weather.gov
  (free, no key). Wind speed/gust from that API come back in **km/h, not
  m/s** -- this was a real bug once already (wrong conversion factor made
  every reading ~3.6x too high). The current conversion factor is correct;
  don't change it without double-checking that unit.

## Known outstanding items (as of this file's writing)

- **The full database schema now lives in `supabase/schema.sql`** — a
  consolidated, idempotent reference safe to re-run at any time. If in doubt
  about whether a migration has been applied, that file is the source of
  truth for what *should* exist; compare it against Supabase's actual Table
  Editor if something seems off.
- The narrative-generation logic in `api/_lib/scoring.js` (`describeWindow`)
  is new and has only been sanity-checked with fabricated data, not
  real-world forecasts yet -- treat its output as worth double-checking,
  not assumed-correct.

## Working conventions from the original build

- Every code change was validated with `esbuild` (JSX and plain JS) before
  being considered done, to catch syntax errors before they ever reached
  deployment. Keep doing this, or run an equivalent build/typecheck step.
- Copy tone throughout the site is deliberately plain, honest, and slightly
  informal (see the About page) -- avoid corporate-sounding language if
  adding user-facing text.
- Environment variables in use: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `ADMIN_PASSWORD`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `SITE_URL`. No
  `RESEND_API_KEY` -- an earlier plan to use Resend was replaced with Gmail
  SMTP specifically to avoid requiring a verified custom domain.

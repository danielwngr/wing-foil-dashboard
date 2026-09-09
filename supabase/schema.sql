-- Consolidated reference of the current Supabase schema for this project.
--
-- This is a permanent, saved record of every migration run over the course
-- of building this app -- not just what happens to be visible in Supabase's
-- SQL Editor history at any given moment (that history is a browser-local
-- convenience feature, not a record of the database's actual state).
--
-- Every statement below uses "if not exists" / "if exists" guards, so this
-- entire file is safe to run again at any time, on a fresh database or an
-- already-migrated one, without erroring or duplicating anything. If you
-- ever need to recreate this database from scratch, this file is the source
-- of truth.

-- === spots ===
-- Community-submitted launch spots (curated "official" spots live in
-- src/spotData.js instead, and never touch this table).
create table if not exists spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lon double precision not null,
  sectors jsonb not null,
  description text,
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at timestamptz not null default now()
);
alter table spots enable row level security;

-- === subscribers ===
-- Notification preferences. One row per email (enforced in application code
-- via upsert-by-email in api/subscribe.js, not a DB constraint).
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  phone text, -- kept for backward compatibility; SMS is not implemented, see CLAUDE.md
  methods jsonb, -- always ['email'] going forward, enforced in application code
  spot_ids jsonb,
  threshold text, -- 'good' | 'good_and_marginal'
  lookahead_days integer,
  token text, -- private token used for the #manage page; not unique-constrained, collision odds via crypto.randomUUID() are negligible
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table subscribers add column if not exists methods jsonb;
alter table subscribers add column if not exists spot_ids jsonb;
alter table subscribers add column if not exists threshold text;
alter table subscribers add column if not exists lookahead_days integer;
alter table subscribers add column if not exists token text;
alter table subscribers add column if not exists active boolean not null default true;
alter table subscribers enable row level security;

-- === notifications_sent ===
-- Dedup log so the same (subscriber, spot, date) match never gets emailed
-- twice as a forecast date approaches. The unique constraint is what the
-- cron's "resolution=ignore-duplicates" upsert relies on.
create table if not exists notifications_sent (
  id uuid primary key default gen_random_uuid(),
  subscriber_email text not null,
  spot_id text not null,
  forecast_date date not null,
  sent_at timestamptz not null default now(),
  unique (subscriber_email, spot_id, forecast_date)
);
alter table notifications_sent enable row level security;

-- Note on RLS: all tables have RLS enabled with no permissive policies,
-- which blocks all access by default -- every server-side query in api/
-- uses the SUPABASE_SERVICE_ROLE_KEY (or newer sb_secret_... key), which
-- bypasses RLS entirely regardless of policies. This is intentional: the
-- database is never queried directly by the browser, only through our own
-- serverless functions.

-- If PostgREST ever seems out of sync after a schema change (a column or
-- table it should see but doesn't), run this to force a cache reload:
-- NOTIFY pgrst, 'reload schema';

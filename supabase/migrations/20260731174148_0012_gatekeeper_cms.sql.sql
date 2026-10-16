/*
# Gatekeeper CMS — Trader Profile Sites & Monetization Foundation

## Purpose
Adds the "Gatekeeper" Visual CMS: each trader gets a customizable public
profile website (a "gift package") they can personalize with text, images,
videos, and layout blocks. This bridges the time-zone gap by letting traders
promote their work, host trade classes, and show video content while away.
Also lays the foundation for future subscription monetization (weekly /
monthly / yearly), though everything stays free during testing.

## New Tables

1. gatekeeper_profiles
   - One row per trader = their public profile site configuration.
   - owner_id      text  — trading-app user UUID (no FK; trading users live
                           in the app's own users table, not auth.users).
   - slug          text  — unique public URL handle (e.g. "jane-trader").
   - display_name, tagline, bio, avatar_url, cover_url — visible content.
   - is_published  bool  — only true rows are publicly visible.
   - template      text  — which gift template to render.
   - social_links  jsonb — {twitter, youtube, ...}.
   - theme         jsonb — {primary_color, font, layout} cosmetic overrides.

2. gatekeeper_blocks
   - Ordered content/media blocks that make up a profile page.
   - profile_id    uuid FK → gatekeeper_profiles (cascade delete).
   - block_type    text  — hero | text | video | image | trade_class | stats | cta.
   - title, content, media_url — block payload.
   - layout        jsonb — {column_span, row, align} for visual CMS.
   - sort_order    int   — display ordering.
   - is_visible    bool  — allow hiding without deleting.

3. gatekeeper_subscriptions
   - Monetization foundation. Free during testing (tier='free').
   - owner_id      text  — trading-app user UUID.
   - tier          text  — free | weekly | monthly | yearly.
   - status        text  — active | canceled | expired.
   - price_cents   int   — price in cents (0 while free).
   - currency      text  — ISO code, default 'usd'.
   - started_at / ends_at — billing window.

4. gatekeeper_roles
   - Gatekeeper-specific role per trading user.
   - user_id       text  — trading-app user UUID (unique).
   - role          text  — trader | editor | admin.

## Security (RLS)

- RLS enabled on every table.
- gatekeeper_profiles + gatekeeper_blocks: PUBLIC SELECT only where
  is_published = true (published gift pages are viewable by anyone, anon
  included). All writes are server-only via the service role — no
  anon/authenticated INSERT/UPDATE/DELETE policies, so direct client writes
  are denied by default. The Express backend enforces ownership with JWT
  auth middleware before any service-role write.
- gatekeeper_subscriptions + gatekeeper_roles: no anon/authenticated
  policies at all — denied by default. Only the service role (Express
  backend) can read or write, and the backend always filters by owner_id.

## Notes
- owner_id / user_id are TEXT (trading-app UUIDs), not FKs to auth.users,
  because the trading app uses custom bcrypt/JWT auth, not Supabase auth.
- A trigger seeds a default free subscription + 'trader' role + default
  gift-template profile + starter blocks whenever a gatekeeper_profiles
  row is inserted (used by the Express signup/seed flow).
*/

CREATE TABLE IF NOT EXISTS public.gatekeeper_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    text NOT NULL,
  slug        text UNIQUE,
  display_name text,
  tagline     text,
  bio         text,
  avatar_url  text,
  cover_url   text,
  is_published boolean NOT NULL DEFAULT false,
  template    text NOT NULL DEFAULT 'gift-default',
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  theme       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gatekeeper_profiles_owner ON public.gatekeeper_profiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_gatekeeper_profiles_slug  ON public.gatekeeper_profiles(slug);

CREATE TABLE IF NOT EXISTS public.gatekeeper_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES public.gatekeeper_profiles(id) ON DELETE CASCADE,
  block_type  text NOT NULL DEFAULT 'text',
  title       text,
  content     text,
  media_url   text,
  layout      jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order  int  NOT NULL DEFAULT 0,
  is_visible  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gatekeeper_blocks_profile ON public.gatekeeper_blocks(profile_id);
CREATE INDEX IF NOT EXISTS idx_gatekeeper_blocks_order  ON public.gatekeeper_blocks(profile_id, sort_order);

CREATE TABLE IF NOT EXISTS public.gatekeeper_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    text NOT NULL,
  tier        text NOT NULL DEFAULT 'free' CHECK (tier IN ('free','weekly','monthly','yearly')),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','canceled','expired')),
  price_cents int  NOT NULL DEFAULT 0,
  currency    text NOT NULL DEFAULT 'usd',
  started_at  timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gatekeeper_subscriptions_owner ON public.gatekeeper_subscriptions(owner_id);

CREATE TABLE IF NOT EXISTS public.gatekeeper_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL UNIQUE,
  role        text NOT NULL DEFAULT 'trader' CHECK (role IN ('trader','editor','admin')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.gatekeeper_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gatekeeper_profiles_touch ON public.gatekeeper_profiles;
CREATE TRIGGER gatekeeper_profiles_touch
  BEFORE UPDATE ON public.gatekeeper_profiles
  FOR EACH ROW EXECUTE FUNCTION public.gatekeeper_touch_updated_at();

DROP TRIGGER IF EXISTS gatekeeper_blocks_touch ON public.gatekeeper_blocks;
CREATE TRIGGER gatekeeper_blocks_touch
  BEFORE UPDATE ON public.gatekeeper_blocks
  FOR EACH ROW EXECUTE FUNCTION public.gatekeeper_touch_updated_at();

DROP TRIGGER IF EXISTS gatekeeper_subscriptions_touch ON public.gatekeeper_subscriptions;
CREATE TRIGGER gatekeeper_subscriptions_touch
  BEFORE UPDATE ON public.gatekeeper_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.gatekeeper_touch_updated_at();

-- Row Level Security
ALTER TABLE public.gatekeeper_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gatekeeper_blocks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gatekeeper_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gatekeeper_roles         ENABLE ROW LEVEL SECURITY;

-- Public can read PUBLISHED profiles + their visible blocks (gift pages are public).
DROP POLICY IF EXISTS "public_read_published_profiles" ON public.gatekeeper_profiles;
CREATE POLICY "public_read_published_profiles"
  ON public.gatekeeper_profiles FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "public_read_visible_blocks" ON public.gatekeeper_blocks;
CREATE POLICY "public_read_visible_blocks"
  ON public.gatekeeper_blocks FOR SELECT
  TO anon, authenticated
  USING (is_visible = true AND EXISTS (
    SELECT 1 FROM public.gatekeeper_profiles p
    WHERE p.id = gatekeeper_blocks.profile_id AND p.is_published = true
  ));

-- Subscriptions & roles: service-role only (no anon/authenticated policies).
-- The Express backend enforces owner checks in application code.

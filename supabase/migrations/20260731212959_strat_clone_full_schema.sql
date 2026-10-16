/*
# Strat-Clone Engine — Full Trading Platform Schema

## Purpose
Creates the complete database schema for the Strat-Clone Engine trading platform:
custom user auth, broker credentials, trade datasets, ML strategy models, trading bots,
execution logs, and the Gatekeeper CMS (trader profile sites with blocks, subscriptions,
roles, admin status, messages, and media).

## New Tables

1. users — Custom user accounts (email/password, not Supabase auth)
2. broker_credentials — Encrypted Alpaca API keys per user
3. trade_datasets — Uploaded CSV/TSV/TXT trade history files
4. parsed_trades — Normalized individual trade rows parsed from datasets
5. strategy_models — ML-extracted behavioral trading patterns
6. trading_bots — Automated trading bot configurations
7. execution_logs — Audit trail of all bot trading actions
8. gatekeeper_profiles — Trader public profile site config (one per user)
9. gatekeeper_blocks — Ordered content/media blocks for profile pages
10. gatekeeper_subscriptions — Monetization tier tracking (free during testing)
11. gatekeeper_roles — Gatekeeper-specific roles (trader/editor/admin)
12. gatekeeper_admin_status — Approval status (pending/approved/revoked)
13. gatekeeper_messages — Visitor contact form messages to profile owners
14. gatekeeper_media — Uploaded media files for profile blocks

## Security (RLS)
- All tables have RLS enabled.
- The Express backend uses the service role key (bypasses RLS) and enforces
  ownership checks in application code via JWT auth middleware.
- gatekeeper_profiles + gatekeeper_blocks: public SELECT for published profiles
  so anon visitors can view live gift websites.
- All other tables: no anon/authenticated policies — service-role only.
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. USERS — custom auth (bcrypt + JWT, not Supabase auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  full_name     varchar(255),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. BROKER CREDENTIALS — encrypted Alpaca API keys
-- ============================================================
CREATE TABLE IF NOT EXISTS public.broker_credentials (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,
  broker_name           varchar(100) NOT NULL DEFAULT 'alpaca',
  api_key_encrypted     text NOT NULL,
  api_secret_encrypted  text NOT NULL,
  is_paper_trading      boolean DEFAULT true,
  is_active             boolean DEFAULT false,
  last_tested_at        timestamptz,
  connection_status     varchar(50) DEFAULT 'disconnected',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE(user_id, broker_name)
);
ALTER TABLE public.broker_credentials ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_broker_credentials_user ON public.broker_credentials(user_id);

-- ============================================================
-- 3. TRADE DATASETS — uploaded CSV files
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trade_datasets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  name             varchar(255) NOT NULL,
  original_filename varchar(255),
  file_path        text,
  status           varchar(20) NOT NULL DEFAULT 'uploaded',
  column_mapping   jsonb,
  row_count        integer NOT NULL DEFAULT 0,
  error_message    text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
ALTER TABLE public.trade_datasets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_trade_datasets_user ON public.trade_datasets(user_id);

-- ============================================================
-- 4. PARSED TRADES — normalized trade rows
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parsed_trades (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id       uuid NOT NULL,
  user_id          uuid NOT NULL,
  timestamp        timestamptz,
  symbol           varchar(50),
  entry_price      numeric,
  exit_price       numeric,
  pnl              numeric,
  side             varchar(10),
  duration_minutes integer,
  asset_class      varchar(50),
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE public.parsed_trades ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_parsed_trades_dataset ON public.parsed_trades(dataset_id);
CREATE INDEX IF NOT EXISTS idx_parsed_trades_user ON public.parsed_trades(user_id);

-- ============================================================
-- 5. STRATEGY MODELS — ML behavioral patterns
-- ============================================================
CREATE TABLE IF NOT EXISTS public.strategy_models (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL,
  dataset_id                    uuid NOT NULL,
  name                          varchar(255) NOT NULL,
  status                        varchar(50) DEFAULT 'training',
  win_rate                      numeric(5,2),
  avg_risk_reward               numeric(8,4),
  avg_trade_duration_minutes    integer,
  preferred_asset_classes       jsonb,
  ruleset                       jsonb,
  metrics                       jsonb,
  created_at                    timestamptz DEFAULT now(),
  updated_at                    timestamptz DEFAULT now()
);
ALTER TABLE public.strategy_models ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_strategy_models_user ON public.strategy_models(user_id);

-- ============================================================
-- 6. TRADING BOTS — automated execution configs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trading_bots (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL,
  model_id               uuid NOT NULL,
  broker_credential_id   uuid,
  name                   varchar(255) NOT NULL,
  status                 varchar(50) DEFAULT 'inactive',
  max_daily_loss         numeric(18,8) DEFAULT 1000,
  current_daily_pnl      numeric(18,8) DEFAULT 0,
  risk_reset_at          date DEFAULT CURRENT_DATE,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);
ALTER TABLE public.trading_bots ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_trading_bots_user ON public.trading_bots(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_bots_status ON public.trading_bots(status);

-- ============================================================
-- 7. EXECUTION LOGS — audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS public.execution_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  bot_id           uuid,
  model_id         uuid,
  action           varchar(20) NOT NULL,
  symbol           varchar(20),
  quantity         numeric(18,8),
  price            numeric(18,8),
  status           varchar(50) NOT NULL,
  broker_response  jsonb,
  message          text,
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_execution_logs_user ON public.execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_bot ON public.execution_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_created ON public.execution_logs(created_at DESC);

-- ============================================================
-- 8. GATEKEEPER PROFILES — trader public site config
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gatekeeper_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL,
  slug          varchar(100) UNIQUE,
  display_name  varchar(255),
  tagline       varchar(255),
  bio           text,
  avatar_url    text,
  cover_url     text,
  is_published  boolean NOT NULL DEFAULT false,
  template      varchar(50) NOT NULL DEFAULT 'gift-default',
  social_links  jsonb NOT NULL DEFAULT '{}'::jsonb,
  theme         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
ALTER TABLE public.gatekeeper_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gatekeeper_profiles_owner ON public.gatekeeper_profiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_gatekeeper_profiles_slug ON public.gatekeeper_profiles(slug);

-- ============================================================
-- 9. GATEKEEPER BLOCKS — content/media blocks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gatekeeper_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES public.gatekeeper_profiles(id) ON DELETE CASCADE,
  block_type  varchar(50) NOT NULL DEFAULT 'text',
  title       varchar(255),
  content     text,
  media_url   text,
  layout      jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order  integer NOT NULL DEFAULT 0,
  is_visible  boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE public.gatekeeper_blocks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gatekeeper_blocks_profile ON public.gatekeeper_blocks(profile_id);
CREATE INDEX IF NOT EXISTS idx_gatekeeper_blocks_order ON public.gatekeeper_blocks(profile_id, sort_order);

-- ============================================================
-- 10. GATEKEEPER SUBSCRIPTIONS — monetization
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gatekeeper_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL,
  tier        varchar(20) NOT NULL DEFAULT 'free' CHECK (tier IN ('free','weekly','monthly','yearly')),
  status      varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','canceled','expired')),
  price_cents integer NOT NULL DEFAULT 0,
  currency    varchar(10) NOT NULL DEFAULT 'usd',
  started_at  timestamptz DEFAULT now(),
  ends_at     timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE public.gatekeeper_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gatekeeper_subscriptions_owner ON public.gatekeeper_subscriptions(owner_id);

-- ============================================================
-- 11. GATEKEEPER ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gatekeeper_roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE,
  role            varchar(20) NOT NULL DEFAULT 'trader' CHECK (role IN ('trader','editor','admin')),
  approval_status varchar(20) NOT NULL DEFAULT 'approved',
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.gatekeeper_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 12. GATEKEEPER ADMIN STATUS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gatekeeper_admin_status (
  user_id    uuid NOT NULL UNIQUE,
  email      text NOT NULL,
  status     varchar(20) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','revoked')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.gatekeeper_admin_status ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 13. GATEKEEPER MESSAGES — visitor contact form
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gatekeeper_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES public.gatekeeper_profiles(id) ON DELETE CASCADE,
  sender_name  varchar(255) NOT NULL,
  sender_email varchar(255) NOT NULL,
  message      text NOT NULL,
  page         varchar(50) DEFAULT 'contact',
  is_read      boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.gatekeeper_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gatekeeper_messages_profile ON public.gatekeeper_messages(profile_id);

-- ============================================================
-- 14. GATEKEEPER MEDIA — uploaded media files
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gatekeeper_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES public.gatekeeper_profiles(id) ON DELETE CASCADE,
  block_id    uuid REFERENCES public.gatekeeper_blocks(id) ON DELETE SET NULL,
  media_type  varchar(20) NOT NULL DEFAULT 'image',
  url         text NOT NULL,
  filename    varchar(255),
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.gatekeeper_media ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gatekeeper_media_profile ON public.gatekeeper_media(profile_id);

-- ============================================================
-- PUBLIC READ POLICIES for published gatekeeper profiles + blocks
-- (so anon visitors can view live gift websites)
-- ============================================================
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

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS broker_credentials_updated_at ON public.broker_credentials;
CREATE TRIGGER broker_credentials_updated_at BEFORE UPDATE ON public.broker_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trade_datasets_updated_at ON public.trade_datasets;
CREATE TRIGGER trade_datasets_updated_at BEFORE UPDATE ON public.trade_datasets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS strategy_models_updated_at ON public.strategy_models;
CREATE TRIGGER strategy_models_updated_at BEFORE UPDATE ON public.strategy_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trading_bots_updated_at ON public.trading_bots;
CREATE TRIGGER trading_bots_updated_at BEFORE UPDATE ON public.trading_bots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.gatekeeper_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gatekeeper_profiles_touch ON public.gatekeeper_profiles;
CREATE TRIGGER gatekeeper_profiles_touch BEFORE UPDATE ON public.gatekeeper_profiles
  FOR EACH ROW EXECUTE FUNCTION public.gatekeeper_touch_updated_at();

DROP TRIGGER IF EXISTS gatekeeper_blocks_touch ON public.gatekeeper_blocks;
CREATE TRIGGER gatekeeper_blocks_touch BEFORE UPDATE ON public.gatekeeper_blocks
  FOR EACH ROW EXECUTE FUNCTION public.gatekeeper_touch_updated_at();

DROP TRIGGER IF EXISTS gatekeeper_subscriptions_touch ON public.gatekeeper_subscriptions;
CREATE TRIGGER gatekeeper_subscriptions_touch BEFORE UPDATE ON public.gatekeeper_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.gatekeeper_touch_updated_at();

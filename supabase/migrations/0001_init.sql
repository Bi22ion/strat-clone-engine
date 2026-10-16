-- NexusLive initial schema (minimal runnable foundation)

create extension if not exists pgcrypto;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  role text not null default 'viewer' check (role in ('viewer', 'host', 'agency_master', 'super_admin')),
  stealth_mode boolean not null default false,
  created_at timestamptz not null default now()
);

-- Organizations (guilds/studios)
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'host' check (member_role in ('host', 'manager')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Wallets
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallet_type text not null check (wallet_type in ('tokens', 'diamonds')),
  balance bigint not null default 0,
  currency text not null default 'VIRTUAL',
  updated_at timestamptz not null default now(),
  unique (user_id, wallet_type)
);

-- Global commission config ("Programmer's Cut")
create table if not exists public.platform_config (
  id int primary key default 1,
  platform_fee_bps int not null default 3000 check (platform_fee_bps >= 0 and platform_fee_bps <= 10000),
  host_share_bps int not null default 6000 check (host_share_bps >= 0 and host_share_bps <= 10000),
  agency_share_bps int not null default 1000 check (agency_share_bps >= 0 and agency_share_bps <= 10000),
  updated_at timestamptz not null default now(),
  constraint platform_config_sum check (platform_fee_bps + host_share_bps + agency_share_bps = 10000)
);

insert into public.platform_config (id) values (1)
on conflict (id) do nothing;

-- Ledger (append-only)
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  from_user_id uuid references public.profiles(id) on delete set null,
  to_user_id uuid references public.profiles(id) on delete set null,
  org_id uuid references public.orgs(id) on delete set null,
  amount_tokens bigint,
  amount_diamonds bigint,
  platform_fee_tokens bigint,
  host_amount_diamonds bigint,
  agency_amount_diamonds bigint,
  pk_session_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

-- PK sessions
create table if not exists public.pk_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  starts_at timestamptz not null default now(),
  duration_seconds int not null default 300,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  paused_reason text,
  host_a_id uuid not null references public.profiles(id) on delete restrict,
  host_b_id uuid not null references public.profiles(id) on delete restrict,
  org_a_id uuid references public.orgs(id) on delete set null,
  org_b_id uuid references public.orgs(id) on delete set null,
  score_a bigint not null default 0,
  score_b bigint not null default 0,
  winner_host_id uuid references public.profiles(id) on delete set null
);

create table if not exists public.pk_heartbeats (
  session_id uuid not null references public.pk_sessions(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (session_id, host_id)
);

-- Minimal helper: updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wallets_touch on public.wallets;
create trigger wallets_touch
before update on public.wallets
for each row execute function public.touch_updated_at();

-- Realtime publication (tables needed for PK UI)
alter publication supabase_realtime add table public.pk_sessions;
alter publication supabase_realtime add table public.pk_heartbeats;

-- Activation migration: align splits + add transactions table (70/20/10)

-- Update default platform config to 20% platform, 70% host, 10% agency
update public.platform_config
set
  platform_fee_bps = 2000,
  host_share_bps = 7000,
  agency_share_bps = 1000,
  updated_at = now()
where id = 1;

-- Add denormalized wallet columns on profiles for simplified UI reads
alter table public.profiles
add column if not exists wallet_tokens bigint not null default 0,
add column if not exists wallet_diamonds bigint not null default 0;

-- Optional: compact roles to match prompt ('agency' instead of 'agency_master')
update public.profiles set role = 'agency_master' where role = 'agency';

-- PK sessions prompt-compatible columns
alter table public.pk_sessions
add column if not exists end_time timestamptz;

-- Transactions (prompt naming)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sender_id uuid not null references public.profiles(id) on delete restrict,
  receiver_id uuid not null references public.profiles(id) on delete restrict,
  gross_amount bigint not null,
  platform_fee bigint not null,
  agency_fee bigint not null,
  host_net_amount bigint not null,
  pk_session_id uuid references public.pk_sessions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.transactions enable row level security;

drop policy if exists "transactions: read own" on public.transactions;
create policy "transactions: read own"
on public.transactions for select
to authenticated
using (
  sender_id = auth.uid()
  or receiver_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
);

drop policy if exists "transactions: no direct writes" on public.transactions;
create policy "transactions: no direct writes"
on public.transactions for all
to authenticated
using (false)
with check (false);

-- Keep profiles.wallet_* in sync from wallets table
create or replace function public.sync_profile_wallet_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
  set
    wallet_tokens = coalesce((
      select w.balance from public.wallets w
      where w.user_id = p.id and w.wallet_type = 'tokens'
    ), 0),
    wallet_diamonds = coalesce((
      select w.balance from public.wallets w
      where w.user_id = p.id and w.wallet_type = 'diamonds'
    ), 0)
  where p.id = new.user_id;
  return new;
end;
$$;

revoke all on function public.sync_profile_wallet_totals() from public;
grant execute on function public.sync_profile_wallet_totals() to service_role;

drop trigger if exists wallets_sync_profile on public.wallets;
create trigger wallets_sync_profile
after insert or update on public.wallets
for each row execute function public.sync_profile_wallet_totals();

-- Update gift processing function to also write into `transactions` with 70/20/10
create or replace function public.process_gift(
  p_pk_session_id uuid,
  p_from_user_id uuid,
  p_to_host_id uuid,
  p_tokens_amount int,
  p_org_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg record;
  v_platform_fee_tokens bigint;
  v_host_tokens bigint;
  v_host_diamonds bigint;
  v_agency_diamonds bigint;
  v_host_wallet uuid;
  v_from_wallet uuid;
begin
  if p_tokens_amount <= 0 then
    raise exception 'tokens_amount_must_be_positive';
  end if;

  select * into v_cfg from public.platform_config where id = 1;
  if v_cfg is null then
    raise exception 'platform_config_missing';
  end if;

  v_platform_fee_tokens := (p_tokens_amount::bigint * v_cfg.platform_fee_bps) / 10000;
  v_host_tokens := (p_tokens_amount::bigint - v_platform_fee_tokens);

  -- 1 token -> 1 diamond conversion (adjust later)
  v_host_diamonds := (v_host_tokens * v_cfg.host_share_bps) / 10000;
  v_agency_diamonds := (v_host_tokens * v_cfg.agency_share_bps) / 10000;

  v_from_wallet := public.ensure_wallet(p_from_user_id, 'tokens');
  v_host_wallet := public.ensure_wallet(p_to_host_id, 'diamonds');

  update public.wallets
    set balance = balance - p_tokens_amount::bigint
  where id = v_from_wallet
    and balance >= p_tokens_amount::bigint;

  if not found then
    raise exception 'insufficient_tokens';
  end if;

  update public.wallets
    set balance = balance + v_host_diamonds
  where id = v_host_wallet;

  insert into public.ledger_entries (
    event_type,
    from_user_id,
    to_user_id,
    org_id,
    amount_tokens,
    platform_fee_tokens,
    host_amount_diamonds,
    agency_amount_diamonds,
    pk_session_id,
    metadata
  ) values (
    'gift',
    p_from_user_id,
    p_to_host_id,
    p_org_id,
    p_tokens_amount::bigint,
    v_platform_fee_tokens,
    v_host_diamonds,
    v_agency_diamonds,
    p_pk_session_id,
    jsonb_build_object('split_bps', jsonb_build_object('platform', v_cfg.platform_fee_bps, 'host', v_cfg.host_share_bps, 'agency', v_cfg.agency_share_bps))
  );

  insert into public.transactions (
    sender_id,
    receiver_id,
    gross_amount,
    platform_fee,
    agency_fee,
    host_net_amount,
    pk_session_id,
    metadata
  ) values (
    p_from_user_id,
    p_to_host_id,
    p_tokens_amount::bigint,
    v_platform_fee_tokens,
    v_agency_diamonds,
    v_host_diamonds,
    p_pk_session_id,
    jsonb_build_object('conversion', '1token=1diamond')
  );

  if p_pk_session_id is not null then
    update public.pk_sessions
      set
        score_a = score_a + case when host_a_id = p_to_host_id then p_tokens_amount::bigint else 0 end,
        score_b = score_b + case when host_b_id = p_to_host_id then p_tokens_amount::bigint else 0 end
    where id = p_pk_session_id;
  end if;

  return jsonb_build_object(
    'platform_fee_tokens', v_platform_fee_tokens,
    'host_diamonds', v_host_diamonds,
    'agency_diamonds', v_agency_diamonds
  );
end;
$$;

revoke all on function public.process_gift(uuid, uuid, uuid, int, uuid) from public;
grant execute on function public.process_gift(uuid, uuid, uuid, int, uuid) to service_role;


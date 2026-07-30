-- VOD / paid replay MVP

create table if not exists public.vod_assets (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  source_stream_id uuid references public.program_schedule(id) on delete set null,
  title text not null,
  description text,
  playback_url text,
  thumbnail_url text,
  duration_seconds int,
  price_tokens int not null default 50 check (price_tokens >= 0),
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  visibility text not null default 'paid' check (visibility in ('paid', 'public', 'private')),
  recorded_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_vod_assets_host_created on public.vod_assets(host_id, created_at desc);
create index if not exists idx_vod_assets_status_visibility on public.vod_assets(status, visibility);

create table if not exists public.vod_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  vod_id uuid not null references public.vod_assets(id) on delete cascade,
  purchased_at timestamptz not null default now(),
  price_tokens int not null default 0,
  primary key (user_id, vod_id)
);

create table if not exists public.recording_jobs (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  stream_id uuid references public.program_schedule(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  input_url text,
  output_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recording_jobs_host_created on public.recording_jobs(host_id, created_at desc);

alter table public.vod_assets enable row level security;
alter table public.vod_access enable row level security;
alter table public.recording_jobs enable row level security;

drop policy if exists "vod_assets: read ready public_or_paid" on public.vod_assets;
create policy "vod_assets: read ready public_or_paid"
on public.vod_assets for select
using (status = 'ready' and visibility in ('public', 'paid'));

drop policy if exists "vod_assets: host manage own" on public.vod_assets;
create policy "vod_assets: host manage own"
on public.vod_assets for all
to authenticated
using (host_id = auth.uid())
with check (host_id = auth.uid());

drop policy if exists "vod_access: read own" on public.vod_access;
create policy "vod_access: read own"
on public.vod_access for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "recording_jobs: host read own" on public.recording_jobs;
create policy "recording_jobs: host read own"
on public.recording_jobs for select
to authenticated
using (host_id = auth.uid());

drop policy if exists "recording_jobs: host insert own" on public.recording_jobs;
create policy "recording_jobs: host insert own"
on public.recording_jobs for insert
to authenticated
with check (host_id = auth.uid());

create or replace function public.purchase_vod_access(p_vod_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_vod public.vod_assets%rowtype;
  v_wallet uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'auth_required';
  end if;

  select * into v_vod
  from public.vod_assets
  where id = p_vod_id
    and status = 'ready'
    and visibility in ('public', 'paid');

  if v_vod is null then
    raise exception 'vod_not_available';
  end if;

  if exists (
    select 1 from public.vod_access
    where user_id = v_uid and vod_id = p_vod_id
  ) then
    return jsonb_build_object('ok', true, 'already_owned', true);
  end if;

  if v_vod.visibility = 'public' or v_vod.price_tokens = 0 then
    insert into public.vod_access (user_id, vod_id, price_tokens)
    values (v_uid, p_vod_id, 0);
    return jsonb_build_object('ok', true, 'price_tokens', 0);
  end if;

  v_wallet := public.ensure_wallet(v_uid, 'tokens');
  update public.wallets
    set balance = balance - v_vod.price_tokens
  where id = v_wallet and balance >= v_vod.price_tokens;

  if not found then
    raise exception 'insufficient_tokens';
  end if;

  insert into public.vod_access (user_id, vod_id, price_tokens)
  values (v_uid, p_vod_id, v_vod.price_tokens);

  insert into public.ledger_entries (
    event_type,
    from_user_id,
    to_user_id,
    amount_tokens,
    metadata
  ) values (
    'vod_purchase',
    v_uid,
    v_vod.host_id,
    v_vod.price_tokens,
    jsonb_build_object('vod_id', p_vod_id)
  );

  return jsonb_build_object('ok', true, 'price_tokens', v_vod.price_tokens);
end;
$$;

revoke all on function public.purchase_vod_access(uuid) from public;
grant execute on function public.purchase_vod_access(uuid) to authenticated;


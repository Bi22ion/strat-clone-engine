-- Private room controls for live streams

alter table public.program_schedule
add column if not exists is_private boolean not null default false,
add column if not exists private_entry_tokens int not null default 100;

create table if not exists public.stream_private_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  stream_id uuid not null references public.program_schedule(id) on delete cascade,
  purchased_at timestamptz not null default now(),
  price_tokens int not null default 0,
  primary key (user_id, stream_id)
);

alter table public.stream_private_access enable row level security;

drop policy if exists "stream_private_access: read own" on public.stream_private_access;
create policy "stream_private_access: read own"
on public.stream_private_access for select
to authenticated
using (user_id = auth.uid());

create or replace function public.unlock_private_room(p_stream_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_stream public.program_schedule%rowtype;
  v_wallet uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'auth_required';
  end if;

  select * into v_stream
  from public.program_schedule
  where id = p_stream_id
    and status = 'live';

  if v_stream is null then
    raise exception 'stream_not_live';
  end if;

  if coalesce(v_stream.is_private, false) = false then
    return jsonb_build_object('ok', true, 'already_public', true);
  end if;

  if exists (
    select 1 from public.stream_private_access
    where user_id = v_uid and stream_id = p_stream_id
  ) then
    return jsonb_build_object('ok', true, 'already_unlocked', true);
  end if;

  v_wallet := public.ensure_wallet(v_uid, 'tokens');
  update public.wallets
    set balance = balance - v_stream.private_entry_tokens
  where id = v_wallet and balance >= v_stream.private_entry_tokens;

  if not found then
    raise exception 'insufficient_tokens';
  end if;

  insert into public.stream_private_access (user_id, stream_id, price_tokens)
  values (v_uid, p_stream_id, v_stream.private_entry_tokens);

  insert into public.ledger_entries (
    event_type,
    from_user_id,
    to_user_id,
    amount_tokens,
    metadata
  ) values (
    'private_room_unlock',
    v_uid,
    v_stream.host,
    v_stream.private_entry_tokens,
    jsonb_build_object('stream_id', p_stream_id)
  );

  return jsonb_build_object('ok', true, 'price_tokens', v_stream.private_entry_tokens);
end;
$$;

revoke all on function public.unlock_private_room(uuid) from public;
grant execute on function public.unlock_private_room(uuid) to authenticated;


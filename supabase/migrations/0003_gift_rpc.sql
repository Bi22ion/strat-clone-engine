-- Atomic gift processing for Edge Function

create or replace function public.ensure_wallet(p_user_id uuid, p_wallet_type text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
begin
  select id into v_wallet_id
  from public.wallets
  where user_id = p_user_id and wallet_type = p_wallet_type;

  if v_wallet_id is null then
    insert into public.wallets (user_id, wallet_type, balance, currency)
    values (p_user_id, p_wallet_type, 0, 'VIRTUAL')
    returning id into v_wallet_id;
  end if;

  return v_wallet_id;
end;
$$;

revoke all on function public.ensure_wallet(uuid, text) from public;
grant execute on function public.ensure_wallet(uuid, text) to service_role;

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

  -- Decrement viewer tokens
  update public.wallets
    set balance = balance - p_tokens_amount::bigint
  where id = v_from_wallet
    and balance >= p_tokens_amount::bigint;

  if not found then
    raise exception 'insufficient_tokens';
  end if;

  -- Credit host diamonds
  update public.wallets
    set balance = balance + v_host_diamonds
  where id = v_host_wallet;

  -- Append ledger
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
    jsonb_build_object('conversion', '1token=1diamond')
  );

  -- Update PK score if applicable (count full tokens toward score)
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


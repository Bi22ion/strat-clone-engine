-- Compatibility shim: ensure `pk_battles` exists for the frontend.
-- If you already have a real `pk_battles` table, you can skip this.

do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'pk_battles'
  ) then
    -- If pk_sessions exists, create a view alias to satisfy PostgREST queries.
    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'pk_sessions'
    ) then
      execute $v$
        create view public.pk_battles as
        select
          id,
          host_a_id,
          host_b_id,
          score_a as host_a_score,
          score_b as host_b_score,
          status,
          created_at,
          starts_at
        from public.pk_sessions
      $v$;
    end if;
  end if;
end $$;


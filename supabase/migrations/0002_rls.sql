-- RLS policies: minimal safe defaults

alter table public.profiles enable row level security;
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.pk_sessions enable row level security;
alter table public.pk_heartbeats enable row level security;
alter table public.platform_config enable row level security;

-- Profiles
drop policy if exists "profiles: read public" on public.profiles;
create policy "profiles: read public"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profiles: update self" on public.profiles;
create policy "profiles: update self"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Orgs + memberships: owner can manage; members can read
drop policy if exists "orgs: read if member" on public.orgs;
create policy "orgs: read if member"
on public.orgs for select
to authenticated
using (
  exists (
    select 1
    from public.org_members m
    where m.org_id = orgs.id and m.user_id = auth.uid()
  )
  or owner_id = auth.uid()
);

drop policy if exists "orgs: insert by agency_master+"
on public.orgs;
create policy "orgs: insert by agency_master+"
on public.orgs for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('agency_master', 'super_admin')
  )
  and owner_id = auth.uid()
);

drop policy if exists "orgs: update by owner" on public.orgs;
create policy "orgs: update by owner"
on public.orgs for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "org_members: read if member" on public.org_members;
create policy "org_members: read if member"
on public.org_members for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.orgs o
    where o.id = org_members.org_id and o.owner_id = auth.uid()
  )
);

drop policy if exists "org_members: insert by owner" on public.org_members;
create policy "org_members: insert by owner"
on public.org_members for insert
to authenticated
with check (
  exists (
    select 1 from public.orgs o
    where o.id = org_members.org_id and o.owner_id = auth.uid()
  )
);

drop policy if exists "org_members: delete by owner" on public.org_members;
create policy "org_members: delete by owner"
on public.org_members for delete
to authenticated
using (
  exists (
    select 1 from public.orgs o
    where o.id = org_members.org_id and o.owner_id = auth.uid()
  )
);

-- Wallets: only owner can read; only edge service role should modify balances
drop policy if exists "wallets: read own" on public.wallets;
create policy "wallets: read own"
on public.wallets for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "wallets: no direct writes" on public.wallets;
create policy "wallets: no direct writes"
on public.wallets for all
to authenticated
using (false)
with check (false);

-- Ledger: only involved parties can read; no direct writes
drop policy if exists "ledger: read own" on public.ledger_entries;
create policy "ledger: read own"
on public.ledger_entries for select
to authenticated
using (
  from_user_id = auth.uid()
  or to_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
);

drop policy if exists "ledger: no direct writes" on public.ledger_entries;
create policy "ledger: no direct writes"
on public.ledger_entries for all
to authenticated
using (false)
with check (false);

-- PK sessions: any authenticated user can read basic state; only hosts/superadmin can update heartbeat
drop policy if exists "pk_sessions: read authenticated" on public.pk_sessions;
create policy "pk_sessions: read authenticated"
on public.pk_sessions for select
to authenticated
using (true);

drop policy if exists "pk_sessions: update by participants" on public.pk_sessions;
create policy "pk_sessions: update by participants"
on public.pk_sessions for update
to authenticated
using (host_a_id = auth.uid() or host_b_id = auth.uid())
with check (host_a_id = host_a_id and host_b_id = host_b_id);

drop policy if exists "pk_sessions: insert by hosts" on public.pk_sessions;
create policy "pk_sessions: insert by hosts"
on public.pk_sessions for insert
to authenticated
with check (host_a_id = auth.uid() or host_b_id = auth.uid());

drop policy if exists "pk_heartbeats: read authenticated" on public.pk_heartbeats;
create policy "pk_heartbeats: read authenticated"
on public.pk_heartbeats for select
to authenticated
using (true);

drop policy if exists "pk_heartbeats: upsert by host/self" on public.pk_heartbeats;
create policy "pk_heartbeats: upsert by host/self"
on public.pk_heartbeats for insert
to authenticated
with check (host_id = auth.uid());

drop policy if exists "pk_heartbeats: update by host/self" on public.pk_heartbeats;
create policy "pk_heartbeats: update by host/self"
on public.pk_heartbeats for update
to authenticated
using (host_id = auth.uid())
with check (host_id = auth.uid());

-- Platform config: only super_admin can read/write
drop policy if exists "platform_config: super_admin only" on public.platform_config;
create policy "platform_config: super_admin only"
on public.platform_config for all
to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
);

-- Super admin stealth mode: they can read all profiles even if stealth,
-- but the *app* must omit stealth admins from public viewer lists.

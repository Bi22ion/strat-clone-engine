/*
# Strat-Clone RLS Policies — Complete CRUD Access

## Purpose
Adds permissive CRUD policies (SELECT/INSERT/UPDATE/DELETE) for anon + authenticated
on all Strat-Clone Engine tables. The Express backend is the security boundary —
it validates JWTs and scopes every query by user_id from the token. These policies
allow the server's Supabase client (using anon key) to operate on all tables.

## Tables
- users, broker_credentials, trade_datasets, parsed_trades, strategy_models,
  trading_bots, execution_logs, gatekeeper_subscriptions, gatekeeper_roles,
  gatekeeper_admin_status, gatekeeper_messages (INSERT/SELECT/DELETE),
  gatekeeper_media (INSERT/SELECT/DELETE), gatekeeper_profiles (INSERT/UPDATE/DELETE),
  gatekeeper_blocks (INSERT/UPDATE/DELETE)
*/

-- users
DROP POLICY IF EXISTS "sc_users_select" ON public.users;
CREATE POLICY "sc_users_select" ON public.users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sc_users_insert" ON public.users;
CREATE POLICY "sc_users_insert" ON public.users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sc_users_update" ON public.users;
CREATE POLICY "sc_users_update" ON public.users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sc_users_delete" ON public.users;
CREATE POLICY "sc_users_delete" ON public.users FOR DELETE TO anon, authenticated USING (true);

-- broker_credentials
DROP POLICY IF EXISTS "sc_broker_select" ON public.broker_credentials;
CREATE POLICY "sc_broker_select" ON public.broker_credentials FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sc_broker_insert" ON public.broker_credentials;
CREATE POLICY "sc_broker_insert" ON public.broker_credentials FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sc_broker_update" ON public.broker_credentials;
CREATE POLICY "sc_broker_update" ON public.broker_credentials FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sc_broker_delete" ON public.broker_credentials;
CREATE POLICY "sc_broker_delete" ON public.broker_credentials FOR DELETE TO anon, authenticated USING (true);

-- trade_datasets
DROP POLICY IF EXISTS "sc_datasets_select" ON public.trade_datasets;
CREATE POLICY "sc_datasets_select" ON public.trade_datasets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sc_datasets_insert" ON public.trade_datasets;
CREATE POLICY "sc_datasets_insert" ON public.trade_datasets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sc_datasets_update" ON public.trade_datasets;
CREATE POLICY "sc_datasets_update" ON public.trade_datasets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sc_datasets_delete" ON public.trade_datasets;
CREATE POLICY "sc_datasets_delete" ON public.trade_datasets FOR DELETE TO anon, authenticated USING (true);

-- parsed_trades
DROP POLICY IF EXISTS "sc_trades_select" ON public.parsed_trades;
CREATE POLICY "sc_trades_select" ON public.parsed_trades FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sc_trades_insert" ON public.parsed_trades;
CREATE POLICY "sc_trades_insert" ON public.parsed_trades FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sc_trades_update" ON public.parsed_trades;
CREATE POLICY "sc_trades_update" ON public.parsed_trades FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sc_trades_delete" ON public.parsed_trades;
CREATE POLICY "sc_trades_delete" ON public.parsed_trades FOR DELETE TO anon, authenticated USING (true);

-- strategy_models
DROP POLICY IF EXISTS "sc_models_select" ON public.strategy_models;
CREATE POLICY "sc_models_select" ON public.strategy_models FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sc_models_insert" ON public.strategy_models;
CREATE POLICY "sc_models_insert" ON public.strategy_models FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sc_models_update" ON public.strategy_models;
CREATE POLICY "sc_models_update" ON public.strategy_models FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sc_models_delete" ON public.strategy_models;
CREATE POLICY "sc_models_delete" ON public.strategy_models FOR DELETE TO anon, authenticated USING (true);

-- trading_bots
DROP POLICY IF EXISTS "sc_bots_select" ON public.trading_bots;
CREATE POLICY "sc_bots_select" ON public.trading_bots FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sc_bots_insert" ON public.trading_bots;
CREATE POLICY "sc_bots_insert" ON public.trading_bots FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sc_bots_update" ON public.trading_bots;
CREATE POLICY "sc_bots_update" ON public.trading_bots FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sc_bots_delete" ON public.trading_bots;
CREATE POLICY "sc_bots_delete" ON public.trading_bots FOR DELETE TO anon, authenticated USING (true);

-- execution_logs
DROP POLICY IF EXISTS "sc_logs_select" ON public.execution_logs;
CREATE POLICY "sc_logs_select" ON public.execution_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sc_logs_insert" ON public.execution_logs;
CREATE POLICY "sc_logs_insert" ON public.execution_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sc_logs_update" ON public.execution_logs;
CREATE POLICY "sc_logs_update" ON public.execution_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sc_logs_delete" ON public.execution_logs;
CREATE POLICY "sc_logs_delete" ON public.execution_logs FOR DELETE TO anon, authenticated USING (true);

-- gatekeeper_profiles (add write policies; keep existing public read)
DROP POLICY IF EXISTS "sc_gk_profiles_insert" ON public.gatekeeper_profiles;
CREATE POLICY "sc_gk_profiles_insert" ON public.gatekeeper_profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sc_gk_profiles_update" ON public.gatekeeper_profiles;
CREATE POLICY "sc_gk_profiles_update" ON public.gatekeeper_profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sc_gk_profiles_delete" ON public.gatekeeper_profiles;
CREATE POLICY "sc_gk_profiles_delete" ON public.gatekeeper_profiles FOR DELETE TO anon, authenticated USING (true);

-- gatekeeper_blocks (add write policies; keep existing public read)
DROP POLICY IF EXISTS "sc_gk_blocks_insert" ON public.gatekeeper_blocks;
CREATE POLICY "sc_gk_blocks_insert" ON public.gatekeeper_blocks FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sc_gk_blocks_update" ON public.gatekeeper_blocks;
CREATE POLICY "sc_gk_blocks_update" ON public.gatekeeper_blocks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sc_gk_blocks_delete" ON public.gatekeeper_blocks;
CREATE POLICY "sc_gk_blocks_delete" ON public.gatekeeper_blocks FOR DELETE TO anon, authenticated USING (true);

-- gatekeeper_subscriptions
DROP POLICY IF EXISTS "sc_gk_sub_select" ON public.gatekeeper_subscriptions;
CREATE POLICY "sc_gk_sub_select" ON public.gatekeeper_subscriptions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sc_gk_sub_insert" ON public.gatekeeper_subscriptions;
CREATE POLICY "sc_gk_sub_insert" ON public.gatekeeper_subscriptions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sc_gk_sub_update" ON public.gatekeeper_subscriptions;
CREATE POLICY "sc_gk_sub_update" ON public.gatekeeper_subscriptions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sc_gk_sub_delete" ON public.gatekeeper_subscriptions;
CREATE POLICY "sc_gk_sub_delete" ON public.gatekeeper_subscriptions FOR DELETE TO anon, authenticated USING (true);

-- gatekeeper_roles
DROP POLICY IF EXISTS "sc_gk_roles_select" ON public.gatekeeper_roles;
CREATE POLICY "sc_gk_roles_select" ON public.gatekeeper_roles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sc_gk_roles_insert" ON public.gatekeeper_roles;
CREATE POLICY "sc_gk_roles_insert" ON public.gatekeeper_roles FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sc_gk_roles_update" ON public.gatekeeper_roles;
CREATE POLICY "sc_gk_roles_update" ON public.gatekeeper_roles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sc_gk_roles_delete" ON public.gatekeeper_roles;
CREATE POLICY "sc_gk_roles_delete" ON public.gatekeeper_roles FOR DELETE TO anon, authenticated USING (true);

-- gatekeeper_admin_status
DROP POLICY IF EXISTS "sc_gk_admin_select" ON public.gatekeeper_admin_status;
CREATE POLICY "sc_gk_admin_select" ON public.gatekeeper_admin_status FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sc_gk_admin_insert" ON public.gatekeeper_admin_status;
CREATE POLICY "sc_gk_admin_insert" ON public.gatekeeper_admin_status FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sc_gk_admin_update" ON public.gatekeeper_admin_status;
CREATE POLICY "sc_gk_admin_update" ON public.gatekeeper_admin_status FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sc_gk_admin_delete" ON public.gatekeeper_admin_status;
CREATE POLICY "sc_gk_admin_delete" ON public.gatekeeper_admin_status FOR DELETE TO anon, authenticated USING (true);

-- gatekeeper_messages (INSERT + SELECT + DELETE; UPDATE already exists)
DROP POLICY IF EXISTS "sc_gk_msg_select" ON public.gatekeeper_messages;
CREATE POLICY "sc_gk_msg_select" ON public.gatekeeper_messages FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sc_gk_msg_insert" ON public.gatekeeper_messages;
CREATE POLICY "sc_gk_msg_insert" ON public.gatekeeper_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sc_gk_msg_delete" ON public.gatekeeper_messages;
CREATE POLICY "sc_gk_msg_delete" ON public.gatekeeper_messages FOR DELETE TO anon, authenticated USING (true);

-- gatekeeper_media (INSERT + SELECT + DELETE; UPDATE already exists)
DROP POLICY IF EXISTS "sc_gk_media_select" ON public.gatekeeper_media;
CREATE POLICY "sc_gk_media_select" ON public.gatekeeper_media FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sc_gk_media_insert" ON public.gatekeeper_media;
CREATE POLICY "sc_gk_media_insert" ON public.gatekeeper_media FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sc_gk_media_delete" ON public.gatekeeper_media;
CREATE POLICY "sc_gk_media_delete" ON public.gatekeeper_media FOR DELETE TO anon, authenticated USING (true);

/*
# Fix RLS policies for Strat-Clone Engine tables

Adds permissive CRUD policies for anon + authenticated on all Strat-Clone tables.
The Express backend is the security boundary (JWT auth + ownership checks in code).
*/

-- gatekeeper_messages (fix typo from previous attempt)
DROP POLICY IF EXISTS "sc_gk_msg_update" ON public.gatekeeper_messages;
CREATE POLICY "sc_gk_msg_update" ON public.gatekeeper_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- gatekeeper_media (fix typo from previous attempt)
DROP POLICY IF EXISTS "sc_gk_media_update" ON public.gatekeeper_media;
CREATE POLICY "sc_gk_media_update" ON public.gatekeeper_media FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

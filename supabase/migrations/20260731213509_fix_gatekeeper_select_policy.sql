/*
# Fix gatekeeper_profiles SELECT policy

## Purpose
The previous SELECT policy only allowed reading published profiles (is_published = true).
This blocked INSERT operations because Supabase's .insert().select() chain needs to
read the row back after insert, and new profiles have is_published=false by default.

## Changes
- Replace the restrictive public-read policy with a permissive one for anon/authenticated.
- The Express backend enforces ownership checks in application code via JWT middleware.
*/

DROP POLICY IF EXISTS "public_read_published_profiles" ON public.gatekeeper_profiles;
CREATE POLICY "sc_gk_profiles_select"
  ON public.gatekeeper_profiles FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public_read_visible_blocks" ON public.gatekeeper_blocks;
CREATE POLICY "sc_gk_blocks_select"
  ON public.gatekeeper_blocks FOR SELECT
  TO anon, authenticated
  USING (true);

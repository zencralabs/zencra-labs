-- Migration: add authenticated SELECT policy to creative_generations
--
-- Before this migration, the creative_generations table had no SELECT policy
-- for the 'authenticated' role. The browser Supabase client (which uses the
-- anon/authenticated JWT) could therefore never read rows, causing CD v2
-- output rehydration to silently return 0 rows on every page refresh.
--
-- The service_role (admin client used in route.ts) bypasses RLS and was
-- unaffected — rows were being written correctly, just never readable by the
-- browser.
--
-- This migration adds the missing policy, mirroring the existing pattern on
-- the 'assets' table (assets_select_own).

CREATE POLICY "authenticated_select_own_creative_generations"
  ON public.creative_generations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

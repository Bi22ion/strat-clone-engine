-- Add metadata column to gatekeeper_profiles for extended profile fields
ALTER TABLE gatekeeper_profiles
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

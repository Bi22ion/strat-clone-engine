-- Add replies column to gatekeeper_messages for two-way communication
ALTER TABLE gatekeeper_messages
  ADD COLUMN IF NOT EXISTS replies JSONB DEFAULT '[]'::jsonb;

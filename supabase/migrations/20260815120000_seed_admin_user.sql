-- Idempotent development/admin seed for the custom Strat-Clone auth table.
-- This preserves all existing rows and only replaces this exact email account.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS password text,
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS role text;

DELETE FROM public.users
WHERE email = 'ssegwanyibillgates@gmail.com'
   OR username = 'ssegwanyibillgates@gmail.com';

INSERT INTO public.users (username, email, password, password_hash, role)
VALUES (
  'ssegwanyibillgates@gmail.com',
  'ssegwanyibillgates@gmail.com',
  crypt('@House33', gen_salt('bf')),
  crypt('@House33', gen_salt('bf')),
  'admin'
);

-- The application authenticates against password_hash with bcrypt.compare.
-- Do not reuse this development password in production.

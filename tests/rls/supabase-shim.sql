-- Supabase-compatibility shim so the real migrations in supabase/migrations/
-- can run unmodified against a plain Postgres instance (CI service container or
-- a local Postgres). It recreates the minimal pieces Supabase provides in
-- production: the auth/storage schemas + helper functions and the standard roles.
--
-- This file is destructive: it drops and recreates the public/auth/storage
-- schemas so the test suite starts from a clean slate on every run.

DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS storage CASCADE;

CREATE SCHEMA public;
CREATE SCHEMA auth;
CREATE SCHEMA storage;

-- Standard Supabase roles. service_role bypasses RLS just like in production.
-- (`postgres` already exists when connecting as it, e.g. the CI service container.)
DO $$ BEGIN CREATE ROLE postgres NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

-- Minimal auth.users so profiles' FK (profiles.id -> auth.users.id) resolves.
CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT
);

-- auth.uid() / auth.jwt() / auth.role() mirror Supabase's implementations:
-- they read the claims injected per-request via `request.jwt.claims`.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    ''
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role';
$$;

-- Minimal storage objects referenced by the logos-bucket migration.
CREATE TABLE storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT,
  public BOOLEAN DEFAULT false
);

CREATE TABLE storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT,
  name TEXT
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

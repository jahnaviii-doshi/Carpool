-- Milestone 1: extensions every later migration depends on.
-- Supabase convention: extensions live in the `extensions` schema, which is
-- on the search_path for the API roles but not exposed through PostgREST.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron;            -- installs into its own `cron` schema
create extension if not exists pgtap with schema extensions;
create extension if not exists citext with schema extensions;  -- case-insensitive emails/domains

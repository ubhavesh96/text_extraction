-- Run this once in the Supabase SQL editor for your project.

create extension if not exists pgcrypto;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  file_name text,
  mime_type text,
  document_type text,
  title text,
  summary text,
  language text,
  fields jsonb not null default '[]'::jsonb,
  tables jsonb not null default '[]'::jsonb,
  raw_text text,
  confidence numeric
);

create index if not exists documents_created_at_idx on documents (created_at desc);

alter table documents enable row level security;
-- No policies are added on purpose: only the service-role key (used
-- server-side only, inside the Netlify functions) can read/write this
-- table. The anon/public key gets nothing, so this stays private even
-- though the app itself has no login.

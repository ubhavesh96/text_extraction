-- Run this once in the Supabase SQL editor for your project.

create extension if not exists pgcrypto;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
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

create index if not exists documents_user_id_created_at_idx on documents (user_id, created_at desc);

alter table documents enable row level security;

create policy "Users can view their own documents"
  on documents for select
  using (auth.uid() = user_id);

create policy "Users can insert their own documents"
  on documents for insert
  with check (auth.uid() = user_id);

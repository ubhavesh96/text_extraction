-- Run this once in the Supabase SQL editor to add per-user ownership
-- to an already-existing `documents` table.

alter table documents add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Remove pre-accounts test rows (created before any user existed, so they
-- have no owner to attribute them to).
delete from documents where user_id is null;

alter table documents alter column user_id set not null;

create index if not exists documents_user_id_created_at_idx on documents (user_id, created_at desc);

alter table documents enable row level security;

drop policy if exists "Users can view their own documents" on documents;
create policy "Users can view their own documents"
  on documents for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own documents" on documents;
create policy "Users can insert their own documents"
  on documents for insert
  with check (auth.uid() = user_id);

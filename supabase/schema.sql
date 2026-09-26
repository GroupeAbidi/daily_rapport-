-- ABIDI Minoterie Daily — prototype database
-- Run this once in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null,
  role text not null check (role in ('ANALYST', 'MANAGER')),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'PUBLISHED' check (status in ('DRAFT', 'PUBLISHED')),
  note text not null default '',
  source_file text not null default '',
  production jsonb not null default '[]'::jsonb,
  wheat jsonb not null default '[]'::jsonb,
  sales jsonb not null default '[]'::jsonb,
  collections jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(report_date, version)
);

create index if not exists daily_reports_date_idx
  on public.daily_reports(report_date desc, version desc);

alter table public.profiles enable row level security;
alter table public.daily_reports enable row level security;

create or replace function public.is_analyst()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ANALYST'
  );
$$;

revoke all on function public.is_analyst() from public;
grant execute on function public.is_analyst() to authenticated;

drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "reports_read" on public.daily_reports;
create policy "reports_read"
on public.daily_reports for select
to authenticated
using (status = 'PUBLISHED' or public.is_analyst());

drop policy if exists "reports_insert_analyst" on public.daily_reports;
create policy "reports_insert_analyst"
on public.daily_reports for insert
to authenticated
with check (public.is_analyst() and created_by = auth.uid());

drop policy if exists "reports_update_analyst" on public.daily_reports;
create policy "reports_update_analyst"
on public.daily_reports for update
to authenticated
using (public.is_analyst())
with check (public.is_analyst());

drop policy if exists "reports_delete_analyst" on public.daily_reports;
create policy "reports_delete_analyst"
on public.daily_reports for delete
to authenticated
using (public.is_analyst());

-- AFTER creating the two users in Supabase Authentication > Users,
-- replace the email addresses below and execute these statements.
--
-- insert into public.profiles (id, email, full_name, role)
-- select id, email, 'Samer / Analyste', 'ANALYST'
-- from auth.users where email = 'YOUR_ANALYST_EMAIL'
-- on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;
--
-- insert into public.profiles (id, email, full_name, role)
-- select id, email, 'Manager', 'MANAGER'
-- from auth.users where email = 'YOUR_MANAGER_EMAIL'
-- on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

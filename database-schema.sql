-- مخطط قاعدة البيانات لنظام المحاسبة الاحترافي
-- يعمل على Supabase/PostgreSQL

create extension if not exists pgcrypto;

create table if not exists "USERS" (
  id uuid primary key,
  email text not null unique,
  role text not null default 'viewer' check (role in ('admin', 'accountant', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists "ACCOUNTS" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('أصول', 'خصوم', 'حقوق ملكية', 'إيرادات', 'مصروفات')),
  currency text not null check (currency in ('USD', 'EUR', 'TRY', 'SYP')),
  balance numeric(18, 2) not null default 0,
  created_at timestamptz not null default now(),
  constraint accounts_name_len check (char_length(name) between 2 and 100)
);

create table if not exists "TRANSACTIONS" (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  debit_account uuid not null references "ACCOUNTS" (id),
  credit_account uuid not null references "ACCOUNTS" (id),
  description text not null,
  amount numeric(18, 2) not null check (amount > 0),
  currency text not null check (currency in ('USD', 'EUR', 'TRY', 'SYP')),
  exchange_rate numeric(18, 6) not null check (exchange_rate > 0),
  converted_usd numeric(18, 2) not null check (converted_usd > 0),
  created_at timestamptz not null default now(),
  constraint transactions_accounts_different check (debit_account <> credit_account),
  constraint transactions_desc_len check (char_length(description) between 3 and 500)
);

create index if not exists idx_transactions_date on "TRANSACTIONS" (date desc);
create index if not exists idx_transactions_debit on "TRANSACTIONS" (debit_account);
create index if not exists idx_transactions_credit on "TRANSACTIONS" (credit_account);
create index if not exists idx_accounts_type on "ACCOUNTS" (type);

create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select coalesce((select role from "USERS" where id = auth.uid() limit 1), 'viewer');
$$;

alter table "USERS" enable row level security;
alter table "ACCOUNTS" enable row level security;
alter table "TRANSACTIONS" enable row level security;

drop policy if exists users_select_own_or_admin on "USERS";
create policy users_select_own_or_admin
on "USERS"
for select
to authenticated
using (id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists users_update_admin on "USERS";
create policy users_update_admin
on "USERS"
for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists users_insert_self_or_admin on "USERS";
create policy users_insert_self_or_admin
on "USERS"
for insert
to authenticated
with check (id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists accounts_select_authenticated on "ACCOUNTS";
create policy accounts_select_authenticated
on "ACCOUNTS"
for select
to authenticated
using (true);

drop policy if exists accounts_manage_role_based on "ACCOUNTS";
create policy accounts_manage_role_based
on "ACCOUNTS"
for all
to authenticated
using (public.current_user_role() in ('admin', 'accountant'))
with check (public.current_user_role() in ('admin', 'accountant'));

drop policy if exists transactions_select_authenticated on "TRANSACTIONS";
create policy transactions_select_authenticated
on "TRANSACTIONS"
for select
to authenticated
using (true);

drop policy if exists transactions_manage_role_based on "TRANSACTIONS";
create policy transactions_manage_role_based
on "TRANSACTIONS"
for all
to authenticated
using (public.current_user_role() in ('admin', 'accountant'))
with check (public.current_user_role() in ('admin', 'accountant'));

-- =====================================================================
-- ChurchConnect v2 — Initial schema migration
-- Supabase / PostgreSQL
--
-- Runs cleanly in the Supabase SQL editor or via `supabase db push`.
-- Order of operations:
--   1. Extensions
--   2. Enums
--   3. Core tables (departments, profiles) — referenced by helpers/FKs
--   4. Helper functions + new-user trigger
--   5. Remaining domain tables
--   6. updated_at triggers
--   7. Indexes
--   8. Row-Level Security + policies
--   9. Storage bucket + storage policies
-- =====================================================================


-- =====================================================================
-- 1. EXTENSIONS
-- =====================================================================
-- gen_random_uuid() lives in pgcrypto. Supabase ships it, included
-- defensively so this migration is portable.
create extension if not exists pgcrypto;


-- =====================================================================
-- 2. ENUMS
-- =====================================================================
-- Each enum is wrapped in a DO guard so re-running the migration does
-- not error on "type already exists".

do $$ begin
  create type membership_status as enum ('active', 'inactive', 'visitor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type giving_type as enum ('tithe', 'offering', 'special_offering', 'thanksgiving', 'building_fund');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('cash', 'bank_transfer', 'mobile_money', 'cheque');
exception when duplicate_object then null; end $$;

do $$ begin
  create type expenditure_category as enum (
    'utilities', 'salaries', 'maintenance', 'outreach', 'events',
    'equipment', 'welfare', 'administration', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('present', 'late', 'excused');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_type as enum ('service', 'meeting', 'activity', 'special', 'outreach', 'training');
exception when duplicate_object then null; end $$;

do $$ begin
  create type media_type as enum ('audio', 'video');
exception when duplicate_object then null; end $$;

do $$ begin
  create type allowed_media as enum ('none', 'audio', 'video', 'both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type property_type as enum (
    'building', 'land', 'vehicle', 'equipment', 'furniture', 'electronics', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type property_condition as enum ('excellent', 'good', 'fair', 'poor', 'decommissioned');
exception when duplicate_object then null; end $$;


-- =====================================================================
-- 3. CORE TABLES (departments, profiles)
-- These are created first because helper functions and many FKs depend
-- on them.
-- =====================================================================

-- ---- departments -----------------------------------------------------
create table if not exists public.departments (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text,
  head_name           text,
  head_user_id        uuid,                 -- FK to profiles, added after profiles exists
  media_upload_enabled boolean not null default false,
  allowed_media_types allowed_media not null default 'none',
  is_active           boolean not null default true,
  color               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---- profiles (1:1 with auth.users) ----------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text,
  full_name         text,
  role              text not null default 'member'
                      check (role in (
                        'super_admin', 'pastor_admin', 'finance_officer',
                        'department_head', 'data_entry_staff', 'member'
                      )),
  department_id     uuid references public.departments(id) on delete set null,
  phone             text,
  profile_photo_url text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Now that profiles exists, wire departments.head_user_id -> profiles.id
do $$ begin
  alter table public.departments
    add constraint departments_head_user_id_fkey
    foreign key (head_user_id) references public.profiles(id) on delete set null;
exception when duplicate_object then null; end $$;


-- =====================================================================
-- 4. HELPER FUNCTIONS + NEW-USER TRIGGER
-- =====================================================================

-- handle_new_user: auto-creates a profiles row when an auth.users row is
-- inserted. SECURITY DEFINER so it can write to public.profiles
-- regardless of the (anonymous) inserting context.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- current_app_role: returns the calling user's role. SECURITY DEFINER +
-- STABLE so it can be used freely inside RLS policies without recursion
-- issues (it reads profiles with definer privileges).
create or replace function public.current_app_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- is_admin: convenience wrapper for the two admin roles.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_app_role() in ('super_admin', 'pastor_admin');
$$;

-- set_updated_at: generic trigger to keep updated_at fresh on UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =====================================================================
-- 5. REMAINING DOMAIN TABLES
-- =====================================================================

-- ---- members ----------------------------------------------------------
create table if not exists public.members (
  id                      uuid primary key default gen_random_uuid(),
  first_name              text not null,
  last_name               text not null,
  email                   text,
  phone                   text,
  address                 text,
  department_id           uuid references public.departments(id) on delete set null,
  join_date               date,
  membership_status       membership_status not null default 'active',
  profile_photo_url       text,
  gender                  text,
  date_of_birth           date,
  marital_status          text,
  occupation              text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  notes                   text,
  user_id                 uuid references public.profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---- giving -----------------------------------------------------------
create table if not exists public.giving (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid references public.members(id) on delete set null,
  member_name      text,
  date             date not null,
  amount           numeric(12,2) not null,
  type             giving_type not null,
  payment_method   payment_method,
  service_or_event text,
  notes            text,
  recorded_by      uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---- expenditures -----------------------------------------------------
create table if not exists public.expenditures (
  id              uuid primary key default gen_random_uuid(),
  date            date not null,
  category        expenditure_category not null,
  description     text,
  amount          numeric(12,2) not null,
  department_id   uuid references public.departments(id) on delete set null,
  approval_status approval_status not null default 'pending',
  approved_by     uuid references public.profiles(id) on delete set null,
  approved_date   timestamptz,
  receipt_url     text,
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---- events -----------------------------------------------------------
create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  department_id   uuid references public.departments(id) on delete set null,
  start_datetime  timestamptz not null,
  end_datetime    timestamptz,
  location        text,
  event_type      event_type not null default 'service',
  is_public       boolean not null default false,
  created_by      uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---- attendance -------------------------------------------------------
create table if not exists public.attendance (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid references public.events(id) on delete set null,
  event_name     text,
  event_date     date,
  member_id      uuid references public.members(id) on delete set null,
  member_name    text,
  department_id  uuid references public.departments(id) on delete set null,
  check_in_time  timestamptz not null default now(),
  status         attendance_status not null default 'present',
  checked_in_by  uuid references public.profiles(id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---- sermons ----------------------------------------------------------
create table if not exists public.sermons (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  preacher         text,
  date             date,
  department_id    uuid references public.departments(id) on delete set null,
  media_type       media_type,
  file_url         text,
  thumbnail_url    text,
  duration_minutes integer,
  tags             text[],
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---- properties -------------------------------------------------------
create table if not exists public.properties (
  id                    uuid primary key default gen_random_uuid(),
  type                  property_type not null,
  name                  text not null,
  description           text,
  location_or_serial    text,
  purchase_date         date,
  purchase_value        numeric(12,2),
  current_condition     property_condition not null default 'good',
  assigned_department_id uuid references public.departments(id) on delete set null,
  maintenance_notes     text,
  photo_url             text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---- church_settings (singleton) -------------------------------------
-- The is_singleton column is fixed to true and UNIQUE, so at most one row
-- can ever exist.
create table if not exists public.church_settings (
  id              uuid primary key default gen_random_uuid(),
  is_singleton    boolean not null default true unique,
  church_name     text not null,
  logo_url        text,
  language        text not null default 'en',
  currency_code   text not null default 'EUR',
  currency_symbol text not null default '€',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint church_settings_singleton_chk check (is_singleton = true)
);


-- =====================================================================
-- 6. updated_at TRIGGERS
-- Attach BEFORE UPDATE set_updated_at() to every table with updated_at.
-- =====================================================================
do $$
declare
  t text;
  tables text[] := array[
    'departments', 'profiles', 'members', 'giving', 'expenditures',
    'events', 'attendance', 'sermons', 'properties', 'church_settings'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end $$;


-- =====================================================================
-- 7. INDEXES
-- =====================================================================
create index if not exists idx_members_department_id   on public.members (department_id);
create index if not exists idx_members_user_id          on public.members (user_id);
create index if not exists idx_giving_date              on public.giving (date);
create index if not exists idx_giving_member_id         on public.giving (member_id);
create index if not exists idx_attendance_event_id      on public.attendance (event_id);
create index if not exists idx_attendance_member_id     on public.attendance (member_id);
create index if not exists idx_events_start_datetime    on public.events (start_datetime);
create index if not exists idx_expenditures_date        on public.expenditures (date);
create index if not exists idx_expenditures_department  on public.expenditures (department_id);
create index if not exists idx_profiles_role            on public.profiles (role);
create index if not exists idx_profiles_department_id   on public.profiles (department_id);


-- =====================================================================
-- 8. ROW-LEVEL SECURITY
-- =====================================================================
alter table public.departments     enable row level security;
alter table public.profiles        enable row level security;
alter table public.members         enable row level security;
alter table public.giving          enable row level security;
alter table public.expenditures    enable row level security;
alter table public.events          enable row level security;
alter table public.attendance      enable row level security;
alter table public.sermons         enable row level security;
alter table public.properties      enable row level security;
alter table public.church_settings enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- Self read/update; admins read/update all.
-- NOTE: changing the `role` column is an administrative action. By
-- convention only super_admin should grant roles; the admin UPDATE policy
-- below permits both admin roles to update profiles. Tightening role
-- changes to super_admin only is enforced at the application layer.
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select using (public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- departments
-- All authenticated users SELECT; super_admin manages.
-- Nice-to-have: a department_head may UPDATE their own department.
-- ---------------------------------------------------------------------
drop policy if exists departments_select_all on public.departments;
create policy departments_select_all on public.departments
  for select using (auth.uid() is not null);

drop policy if exists departments_insert_admin on public.departments;
create policy departments_insert_admin on public.departments
  for insert with check (public.current_app_role() = 'super_admin');

drop policy if exists departments_update_super on public.departments;
create policy departments_update_super on public.departments
  for update using (public.current_app_role() = 'super_admin')
  with check (public.current_app_role() = 'super_admin');

drop policy if exists departments_update_head on public.departments;
create policy departments_update_head on public.departments
  for update
  using (public.current_app_role() = 'department_head' and head_user_id = auth.uid())
  with check (public.current_app_role() = 'department_head' and head_user_id = auth.uid());

drop policy if exists departments_delete_super on public.departments;
create policy departments_delete_super on public.departments
  for delete using (public.current_app_role() = 'super_admin');

-- ---------------------------------------------------------------------
-- members
-- Staff roles SELECT; a member can read/update their own linked record.
-- INSERT/UPDATE for super_admin, pastor_admin, data_entry_staff.
-- DELETE admin-only.
-- ---------------------------------------------------------------------
drop policy if exists members_select_staff on public.members;
create policy members_select_staff on public.members
  for select using (
    public.current_app_role() in (
      'super_admin', 'pastor_admin', 'data_entry_staff',
      'finance_officer', 'department_head'
    )
  );

drop policy if exists members_select_self on public.members;
create policy members_select_self on public.members
  for select using (user_id = auth.uid());

drop policy if exists members_update_self on public.members;
create policy members_update_self on public.members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists members_insert_staff on public.members;
create policy members_insert_staff on public.members
  for insert with check (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'data_entry_staff')
  );

drop policy if exists members_update_staff on public.members;
create policy members_update_staff on public.members
  for update using (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'data_entry_staff')
  ) with check (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'data_entry_staff')
  );

drop policy if exists members_delete_admin on public.members;
create policy members_delete_admin on public.members
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- giving
-- Finance-capable roles SELECT/INSERT/UPDATE; a member can read their own
-- giving (via their linked members row). DELETE for finance_officer +
-- super_admin.
-- ---------------------------------------------------------------------
drop policy if exists giving_select_finance on public.giving;
create policy giving_select_finance on public.giving
  for select using (
    public.current_app_role() in (
      'super_admin', 'pastor_admin', 'finance_officer', 'data_entry_staff'
    )
  );

drop policy if exists giving_select_self on public.giving;
create policy giving_select_self on public.giving
  for select using (
    exists (
      select 1 from public.members m
      where m.id = giving.member_id and m.user_id = auth.uid()
    )
  );

drop policy if exists giving_insert_finance on public.giving;
create policy giving_insert_finance on public.giving
  for insert with check (
    public.current_app_role() in (
      'super_admin', 'pastor_admin', 'finance_officer', 'data_entry_staff'
    )
  );

drop policy if exists giving_update_finance on public.giving;
create policy giving_update_finance on public.giving
  for update using (
    public.current_app_role() in (
      'super_admin', 'pastor_admin', 'finance_officer', 'data_entry_staff'
    )
  ) with check (
    public.current_app_role() in (
      'super_admin', 'pastor_admin', 'finance_officer', 'data_entry_staff'
    )
  );

drop policy if exists giving_delete_finance on public.giving;
create policy giving_delete_finance on public.giving
  for delete using (
    public.current_app_role() in ('super_admin', 'finance_officer')
  );

-- ---------------------------------------------------------------------
-- expenditures
-- INSERT for super_admin, pastor_admin, finance_officer, department_head.
-- SELECT for those finance-capable roles. UPDATE (approve) for
-- finance_officer + admins. DELETE admin-only.
-- ---------------------------------------------------------------------
drop policy if exists expenditures_select on public.expenditures;
create policy expenditures_select on public.expenditures
  for select using (
    public.current_app_role() in (
      'super_admin', 'pastor_admin', 'finance_officer', 'department_head'
    )
  );

drop policy if exists expenditures_insert on public.expenditures;
create policy expenditures_insert on public.expenditures
  for insert with check (
    public.current_app_role() in (
      'super_admin', 'pastor_admin', 'finance_officer', 'department_head'
    )
  );

drop policy if exists expenditures_update on public.expenditures;
create policy expenditures_update on public.expenditures
  for update using (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'finance_officer')
  ) with check (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'finance_officer')
  );

drop policy if exists expenditures_delete_admin on public.expenditures;
create policy expenditures_delete_admin on public.expenditures
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- events
-- Public events visible to all authenticated; non-public visible to staff
-- roles. INSERT/UPDATE for super_admin, pastor_admin, department_head.
-- DELETE admin-only.
-- ---------------------------------------------------------------------
drop policy if exists events_select_public on public.events;
create policy events_select_public on public.events
  for select using (is_public = true and auth.uid() is not null);

drop policy if exists events_select_staff on public.events;
create policy events_select_staff on public.events
  for select using (
    public.current_app_role() in (
      'super_admin', 'pastor_admin', 'finance_officer',
      'department_head', 'data_entry_staff'
    )
  );

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert with check (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'department_head')
  );

drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update using (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'department_head')
  ) with check (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'department_head')
  );

drop policy if exists events_delete_admin on public.events;
create policy events_delete_admin on public.events
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- attendance
-- INSERT/SELECT/UPDATE for super_admin, pastor_admin, data_entry_staff,
-- department_head. DELETE admin-only.
-- ---------------------------------------------------------------------
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select using (
    public.current_app_role() in (
      'super_admin', 'pastor_admin', 'data_entry_staff', 'department_head'
    )
  );

drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance
  for insert with check (
    public.current_app_role() in (
      'super_admin', 'pastor_admin', 'data_entry_staff', 'department_head'
    )
  );

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance
  for update using (
    public.current_app_role() in (
      'super_admin', 'pastor_admin', 'data_entry_staff', 'department_head'
    )
  ) with check (
    public.current_app_role() in (
      'super_admin', 'pastor_admin', 'data_entry_staff', 'department_head'
    )
  );

drop policy if exists attendance_delete_admin on public.attendance;
create policy attendance_delete_admin on public.attendance
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- sermons
-- SELECT for all authenticated. INSERT/UPDATE for super_admin,
-- pastor_admin, department_head. DELETE admin-only.
-- ---------------------------------------------------------------------
drop policy if exists sermons_select_all on public.sermons;
create policy sermons_select_all on public.sermons
  for select using (auth.uid() is not null);

drop policy if exists sermons_insert on public.sermons;
create policy sermons_insert on public.sermons
  for insert with check (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'department_head')
  );

drop policy if exists sermons_update on public.sermons;
create policy sermons_update on public.sermons
  for update using (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'department_head')
  ) with check (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'department_head')
  );

drop policy if exists sermons_delete_admin on public.sermons;
create policy sermons_delete_admin on public.sermons
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- properties
-- SELECT/INSERT/UPDATE for super_admin, pastor_admin, finance_officer.
-- DELETE admin-only.
-- ---------------------------------------------------------------------
drop policy if exists properties_select on public.properties;
create policy properties_select on public.properties
  for select using (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'finance_officer')
  );

drop policy if exists properties_insert on public.properties;
create policy properties_insert on public.properties
  for insert with check (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'finance_officer')
  );

drop policy if exists properties_update on public.properties;
create policy properties_update on public.properties
  for update using (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'finance_officer')
  ) with check (
    public.current_app_role() in ('super_admin', 'pastor_admin', 'finance_officer')
  );

drop policy if exists properties_delete_admin on public.properties;
create policy properties_delete_admin on public.properties
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- church_settings
-- SELECT for all authenticated. INSERT/UPDATE for super_admin only.
-- ---------------------------------------------------------------------
drop policy if exists church_settings_select_all on public.church_settings;
create policy church_settings_select_all on public.church_settings
  for select using (auth.uid() is not null);

drop policy if exists church_settings_insert_super on public.church_settings;
create policy church_settings_insert_super on public.church_settings
  for insert with check (public.current_app_role() = 'super_admin');

drop policy if exists church_settings_update_super on public.church_settings;
create policy church_settings_update_super on public.church_settings
  for update using (public.current_app_role() = 'super_admin')
  with check (public.current_app_role() = 'super_admin');


-- =====================================================================
-- 9. STORAGE BUCKET + POLICIES
-- Public-read bucket "church-assets" for uploads (logos, photos,
-- receipts, sermon media).
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('church-assets', 'church-assets', true)
on conflict (id) do nothing;

-- Anyone may read objects in the bucket (public bucket).
drop policy if exists church_assets_read on storage.objects;
create policy church_assets_read on storage.objects
  for select using (bucket_id = 'church-assets');

-- Authenticated users may upload.
drop policy if exists church_assets_insert on storage.objects;
create policy church_assets_insert on storage.objects
  for insert with check (bucket_id = 'church-assets' and auth.uid() is not null);

-- Authenticated users may update/delete objects in the bucket.
drop policy if exists church_assets_update on storage.objects;
create policy church_assets_update on storage.objects
  for update using (bucket_id = 'church-assets' and auth.uid() is not null)
  with check (bucket_id = 'church-assets' and auth.uid() is not null);

drop policy if exists church_assets_delete on storage.objects;
create policy church_assets_delete on storage.objects
  for delete using (bucket_id = 'church-assets' and auth.uid() is not null);

-- =====================================================================
-- End of 0001_init.sql
-- =====================================================================

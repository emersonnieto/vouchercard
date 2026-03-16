create or replace function public.rls_access_mode()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(
    coalesce(
      nullif(current_setting('app.access_mode', true), ''),
      ''
    )
  );
$$;

create or replace function public.rls_current_user_id()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.user_id', true), ''),
    ''
  );
$$;

create or replace function public.rls_current_agency_id()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.agency_id', true), ''),
    ''
  );
$$;

create or replace function public.rls_current_role()
returns text
language sql
stable
set search_path = ''
as $$
  select upper(
    coalesce(
      nullif(current_setting('app.role', true), ''),
      ''
    )
  );
$$;

create or replace function public.rls_is_database_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in (
    'postgres',
    'supabase_admin',
    'supabase_auth_admin',
    'service_role'
  );
$$;

create or replace function public.rls_is_system()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.rls_is_database_admin() or public.rls_access_mode() = 'system';
$$;

create or replace function public.rls_is_superadmin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.rls_current_role() = 'SUPERADMIN';
$$;

create or replace function public.rls_can_access_agency(target_agency_id text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    public.rls_is_system()
    or public.rls_is_superadmin()
    or (
      target_agency_id is not null
      and target_agency_id <> ''
      and target_agency_id = public.rls_current_agency_id()
    );
$$;

create or replace function public.rls_can_access_voucher(target_voucher_id text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public."Voucher" v
    where v."id" = target_voucher_id
      and public.rls_can_access_agency(v."agencyId")
  );
$$;

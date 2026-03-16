create or replace function public.rls_access_mode()
returns text
language sql
stable
as $$
  select lower(coalesce(nullif(current_setting('app.access_mode', true), ''), ''));
$$;

create or replace function public.rls_current_user_id()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('app.user_id', true), ''), '');
$$;

create or replace function public.rls_current_agency_id()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('app.agency_id', true), ''), '');
$$;

create or replace function public.rls_current_role()
returns text
language sql
stable
as $$
  select upper(coalesce(nullif(current_setting('app.role', true), ''), ''));
$$;

create or replace function public.rls_is_database_admin()
returns boolean
language sql
stable
as $$
  select current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role');
$$;

create or replace function public.rls_is_system()
returns boolean
language sql
stable
as $$
  select public.rls_is_database_admin() or public.rls_access_mode() = 'system';
$$;

create or replace function public.rls_is_superadmin()
returns boolean
language sql
stable
as $$
  select public.rls_current_role() = 'SUPERADMIN';
$$;

create or replace function public.rls_can_access_agency(target_agency_id text)
returns boolean
language sql
stable
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
as $$
  select exists (
    select 1
    from public."Voucher" v
    where v."id" = target_voucher_id
      and public.rls_can_access_agency(v."agencyId")
  );
$$;

alter table public."Agency" enable row level security;
alter table public."Agency" force row level security;

alter table public."User" enable row level security;
alter table public."User" force row level security;

alter table public."Voucher" enable row level security;
alter table public."Voucher" force row level security;

alter table public."Flight" enable row level security;
alter table public."Flight" force row level security;

alter table public."Hotel" enable row level security;
alter table public."Hotel" force row level security;

alter table public."Transfer" enable row level security;
alter table public."Transfer" force row level security;

alter table public."Tour" enable row level security;
alter table public."Tour" force row level security;

alter table public."AgencySubscription" enable row level security;
alter table public."AgencySubscription" force row level security;

alter table public."BillingWebhookEvent" enable row level security;
alter table public."app_rate_limits" enable row level security;

drop policy if exists agency_select_policy on public."Agency";
drop policy if exists agency_insert_policy on public."Agency";
drop policy if exists agency_update_policy on public."Agency";
drop policy if exists agency_delete_policy on public."Agency";

create policy agency_select_policy
on public."Agency"
for select
using (public.rls_can_access_agency("id"));

create policy agency_insert_policy
on public."Agency"
for insert
with check (public.rls_is_system() or public.rls_is_superadmin());

create policy agency_update_policy
on public."Agency"
for update
using (public.rls_can_access_agency("id"))
with check (public.rls_can_access_agency("id"));

create policy agency_delete_policy
on public."Agency"
for delete
using (public.rls_is_system() or public.rls_is_superadmin());

drop policy if exists user_select_policy on public."User";
drop policy if exists user_insert_policy on public."User";
drop policy if exists user_update_policy on public."User";
drop policy if exists user_delete_policy on public."User";

create policy user_select_policy
on public."User"
for select
using (
  public.rls_is_system()
  or public.rls_is_superadmin()
  or "id" = public.rls_current_user_id()
);

create policy user_insert_policy
on public."User"
for insert
with check (public.rls_is_system() or public.rls_is_superadmin());

create policy user_update_policy
on public."User"
for update
using (
  public.rls_is_system()
  or public.rls_is_superadmin()
  or "id" = public.rls_current_user_id()
)
with check (
  public.rls_is_system()
  or public.rls_is_superadmin()
  or (
    "id" = public.rls_current_user_id()
    and "agencyId" = public.rls_current_agency_id()
    and upper(coalesce("role", '')) <> 'SUPERADMIN'
  )
);

create policy user_delete_policy
on public."User"
for delete
using (public.rls_is_system() or public.rls_is_superadmin());

drop policy if exists voucher_select_policy on public."Voucher";
drop policy if exists voucher_insert_policy on public."Voucher";
drop policy if exists voucher_update_policy on public."Voucher";
drop policy if exists voucher_delete_policy on public."Voucher";

create policy voucher_select_policy
on public."Voucher"
for select
using (public.rls_can_access_agency("agencyId"));

create policy voucher_insert_policy
on public."Voucher"
for insert
with check (public.rls_can_access_agency("agencyId"));

create policy voucher_update_policy
on public."Voucher"
for update
using (public.rls_can_access_agency("agencyId"))
with check (public.rls_can_access_agency("agencyId"));

create policy voucher_delete_policy
on public."Voucher"
for delete
using (public.rls_can_access_agency("agencyId"));

drop policy if exists flight_select_policy on public."Flight";
drop policy if exists flight_insert_policy on public."Flight";
drop policy if exists flight_update_policy on public."Flight";
drop policy if exists flight_delete_policy on public."Flight";

create policy flight_select_policy
on public."Flight"
for select
using (public.rls_can_access_voucher("voucherId"));

create policy flight_insert_policy
on public."Flight"
for insert
with check (public.rls_can_access_voucher("voucherId"));

create policy flight_update_policy
on public."Flight"
for update
using (public.rls_can_access_voucher("voucherId"))
with check (public.rls_can_access_voucher("voucherId"));

create policy flight_delete_policy
on public."Flight"
for delete
using (public.rls_can_access_voucher("voucherId"));

drop policy if exists hotel_select_policy on public."Hotel";
drop policy if exists hotel_insert_policy on public."Hotel";
drop policy if exists hotel_update_policy on public."Hotel";
drop policy if exists hotel_delete_policy on public."Hotel";

create policy hotel_select_policy
on public."Hotel"
for select
using (public.rls_can_access_voucher("voucherId"));

create policy hotel_insert_policy
on public."Hotel"
for insert
with check (public.rls_can_access_voucher("voucherId"));

create policy hotel_update_policy
on public."Hotel"
for update
using (public.rls_can_access_voucher("voucherId"))
with check (public.rls_can_access_voucher("voucherId"));

create policy hotel_delete_policy
on public."Hotel"
for delete
using (public.rls_can_access_voucher("voucherId"));

drop policy if exists transfer_select_policy on public."Transfer";
drop policy if exists transfer_insert_policy on public."Transfer";
drop policy if exists transfer_update_policy on public."Transfer";
drop policy if exists transfer_delete_policy on public."Transfer";

create policy transfer_select_policy
on public."Transfer"
for select
using (public.rls_can_access_voucher("voucherId"));

create policy transfer_insert_policy
on public."Transfer"
for insert
with check (public.rls_can_access_voucher("voucherId"));

create policy transfer_update_policy
on public."Transfer"
for update
using (public.rls_can_access_voucher("voucherId"))
with check (public.rls_can_access_voucher("voucherId"));

create policy transfer_delete_policy
on public."Transfer"
for delete
using (public.rls_can_access_voucher("voucherId"));

drop policy if exists tour_select_policy on public."Tour";
drop policy if exists tour_insert_policy on public."Tour";
drop policy if exists tour_update_policy on public."Tour";
drop policy if exists tour_delete_policy on public."Tour";

create policy tour_select_policy
on public."Tour"
for select
using (public.rls_can_access_voucher("voucherId"));

create policy tour_insert_policy
on public."Tour"
for insert
with check (public.rls_can_access_voucher("voucherId"));

create policy tour_update_policy
on public."Tour"
for update
using (public.rls_can_access_voucher("voucherId"))
with check (public.rls_can_access_voucher("voucherId"));

create policy tour_delete_policy
on public."Tour"
for delete
using (public.rls_can_access_voucher("voucherId"));

drop policy if exists agency_subscription_select_policy on public."AgencySubscription";
drop policy if exists agency_subscription_insert_policy on public."AgencySubscription";
drop policy if exists agency_subscription_update_policy on public."AgencySubscription";
drop policy if exists agency_subscription_delete_policy on public."AgencySubscription";

create policy agency_subscription_select_policy
on public."AgencySubscription"
for select
using (public.rls_can_access_agency("agencyId"));

create policy agency_subscription_insert_policy
on public."AgencySubscription"
for insert
with check (public.rls_is_system() or public.rls_is_superadmin());

create policy agency_subscription_update_policy
on public."AgencySubscription"
for update
using (public.rls_is_system() or public.rls_is_superadmin())
with check (public.rls_is_system() or public.rls_is_superadmin());

create policy agency_subscription_delete_policy
on public."AgencySubscription"
for delete
using (public.rls_is_system() or public.rls_is_superadmin());

drop policy if exists billing_webhook_event_system_policy on public."BillingWebhookEvent";
create policy billing_webhook_event_system_policy
on public."BillingWebhookEvent"
for all
using (public.rls_is_system())
with check (public.rls_is_system());

drop policy if exists app_rate_limits_system_policy on public."app_rate_limits";
create policy app_rate_limits_system_policy
on public."app_rate_limits"
for all
using (public.rls_is_system())
with check (public.rls_is_system());

-- Run after configuring DATABASE_URL_APP and applying the RLS migration.
-- Useful checks for the runtime role and the main tenant-scoped tables.

select
  rolname,
  rolcanlogin,
  rolbypassrls,
  rolsuper
from pg_roles
where rolname = 'app_runtime';

select
  n.nspname as schemaname,
  c.relname as tablename,
  c.relrowsecurity as rowsecurity,
  c.relforcerowsecurity as forcerowsecurity
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'Agency',
    'User',
    'Voucher',
    'Flight',
    'Hotel',
    'Transfer',
    'Tour',
    'AgencySubscription',
    'BillingWebhookEvent',
    'app_rate_limits'
  )
order by tablename;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'Agency',
    'User',
    'Voucher',
    'Flight',
    'Hotel',
    'Transfer',
    'Tour',
    'AgencySubscription',
    'BillingWebhookEvent',
    'app_rate_limits'
  )
order by tablename, policyname;

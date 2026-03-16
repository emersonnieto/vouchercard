-- Configure a dedicated runtime role for authenticated app traffic.
-- Run this as a privileged database user before switching DATABASE_URL_APP.
-- Replace the password before using in production.
--
-- If your database name is not "postgres", adjust the GRANT CONNECT line.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime
      login
      password 'change_me_before_production'
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      noreplication;
  end if;
end $$;

grant connect on database postgres to app_runtime;
grant usage on schema public to app_runtime;

grant select, insert, update, delete on table
  public."Agency",
  public."User",
  public."Voucher",
  public."Flight",
  public."Hotel",
  public."Transfer",
  public."Tour",
  public."AgencySubscription"
to app_runtime;

revoke all on table public."BillingWebhookEvent" from app_runtime;
revoke all on table public."app_rate_limits" from app_runtime;

-- Safety net: this role must not bypass RLS.
alter role app_runtime nobypassrls;

comment on role app_runtime is
  'Runtime role for authenticated VoucherCard app traffic. Must be used via DATABASE_URL_APP.';

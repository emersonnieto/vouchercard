drop policy if exists agency_subscription_update_policy on public."AgencySubscription";

create policy agency_subscription_update_policy
on public."AgencySubscription"
for update
using (public.rls_can_access_agency("agencyId"))
with check (public.rls_can_access_agency("agencyId"));

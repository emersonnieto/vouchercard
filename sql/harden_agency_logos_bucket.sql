-- Harden the public agency-logos bucket without breaking public file URLs.
-- Apply in the Supabase project's SQL Editor.
--
-- This removes client-facing SELECT/INSERT/UPDATE policies on storage.objects
-- for the agency-logos bucket. Public asset delivery via
-- /storage/v1/object/public/agency-logos/... keeps working because the bucket
-- itself remains public. Server-side uploads also keep working because the API
-- uses the service role key, which bypasses RLS.

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd in ('SELECT', 'INSERT', 'UPDATE')
      and (
        array_position(roles, 'public') is not null
        or array_position(roles, 'anon') is not null
        or array_position(roles, 'authenticated') is not null
      )
      and (
        coalesce(qual, '') ilike '%agency-logos%'
        or coalesce(with_check, '') ilike '%agency-logos%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', policy_row.policyname);
  end loop;
end $$;

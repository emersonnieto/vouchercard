-- Verify the agency-logos bucket stays public while list/read policies on
-- storage.objects are no longer exposed to anon/public/authenticated roles.

select
  id,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'agency-logos';

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    coalesce(qual, '') ilike '%agency-logos%'
    or coalesce(with_check, '') ilike '%agency-logos%'
  )
order by policyname;

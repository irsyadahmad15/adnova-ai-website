-- AdNova AI admin-only access to lead records.
-- Run this in Supabase SQL Editor after creating the admin Auth user
-- and assigning app_metadata.role = 'admin' using a trusted admin process.
-- Never expose the service_role key in browser code.

drop policy if exists "Admins can read leads" on public.leads;
create policy "Admins can read leads"
on public.leads for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update leads" on public.leads;
create policy "Admins can update leads"
on public.leads for update to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Keep the existing anonymous INSERT policy for the public enquiry form.
-- Do not add public SELECT, UPDATE, or DELETE policies.

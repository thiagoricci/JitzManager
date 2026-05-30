insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "logos_select_public"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "logos_insert_authenticated"
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and auth.role() = 'authenticated'
  );

create policy "logos_update_authenticated"
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and auth.role() = 'authenticated'
  );

create policy "logos_delete_authenticated"
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and auth.role() = 'authenticated'
  );

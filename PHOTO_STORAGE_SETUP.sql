-- Run this in Supabase SQL Editor if photo upload reports a storage policy error.
-- This keeps the bucket private and only allows each signed-in user to access
-- files inside their own folder: product-images/<auth.uid()>/...

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can upload own product photos" on storage.objects;
drop policy if exists "Users can view own product photos" on storage.objects;
drop policy if exists "Users can update own product photos" on storage.objects;
drop policy if exists "Users can delete own product photos" on storage.objects;

create policy "Users can upload own product photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can view own product photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can update own product photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can delete own product photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

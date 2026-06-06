-- ============================================================
-- Boda Zamora-Cárcamo · Políticas del bucket de Storage
-- Antes de ejecutar: Storage → crear bucket "wedding-photos" (PRIVADO)
-- ============================================================

drop policy if exists "el invitado sube a su propia carpeta" on storage.objects;
create policy "el invitado sube a su propia carpeta" on storage.objects
  for insert with check (
    bucket_id = 'wedding-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "el invitado lee su propia carpeta" on storage.objects;
create policy "el invitado lee su propia carpeta" on storage.objects
  for select using (
    bucket_id = 'wedding-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "el invitado elimina su propia foto" on storage.objects;
create policy "el invitado elimina su propia foto" on storage.objects
  for delete using (
    bucket_id = 'wedding-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "los super admins leen todo el bucket" on storage.objects;
create policy "los super admins leen todo el bucket" on storage.objects
  for select using (
    bucket_id = 'wedding-photos' and public.is_super_admin()
  );

drop policy if exists "los super admins eliminan cualquier foto" on storage.objects;
create policy "los super admins eliminan cualquier foto" on storage.objects
  for delete using (
    bucket_id = 'wedding-photos' and public.is_super_admin()
  );

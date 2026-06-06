-- ============================================================
-- Boda Zamora-Cárcamo · Row Level Security
-- Ejecutar DESPUÉS de 01_schema.sql
-- ============================================================

alter table profiles enable row level security;
alter table photos enable row level security;
alter table song_suggestions enable row level security;
alter table spotify_credentials enable row level security;

-- Helper: ¿el usuario actual es super admin?
create or replace function public.is_super_admin()
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce((select role = 'super_admin' from profiles where id = auth.uid()), false);
$$;

-- ── profiles ──
drop policy if exists "el usuario lee su propio perfil" on profiles;
create policy "el usuario lee su propio perfil" on profiles
  for select using (auth.uid() = id);

drop policy if exists "los super admins leen todos los perfiles" on profiles;
create policy "los super admins leen todos los perfiles" on profiles
  for select using (public.is_super_admin());

drop policy if exists "el usuario actualiza su propio perfil" on profiles;
create policy "el usuario actualiza su propio perfil" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "los super admins actualizan cualquier perfil" on profiles;
create policy "los super admins actualizan cualquier perfil" on profiles
  for update using (public.is_super_admin());

-- ── photos ──
drop policy if exists "el usuario lee sus propias fotos" on photos;
create policy "el usuario lee sus propias fotos" on photos
  for select using (auth.uid() = uploader_id);

drop policy if exists "los super admins leen todas las fotos" on photos;
create policy "los super admins leen todas las fotos" on photos
  for select using (public.is_super_admin());

drop policy if exists "el usuario sube sus propias fotos" on photos;
create policy "el usuario sube sus propias fotos" on photos
  for insert with check (auth.uid() = uploader_id);

drop policy if exists "el usuario elimina sus propias fotos" on photos;
create policy "el usuario elimina sus propias fotos" on photos
  for delete using (auth.uid() = uploader_id);

drop policy if exists "los super admins eliminan cualquier foto" on photos;
create policy "los super admins eliminan cualquier foto" on photos
  for delete using (public.is_super_admin());

-- ── song_suggestions ──
drop policy if exists "el usuario lee sus propias sugerencias" on song_suggestions;
create policy "el usuario lee sus propias sugerencias" on song_suggestions
  for select using (auth.uid() = suggester_id);

drop policy if exists "los super admins leen todas las sugerencias" on song_suggestions;
create policy "los super admins leen todas las sugerencias" on song_suggestions
  for select using (public.is_super_admin());

drop policy if exists "el usuario crea sugerencias" on song_suggestions;
create policy "el usuario crea sugerencias" on song_suggestions
  for insert with check (auth.uid() = suggester_id);

drop policy if exists "los super admins actualizan sugerencias" on song_suggestions;
create policy "los super admins actualizan sugerencias" on song_suggestions
  for update using (public.is_super_admin());

-- ── spotify_credentials ──
-- Sin políticas para el cliente: solo se accede desde el servidor con la
-- service-role key (Cloudflare Functions). RLS activo = niega todo al cliente.

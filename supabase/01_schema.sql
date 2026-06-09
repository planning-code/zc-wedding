-- ============================================================
-- Boda Zamora-Cárcamo · Esquema base
-- Ejecutar en: Supabase → SQL Editor (en orden: 01 → 02 → 03 → 04)
-- ============================================================

-- 4.1 PROFILES (extiende auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  phone text,
  role text not null default 'guest' check (role in ('guest', 'super_admin')),
  rsvp_status text not null default 'pending' check (rsvp_status in ('pending','confirmed','declined')),
  rsvp_message text,
  rsvp_confirmed_at timestamptz,
  plus_one_count int not null default 0,
  dietary_restrictions text,
  invited_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Crea el perfil automáticamente cuando aparece el usuario en auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  admin_emails text[] := array['karla.carcamo0309@gmail.com', 'ezamorah.90@gmail.com'];
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when new.email = any(admin_emails) then 'super_admin' else 'guest' end
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4.2 PHOTOS (galería)
create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  size_bytes bigint not null,
  width int,
  height int,
  taken_at timestamptz,
  caption text,
  uploaded_at timestamptz default now()
);
create index if not exists photos_uploader_idx on photos (uploader_id);
create index if not exists photos_uploaded_at_idx on photos (uploaded_at desc);

-- 4.3 SUGERENCIAS DE CANCIONES
create table if not exists song_suggestions (
  id uuid primary key default gen_random_uuid(),
  suggester_id uuid not null references profiles(id) on delete cascade,
  spotify_track_id text not null,
  track_name text not null,
  artist_name text not null,
  album_art_url text,
  preview_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  unique (suggester_id, spotify_track_id)
);

-- 4.4 CREDENCIALES DE SPOTIFY (un solo registro: dueño del playlist)
create table if not exists spotify_credentials (
  id int primary key default 1 check (id = 1),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  playlist_id text not null,
  updated_at timestamptz default now()
);

-- ============================================================
-- Boda Zamora-Cárcamo · Invitaciones personalizadas (por token)
-- Ejecutar DESPUÉS de 01_schema.sql y 02_rls.sql
-- ============================================================

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),  -- el token que viaja en el link
  first_name text not null,
  last_name  text not null,
  phone      text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists invites_created_at_idx on invites (created_at desc);

alter table invites enable row level security;

-- Solo los super admins gestionan las invitaciones
drop policy if exists "super admins gestionan invites" on invites;
create policy "super admins gestionan invites" on invites
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- RPC: devuelve SOLO el nombre para un token dado.
-- security definer => puede leer la tabla aunque el cliente sea anónimo,
-- pero solo expone el nombre de ESE token (no permite listar todo).
create or replace function public.get_invite_name(token uuid)
returns text language sql stable security definer
set search_path = public as $$
  select trim(first_name || ' ' || last_name)
  from invites
  where id = token;
$$;

grant execute on function public.get_invite_name(uuid) to anon, authenticated;

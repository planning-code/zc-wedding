-- ============================================================
-- Boda Zamora-Cárcamo · Acompañantes en invitaciones personalizadas
-- Ejecutar DESPUÉS de 05_invites.sql
-- ============================================================

alter table invites add column if not exists max_companions integer default null;

-- RPC: devuelve el número máximo de acompañantes para un token dado.
create or replace function public.get_invite_companions(token uuid)
returns int language sql stable security definer
set search_path = public as $$
  select max_companions from invites where id = token;
$$;

grant execute on function public.get_invite_companions(uuid) to anon, authenticated;

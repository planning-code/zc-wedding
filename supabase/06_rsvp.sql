-- ============================================================
-- Boda Zamora-Cárcamo · RSVP sin login (ligado al token de invitación)
-- Ejecutar DESPUÉS de 05_invites.sql
-- ============================================================
-- El RSVP ya NO vive en profiles ni exige iniciar sesión.
-- Cualquiera puede confirmar/declinar; si abrió con un link
-- personalizado (?invite=<token>), su respuesta queda ligada
-- a esa invitación.
-- ============================================================

create table if not exists rsvps (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid references invites(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  status text not null check (status in ('confirmed','declined')),
  message text,
  plus_one_count int not null default 0,
  source text not null default 'guest' check (source in ('guest','admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Una sola respuesta por invitación (las respuestas con token se actualizan;
-- las libres —sin token— pueden ser varias filas con invite_id nulo).
create unique index if not exists rsvps_invite_unique
  on rsvps (invite_id) where invite_id is not null;
create index if not exists rsvps_created_at_idx on rsvps (created_at desc);

alter table rsvps enable row level security;

-- Los super admins leen y gestionan todas las respuestas (incluye edición manual).
drop policy if exists "super admins gestionan rsvps" on rsvps;
create policy "super admins gestionan rsvps" on rsvps
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ── RPC público: confirmar / declinar sin sesión ──
-- security definer => escribe en rsvps aunque el cliente sea anónimo,
-- pero solo a través de esta función validada (no abre la tabla al público).
create or replace function public.submit_rsvp(
  p_token uuid,
  p_status text,
  p_full_name text,
  p_email text default null,
  p_phone text default null,
  p_message text default null,
  p_plus_one int default 0
) returns uuid
language plpgsql security definer
set search_path = public as $$
declare
  v_id uuid;
begin
  if p_status not in ('confirmed','declined') then
    raise exception 'estado inválido';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'nombre requerido';
  end if;
  if p_token is not null and not exists (select 1 from invites where id = p_token) then
    raise exception 'invitación no encontrada';
  end if;

  if p_token is not null then
    insert into rsvps (invite_id, full_name, email, phone, status, message, plus_one_count, source, updated_at)
    values (p_token, trim(p_full_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''), p_status,
            nullif(trim(p_message), ''), greatest(coalesce(p_plus_one, 0), 0), 'guest', now())
    on conflict (invite_id) where invite_id is not null
    do update set
      full_name      = excluded.full_name,
      email          = excluded.email,
      phone          = excluded.phone,
      status         = excluded.status,
      message        = excluded.message,
      plus_one_count = excluded.plus_one_count,
      updated_at     = now()
    returning id into v_id;
  else
    insert into rsvps (invite_id, full_name, email, phone, status, message, plus_one_count, source, updated_at)
    values (null, trim(p_full_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''), p_status,
            nullif(trim(p_message), ''), greatest(coalesce(p_plus_one, 0), 0), 'guest', now())
    returning id into v_id;
  end if;

  return v_id;
end; $$;

grant execute on function public.submit_rsvp(uuid, text, text, text, text, text, int) to anon, authenticated;

-- ── RPC público: recuperar la respuesta previa de un token ──
-- Permite que un invitado que reabre su link vea/edite lo que ya respondió.
create or replace function public.get_my_rsvp(p_token uuid)
returns table (full_name text, email text, phone text, status text, message text, plus_one_count int)
language sql stable security definer
set search_path = public as $$
  select full_name, email, phone, status, message, plus_one_count
  from rsvps where invite_id = p_token;
$$;

grant execute on function public.get_my_rsvp(uuid) to anon, authenticated;

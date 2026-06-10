-- ============================================================
-- Boda Zamora-Cárcamo · Playlist pública
-- Ejecutar DESPUÉS de 02_rls.sql
-- ============================================================
-- Permite que cualquier invitado (con o sin sesión) lea las
-- canciones que los novios ya aprobaron, para mostrarlas en
-- la página de listas de reproducción.
-- ============================================================

drop policy if exists "todos leen canciones aprobadas" on song_suggestions;
create policy "todos leen canciones aprobadas" on song_suggestions
  for select using (status = 'approved');

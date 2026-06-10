/* ============================================================
   Karlita & Edgardo · Página de listas de reproducción
   - Embed de Spotify (estático en el HTML)
   - Canciones sugeridas por invitados y aprobadas por los novios
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.APP_CONFIG || {};
const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function loadApproved() {
  const list = document.getElementById('approved-songs');
  const empty = document.getElementById('approved-empty');
  if (!list) return;

  const { data, error } = await supabase
    .from('song_suggestions')
    .select('track_name, artist_name, album_art_url')
    .eq('status', 'approved')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Playlist] aprobadas:', error);
    if (empty) { empty.hidden = false; empty.textContent = 'No pudimos cargar las canciones en este momento.'; }
    return;
  }

  const songs = data || [];
  if (!songs.length) {
    if (empty) empty.hidden = false;
    return;
  }

  list.innerHTML = songs.map((s, i) => `
    <li class="playlist-song" style="--i:${i}">
      <img class="playlist-song__art" src="${esc(s.album_art_url || '')}" alt="" width="56" height="56" loading="lazy">
      <span class="playlist-song__meta">
        <span class="playlist-song__name">${esc(s.track_name)}</span>
        <span class="playlist-song__artist">${esc(s.artist_name)}</span>
      </span>
    </li>`).join('');
}

loadApproved();

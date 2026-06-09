/* ============================================================
   Karlita & Edgardo · Autenticación (magic-link) + gates
   - Cliente Supabase compartido
   - Login por enlace mágico (OTP por correo)
   - Mostrar/ocultar contenido protegido segun la sesión
   - Búsqueda en Spotify + guardar sugerencia
   Cargado como módulo: import desde esm.sh.
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.APP_CONFIG || {};
export const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// ─────────────────────────────────────────────
// 1. Gates de autenticación
//    [data-auth-gate]      → visible SIN sesión
//    [data-auth-protected] → visible CON sesión
// ─────────────────────────────────────────────

function applyAuthState(session) {
  const authed = !!session;
  document.body.dataset.authed = authed ? 'true' : 'false';

  document.querySelectorAll('[data-auth-gate]').forEach((el) => {
    el.hidden = authed;
  });
  document.querySelectorAll('[data-auth-protected]').forEach((el) => {
    el.hidden = !authed;
  });
}

// ─────────────────────────────────────────────
// 2. Login con Google (OAuth)
// ─────────────────────────────────────────────

export function wireGoogleLogin(client = supabase) {
  document.querySelectorAll('[data-google-login]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const msg = btn.parentElement.querySelector('[data-auth-msg]');
      btn.disabled = true;
      if (msg) { msg.textContent = ''; msg.classList.remove('is-error'); }
      try {
        const { error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${location.origin}${location.pathname}` },
        });
        if (error) throw error;
        // El navegador redirige a Google; no hace falta más.
      } catch (err) {
        console.error('[Auth] signInWithOAuth:', err);
        btn.disabled = false;
        if (msg) { msg.textContent = 'No pudimos iniciar sesión con Google. Inténtalo de nuevo.'; msg.classList.add('is-error'); }
      }
    });
  });

  // Cerrar sesión (cualquier elemento [data-logout])
  document.querySelectorAll('[data-logout]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      await client.auth.signOut();
    });
  });
}

// ─────────────────────────────────────────────
// 3. Búsqueda de canciones + sugerencia
// ─────────────────────────────────────────────

function wireSongSearch() {
  const form = document.getElementById('song-form');
  const results = document.getElementById('song-results');
  const feedback = document.getElementById('song-feedback');
  if (!form || !results) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = form.querySelector('#song-search').value.trim();
    if (!q) return;

    results.innerHTML = '';
    if (feedback) feedback.textContent = 'Buscando…';

    try {
      const res = await fetch(`/api/spotify-search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const tracks = await res.json();
      if (feedback) feedback.textContent = tracks.length ? '' : 'Sin resultados. Prueba con otro término.';
      renderTracks(tracks, results, feedback);
    } catch (err) {
      console.error('[Spotify] búsqueda:', err);
      if (feedback) feedback.textContent = 'No pudimos buscar en Spotify en este momento.';
    }
  });
}

function renderTracks(tracks, container, feedback) {
  container.innerHTML = '';
  tracks.forEach((t) => {
    const li = document.createElement('li');
    li.className = 'song-result';
    li.innerHTML = `
      <img class="song-result__art" src="${t.albumArt || ''}" alt="" width="48" height="48">
      <span class="song-result__meta">
        <span class="song-result__name">${escapeHtml(t.name)}</span>
        <span class="song-result__artist">${escapeHtml(t.artist)}</span>
      </span>
      <button type="button" class="btn btn--ghost btn--mini" data-suggest>Sugerir</button>`;
    li.querySelector('[data-suggest]').addEventListener('click', () => suggestTrack(t, li, feedback));
    container.appendChild(li);
  });
}

async function suggestTrack(track, li, feedback) {
  const btn = li.querySelector('[data-suggest]');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('sin sesión');

    const { error } = await supabase.from('song_suggestions').insert({
      suggester_id: user.id,
      spotify_track_id: track.id,
      track_name: track.name,
      artist_name: track.artist,
      album_art_url: track.albumArt || null,
      preview_url: track.previewUrl || null,
    });
    if (error && error.code !== '23505') throw error; // 23505 = ya la sugeriste

    if (btn) { btn.textContent = '¡Sugerida!'; btn.classList.add('is-done'); }
    if (feedback) feedback.textContent = '¡Gracias! Karlita y Edgardo revisarán tu sugerencia.';
  } catch (err) {
    console.error('[Spotify] sugerir:', err);
    if (btn) { btn.disabled = false; btn.textContent = 'Sugerir'; }
    if (feedback) feedback.textContent = 'No pudimos guardar tu sugerencia. Inténtalo de nuevo.';
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ─────────────────────────────────────────────
// 4. Arranque
// ─────────────────────────────────────────────

supabase.auth.getSession().then(({ data }) => applyAuthState(data.session));
supabase.auth.onAuthStateChange((_event, session) => applyAuthState(session));

wireGoogleLogin();
wireSongSearch();

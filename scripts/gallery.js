/* ============================================================
   Karlita & Edgardo · Galería
   - Gate de login con Google
   - Subida a Storage (bucket privado wedding-photos)
   - El invitado ve sus fotos; el super admin ve todas (RLS)
   - Los super admin pueden eliminar cualquier foto
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.APP_CONFIG || {};
const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const BUCKET = 'wedding-photos';

const grid = document.getElementById('gallery-grid');
const empty = document.getElementById('gallery-empty');
const status = document.getElementById('gallery-status');
const fileInput = document.getElementById('gallery-file');
const cameraInput = document.getElementById('gallery-camera');

let isSuperAdmin = false;
// Prevents loading photos twice on initial mount (getSession + onAuthStateChange both fire).
let photosRequested = false;

// ── Gates ──
function applyAuthState(session) {
  const authed = !!session;
  document.body.dataset.authed = authed ? 'true' : 'false';
  document.querySelectorAll('[data-auth-gate]').forEach((el) => (el.hidden = authed));
  document.querySelectorAll('[data-auth-protected]').forEach((el) => (el.hidden = !authed));

  if (authed && !photosRequested) {
    photosRequested = true;
    loadRoleAndPhotos(session.user.id);
  }
  if (!authed) {
    photosRequested = false;
    isSuperAdmin = false;
  }
}

async function loadRoleAndPhotos(uid) {
  try {
    const { data } = await supabase
      .from('profiles').select('role').eq('id', uid).single();
    isSuperAdmin = data?.role === 'super_admin';
    if (grid) grid.dataset.role = isSuperAdmin ? 'super_admin' : 'guest';
  } catch { /* noop */ }
  loadPhotos();
}

// ── Login con Google (OAuth) ──
document.querySelectorAll('[data-google-login]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const msg = btn.parentElement.querySelector('[data-auth-msg]');
    btn.disabled = true;
    if (msg) { msg.textContent = ''; msg.classList.remove('is-error'); }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}${location.pathname}` },
      });
      if (error) throw error;
    } catch (err) {
      console.error('[Galería] login Google:', err);
      btn.disabled = false;
      if (msg) { msg.textContent = 'No pudimos iniciar sesión con Google. Inténtalo de nuevo.'; msg.classList.add('is-error'); }
    }
  });
});

document.querySelectorAll('[data-logout]').forEach((el) =>
  el.addEventListener('click', async (e) => { e.preventDefault(); await supabase.auth.signOut(); })
);

// ── Subida ──
async function uploadFiles(files, inputEl) {
  if (!files.length) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  let done = 0;
  let lastErr = '';
  for (const file of files) {
    if (status) status.textContent = `Subiendo ${done + 1} de ${files.length}…`;
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;

      const { error: rowErr } = await supabase.from('photos').insert({
        uploader_id: user.id,
        storage_path: path,
        size_bytes: file.size,
      });
      if (rowErr) throw rowErr;
      done++;
    } catch (err) {
      console.error('[Galería] subida:', err);
      lastErr = err?.message || String(err);
    }
  }
  if (status) {
    status.textContent = done
      ? `${done} foto(s) subidas.`
      : `No se pudo subir${lastErr ? `: ${lastErr}` : '.'}`;
  }
  if (inputEl) inputEl.value = '';
  loadPhotos();
}

if (fileInput) {
  fileInput.addEventListener('change', () => uploadFiles(Array.from(fileInput.files || []), fileInput));
}
if (cameraInput) {
  cameraInput.addEventListener('change', () => uploadFiles(Array.from(cameraInput.files || []), cameraInput));
}

// ── Eliminar foto (solo super admin) ──
async function deletePhoto(id, storagePath, figEl) {
  if (!confirm('¿Eliminar esta foto? La acción no se puede deshacer.')) return;
  const { error: storErr } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (storErr) { console.error('[Galería] eliminar storage:', storErr); alert('No se pudo eliminar la foto.'); return; }
  const { error: rowErr } = await supabase.from('photos').delete().eq('id', id);
  if (rowErr) { console.error('[Galería] eliminar fila:', rowErr); }
  figEl.remove();
  const remaining = grid?.querySelectorAll('.gallery-grid__item').length || 0;
  if (empty) empty.hidden = remaining > 0;
}

// ── Listar ──
async function loadPhotos() {
  if (!grid) return;
  const { data: rows, error } = await supabase
    .from('photos')
    .select('id, storage_path, uploaded_at')
    .order('uploaded_at', { ascending: false });

  if (error) { console.error('[Galería] listar:', error); return; }

  grid.innerHTML = '';
  if (!rows || !rows.length) { if (empty) empty.hidden = false; return; }
  if (empty) empty.hidden = true;

  for (const row of rows) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, 60 * 60);
    if (!signed) continue;

    const fig = document.createElement('figure');
    fig.className = 'gallery-grid__item';
    fig.innerHTML = `<img src="${signed.signedUrl}" alt="" loading="lazy">`;

    if (isSuperAdmin) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'gallery-delete';
      del.setAttribute('aria-label', 'Eliminar foto');
      del.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
      del.addEventListener('click', () => deletePhoto(row.id, row.storage_path, fig));
      fig.appendChild(del);
    }

    grid.appendChild(fig);
  }
}

supabase.auth.getSession().then(({ data }) => {
  // Set visual gates immediately so there's no flash, but don't trigger loadPhotos.
  // onAuthStateChange fires right after and handles the full auth state.
  const authed = !!data.session;
  document.body.dataset.authed = authed ? 'true' : 'false';
  document.querySelectorAll('[data-auth-gate]').forEach((el) => (el.hidden = authed));
  document.querySelectorAll('[data-auth-protected]').forEach((el) => (el.hidden = !authed));
});
supabase.auth.onAuthStateChange((_e, session) => applyAuthState(session));

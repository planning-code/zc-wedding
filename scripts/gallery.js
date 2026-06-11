/* ============================================================
   Karlita & Edgardo · Galería
   - Gate de login con Google
   - Subida a Storage (bucket privado wedding-photos)
   - El invitado ve sus fotos; el super admin ve todas (RLS)
   - Abrir foto en grande (lightbox) + descargar individual
   - Selección múltiple: descargar en zip o eliminar en lote
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

// Barra de selección
const toolbar = document.getElementById('gallery-toolbar');
const selectToggle = document.getElementById('gallery-select-toggle');
const selectActions = document.getElementById('gallery-select-actions');
const selectCount = document.getElementById('gallery-select-count');
const selectAllBtn = document.getElementById('gallery-select-all');
const downloadSelBtn = document.getElementById('gallery-download-sel');
const deleteSelBtn = document.getElementById('gallery-delete-sel');
const selectCancel = document.getElementById('gallery-select-cancel');

// Lightbox
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lightbox-img');
const lbClose = document.getElementById('lightbox-close');
const lbPrev = document.getElementById('lightbox-prev');
const lbNext = document.getElementById('lightbox-next');
const lbDownload = document.getElementById('lightbox-download');

let isSuperAdmin = false;
// Evita cargar las fotos dos veces al montar (getSession + onAuthStateChange).
let photosRequested = false;

let photos = [];            // { id, path, url }
let selectMode = false;
const selected = new Set(); // ids
let lbIndex = -1;

const CHECK_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
const TRASH_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;

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
    if (deleteSelBtn) deleteSelBtn.hidden = !isSuperAdmin;
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

// ── Listar ──
async function loadPhotos() {
  if (!grid) return;
  const { data: rows, error } = await supabase
    .from('photos')
    .select('id, storage_path, uploaded_at')
    .order('uploaded_at', { ascending: false });

  if (error) { console.error('[Galería] listar:', error); return; }

  photos = [];
  for (const row of rows || []) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, 60 * 60);
    if (!signed) continue;
    photos.push({ id: row.id, path: row.storage_path, url: signed.signedUrl });
  }
  // Limpia selección de fotos que ya no existen.
  for (const id of [...selected]) if (!photos.find((p) => p.id === id)) selected.delete(id);
  render();
}

function render() {
  grid.innerHTML = '';
  if (!photos.length) {
    if (empty) empty.hidden = false;
    if (toolbar) toolbar.hidden = true;
    if (selectMode) setSelectMode(false);
    return;
  }
  if (empty) empty.hidden = true;
  if (toolbar) toolbar.hidden = false;
  grid.classList.toggle('is-selecting', selectMode);

  photos.forEach((p, i) => {
    const fig = document.createElement('figure');
    fig.className = 'gallery-grid__item';
    fig.dataset.id = p.id;
    fig.dataset.index = String(i);
    if (selected.has(p.id)) fig.classList.add('is-selected');
    fig.innerHTML = `<img src="${p.url}" alt="" loading="lazy">`;

    const check = document.createElement('span');
    check.className = 'gallery-check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML = CHECK_SVG;
    fig.appendChild(check);

    if (isSuperAdmin && !selectMode) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'gallery-delete';
      del.setAttribute('aria-label', 'Eliminar foto');
      del.innerHTML = TRASH_SVG;
      fig.appendChild(del);
    }

    grid.appendChild(fig);
  });

  updateSelCount();
}

// ── Click sobre la grilla (delegación) ──
grid?.addEventListener('click', (e) => {
  const del = e.target.closest('.gallery-delete');
  if (del) {
    const fig = del.closest('[data-id]');
    if (fig) deleteOne(fig.dataset.id);
    return;
  }
  const fig = e.target.closest('.gallery-grid__item');
  if (!fig) return;
  if (selectMode) toggleSelect(fig.dataset.id);
  else openLightbox(Number(fig.dataset.index));
});

// ── Selección múltiple ──
function setSelectMode(on) {
  selectMode = on;
  if (selectToggle) selectToggle.hidden = on;
  if (selectActions) selectActions.hidden = !on;
  if (!on) selected.clear();
  render();
}

function toggleSelect(id) {
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  const fig = grid.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (fig) fig.classList.toggle('is-selected', selected.has(id));
  updateSelCount();
}

function updateSelCount() {
  const n = selected.size;
  if (selectCount) selectCount.textContent = n === 1 ? '1 seleccionada' : `${n} seleccionadas`;
  if (downloadSelBtn) downloadSelBtn.disabled = n === 0;
  if (deleteSelBtn) deleteSelBtn.disabled = n === 0;
  if (selectAllBtn) selectAllBtn.textContent = (n === photos.length && n > 0) ? 'Ninguna' : 'Todas';
}

selectToggle?.addEventListener('click', () => setSelectMode(true));
selectCancel?.addEventListener('click', () => setSelectMode(false));
selectAllBtn?.addEventListener('click', () => {
  if (selected.size === photos.length) selected.clear();
  else photos.forEach((p) => selected.add(p.id));
  render();
});

// ── Descargas ──
function extOf(path) { return (path.split('.').pop() || 'jpg').toLowerCase(); }

async function downloadOne(p, suggestedName) {
  const name = suggestedName || `foto-boda.${extOf(p.path)}`;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(p.path);
    if (error || !data) throw error || new Error('sin datos');
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[Galería] descargar:', err);
    alert('No se pudo descargar la foto.');
  }
}

async function downloadSelectedZip() {
  const items = photos.filter((p) => selected.has(p.id));
  if (!items.length) return;
  const original = downloadSelBtn.textContent;
  downloadSelBtn.disabled = true;
  downloadSelBtn.textContent = 'Preparando…';
  try {
    const { default: JSZip } = await import('https://esm.sh/jszip@3.10.1');
    const zip = new JSZip();
    let n = 1;
    for (const p of items) {
      downloadSelBtn.textContent = `Preparando ${n}/${items.length}…`;
      const { data, error } = await supabase.storage.from(BUCKET).download(p.path);
      if (!error && data) zip.file(`foto-${String(n).padStart(2, '0')}.${extOf(p.path)}`, data);
      n++;
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fotos-boda.zip';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[Galería] zip:', err);
    alert('No se pudieron descargar las fotos.');
  } finally {
    downloadSelBtn.disabled = false;
    downloadSelBtn.textContent = original;
  }
}

downloadSelBtn?.addEventListener('click', downloadSelectedZip);

// ── Eliminar (solo super admin) ──
async function removePhotos(items) {
  const paths = items.map((p) => p.path);
  const ids = items.map((p) => p.id);
  const { error: storErr } = await supabase.storage.from(BUCKET).remove(paths);
  if (storErr) { console.error('[Galería] eliminar storage:', storErr); alert('No se pudieron eliminar las fotos.'); return false; }
  const { error: rowErr } = await supabase.from('photos').delete().in('id', ids);
  if (rowErr) console.error('[Galería] eliminar filas:', rowErr);
  photos = photos.filter((p) => !ids.includes(p.id));
  ids.forEach((id) => selected.delete(id));
  render();
  return true;
}

function deleteOne(id) {
  const p = photos.find((x) => x.id === id);
  if (!p) return;
  if (!confirm('¿Eliminar esta foto? Esta acción es permanente y no se puede deshacer.')) return;
  removePhotos([p]);
}

deleteSelBtn?.addEventListener('click', async () => {
  const items = photos.filter((p) => selected.has(p.id));
  if (!items.length) return;
  if (!confirm(`¿Eliminar ${items.length} foto(s)? Esta acción es permanente y no se puede deshacer.`)) return;
  if (await removePhotos(items)) setSelectMode(false);
});

// ── Lightbox ──
function openLightbox(idx) {
  if (idx < 0 || idx >= photos.length) return;
  lbIndex = idx;
  showLightbox();
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}

function showLightbox() {
  const p = photos[lbIndex];
  if (!p) return;
  lbImg.src = p.url;
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
  lbImg.src = '';
  lbIndex = -1;
}

function lbNavigate(dir) {
  if (!photos.length || lbIndex < 0) return;
  lbIndex = (lbIndex + dir + photos.length) % photos.length;
  showLightbox();
}

lbClose?.addEventListener('click', closeLightbox);
lbPrev?.addEventListener('click', () => lbNavigate(-1));
lbNext?.addEventListener('click', () => lbNavigate(1));
lbDownload?.addEventListener('click', () => {
  const p = photos[lbIndex];
  if (p) downloadOne(p);
});
lightbox?.addEventListener('click', (e) => {
  // Clic en el fondo (no en la imagen ni en los controles) cierra.
  if (e.target === lightbox || e.target.classList.contains('lightbox__stage')) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (lightbox.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  else if (e.key === 'ArrowLeft') lbNavigate(-1);
  else if (e.key === 'ArrowRight') lbNavigate(1);
});

// ── Arranque ──
supabase.auth.getSession().then(({ data }) => {
  // Set visual gates immediately so there's no flash, but don't trigger loadPhotos.
  // onAuthStateChange fires right after and handles the full auth state.
  const authed = !!data.session;
  document.body.dataset.authed = authed ? 'true' : 'false';
  document.querySelectorAll('[data-auth-gate]').forEach((el) => (el.hidden = authed));
  document.querySelectorAll('[data-auth-protected]').forEach((el) => (el.hidden = !authed));
});
supabase.auth.onAuthStateChange((_e, session) => applyAuthState(session));

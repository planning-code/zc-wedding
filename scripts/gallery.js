/* ============================================================
   Karlita & Edgardo · Galería
   - Mismo gate de login que el sitio (enlace mágico)
   - Subida a Storage (bucket privado wedding-photos)
   - El invitado ve sus fotos; el super admin ve todas (RLS)
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

// ── Gates ──
function applyAuthState(session) {
  const authed = !!session;
  document.body.dataset.authed = authed ? 'true' : 'false';
  document.querySelectorAll('[data-auth-gate]').forEach((el) => (el.hidden = authed));
  document.querySelectorAll('[data-auth-protected]').forEach((el) => (el.hidden = !authed));
  if (authed) loadPhotos();
}

// ── Login (magic-link) ──
document.querySelectorAll('[data-auth-form]').forEach((form) => {
  const msg = form.parentElement.querySelector('[data-auth-msg]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]').value.trim();
    if (!email) return;
    const btn = form.querySelector('button');
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Enviando…'; }
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}${location.pathname}` },
      });
      if (error) throw error;
      if (msg) msg.textContent = 'Te enviamos un enlace de acceso a tu correo.';
      form.reset();
    } catch (err) {
      console.error('[Galería] login:', err);
      if (msg) { msg.textContent = 'No pudimos enviar el enlace. Inténtalo de nuevo.'; msg.classList.add('is-error'); }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Enviar enlace de acceso'; }
    }
  });
});

document.querySelectorAll('[data-logout]').forEach((el) =>
  el.addEventListener('click', async (e) => { e.preventDefault(); await supabase.auth.signOut(); })
);

// ── Subida ──
if (fileInput) {
  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let done = 0;
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
      }
    }
    if (status) status.textContent = done ? `${done} foto(s) subidas.` : 'No se pudo subir.';
    fileInput.value = '';
    loadPhotos();
  });
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
    grid.appendChild(fig);
  }
}

supabase.auth.getSession().then(({ data }) => applyAuthState(data.session));
supabase.auth.onAuthStateChange((_e, session) => applyAuthState(session));

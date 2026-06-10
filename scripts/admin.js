/* ============================================================
   Karlita & Edgardo · Panel de administración (Supabase)
   - Acceso solo para super_admin (Google OAuth + check de rol)
   - Invitados: lista unificada con filtros y datos de RSVP
   - Música: aprobar / rechazar sugerencias
   - Galería: todas las fotos + eliminar
   - Invitaciones Personalizadas: generar, editar, eliminar
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.APP_CONFIG || {};
const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const BUCKET = 'wedding-photos';
const el = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let CURRENT_UID = null;
let photosCache = [];

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
let toastTimer = 0;
function toast(msg) {
  const t = el('toast');
  if (!t) return;
  el('toast-msg').textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}

// ─────────────────────────────────────────────
// GATE DE ACCESO
// ─────────────────────────────────────────────
function showGate(mode) {
  const gate = el('admin-gate');
  gate.hidden = false;
  document.body.style.overflow = 'hidden';
  const login = el('admin-google-login');
  const signout = el('admin-gate-signout');
  const text = el('admin-gate-text');
  if (mode === 'denied') {
    text.textContent = 'Esta cuenta no tiene acceso de administrador. Usa la cuenta de Google de los novios.';
    login.hidden = true;
    signout.hidden = false;
  } else {
    text.textContent = 'Inicia sesión con la cuenta de Google de los novios.';
    login.hidden = false;
    signout.hidden = true;
  }
}
function hideGate() {
  el('admin-gate').hidden = true;
  document.body.style.overflow = '';
}

el('admin-google-login')?.addEventListener('click', async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/admin.html` },
  });
});
el('admin-gate-signout')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});
el('btn-logout')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

// ─────────────────────────────────────────────
// NAVEGACIÓN
// ─────────────────────────────────────────────
const SECTION_TITLES = {
  invitados: 'Invitados',
  musica: 'Música',
  galeria: 'Galería',
  invitaciones: 'Invitaciones Personalizadas',
};

function showSection(id) {
  document.querySelectorAll('.admin-section').forEach((s) => {
    s.hidden = s.dataset.section !== id;
  });
  document.querySelectorAll('.sidebar__link[data-section]').forEach((a) => {
    a.classList.toggle('sidebar__link--active', a.dataset.section === id);
  });
  const title = el('page-title');
  if (title) title.textContent = SECTION_TITLES[id] || id;
  if (window.innerWidth <= 768) closeSidebar();
}

function wireNav() {
  document.querySelectorAll('.sidebar__link[data-section]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); showSection(a.dataset.section); });
  });
  const sidebar = el('sidebar');
  const menuToggle = el('menu-toggle');
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);
  window.openSidebar = () => { sidebar?.classList.add('is-open'); backdrop.classList.add('is-visible'); };
  window.closeSidebar = () => { sidebar?.classList.remove('is-open'); backdrop.classList.remove('is-visible'); };
  menuToggle?.addEventListener('click', () =>
    sidebar?.classList.contains('is-open') ? closeSidebar() : openSidebar());
  backdrop.addEventListener('click', () => closeSidebar());
}
function closeSidebar() { window.closeSidebar?.(); }

// ─────────────────────────────────────────────
// DATOS: INVITADOS (invites + su RSVP)
// ─────────────────────────────────────────────
let guestsCache = [];
let guestFilter = 'all';

async function loadGuests() {
  const { data: invites, error } = await supabase
    .from('invites')
    .select('id, first_name, last_name, phone, max_companions, created_at, rsvps(id, full_name, email, phone, status, message, plus_one_count, source, updated_at)')
    .order('created_at', { ascending: false });
  if (error) { console.error('[Admin] invites+rsvps:', error); toast('Error al cargar invitados'); return; }
  guestsCache = (invites || []).map((i) => ({ ...i, rsvp: (i.rsvps && i.rsvps[0]) || null }));
  renderGuests();
}

const STATUS_LABEL = { confirmed: 'Confirmado', pending: 'Pendiente', declined: 'Declinó' };
const STATUS_CLASS = { confirmed: 'badge--success', pending: 'badge--warning', declined: 'badge--muted' };

function guestName(g) {
  return (g.rsvp && g.rsvp.full_name) || `${g.first_name} ${g.last_name}`.trim();
}
function guestStatus(g) { return g.rsvp ? g.rsvp.status : 'pending'; }

function renderGuests() {
  const q = (el('search-guests')?.value || '').toLowerCase();
  let rows = guestsCache.filter((g) =>
    !q || guestName(g).toLowerCase().includes(q) || (g.rsvp?.email || '').toLowerCase().includes(q));
  if (guestFilter !== 'all') rows = rows.filter((g) => guestStatus(g) === guestFilter);

  const confirmed = guestsCache.filter((g) => guestStatus(g) === 'confirmed');
  el('kpi-total').textContent = guestsCache.length;
  el('kpi-confirmed').textContent = confirmed.length;
  el('kpi-pending').textContent = guestsCache.filter((g) => guestStatus(g) === 'pending').length;
  el('kpi-declined').textContent = guestsCache.filter((g) => guestStatus(g) === 'declined').length;
  el('kpi-seats').textContent = confirmed.reduce((sum, g) => sum + 1 + (g.rsvp?.plus_one_count || 0), 0);

  const tbody = el('guests-tbody');
  tbody.innerHTML = rows.map((g, idx) => {
    const status = guestStatus(g);
    const plus = g.rsvp?.plus_one_count || 0;
    const phone = g.rsvp?.phone || g.phone || '—';
    const fecha = g.rsvp?.updated_at ? new Date(g.rsvp.updated_at).toLocaleDateString('es-SV') : '—';
    const opt = (v, label) => `<option value="${v}"${status === v ? ' selected' : ''}>${label}</option>`;
    return `
    <tr data-invite="${g.id}">
      <td class="col-num">${idx + 1}</td>
      <td>${esc(guestName(g))}</td>
      <td>${esc(phone)}</td>
      <td>${esc(g.rsvp?.email || '—')}</td>
      <td>
        <input class="guest-edit__num" type="number" min="0" max="20" value="${plus}"
               data-plus aria-label="Acompañantes de ${esc(guestName(g))}">
      </td>
      <td>
        <select class="guest-edit__status guest-edit__status--${status}" data-status aria-label="Estado de ${esc(guestName(g))}">
          ${opt('pending', 'Pendiente')}
          ${opt('confirmed', 'Confirmado')}
          ${opt('declined', 'Declinó')}
        </select>
      </td>
      <td>${esc(g.rsvp?.message || '—')}</td>
      <td>${fecha}</td>
    </tr>`;
  }).join('');
  el('guests-empty').hidden = rows.length > 0;
}

// Filtros de estado
el('guest-filters')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-filter]');
  if (!btn) return;
  guestFilter = btn.dataset.filter;
  el('guest-filters').querySelectorAll('.filter-tab').forEach((b) => {
    b.classList.toggle('filter-tab--active', b.dataset.filter === guestFilter);
  });
  renderGuests();
});

// Edición manual de asistencia (super admin)
async function setGuestRsvp(invite, status, plusOne) {
  const existing = invite.rsvp;
  if (status === 'pending') {
    if (existing) {
      const { error } = await supabase.from('rsvps').delete().eq('id', existing.id);
      if (error) { console.error('[Admin] borrar rsvp:', error); toast('No se pudo actualizar'); return; }
    }
  } else {
    const row = {
      invite_id: invite.id,
      full_name: existing?.full_name || `${invite.first_name} ${invite.last_name}`.trim(),
      email: existing?.email ?? null,
      phone: existing?.phone ?? invite.phone ?? null,
      status,
      message: existing?.message ?? null,
      plus_one_count: Math.max(0, plusOne || 0),
      source: 'admin',
    };
    const res = existing
      ? await supabase.from('rsvps').update(row).eq('id', existing.id)
      : await supabase.from('rsvps').insert(row);
    if (res.error) { console.error('[Admin] guardar rsvp:', res.error); toast('No se pudo actualizar'); return; }
  }
  toast('Asistencia actualizada');
  loadGuests();
}

el('guests-tbody')?.addEventListener('change', (e) => {
  const tr = e.target.closest('tr[data-invite]');
  if (!tr) return;
  const invite = guestsCache.find((g) => g.id === tr.dataset.invite);
  if (!invite) return;
  const status = tr.querySelector('[data-status]')?.value || 'pending';
  const plus = parseInt(tr.querySelector('[data-plus]')?.value || '0', 10);
  setGuestRsvp(invite, status, plus);
});

el('search-guests')?.addEventListener('input', renderGuests);

function exportCsv(filename, header, rows) {
  const csv = [header, ...rows].map((r) =>
    r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

el('btn-export-csv')?.addEventListener('click', () => {
  exportCsv('invitados.csv',
    ['#', 'Invitado', 'Telefono', 'Correo', 'Acompanantes', 'Estado', 'Mensaje', 'Fecha RSVP'],
    guestsCache.map((g, i) => [
      i + 1, guestName(g), g.rsvp?.phone || g.phone || '', g.rsvp?.email || '',
      g.rsvp?.plus_one_count || 0, guestStatus(g), g.rsvp?.message || '',
      g.rsvp?.updated_at ? new Date(g.rsvp.updated_at).toLocaleDateString('es-SV') : '',
    ]));
});

// ─────────────────────────────────────────────
// DATOS: MÚSICA (aprobar / rechazar)
// ─────────────────────────────────────────────
async function loadMusic() {
  const { data, error } = await supabase
    .from('song_suggestions')
    .select('id, track_name, artist_name, album_art_url, status, created_at, suggester:profiles!suggester_id(email, full_name)')
    .order('created_at', { ascending: false });
  if (error) { console.error('[Admin] music:', error); toast('Error al cargar canciones'); return; }
  renderMusic(data || []);
}

const SONG_LABEL = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' };
const SONG_CLASS = { pending: 'badge--warning', approved: 'badge--success', rejected: 'badge--muted' };

function renderMusic(songs) {
  el('music-pending-count').textContent = songs.filter((s) => s.status === 'pending').length;
  el('music-approved-count').textContent = songs.filter((s) => s.status === 'approved').length;
  el('music-rejected-count').textContent = songs.filter((s) => s.status === 'rejected').length;

  const tbody = el('music-tbody');
  tbody.innerHTML = songs.map((s) => {
    const who = s.suggester ? (s.suggester.full_name || s.suggester.email) : '—';
    const actions = s.status === 'pending'
      ? `<button class="btn btn--gold btn--sm" data-approve="${s.id}">Aprobar</button>
         <button class="btn btn--ghost btn--sm" data-reject="${s.id}">Rechazar</button>`
      : `<button class="btn btn--ghost btn--sm" data-reset="${s.id}">Revertir</button>`;
    return `
    <tr>
      <td>${esc(s.track_name)}</td>
      <td>${esc(s.artist_name)}</td>
      <td>${esc(who)}</td>
      <td><span class="badge ${SONG_CLASS[s.status]}">${SONG_LABEL[s.status]}</span></td>
      <td class="col-actions">${actions}</td>
    </tr>`;
  }).join('');
  el('music-empty').hidden = songs.length > 0;
}

async function setSongStatus(id, status) {
  const patch = status === 'pending'
    ? { status, reviewed_by: null, reviewed_at: null }
    : { status, reviewed_by: CURRENT_UID, reviewed_at: new Date().toISOString() };
  const { error } = await supabase.from('song_suggestions').update(patch).eq('id', id);
  if (error) { console.error('[Admin] update song:', error); toast('No se pudo actualizar'); return; }
  toast(status === 'approved' ? 'Canción aprobada' : status === 'rejected' ? 'Canción rechazada' : 'Revertida');
  loadMusic();
}

el('music-tbody')?.addEventListener('click', (e) => {
  const ap = e.target.closest('[data-approve]');
  const rj = e.target.closest('[data-reject]');
  const rs = e.target.closest('[data-reset]');
  if (ap) setSongStatus(ap.dataset.approve, 'approved');
  if (rj) setSongStatus(rj.dataset.reject, 'rejected');
  if (rs) setSongStatus(rs.dataset.reset, 'pending');
});

// ─────────────────────────────────────────────
// DATOS: GALERÍA (todas las fotos + eliminar)
// ─────────────────────────────────────────────
async function loadGallery() {
  const { data, error } = await supabase
    .from('photos')
    .select('id, storage_path, uploaded_at, uploader:profiles!uploader_id(email, full_name)')
    .order('uploaded_at', { ascending: false });
  if (error) { console.error('[Admin] photos:', error); toast('Error al cargar galería'); return; }

  photosCache = [];
  for (const row of data || []) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 60 * 60);
    photosCache.push({
      ...row,
      url: signed?.signedUrl || '',
      who: row.uploader ? (row.uploader.full_name || row.uploader.email) : 'Desconocido',
    });
  }
  el('gallery-count').textContent = photosCache.length;
  el('gallery-uploaders').textContent = new Set(photosCache.map((p) => p.who)).size;
  renderGallery();
}

function renderGallery() {
  const q = (el('search-gallery')?.value || '').toLowerCase();
  const sort = el('gallery-sort')?.value || 'date-desc';
  let rows = photosCache.filter((p) => !q || p.who.toLowerCase().includes(q));
  rows = rows.slice().sort((a, b) => {
    if (sort === 'date-asc') return new Date(a.uploaded_at) - new Date(b.uploaded_at);
    if (sort === 'uploader') return a.who.localeCompare(b.who);
    return new Date(b.uploaded_at) - new Date(a.uploaded_at);
  });

  const grid = el('admin-gallery');
  grid.innerHTML = rows.map((p) => `
    <figure class="admin-photo" data-id="${esc(p.id)}" data-path="${esc(p.storage_path)}">
      <img src="${p.url}" alt="" loading="lazy">
      <figcaption class="admin-photo__meta">
        <span class="admin-photo__who">${esc(p.who)}</span>
        <span class="admin-photo__date">${new Date(p.uploaded_at).toLocaleDateString('es-SV')}</span>
      </figcaption>
      <button type="button" class="admin-photo__delete" aria-label="Eliminar foto">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </figure>`).join('');
  el('gallery-empty').hidden = rows.length > 0;
}

el('admin-gallery')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('.admin-photo__delete');
  if (!btn) return;
  const fig = btn.closest('[data-id]');
  if (!fig) return;
  if (!confirm('¿Eliminar esta foto? La acción no se puede deshacer.')) return;
  const { error: storErr } = await supabase.storage.from(BUCKET).remove([fig.dataset.path]);
  if (storErr) { toast('No se pudo eliminar del storage'); console.error(storErr); return; }
  await supabase.from('photos').delete().eq('id', fig.dataset.id);
  photosCache = photosCache.filter((p) => p.id !== fig.dataset.id);
  el('gallery-count').textContent = photosCache.length;
  el('gallery-uploaders').textContent = new Set(photosCache.map((p) => p.who)).size;
  renderGallery();
  toast('Foto eliminada');
});

el('search-gallery')?.addEventListener('input', renderGallery);
el('gallery-sort')?.addEventListener('change', renderGallery);

// ─────────────────────────────────────────────
// DATOS: INVITACIONES PERSONALIZADAS
// ─────────────────────────────────────────────
let invitesCache = [];

function inviteLink(id) {
  return `${location.origin}/?invite=${id}`;
}

function whatsappLink(inv) {
  const name = `${inv.first_name} ${inv.last_name}`.trim();
  const companions = inv.max_companions > 0
    ? ` Incluye ${inv.max_companions} acompañante${inv.max_companions > 1 ? 's' : ''}.` : '';
  const msg =
    `Hola ${name}, Karlita y Edgardo te invitan a celebrar su boda.\n` +
    `Domingo 16 de agosto de 2026 · 4:00 PM · Hotel Hilton, San Salvador.${companions}\n\n` +
    `Abre tu invitación aquí:\n${inviteLink(inv.id)}`;
  const digits = (inv.phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

async function loadInvites() {
  const { data, error } = await supabase
    .from('invites')
    .select('id, first_name, last_name, phone, max_companions, created_at')
    .order('created_at', { ascending: false });
  if (error) { console.error('[Admin] invites:', error); toast('Error al cargar invitaciones'); return; }
  invitesCache = data || [];
  renderInvites();
}

function renderInvites() {
  const q = (el('search-invites')?.value || '').toLowerCase();
  const rows = invitesCache.filter((i) =>
    !q || `${i.first_name} ${i.last_name}`.toLowerCase().includes(q));

  const tbody = el('invites-tbody');
  tbody.innerHTML = rows.map((i, idx) => `
    <tr data-invite-id="${esc(i.id)}">
      <td class="col-num">${idx + 1}</td>
      <td>${esc(i.first_name)} ${esc(i.last_name)}</td>
      <td>${esc(i.phone || '—')}</td>
      <td>${i.max_companions != null ? i.max_companions : '—'}</td>
      <td><code class="invite-link">${esc(inviteLink(i.id))}</code></td>
      <td class="col-actions">
        <button class="btn btn--ghost btn--sm" data-copy="${esc(inviteLink(i.id))}">Copiar</button>
        <a class="btn btn--gold btn--sm" href="${esc(whatsappLink(i))}" target="_blank" rel="noopener">WhatsApp</a>
        <button class="btn btn--ghost btn--sm" data-edit-invite="${esc(i.id)}">Modificar</button>
        <button class="btn btn--ghost btn--sm btn--danger" data-delete-invite="${esc(i.id)}">Eliminar</button>
      </td>
    </tr>`).join('');
  el('invites-empty').hidden = rows.length > 0;
}

el('search-invites')?.addEventListener('input', renderInvites);

el('invite-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const first = el('inv-first').value.trim();
  const last = el('inv-last').value.trim();
  const phone = el('inv-phone').value.trim();
  const guestsVal = el('inv-guests').value.trim();
  if (!first || !last) { toast('Nombre y apellido son obligatorios'); return; }

  const btn = el('btn-generate-invite');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
  const { error } = await supabase.from('invites').insert({
    first_name: first,
    last_name: last,
    phone: phone || null,
    max_companions: guestsVal !== '' ? parseInt(guestsVal, 10) : null,
    created_by: CURRENT_UID,
  });
  if (btn) { btn.disabled = false; btn.textContent = 'Generar link'; }
  if (error) { console.error('[Admin] crear invite:', error); toast('No se pudo generar el link'); return; }

  el('invite-form').reset();
  toast('Invitación generada');
  loadInvites();
  loadGuests();
});

el('invites-tbody')?.addEventListener('click', async (e) => {
  const copyBtn = e.target.closest('[data-copy]');
  if (copyBtn) {
    try { await navigator.clipboard.writeText(copyBtn.dataset.copy); toast('Link copiado'); }
    catch { toast('No se pudo copiar'); }
    return;
  }

  const editBtn = e.target.closest('[data-edit-invite]');
  if (editBtn) {
    const inv = invitesCache.find((i) => i.id === editBtn.dataset.editInvite);
    if (!inv) return;
    el('invite-edit-id').value = inv.id;
    el('inv-edit-first').value = inv.first_name;
    el('inv-edit-last').value = inv.last_name;
    el('inv-edit-phone').value = inv.phone || '';
    el('inv-edit-guests').value = inv.max_companions != null ? inv.max_companions : '';
    el('invite-modal-backdrop').hidden = false;
    return;
  }

  const deleteBtn = e.target.closest('[data-delete-invite]');
  if (deleteBtn) {
    const inv = invitesCache.find((i) => i.id === deleteBtn.dataset.deleteInvite);
    if (!inv) return;
    const name = `${inv.first_name} ${inv.last_name}`.trim();
    if (!confirm(`¿Eliminar la invitación de ${name}? Sus respuestas de RSVP quedarán sin invitación asociada.`)) return;
    const { error } = await supabase.from('invites').delete().eq('id', inv.id);
    if (error) { toast('No se pudo eliminar'); console.error(error); return; }
    toast('Invitación eliminada');
    loadInvites();
    loadGuests();
  }
});

// Modal de edición de invitación
function closeInviteModal() { el('invite-modal-backdrop').hidden = true; }
el('invite-modal-close')?.addEventListener('click', closeInviteModal);
el('inv-edit-cancel')?.addEventListener('click', closeInviteModal);
el('invite-modal-backdrop')?.addEventListener('click', (e) => {
  if (e.target === el('invite-modal-backdrop')) closeInviteModal();
});

el('invite-edit-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = el('invite-edit-id').value;
  const first = el('inv-edit-first').value.trim();
  const last = el('inv-edit-last').value.trim();
  const phone = el('inv-edit-phone').value.trim();
  const guestsVal = el('inv-edit-guests').value.trim();
  if (!first || !last) { toast('Nombre y apellido son obligatorios'); return; }

  const btn = el('inv-edit-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
  const { error } = await supabase.from('invites').update({
    first_name: first,
    last_name: last,
    phone: phone || null,
    max_companions: guestsVal !== '' ? parseInt(guestsVal, 10) : null,
  }).eq('id', id);
  if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
  if (error) { toast('No se pudo guardar'); console.error(error); return; }
  toast('Invitación actualizada');
  closeInviteModal();
  loadInvites();
  loadGuests();
});

// ─────────────────────────────────────────────
// ARRANQUE
// ─────────────────────────────────────────────
let started = false;
async function startApp(profile) {
  if (started) return;
  started = true;
  hideGate();
  const badge = el('badge-role');
  if (badge && profile) badge.textContent = profile.full_name || 'Super Admin';
  wireNav();
  showSection('invitados');
  await Promise.all([loadGuests(), loadMusic(), loadGallery(), loadInvites()]);
}

async function gateCheck() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { showGate('login'); return; }
  CURRENT_UID = session.user.id;
  const { data: profile, error } = await supabase
    .from('profiles').select('role, full_name, email').eq('id', session.user.id).single();
  if (error || !profile || profile.role !== 'super_admin') { showGate('denied'); return; }
  startApp(profile);
}

supabase.auth.onAuthStateChange(() => { if (!started) gateCheck(); });
gateCheck();

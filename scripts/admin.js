/* ============================================================
   Karlita & Edgardo · Panel de administración (Supabase)
   - Acceso solo para super_admin (Google OAuth + check de rol)
   - Invitados / RSVP desde profiles
   - Música: aprobar / rechazar sugerencias
   - Galería: todas las fotos de todos los invitados
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
let profilesCache = [];
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
  detalles: 'Detalles del evento',
  rsvp: 'Confirmaciones',
  musica: 'Música',
  galeria: 'Galería',
  invitaciones: 'Invitaciones',
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
  // Sidebar móvil
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
// DATOS: PROFILES (invitados + RSVP)
// ─────────────────────────────────────────────
async function loadProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, rsvp_status, rsvp_message, plus_one_count, dietary_restrictions, rsvp_confirmed_at, created_at')
    .order('created_at', { ascending: false });
  if (error) { console.error('[Admin] profiles:', error); toast('Error al cargar invitados'); return; }
  profilesCache = data || [];
  renderGuests();
  renderRsvp();
}

const STATUS_LABEL = { confirmed: 'Confirmado', pending: 'Pendiente', declined: 'Declinó' };
const STATUS_CLASS = { confirmed: 'badge--success', pending: 'badge--warning', declined: 'badge--muted' };

function renderGuests() {
  const q = (el('search-guests')?.value || '').toLowerCase();
  const rows = profilesCache.filter((p) =>
    !q || (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q));

  el('kpi-total').textContent = profilesCache.length;
  el('kpi-confirmed').textContent = profilesCache.filter((p) => p.rsvp_status === 'confirmed').length;
  el('kpi-pending').textContent = profilesCache.filter((p) => p.rsvp_status === 'pending').length;
  el('kpi-declined').textContent = profilesCache.filter((p) => p.rsvp_status === 'declined').length;
  el('kpi-seats').textContent = profilesCache
    .filter((p) => p.rsvp_status === 'confirmed')
    .reduce((sum, p) => sum + 1 + (p.plus_one_count || 0), 0);

  const tbody = el('guests-tbody');
  tbody.innerHTML = rows.map((p) => `
    <tr>
      <td>${esc(p.full_name || '—')}</td>
      <td>${esc(p.email)}</td>
      <td>${esc(p.phone || '—')}</td>
      <td>${p.plus_one_count || 0}</td>
      <td><span class="badge ${STATUS_CLASS[p.rsvp_status] || ''}">${STATUS_LABEL[p.rsvp_status] || p.rsvp_status}</span></td>
      <td>${p.role === 'super_admin' ? '<span class="badge badge--gold">Admin</span>' : 'Invitado'}</td>
    </tr>`).join('');
  el('guests-empty').hidden = rows.length > 0;
}

function renderRsvp() {
  const q = (el('search-rsvp')?.value || '').toLowerCase();
  const responded = profilesCache.filter((p) => p.rsvp_status !== 'pending');
  const rows = responded.filter((p) =>
    !q || (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q));

  el('rsvp-confirmed').textContent = profilesCache.filter((p) => p.rsvp_status === 'confirmed').length;
  el('rsvp-pending').textContent = profilesCache.filter((p) => p.rsvp_status === 'pending').length;
  el('rsvp-declined').textContent = profilesCache.filter((p) => p.rsvp_status === 'declined').length;
  el('rsvp-plus-ones').textContent = profilesCache
    .filter((p) => p.rsvp_status === 'confirmed')
    .reduce((sum, p) => sum + (p.plus_one_count || 0), 0);

  const tbody = el('rsvp-tbody');
  tbody.innerHTML = rows.map((p) => `
    <tr>
      <td>${esc(p.full_name || '—')}</td>
      <td>${esc(p.email)}</td>
      <td><span class="badge ${STATUS_CLASS[p.rsvp_status] || ''}">${STATUS_LABEL[p.rsvp_status] || p.rsvp_status}</span></td>
      <td>${p.plus_one_count || 0}</td>
      <td>${esc(p.dietary_restrictions || p.rsvp_message || '—')}</td>
      <td>${p.rsvp_confirmed_at ? new Date(p.rsvp_confirmed_at).toLocaleDateString('es-SV') : '—'}</td>
    </tr>`).join('');
  el('rsvp-empty').hidden = rows.length > 0;
}

el('search-guests')?.addEventListener('input', renderGuests);
el('search-rsvp')?.addEventListener('input', renderRsvp);

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
    ['Nombre', 'Correo', 'Telefono', 'Acompanantes', 'RSVP', 'Rol'],
    profilesCache.map((p) => [p.full_name, p.email, p.phone, p.plus_one_count || 0, p.rsvp_status, p.role]));
});
el('btn-export-rsvp')?.addEventListener('click', () => {
  exportCsv('confirmaciones.csv',
    ['Nombre', 'Correo', 'Estado', 'Acompanantes', 'Mensaje', 'Fecha'],
    profilesCache.filter((p) => p.rsvp_status !== 'pending')
      .map((p) => [p.full_name, p.email, p.rsvp_status, p.plus_one_count || 0, p.rsvp_message, p.rsvp_confirmed_at]));
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
// DATOS: GALERÍA (todas las fotos)
// ─────────────────────────────────────────────
async function loadGallery() {
  const { data, error } = await supabase
    .from('photos')
    .select('id, storage_path, uploaded_at, uploader:profiles!uploader_id(email, full_name)')
    .order('uploaded_at', { ascending: false });
  if (error) { console.error('[Admin] photos:', error); toast('Error al cargar galería'); return; }

  // Firmar URLs
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
    <figure class="admin-photo">
      <img src="${p.url}" alt="" loading="lazy">
      <figcaption class="admin-photo__meta">
        <span class="admin-photo__who">${esc(p.who)}</span>
        <span class="admin-photo__date">${new Date(p.uploaded_at).toLocaleDateString('es-SV')}</span>
      </figcaption>
    </figure>`).join('');
  el('gallery-empty').hidden = rows.length > 0;
}

el('search-gallery')?.addEventListener('input', renderGallery);
el('gallery-sort')?.addEventListener('change', renderGallery);

// ─────────────────────────────────────────────
// DATOS: INVITACIONES (links personalizados)
// ─────────────────────────────────────────────
let invitesCache = [];

function inviteLink(id) {
  return `${location.origin}/?invite=${id}`;
}

function whatsappLink(inv) {
  const name = `${inv.first_name} ${inv.last_name}`.trim();
  const msg =
    `Hola ${name}, Karlita y Edgardo te invitan a celebrar su boda.\n` +
    `Domingo 16 de agosto de 2026 · 4:00 PM · Hotel Hilton, San Salvador.\n\n` +
    `Abre tu invitación aquí:\n${inviteLink(inv.id)}`;
  const digits = (inv.phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

async function loadInvites() {
  const { data, error } = await supabase
    .from('invites')
    .select('id, first_name, last_name, phone, created_at')
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
  tbody.innerHTML = rows.map((i) => `
    <tr>
      <td>${esc(i.first_name)} ${esc(i.last_name)}</td>
      <td>${esc(i.phone || '—')}</td>
      <td><code class="invite-link">${esc(inviteLink(i.id))}</code></td>
      <td class="col-actions">
        <button class="btn btn--ghost btn--sm" data-copy="${esc(inviteLink(i.id))}">Copiar</button>
        <a class="btn btn--gold btn--sm" href="${esc(whatsappLink(i))}" target="_blank" rel="noopener">WhatsApp</a>
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
  if (!first || !last) { toast('Nombre y apellido son obligatorios'); return; }

  const btn = el('btn-generate-invite');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
  const { error } = await supabase.from('invites').insert({
    first_name: first, last_name: last, phone: phone || null, created_by: CURRENT_UID,
  });
  if (btn) { btn.disabled = false; btn.textContent = 'Generar link'; }
  if (error) { console.error('[Admin] crear invite:', error); toast('No se pudo generar el link'); return; }

  el('invite-form').reset();
  toast('Invitación generada');
  loadInvites();
});

el('invites-tbody')?.addEventListener('click', async (e) => {
  const copyBtn = e.target.closest('[data-copy]');
  if (!copyBtn) return;
  try {
    await navigator.clipboard.writeText(copyBtn.dataset.copy);
    toast('Link copiado');
  } catch {
    toast('No se pudo copiar');
  }
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
  await Promise.all([loadProfiles(), loadMusic(), loadGallery(), loadInvites()]);
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

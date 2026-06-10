/* ============================================================
   Karlita & Edgardo · Autenticación + gates + RSVP
   - Cliente Supabase compartido
   - Login con Google (OAuth) — usado para sugerir canciones y panel admin
   - Menú de usuario (esquina superior izquierda)
   - RSVP ABIERTO: cualquiera confirma sin sesión (RPC submit_rsvp)
   - Búsqueda en Spotify + guardar sugerencia (requiere sesión)
   Cargado como módulo: import desde esm.sh.
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.APP_CONFIG || {};
export const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Token de invitación personalizado (?invite=<uuid>), si existe.
const INVITE_TOKEN = new URLSearchParams(location.search).get('invite');

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

  const emailEl = document.getElementById('user-menu-email');
  if (emailEl) emailEl.textContent = session?.user?.email || '';

  applyAdminLink(session);
  if (authed) prefillRsvp(session);
}

// Muestra el acceso al panel solo si la cuenta es super_admin.
async function applyAdminLink(session) {
  const adminLink = document.getElementById('user-menu-admin');
  if (!adminLink) return;
  if (!session) { adminLink.hidden = true; return; }
  try {
    const { data } = await supabase
      .from('profiles').select('role').eq('id', session.user.id).single();
    adminLink.hidden = !(data && data.role === 'super_admin');
  } catch {
    adminLink.hidden = true;
  }
}

// Prefill del RSVP con los datos de Google (correo y nombre), si hay sesión.
function prefillRsvp(session) {
  const emailEl = document.getElementById('email');
  if (emailEl && !emailEl.value) emailEl.value = session.user.email || '';
  const meta = session.user.user_metadata || {};
  const full = meta.full_name || meta.name || '';
  if (full) setNameFields(full);
}

function setNameFields(full) {
  const parts = full.trim().split(/\s+/);
  const fn = parts.shift() || '';
  const ln = parts.join(' ');
  const fnEl = document.getElementById('first-name');
  const lnEl = document.getElementById('last-name');
  if (fnEl && !fnEl.value) fnEl.value = fn;
  if (lnEl && !lnEl.value) lnEl.value = ln;
}

// ─────────────────────────────────────────────
// 2. Login con Google (OAuth) + menú de usuario
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
          options: { redirectTo: `${location.origin}${location.pathname}${location.search}` },
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

function wireUserMenu() {
  const menu = document.getElementById('user-menu');
  const trigger = document.getElementById('user-menu-trigger');
  if (!menu || !trigger) return;

  const setOpen = (open) => {
    menu.dataset.open = open ? 'true' : 'false';
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(menu.dataset.open !== 'true');
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
  menu.querySelectorAll('.user-menu__item').forEach((item) => {
    item.addEventListener('click', () => setOpen(false));
  });
}

// ─────────────────────────────────────────────
// 3. RSVP · abierto para todos (RPC submit_rsvp)
//    Si hay token de invitación, la respuesta queda ligada a esa invitación.
// ─────────────────────────────────────────────

function wireRsvp() {
  const form = document.getElementById('rsvp-form');
  if (!form) return;
  const yesFields = document.getElementById('rsvp-yes-fields');
  const noFields = document.getElementById('rsvp-no-fields');
  const done = document.getElementById('rsvp-done');

  const setReq = (id, on) => { const el = document.getElementById(id); if (el) el.required = on; };

  form.addEventListener('change', (e) => {
    if (e.target.name !== 'attendance') return;
    const isYes = e.target.value === 'yes';
    if (yesFields) yesFields.style.display = isYes ? 'block' : 'none';
    if (noFields) noFields.style.display = isYes ? 'none' : 'block';
    setReq('first-name', isYes); setReq('last-name', isYes); setReq('phone', isYes);
    setReq('no-first-name', !isYes); setReq('no-last-name', !isYes);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-rsvp-submit');

    const fd = new FormData(form);
    const attendance = fd.get('attendance');
    if (!attendance) { alert('Por favor selecciona si podrás asistir.'); return; }

    let payload;
    if (attendance === 'yes') {
      const fn = (fd.get('first-name') || '').trim();
      const ln = (fd.get('last-name') || '').trim();
      const phone = (fd.get('phone') || '').trim();
      const email = (fd.get('email') || '').trim();
      const msg = (fd.get('yes-message') || '').trim();
      if (!fn || !ln || !phone) { alert('Por favor completa nombre, apellido y teléfono.'); return; }
      payload = {
        p_token: INVITE_TOKEN || null,
        p_status: 'confirmed',
        p_full_name: `${fn} ${ln}`,
        p_email: email || null,
        p_phone: phone,
        p_message: msg || null,
        p_plus_one: 0,
      };
    } else {
      const fn = (fd.get('no-first-name') || '').trim();
      const ln = (fd.get('no-last-name') || '').trim();
      const msg = (fd.get('no-message') || '').trim();
      if (!fn || !ln) { alert('Por favor ingresa tu nombre y apellido.'); return; }
      payload = {
        p_token: INVITE_TOKEN || null,
        p_status: 'declined',
        p_full_name: `${fn} ${ln}`,
        p_email: null,
        p_phone: null,
        p_message: msg || null,
        p_plus_one: 0,
      };
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
    const { error } = await supabase.rpc('submit_rsvp', payload);
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar respuesta'; }
    if (error) { console.error('[RSVP] submit_rsvp:', error); alert('No pudimos guardar tu respuesta. Inténtalo de nuevo.'); return; }

    form.hidden = true;
    if (done) done.hidden = false;
  });
}

// Prefill del RSVP a partir del token de invitación:
// usa el nombre del invitado y, si ya respondió antes, su respuesta previa.
async function prefillRsvpFromInvite() {
  if (!INVITE_TOKEN) return;
  try {
    const { data: prev } = await supabase.rpc('get_my_rsvp', { p_token: INVITE_TOKEN });
    const row = Array.isArray(prev) ? prev[0] : prev;
    if (row && row.full_name) {
      // Restaurar respuesta previa
      const isYes = row.status === 'confirmed';
      const radio = document.querySelector(`input[name="attendance"][value="${isYes ? 'yes' : 'no'}"]`);
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
      const parts = (row.full_name || '').trim().split(/\s+/);
      const fn = parts.shift() || '';
      const ln = parts.join(' ');
      const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
      if (isYes) {
        set('first-name', fn); set('last-name', ln);
        set('email', row.email); set('phone', row.phone); set('yes-message', row.message);
      } else {
        set('no-first-name', fn); set('no-last-name', ln); set('no-message', row.message);
      }
      return;
    }
  } catch (err) {
    console.error('[RSVP] get_my_rsvp:', err);
  }
  // Sin respuesta previa: prefill del nombre desde la invitación.
  try {
    const { data: name } = await supabase.rpc('get_invite_name', { token: INVITE_TOKEN });
    if (name) setNameFields(name);
  } catch { /* noop */ }
}

// ─────────────────────────────────────────────
// 5. Invitación personalizada (?invite=<token>)
//    Muestra el nombre del invitado en la pantalla de entrada.
// ─────────────────────────────────────────────
async function applyInviteName() {
  if (!INVITE_TOKEN) return;
  const wrap = document.getElementById('entry-guest');
  const nameEl = document.getElementById('entry-guest-name');
  if (!wrap || !nameEl) return;
  try {
    const { data, error } = await supabase.rpc('get_invite_name', { token: INVITE_TOKEN });
    if (error || !data) return;
    nameEl.textContent = data;
    wrap.hidden = false;
  } catch (err) {
    console.error('[Invite] get_invite_name:', err);
  }
}

// ─────────────────────────────────────────────
// 6. Arranque
// ─────────────────────────────────────────────

supabase.auth.getSession().then(({ data }) => applyAuthState(data.session));
supabase.auth.onAuthStateChange((_event, session) => applyAuthState(session));

wireGoogleLogin();
wireUserMenu();
wireRsvp();
applyInviteName();
prefillRsvpFromInvite();

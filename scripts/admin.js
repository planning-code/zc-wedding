/* ============================================================
   Karlita & Edgardo · Admin Panel JS (fase 1 — localStorage mock)
   En fases 12–19 cada función se conecta a Supabase/Resend/WhatsApp.
   ============================================================ */
(() => {
  'use strict';

  // ─────────────────────────────────────────────
  // ESTADO LOCAL (se reemplaza con Supabase en fase 12)
  // ─────────────────────────────────────────────
  const STORAGE_KEY = 'zc_guests_v1';

  function loadGuests() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }
  function saveGuests(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  let guests = loadGuests();

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ─────────────────────────────────────────────
  // NAVEGACIÓN POR SECCIONES
  // ─────────────────────────────────────────────
  const sections  = document.querySelectorAll('.admin-section');
  const navLinks  = document.querySelectorAll('.sidebar__link[data-section]');
  const pageTitle = document.getElementById('page-title');

  const SECTION_TITLES = {
    invitados: 'Invitados',
    detalles:  'Detalles del evento',
    rsvp:      'Confirmaciones',
    musica:    'Música',
  };

  function showSection(id) {
    sections.forEach(s => {
      s.hidden = s.dataset.section !== id;
    });
    navLinks.forEach(a => {
      a.classList.toggle('sidebar__link--active', a.dataset.section === id);
    });
    if (pageTitle) pageTitle.textContent = SECTION_TITLES[id] || id;
    if (window.innerWidth <= 768) closeSidebar();
    if (id === 'invitados') renderGuestsTable();
    if (id === 'rsvp')      renderRsvpTable();
    if (id === 'musica')    renderMusicTable();
  }

  navLinks.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      showSection(a.dataset.section);
    });
  });

  // Inicializar sección activa
  showSection('invitados');

  // ─────────────────────────────────────────────
  // SIDEBAR MÓVIL
  // ─────────────────────────────────────────────
  const sidebar     = document.getElementById('sidebar');
  const menuToggle  = document.getElementById('menu-toggle');
  const backdrop    = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:49;display:none;';
  document.body.appendChild(backdrop);

  function openSidebar() {
    sidebar.classList.add('is-open');
    backdrop.style.display = 'block';
    menuToggle.setAttribute('aria-expanded', 'true');
  }
  function closeSidebar() {
    sidebar.classList.remove('is-open');
    backdrop.style.display = 'none';
    menuToggle.setAttribute('aria-expanded', 'false');
  }
  menuToggle?.addEventListener('click', () => sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar());
  backdrop.addEventListener('click', closeSidebar);

  // ─────────────────────────────────────────────
  // TOAST
  // ─────────────────────────────────────────────
  const toastEl  = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  let toastTimer = null;

  function showToast(msg, duration = 3000) {
    if (!toastEl || !toastMsg) return;
    toastMsg.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, duration);
  }

  // ─────────────────────────────────────────────
  // KPIs
  // ─────────────────────────────────────────────
  function updateKpis() {
    const total     = guests.length;
    const confirmed = guests.filter(g => g.rsvpStatus === 'confirmed').length;
    const pending   = guests.filter(g => g.rsvpStatus === 'pending').length;
    const declined  = guests.filter(g => g.rsvpStatus === 'declined').length;
    const seats     = guests.reduce((acc, g) => acc + 1 + (parseInt(g.companions) || 0), 0);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('kpi-total',     total);
    set('kpi-confirmed', confirmed);
    set('kpi-pending',   pending);
    set('kpi-declined',  declined);
    set('kpi-seats',     seats);
    set('rsvp-confirmed',  confirmed);
    set('rsvp-pending',    pending);
    set('rsvp-declined',   declined);
    set('rsvp-plus-ones',  guests.reduce((a, g) => a + (parseInt(g.companions) || 0), 0));
  }

  // ─────────────────────────────────────────────
  // TABLA DE INVITADOS
  // ─────────────────────────────────────────────
  const guestsTbody = document.getElementById('guests-tbody');
  const guestsEmpty = document.getElementById('guests-empty');
  const searchInput = document.getElementById('search-guests');

  function statusTag(status) {
    const map = {
      confirmed: '<span class="status-tag status-tag--confirmed">Confirmado</span>',
      pending:   '<span class="status-tag status-tag--pending">Pendiente</span>',
      declined:  '<span class="status-tag status-tag--declined">Declinó</span>',
    };
    return map[status] || map.pending;
  }

  function sentIcon(sent) {
    return sent
      ? '<svg class="sent-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-label="Enviado"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg class="unsent-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="No enviado"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  }

  function renderGuestsTable(filter = '') {
    updateKpis();
    const filtered = guests.filter(g =>
      !filter ||
      g.name.toLowerCase().includes(filter.toLowerCase()) ||
      (g.email || '').toLowerCase().includes(filter.toLowerCase())
    );

    if (!guestsTbody) return;

    if (filtered.length === 0) {
      guestsTbody.innerHTML = '';
      if (guestsEmpty) guestsEmpty.hidden = false;
      return;
    }
    if (guestsEmpty) guestsEmpty.hidden = true;

    guestsTbody.innerHTML = filtered.map(g => `
      <tr data-id="${g.id}">
        <td><strong>${g.name}</strong>${g.notes ? `<br><small style="color:var(--text-3);font-style:italic">${g.notes}</small>` : ''}</td>
        <td>${g.email || '—'}</td>
        <td>${g.phone || '—'}</td>
        <td style="text-align:center">${g.companions || 0}</td>
        <td>${statusTag(g.rsvpStatus)}</td>
        <td>
          <span title="Email" style="margin-right:.5rem">${sentIcon(g.emailSent)}</span>
          <span title="WhatsApp">${sentIcon(g.waSent)}</span>
        </td>
        <td>
          <div class="row-actions">
            <button class="btn btn--ghost btn--sm" onclick="adminActions.sendInvite('${g.id}')" type="button" title="Enviar invitación">Enviar</button>
            <button class="btn btn--ghost btn--sm" onclick="adminActions.editGuest('${g.id}')" type="button">Editar</button>
            <button class="btn btn--danger btn--sm" onclick="adminActions.deleteGuest('${g.id}')" type="button">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  searchInput?.addEventListener('input', e => renderGuestsTable(e.target.value));

  // ─────────────────────────────────────────────
  // MODAL DE INVITADO
  // ─────────────────────────────────────────────
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalClose    = document.getElementById('modal-close');
  const modalCancel   = document.getElementById('btn-modal-cancel');
  const guestForm     = document.getElementById('guest-form');
  const modalTitle    = document.getElementById('modal-title');
  const btnSendEmail  = document.getElementById('btn-send-email');
  const btnSendWa     = document.getElementById('btn-send-whatsapp');
  const modalSendNote = document.querySelector('.modal__send-note');

  let editingId = null;

  function openModal(guest = null) {
    editingId = guest ? guest.id : null;
    if (modalTitle) modalTitle.textContent = guest ? 'Editar invitado' : 'Agregar invitado';

    document.getElementById('guest-id').value           = guest?.id || '';
    document.getElementById('guest-name').value         = guest?.name || '';
    document.getElementById('guest-email').value        = guest?.email || '';
    document.getElementById('guest-phone').value        = guest?.phone || '';
    document.getElementById('guest-companions').value   = guest?.companions ?? 0;
    document.getElementById('guest-notes').value        = guest?.notes || '';

    const hasSaved = !!guest;
    if (btnSendEmail) btnSendEmail.disabled  = !hasSaved || !guest?.email;
    if (btnSendWa)    btnSendWa.disabled     = !hasSaved || !guest?.phone;
    if (modalSendNote) modalSendNote.hidden  = hasSaved;

    if (modalBackdrop) modalBackdrop.hidden = false;
    document.getElementById('guest-name')?.focus();
  }

  function closeModal() {
    if (modalBackdrop) modalBackdrop.hidden = true;
    editingId = null;
  }

  document.getElementById('btn-add-guest')?.addEventListener('click', () => openModal());
  modalClose?.addEventListener('click', closeModal);
  modalCancel?.addEventListener('click', closeModal);
  modalBackdrop?.addEventListener('click', e => { if (e.target === modalBackdrop) closeModal(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modalBackdrop?.hidden) closeModal();
  });

  guestForm?.addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      id:         editingId || generateId(),
      name:       document.getElementById('guest-name').value.trim(),
      email:      document.getElementById('guest-email').value.trim(),
      phone:      document.getElementById('guest-phone').value.trim(),
      companions: parseInt(document.getElementById('guest-companions').value) || 0,
      notes:      document.getElementById('guest-notes').value.trim(),
      rsvpStatus: 'pending',
      emailSent:  false,
      waSent:     false,
      createdAt:  new Date().toISOString(),
    };

    if (!data.name) {
      showToast('El nombre es requerido.');
      return;
    }

    if (editingId) {
      const idx = guests.findIndex(g => g.id === editingId);
      if (idx !== -1) {
        data.rsvpStatus = guests[idx].rsvpStatus;
        data.emailSent  = guests[idx].emailSent;
        data.waSent     = guests[idx].waSent;
        data.createdAt  = guests[idx].createdAt;
        guests[idx] = data;
      }
    } else {
      guests.push(data);
    }

    saveGuests(guests);
    renderGuestsTable(searchInput?.value || '');
    closeModal();
    showToast(editingId ? 'Invitado actualizado.' : 'Invitado agregado.');
  });

  // ─────────────────────────────────────────────
  // ENVÍO DE INVITACIONES
  // ─────────────────────────────────────────────
  const BASE_URL = 'https://zcwedding.com';

  function buildInviteUrl(guest) {
    return `${BASE_URL}/?invite=${guest.id}`;
  }

  function buildWhatsAppMsg(guest) {
    const inviteUrl = buildInviteUrl(guest);
    const msg = `Hola ${guest.name} 💌\n\nKarlita y Edgardo te invitan a celebrar su boda.\nDomingo 16 de agosto de 2026 · 4:00 PM\nHilton San Salvador\n\nConfirma tu asistencia aquí:\n${inviteUrl}`;
    return `https://wa.me/${guest.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  }

  // Envío de email (fase 14 — conectar a Resend via Cloudflare Function)
  function sendEmail(guest) {
    showToast(`[Fase 14] Correo simulado → ${guest.email}`);
    const idx = guests.findIndex(g => g.id === guest.id);
    if (idx !== -1) { guests[idx].emailSent = true; saveGuests(guests); renderGuestsTable(); }
  }

  // Envío WhatsApp (Opción A — abre app con mensaje prellenado)
  function sendWhatsApp(guest) {
    if (!guest.phone) { showToast('El invitado no tiene número de teléfono.'); return; }
    window.open(buildWhatsAppMsg(guest), '_blank');
    const idx = guests.findIndex(g => g.id === guest.id);
    if (idx !== -1) { guests[idx].waSent = true; saveGuests(guests); renderGuestsTable(); }
  }

  // Botones en el modal (invitado ya guardado)
  btnSendEmail?.addEventListener('click', () => {
    const g = guests.find(g => g.id === editingId);
    if (g) sendEmail(g);
  });
  btnSendWa?.addEventListener('click', () => {
    const g = guests.find(g => g.id === editingId);
    if (g) sendWhatsApp(g);
  });

  // ─────────────────────────────────────────────
  // ACCIONES EXPUESTAS GLOBALMENTE (onclick en tabla)
  // ─────────────────────────────────────────────
  window.adminActions = {
    editGuest(id) {
      const g = guests.find(g => g.id === id);
      if (g) openModal(g);
    },
    deleteGuest(id) {
      if (!confirm('¿Eliminar este invitado?')) return;
      guests = guests.filter(g => g.id !== id);
      saveGuests(guests);
      renderGuestsTable(searchInput?.value || '');
      showToast('Invitado eliminado.');
    },
    sendInvite(id) {
      const g = guests.find(g => g.id === id);
      if (!g) return;
      const method = prompt(`Enviar invitación a ${g.name}.\nEscribe "email" o "wa":`, g.email ? 'email' : 'wa');
      if (!method) return;
      if (method.trim().toLowerCase() === 'wa') sendWhatsApp(g);
      else sendEmail(g);
    },
  };

  // ─────────────────────────────────────────────
  // EXPORTAR CSV
  // ─────────────────────────────────────────────
  function exportCsv(data, filename) {
    if (!data.length) { showToast('No hay datos para exportar.'); return; }
    const keys = Object.keys(data[0]);
    const csv  = [keys.join(','), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = filename;
    a.click();
  }

  document.getElementById('btn-export-csv')?.addEventListener('click', () => exportCsv(guests, 'invitados-kye.csv'));
  document.getElementById('btn-export-rsvp')?.addEventListener('click', () => {
    const rsvp = guests.filter(g => g.rsvpStatus !== 'pending').map(g => ({
      nombre: g.name, correo: g.email, estado: g.rsvpStatus, acompanantes: g.companions,
    }));
    exportCsv(rsvp, 'rsvp-kye.csv');
  });

  // ─────────────────────────────────────────────
  // TABLA RSVP
  // ─────────────────────────────────────────────
  const rsvpTbody  = document.getElementById('rsvp-tbody');
  const rsvpEmpty  = document.getElementById('rsvp-empty');
  const searchRsvp = document.getElementById('search-rsvp');

  function renderRsvpTable(filter = '') {
    updateKpis();
    const filtered = guests.filter(g =>
      !filter ||
      g.name.toLowerCase().includes(filter.toLowerCase()) ||
      (g.email || '').toLowerCase().includes(filter.toLowerCase())
    );

    if (!rsvpTbody) return;
    if (filtered.length === 0) {
      rsvpTbody.innerHTML = '';
      if (rsvpEmpty) rsvpEmpty.hidden = false;
      return;
    }
    if (rsvpEmpty) rsvpEmpty.hidden = true;

    rsvpTbody.innerHTML = filtered.map(g => `
      <tr>
        <td><strong>${g.name}</strong></td>
        <td>${g.email || '—'}</td>
        <td>${statusTag(g.rsvpStatus)}</td>
        <td style="text-align:center">${g.companions || 0}</td>
        <td>${g.dietary || '—'}</td>
        <td>${g.rsvpDate ? new Date(g.rsvpDate).toLocaleDateString('es-SV') : '—'}</td>
      </tr>
    `).join('');
  }

  searchRsvp?.addEventListener('input', e => renderRsvpTable(e.target.value));

  // ─────────────────────────────────────────────
  // TABLA MÚSICA (mock)
  // ─────────────────────────────────────────────
  const musicTbody = document.getElementById('music-tbody');
  const musicEmpty = document.getElementById('music-empty');

  function renderMusicTable() {
    // En fase 16 se conectará a Supabase song_suggestions
    const suggestions = JSON.parse(localStorage.getItem('zc_songs_v1') || '[]');

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('music-pending-count',  suggestions.filter(s => s.status === 'pending').length);
    set('music-approved-count', suggestions.filter(s => s.status === 'approved').length);
    set('music-rejected-count', suggestions.filter(s => s.status === 'rejected').length);

    if (!musicTbody) return;
    if (suggestions.length === 0) {
      musicTbody.innerHTML = '';
      if (musicEmpty) musicEmpty.hidden = false;
      return;
    }
    if (musicEmpty) musicEmpty.hidden = true;

    musicTbody.innerHTML = suggestions.map(s => `
      <tr>
        <td><strong>${s.trackName}</strong></td>
        <td>${s.artistName}</td>
        <td>${s.suggesterName || '—'}</td>
        <td>${statusTag(s.status)}</td>
        <td>
          <div class="row-actions">
            ${s.status === 'pending' ? `
              <button class="btn btn--ghost btn--sm" onclick="approveSong('${s.id}')" type="button">Aprobar</button>
              <button class="btn btn--danger btn--sm" onclick="rejectSong('${s.id}')" type="button">Rechazar</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  window.approveSong = id => {
    const songs = JSON.parse(localStorage.getItem('zc_songs_v1') || '[]');
    const idx   = songs.findIndex(s => s.id === id);
    if (idx !== -1) { songs[idx].status = 'approved'; localStorage.setItem('zc_songs_v1', JSON.stringify(songs)); renderMusicTable(); showToast('Canción aprobada.'); }
  };
  window.rejectSong = id => {
    const songs = JSON.parse(localStorage.getItem('zc_songs_v1') || '[]');
    const idx   = songs.findIndex(s => s.id === id);
    if (idx !== -1) { songs[idx].status = 'rejected'; localStorage.setItem('zc_songs_v1', JSON.stringify(songs)); renderMusicTable(); showToast('Canción rechazada.'); }
  };

  // ─────────────────────────────────────────────
  // FORMULARIOS DE CONFIGURACIÓN (mock — se persisten en localStorage)
  // ─────────────────────────────────────────────
  const SETTINGS_KEY = 'zc_settings_v1';
  const defaultSettings = {};
  const savedSettings   = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');

  function saveForm(formId) {
    const form   = document.getElementById(formId);
    if (!form) return;
    const fields = form.querySelectorAll('input, textarea, select');
    const data   = {};
    fields.forEach(f => {
      if (f.type === 'checkbox') data[f.id] = f.checked;
      else data[f.id] = f.value;
    });
    const settings = { ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'), ...data };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    showToast('Cambios guardados.');
  }

  ['form-general', 'form-padres', 'form-mensaje'].forEach(id => {
    document.getElementById(id)?.addEventListener('submit', e => {
      e.preventDefault();
      saveForm(id);
    });
  });

  // Restaurar valores guardados
  Object.entries(savedSettings).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = val;
    else el.value = val;
  });

  // ─────────────────────────────────────────────
  // RECORDATORIO (placeholder — fase 14)
  // ─────────────────────────────────────────────
  document.getElementById('btn-send-reminder')?.addEventListener('click', () => {
    const pending = guests.filter(g => g.rsvpStatus === 'pending' && g.email);
    showToast(`[Fase 14] Recordatorio simulado a ${pending.length} invitados pendientes.`);
  });

  // ─────────────────────────────────────────────
  // LOGOUT (placeholder — fase 12)
  // ─────────────────────────────────────────────
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) {
      showToast('[Fase 12] Sesión cerrada simulada.');
      setTimeout(() => { window.location.href = '/'; }, 1200);
    }
  });

})();

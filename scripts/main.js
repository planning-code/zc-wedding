/* ============================================================
   Karlita & Edgardo · 16.08.2026
   Lógica principal — fase 1
   Por ahora solo: cuenta regresiva, reproductor de música,
   botones de calendario, formularios mock.
   Las animaciones de scroll vienen en fase 3.
   ============================================================ */

(() => {
  'use strict';

  // ─────────────────────────────────────────────
  // 1. CUENTA REGRESIVA
  //    Objetivo: 16 de agosto de 2026, 4:00 PM, El Salvador (UTC-6).
  //    Estados especiales: día del evento ("¡Hoy nos casamos!"),
  //    post-evento (count-up).
  // ─────────────────────────────────────────────

  const TARGET = new Date('2026-08-16T16:00:00-06:00');

  const numEls = {
    days: document.querySelector('[data-unit="days"]'),
    hours: document.querySelector('[data-unit="hours"]'),
    minutes: document.querySelector('[data-unit="minutes"]'),
    seconds: document.querySelector('[data-unit="seconds"]'),
  };

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function tickCountdown() {
    const now = new Date();
    const diff = TARGET - now;

    if (diff <= 0) {
      // Día del evento o después — por ahora solo deja en cero.
      // En fase 4 se agrega el estado "¡Hoy nos casamos!".
      Object.values(numEls).forEach((el) => el && (el.textContent = '00'));
      return;
    }

    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1000);

    if (numEls.days) numEls.days.textContent = pad(days);
    if (numEls.hours) numEls.hours.textContent = pad(hours);
    if (numEls.minutes) numEls.minutes.textContent = pad(minutes);
    if (numEls.seconds) numEls.seconds.textContent = pad(seconds);
  }

  tickCountdown();
  setInterval(tickCountdown, 1000);

  // ─────────────────────────────────────────────
  // 2. ENLACE DE GOOGLE CALENDAR
  //    16 ago 2026 16:00 -06:00  =  16 ago 2026 22:00 UTC
  // ─────────────────────────────────────────────

  const gcalBtn = document.getElementById('btn-google-cal');
  if (gcalBtn) {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: 'Boda Karlita & Edgardo',
      dates: '20260816T220000Z/20260817T050000Z',
      details:
        'Hilton San Salvador. Confirma tu asistencia: https://zcwedding.com',
      location:
        'Hilton San Salvador, Av. Las Magnolias y Bvd. del Hipódromo, San Salvador, El Salvador',
    });
    gcalBtn.href = `https://calendar.google.com/calendar/render?${params}`;
  }

  // ─────────────────────────────────────────────
  // 3. REPRODUCTOR DE MÚSICA · YouTube IFrame API
  // ─────────────────────────────────────────────

  const musicPlayer = document.getElementById('music-player');
  const musicToggle = document.getElementById('music-toggle');
  let ytPlayer = null;
  let ytReady = false;
  let pendingPlay = false;

  // Función de inicialización
  function initYTPlayer() {
    if (ytPlayer) return; // Evitar doble inicialización

    ytPlayer = new YT.Player('yt-player', {
      videoId: 'X4JjW_jZ5yU',
      playerVars: {
        autoplay: 0,
        loop: 1,
        playlist: 'X4JjW_jZ5yU',
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3
      },
      events: {
        onReady: (e) => {
          console.log('[Música] Player listo');
          ytReady = true;
          e.target.setVolume(50);
          if (pendingPlay) {
            console.log('[Música] Ejecutando reproducción pendiente');
            e.target.playVideo();
            pendingPlay = false;
          }
        },
        onStateChange: (e) => {
          if (!musicPlayer) return;
          const isPlaying = e.data === YT.PlayerState.PLAYING;
          musicPlayer.dataset.state = isPlaying ? 'playing' : 'paused';
          musicToggle.setAttribute('aria-label', isPlaying ? 'Pausar música' : 'Reproducir música');
        },
        onError: (e) => {
          console.error('[Música] Error en el reproductor de YouTube:', e.data);
        }
      },
    });
  }

  // Definir globalmente para la API
  window.onYouTubeIframeAPIReady = initYTPlayer;

  // Por si la API carga ANTES de que este script se ejecute
  if (window.YT && window.YT.Player) {
    initYTPlayer();
  }

  if (musicToggle) {
    musicToggle.addEventListener('click', () => {
      if (!ytReady || !ytPlayer) {
        pendingPlay = true;
        musicPlayer.dataset.state = 'loading';
        return;
      }

      const state = ytPlayer.getPlayerState();
      if (state === YT.PlayerState.PLAYING) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    });
  }

  // ─────────────────────────────────────────────
  // 4. LÓGICA DE PANTALLA DE ENTRADA
  // ─────────────────────────────────────────────

  const entryOverlay = document.getElementById('entry-overlay');
  const btnOpenInvite = document.getElementById('btn-open-invite');

  if (entryOverlay && btnOpenInvite) {
    btnOpenInvite.addEventListener('click', () => {
      // 1. Intentar reproducir música
      if (ytReady) {
        ytPlayer.playVideo();
      } else {
        pendingPlay = true;
      }

      // 2. Ocultar overlay
      entryOverlay.classList.add('is-hidden');

      // 3. Habilitar scroll
      document.body.classList.remove('no-scroll');
    });
  }

  // ─────────────────────────────────────────────
  // 4. FORMULARIOS MOCK
  //    Solo evitan el submit y muestran un mensaje.
  //    El cableado real ocurre en fases 12 (RSVP) y 16 (Spotify).
  // ─────────────────────────────────────────────

  const rsvpForm = document.getElementById('rsvp-form');
  const rsvpYesFields = document.getElementById('rsvp-yes-fields');
  const rsvpNoFields = document.getElementById('rsvp-no-fields');

  if (rsvpForm && rsvpYesFields && rsvpNoFields) {
    // Escuchar cambios en el selector de asistencia
    rsvpForm.addEventListener('change', (e) => {
      if (e.target.name === 'attendance') {
        const isYes = e.target.value === 'yes';
        
        // Toggle de contenedores
        rsvpYesFields.style.display = isYes ? 'block' : 'none';
        rsvpNoFields.style.display = !isYes ? 'block' : 'none';
        
        // Hacer campos requeridos dinámicamente
        const yesInputs = rsvpYesFields.querySelectorAll('input');
        yesInputs.forEach(input => input.required = isYes);

        const noInputs = rsvpNoFields.querySelectorAll('input');
        noInputs.forEach(input => input.required = !isYes);
      }
    });

    rsvpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const formData = new FormData(rsvpForm);
      const attendance = formData.get('attendance');

      if (!attendance) {
        alert('Por favor selecciona si podrás asistir.');
        return;
      }

      if (attendance === 'no') {
        const firstName = formData.get('no-first-name');
        const lastName = formData.get('no-last-name');
        const message = formData.get('no-message');

        if (!firstName || !lastName) {
          alert('Por favor ingresa tu nombre y apellido.');
          return;
        }

        alert(
          `[Mock Fase 1]\n\nRespuesta recibida.\n\nTe extrañaremos, ${firstName}. Gracias por tus felicitaciones:\n"${message || 'Sin mensaje'}"`
        );
      } else {
        const firstName = formData.get('first-name');
        const lastName = formData.get('last-name');
        const email = formData.get('email');
        const phone = formData.get('phone');
        const message = formData.get('yes-message');

        if (!firstName || !lastName || !email || !phone) {
          alert('Por favor completa todos los campos para confirmar tu asistencia.');
          return;
        }

        alert(
          `[Mock Fase 1]\n\n¡Gracias por confirmar, ${firstName}!\n\nDatos registrados:\n- Nombre: ${firstName} ${lastName}\n- Correo: ${email}\n- Teléfono: ${phone}\n- Mensaje: "${message || 'Sin mensaje'}"\n\nEn la fase 12 esto se guardará en la base de datos.`
        );
      }
    });
  }

  const songForm = document.getElementById('song-form');
  if (songForm) {
    songForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = songForm.querySelector('#song-search').value.trim();
      if (!q) return;
      alert(
        `[Mock fase 1]\n\nBúsqueda en Spotify simulada para:\n"${q}"\n\nEn la fase 16 esto llamará a /api/spotify-search.`
      );
    });
  }

})();

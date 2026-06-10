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
  // 3. REPRODUCTOR DE MÚSICA · <audio> nativo, MP3 self-hosted
  // ─────────────────────────────────────────────

  const musicPlayer = document.getElementById('music-player');
  const musicToggle = document.getElementById('music-toggle');
  const bgAudio = document.getElementById('bg-audio');

  if (bgAudio) {
    bgAudio.volume = 0.6;

    bgAudio.addEventListener('playing', () => {
      if (!musicPlayer) return;
      musicPlayer.dataset.state = 'playing';
      musicToggle.setAttribute('aria-label', 'Pausar música');
    });

    bgAudio.addEventListener('pause', () => {
      if (!musicPlayer) return;
      musicPlayer.dataset.state = 'paused';
      musicToggle.setAttribute('aria-label', 'Reproducir música');
    });

    bgAudio.addEventListener('waiting', () => {
      if (!musicPlayer) return;
      musicPlayer.dataset.state = 'loading';
    });

    bgAudio.addEventListener('error', () => {
      console.error('[Música] No se pudo cargar el MP3:', bgAudio.error);
      if (musicPlayer) musicPlayer.dataset.state = 'error';
    });
  }

  function tryPlayAudio() {
    if (!bgAudio) return Promise.reject(new Error('no audio element'));
    const p = bgAudio.play();
    return p && typeof p.then === 'function' ? p : Promise.resolve();
  }

  if (musicToggle && bgAudio) {
    musicToggle.addEventListener('click', () => {
      if (bgAudio.paused) {
        tryPlayAudio().catch((err) => {
          console.warn('[Música] Reproducción bloqueada:', err);
          musicPlayer.dataset.state = 'paused';
        });
      } else {
        bgAudio.pause();
      }
    });
  }

  // ─────────────────────────────────────────────
  // 4. LÓGICA DE PANTALLA DE ENTRADA
  // ─────────────────────────────────────────────

  const entryOverlay = document.getElementById('entry-overlay');
  const btnOpenInvite = document.getElementById('btn-open-invite');

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (entryOverlay && btnOpenInvite) {
    let opening = false;
    btnOpenInvite.addEventListener('click', () => {
      if (opening) return;
      opening = true;
      btnOpenInvite.disabled = true;

      // 1. Reproducir música DENTRO del gesto del usuario (autoplay permitido).
      tryPlayAudio().catch((err) => {
        console.warn('[Música] Reproducción bloqueada en entrada:', err);
      });

      // 2. Levantar la solapa (sello + líneas) — la animación vive en CSS.
      entryOverlay.classList.add('is-opening');

      // 3. Tras la apertura, desvanecer la entrada y liberar el scroll.
      // Esperar a que la solapa termine de abrir (1100ms) + el fondo revele el hero (1150ms delay + 650ms)
      const reveal = () => {
        entryOverlay.classList.add('is-hidden');
        document.body.classList.remove('no-scroll');
      };
      window.setTimeout(reveal, prefersReducedMotion ? 200 : 1900);
    });
  }

  // El RSVP y la búsqueda/sugerencia de canciones se manejan en auth.js
  // (requieren sesión de Supabase).

})();

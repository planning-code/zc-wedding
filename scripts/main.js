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
  // 3. REPRODUCTOR DE MÚSICA
  //    Carlos Vives — Volví a Nacer.
  //    Los navegadores no permiten autoplay con sonido —
  //    el usuario tiene que iniciar la reproducción.
  //    El archivo MP3 va en /assets/volvi-a-nacer.mp3
  // ─────────────────────────────────────────────

  const player = document.getElementById('music-player');
  const toggle = document.getElementById('music-toggle');
  const audio = document.getElementById('bg-music');

  if (player && toggle && audio) {
    audio.volume = 0.4;

    toggle.addEventListener('click', () => {
      if (audio.paused) {
        audio.play().then(() => {
          player.dataset.state = 'playing';
          toggle.setAttribute('aria-label', 'Pausar música');
        }).catch((err) => {
          // Si falla (por ejemplo, archivo no existe todavía), avisa en consola
          console.warn('Audio no disponible:', err);
        });
      } else {
        audio.pause();
        player.dataset.state = 'paused';
        toggle.setAttribute('aria-label', 'Reproducir música');
      }
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

  // ─────────────────────────────────────────────
  // 5. PARALLAX — Sección 3 (Nombres)
  //    La foto empieza mostrando los pies (100%).
  //    Conforme el usuario scrollea dentro de la sección,
  //    el background-position sube hasta 30% revelando las caras.
  //    Recorrido: 100% → 30% a lo largo del 50% de la sección.
  // ─────────────────────────────────────────────

  const namesSection = document.getElementById('nombres');
  const namesPhoto   = document.getElementById('names-photo');

  if (namesSection && namesPhoto) {
    let rafPending = false;

    function updateNamesParallax() {
      rafPending = false;

      const rect       = namesSection.getBoundingClientRect();
      const sectionH   = namesSection.offsetHeight;         // 200vh
      const viewH      = window.innerHeight;

      // scrolled: cuántos px ha avanzado el usuario dentro de la sección
      // 0 = tope de la sección acaba de entrar en pantalla
      // sectionH - viewH = fondo de la sección está al borde inferior del viewport
      const scrolled   = -rect.top;
      const maxScroll  = sectionH - viewH;

      // Progreso 0–1 limitado a la primera mitad del scroll
      const progress   = Math.min(1, Math.max(0, scrolled / (maxScroll * 0.6)));

      // background-position: 100% (pies) → 30% (caras)
      const startPct   = 100;
      const endPct     = 30;
      const currentPct = startPct - (startPct - endPct) * progress;

      namesPhoto.style.backgroundPosition = `center ${currentPct}%`;
    }

    window.addEventListener('scroll', () => {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(updateNamesParallax);
      }
    }, { passive: true });

    // Ejecutar una vez al cargar por si la sección ya es visible
    updateNamesParallax();
  }

})();

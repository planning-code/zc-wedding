---
name: wedding-invite
description: Plantilla completa para construir un sitio de invitación de boda (estilo editorial blanco/negro con acento dorado). Reúne toda la lógica del sitio Zamora-Cárcamo — entry overlay tipo sobre, RSVP abierto sin login, invitaciones personalizadas por token, galería privada con Storage, sugerencias de canciones con Spotify y panel de super admin. Úsalo para crear una nueva invitación desde cero (cambiando colores, logos, fotos, nombres, fecha, lugar) o para modificar una existente, manteniendo intacta la arquitectura. Stack: HTML/CSS/JS vanilla + Supabase + Cloudflare Workers.
---

# Wedding Invite — plantilla de sitio de boda

Plantilla derivada del sitio real de la boda Zamora-Cárcamo. La idea es **personalizar lo cosmético y de evento** (colores, logo, fotos, nombres, fecha, lugar, correos admin, playlist) **sin tocar la lógica de construcción** (auth, RSVP, tokens, galería, Spotify, routing, RLS).

Todo el contenido visible para invitados debe ser **español latinoamericano** (sin "vosotros", sin localismos de España). **Nunca usar emojis** en código, UI, contenido ni commits.

---

## 1. Stack y arquitectura

```
Navegador (HTML/CSS/JS estático, sin build)
    │
    ├── Supabase JS (esm.sh) ──► Supabase
    │      ├── Auth: Google OAuth (solo para galería, sugerir canciones y panel admin)
    │      ├── Postgres con RLS + RPCs security-definer (RSVP anónimo, nombre de invitado)
    │      └── Storage: bucket privado `wedding-photos` con signed URLs
    │
    └── fetch('/api/*') ──► Cloudflare Worker (worker.js)
                              └── functions/api/*  (endpoints de Spotify; aquí viven los secretos)
```

**Principio de separación:** Supabase + RLS atiende casi toda lectura/escritura desde el navegador. El Worker de Cloudflare existe **solo** donde hace falta un secreto (client secret y refresh token de Spotify). La anon key de Supabase es pública por diseño; la seguridad real está en las políticas RLS.

**Hosting:** Cloudflare **Workers** (no Pages). `worker.js` es el entry point: sirve los archivos estáticos vía el binding `ASSETS` y enruta `/api/*` a los handlers. La configuración está en `wrangler.jsonc`.

---

## 2. Inventario de archivos

```
<raíz>/
├── index.html              # Landing: entry overlay, hero, padres, save-the-date, historia,
│                           #   detalles, itinerario, lugar, dress code, regalos, RSVP,
│                           #   sugerir canción (teaser), galería (teaser), cierre, footer
├── gallery.html            # Galería: gate de login + subida + grid
├── playlist.html           # Sugerir canciones (buscador Spotify) + playlist
├── admin.html              # Panel super admin (invitados, música, galería, invitaciones)
├── styles/
│   ├── main.css            # Tokens de diseño (:root) + estilos de la landing/galería/playlist
│   └── admin.css           # Estilos del panel admin
├── scripts/
│   ├── config.js           # window.APP_CONFIG = { SUPABASE_URL, SUPABASE_ANON_KEY }
│   ├── auth.js             # Cliente Supabase compartido, gates, menú usuario, RSVP, invitación
│   ├── main.js             # Cuenta regresiva, Google Calendar, audio de fondo, entry overlay
│   ├── gallery.js          # Galería: gate, subida a Storage, listar, eliminar (super admin)
│   ├── playlist.js         # Buscador Spotify + guardar sugerencia
│   └── admin.js            # Panel: invitados+RSVP+filtros, música, galería, invitaciones
├── functions/api/
│   ├── _utils.js           # readEnv() (recorta espacios en nombre/valor) + json()
│   ├── spotify-search.js   # GET  — búsqueda (Client Credentials, sin login)
│   ├── spotify-authorize.js# GET  — inicia OAuth para obtener el refresh token (1 sola vez)
│   ├── spotify-auth-callback.js # GET — muestra el refresh_token para copiarlo a Cloudflare
│   └── spotify-add-track.js# POST — agrega un track a la playlist (usa refresh token)
├── supabase/               # SQL numerado; ejecutar EN ORDEN en el SQL Editor
│   ├── 01_schema.sql       # profiles, photos, song_suggestions, spotify_credentials, trigger
│   ├── 02_rls.sql          # is_super_admin() + políticas RLS
│   ├── 03_storage.sql      # políticas del bucket wedding-photos
│   ├── 04_seed_admins.sql  # marca correos como super_admin
│   ├── 05_invites.sql      # tabla invites + get_invite_name()
│   ├── 06_rsvp.sql         # tabla rsvps + submit_rsvp() + get_my_rsvp()
│   ├── 07_playlist.sql     # política: todos leen canciones aprobadas
│   └── 08_invites_companions.sql # invites.max_companions + get_invite_companions()
├── photos/                 # Fotos de la pareja (B/N). Slots con nombre semántico.
├── assets/
│   ├── monograma.png       # Logo/monograma (sello del sobre + favicon)
│   ├── og.png              # Open Graph 1200x630
│   └── audio/<cancion>.mp3 # Música de fondo self-hosted
├── favicon.png
├── worker.js               # Entry de Cloudflare Worker: sirve ASSETS + enruta /api/*
└── wrangler.jsonc          # name, main=worker.js, binding ASSETS, nodejs_compat
```

---

## 3. Qué se PERSONALIZA por boda

| Elemento | Dónde | Notas |
| --- | --- | --- |
| **Paleta de colores** | `styles/main.css` `:root` | `--black/--white/--paper`, dorado `--gold/--gold-light/--gold-dark`. Cambiar el acento aquí. |
| **Tipografías** | `styles/main.css` `:root` (`--font-display/--font-italic/--font-body`) + `<link>` de Google Fonts en cada HTML `<head>` | Actual: DM Serif Display + Cormorant Garamond + Inter. |
| **Logo / monograma** | `assets/monograma.png` | Aparece como sello del sobre (entry overlay) y favicon. |
| **Favicon** | `assets/monograma.png` / `favicon.png` | Referenciado en `<head>`. |
| **Fotos de la pareja** | `photos/*.jpg` | Mantener los nombres de slot (ver §4) para no tocar CSS/HTML. |
| **Imagen Open Graph** | `assets/og.png` (1200x630) | Preview al compartir por WhatsApp/iMessage. |
| **Música de fondo** | `assets/audio/<cancion>.mp3` + `index.html` (`#bg-audio` src + `.music-player__track/__artist`) | Self-hosted MP3. |
| **Nombres / fecha / lugar** | textos en `index.html`; meta en `<head>`; cuenta regresiva `TARGET` en `scripts/main.js`; deep link de Google Calendar en `main.js`; `.ics`/textos | El Salvador es UTC-6 sin DST: 4:00 PM local = 22:00 UTC. |
| **Dominio** | URLs `https://...` en metas OG, `main.js`, y `REDIRECT_URI` de `spotify-authorize.js` + `spotify-auth-callback.js` | |
| **Correos super admin** | `supabase/01_schema.sql` (array `admin_emails` del trigger) y `supabase/04_seed_admins.sql` | |
| **Playlist de Spotify** | `PLAYLIST_ID` en `functions/api/spotify-add-track.js` | ID de la playlist destino. |
| **Proyecto Supabase** | `scripts/config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) | Anon key es pública. |

### Slots de fotos (mantener nombres)
`hero.jpg`, `monogram-bg.jpg`, `countdown.jpg`, `story-1/2/3.jpg`, `detail-1/2.jpg`, `venue.jpg`, `dress-code.jpg`, `music.jpg`, `gallery-teaser.jpg`, `closing.jpg`, `footer.jpg`, `names-bg.jpg`. Las rutas también están como variables CSS en `:root` (`--photo-hero`, etc.) para override por sección.

---

## 4. Qué se MANTIENE (lógica de construcción)

No reescribir estos subsistemas; solo personalizar los puntos de §3.

### Entry overlay (sobre)
- Resuelve el bloqueo de autoplay de audio: la música arranca **dentro** del gesto de clic en "Abrir Invitación".
- `body.no-scroll` bloquea el scroll hasta abrir. La solapa (`.entry-flap`) se levanta por CSS; el JS (`main.js`) agrega `is-opening` y luego `is-hidden` tras ~1900ms (200ms si `prefers-reduced-motion`).
- Si hay `?invite=<token>`, `auth.js` muestra el nombre del invitado en `#entry-guest`.
- **Logo en sidebar/entrada como link a `/`**: bypassa el overlay (no re-anima).

### Auth (Google OAuth) + gates
- Cliente Supabase compartido en `auth.js` con `persistSession + autoRefreshToken + detectSessionInUrl`.
- Patrón de gates por atributos: `[data-auth-gate]` visible **sin** sesión, `[data-auth-protected]` visible **con** sesión. `body[data-authed="true"|"false"]`.
- El login con Google es **solo** para: subir a la galería, sugerir canciones y entrar al panel. **El RSVP NO requiere login.**
- `[hidden] { display: none !important }` en CSS para que el `hidden` gane sobre cualquier `display` de autor.
- Cuando hay sesión, el ícono de usuario se pinta en dorado (`body[data-authed="true"] .user-menu__trigger svg { color: var(--gold-light) }`). Sin punto/dot indicador.

### RSVP abierto (clave del diseño)
- **Cualquiera confirma sin sesión** vía la RPC `submit_rsvp` (security definer). Vive en `auth.js` (`wireRsvp`).
- Si la URL trae `?invite=<token>`, la respuesta queda **ligada** a esa invitación (`invite_id = token`, upsert por `invite_id`). Si no hay token, se guarda como **anónima** (`invite_id = NULL`, varias filas permitidas).
- `submit_rsvp(p_token, p_status, p_full_name, p_email, p_phone, p_message, p_plus_one)` acepta `p_token = null`.
- Reabrir el link personalizado recupera la respuesta previa con `get_my_rsvp(token)` y prerrellena el formulario.

### Invitaciones personalizadas por token
- Tabla `invites` (el `id` UUID **es** el token que viaja en `?invite=`). Solo super admins la gestionan (RLS).
- `get_invite_name(token)` y `get_invite_companions(token)` son RPCs security-definer que exponen **solo** ese registro a `anon` (no permiten listar todo).
- `max_companions` opcional; la entrada muestra "Nombre y N acompañante(s)".
- El panel admin genera link + mensaje de WhatsApp (`wa.me`) por invitado, y permite Modificar/Eliminar.

### Galería (Storage privado + RLS)
- Bucket **privado** `wedding-photos`. Cada invitado sube a `wedding-photos/<uid>/<uuid>.<ext>` y solo ve sus fotos (RLS por carpeta = uid). El super admin ve todas.
- Se sirven con **signed URLs** (1 hora). Carga diferida `loading="lazy"`.
- Super admin puede eliminar (storage `.remove()` + `photos.delete()`), tanto en `gallery.html` como en el panel.
- **Cuidado con duplicados:** `getSession()` y `onAuthStateChange` disparan ambos al montar. Usar un flag `photosRequested` para no llamar `loadPhotos()` dos veces (ver `gallery.js`).

### Spotify (search + auto-add)
- **Búsqueda** (`spotify-search.js`): Client Credentials flow, sin login del usuario. Cachea el token. Cualquiera con sesión puede sugerir; se guarda en `song_suggestions` (status `pending`).
- **Auto-add al aprobar**: en el panel, aprobar una canción llama `POST /api/spotify-add-track` con `{ trackId }`, que usa `SPOTIFY_REFRESH_TOKEN` para token de usuario y agrega a `PLAYLIST_ID`.
- **Obtener el refresh token (una sola vez)**: añadir el `REDIRECT_URI` a la app de Spotify; visitar `/api/spotify-authorize` con la cuenta dueña de la playlist; copiar el `refresh_token` que muestra el callback y guardarlo como secret `SPOTIFY_REFRESH_TOKEN` en Cloudflare.
- **Trampa conocida de Cloudflare secrets**: el Dashboard a veces guarda espacios en el **nombre** o el **valor** del secret, causando 503/500 silenciosos. `readEnv()` en `_utils.js` recorta ambos. Si se despliega por Git, re-guardar (Edit+Save) los secrets para asociarlos a la nueva versión.

### Worker routing
- `worker.js`: tabla `ROUTES` `'METHOD /api/path' -> handler`. Si no matchea, `env.ASSETS.fetch(request)` sirve el estático. Al agregar un endpoint nuevo: importar el handler y registrarlo en `ROUTES`.

---

## 5. Orden de ejecución de SQL en Supabase

Ejecutar en el SQL Editor **en orden estricto**. Antes del `03`, crear el bucket `wedding-photos` como **privado** desde Storage.

```
01_schema.sql  → tablas + trigger handle_new_user (auto super_admin por email)
02_rls.sql     → is_super_admin() + políticas
03_storage.sql → políticas del bucket (crear bucket privado ANTES)
04_seed_admins.sql → marcar correos existentes como super_admin
05_invites.sql → invites + get_invite_name()
06_rsvp.sql    → rsvps + submit_rsvp() + get_my_rsvp()
07_playlist.sql→ política: todos leen aprobadas
08_invites_companions.sql → max_companions + get_invite_companions()
```

Config de Auth en Supabase: habilitar Google provider; agregar el dominio de producción y `http://localhost:8788` a las redirect URLs.

---

## 6. Variables de entorno (Cloudflare Worker)

Secrets (Settings → Variables and Secrets). **Verificar que no tengan espacios** en nombre ni valor:

```
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
SPOTIFY_REFRESH_TOKEN   # se obtiene con el flujo /api/spotify-authorize (1 vez)
```

`SUPABASE_URL` y `SUPABASE_ANON_KEY` viven en `scripts/config.js` (cliente). La service-role key **nunca** va al cliente.

Desarrollo local: `wrangler dev` (lee de `.dev.vars`).

---

## 7. Receta: crear una nueva invitación

1. **Copiar la plantilla** a un repo nuevo. Renombrar en `wrangler.jsonc` (`name`).
2. **Supabase**: crear proyecto nuevo → poner `SUPABASE_URL`/`ANON_KEY` en `scripts/config.js` → crear bucket privado `wedding-photos` → correr los SQL 01→08 → poner los correos reales en `01_schema.sql` (array) y `04_seed_admins.sql` → habilitar Google OAuth y redirect URLs.
3. **Marca**: reemplazar `assets/monograma.png`, `assets/og.png`, `favicon.png`, audio de fondo. Ajustar `:root` (colores, fuentes) y los `<link>` de fuentes.
4. **Fotos**: reemplazar `photos/*.jpg` respetando los nombres de slot.
5. **Contenido**: nombres, fecha, lugar, padres, itinerario, dress code, textos en `index.html`; metas OG en `<head>`; `TARGET` y deep link de calendario en `main.js`; fecha límite de RSVP.
6. **Dominio**: actualizar URLs absolutas (metas OG, `main.js`, `REDIRECT_URI` en los dos archivos de Spotify).
7. **Spotify**: crear app → `SPOTIFY_CLIENT_ID/SECRET` como secrets → poner `PLAYLIST_ID` en `spotify-add-track.js` → agregar el `REDIRECT_URI` a la app → visitar `/api/spotify-authorize` con la cuenta dueña → guardar `SPOTIFY_REFRESH_TOKEN`.
8. **Desplegar** a Cloudflare Workers (Git o `wrangler deploy`). Re-guardar secrets si es la primera asociación.
9. **QA**: probar RSVP anónimo y con token, subida a galería como invitado y como admin, búsqueda + sugerencia + aprobación de canción (que aparezca en la playlist), preview OG, cuenta regresiva desde otra zona horaria, `prefers-reduced-motion`.

---

## 8. Convenciones

- **Sin emojis** en absolutamente nada (código, UI, contenido, commits).
- **Español latinoamericano** en todo lo visible para invitados.
- Sin framework, sin build. Mantener el sitio estático + Worker.
- Comentarios y `console.error` con prefijo `[Área]` (p. ej. `[RSVP]`, `[Galería]`).
- Commits descriptivos en español; terminar con la línea `Co-Authored-By` correspondiente.

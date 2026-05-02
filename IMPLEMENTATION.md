# Boda Zamora-Cárcamo — Plan de Implementación

**Pareja:** Karlita Cárcamo y Edgardo Zamora
**Fecha:** domingo 16 de agosto de 2026 — 4:00 PM (UTC-6, El Salvador)
**Lugar:** Hilton San Salvador, Av. Las Magnolias y Bvd. del Hipódromo, Colonia San Benito, San Salvador, El Salvador
**Repositorio:** `zc-wedding`
**Hosting:** Cloudflare Pages + Pages Functions
**Base de datos / Autenticación / Almacenamiento:** Supabase
**Estética:** Editorial blanco y negro, narrativa con animaciones al hacer scroll
**Idioma de la interfaz:** español latinoamericano

> Nota de idioma: todo el contenido visible para los invitados (sitio, correos, plantillas de WhatsApp, mensajes de error) debe estar en español latinoamericano. Evitar regionalismos de España (no "vosotros", no "móvil", no "ordenador"). Usar registro cordial pero cercano: trato de "tú" para invitados jóvenes, "usted" en correos y mensajes formales hacia familiares y padrinos.

---

## 1. Arquitectura general

Una sola página de aterrizaje (`index.html`) maneja la invitación, la cuenta regresiva, el itinerario, la confirmación de asistencia, el calendario, el lugar, las sugerencias musicales y el adelanto de la galería. La galería se separa en su propia ruta (`/gallery.html`) para que la lógica de roles no recargue la página principal.

```
Navegador (HTML/CSS/JS estático)
    │
    ├── Cliente Supabase JS ────► Supabase
    │                              ├── Auth (enlace mágico por correo)
    │                              ├── Postgres (tablas con RLS)
    │                              └── Storage (bucket wedding-photos)
    │
    └── fetch() ──► Cloudflare Pages Functions (/functions/api/*)
                        │
                        ├── API de Resend     (correo transaccional)
                        ├── API de Spotify    (OAuth + cambios al playlist)
                        ├── API de WhatsApp   (opcional — ver §10)
                        └── Supabase admin    (operaciones del lado del servidor)
```

**Por qué esta separación:** Supabase con RLS atiende casi toda la lectura/escritura desde el navegador. Las Cloudflare Functions existen únicamente cuando hace falta un secreto (API key de Resend, refresh token de Spotify) o un privilegio que no debe vivir en el cliente.

---

## 2. Stack técnico

| Capa | Elección | Por qué |
| --- | --- | --- |
| Frontend | HTML/CSS/JS sin framework | No requiere build, despliegue inmediato a Cloudflare Pages, fácil de mantener |
| Auth | Supabase Auth (enlace mágico / OTP) | Sin contraseñas, ideal para evento por invitación |
| Base de datos | Supabase Postgres | RLS aísla los datos por usuario sin necesidad de un backend dedicado |
| Almacenamiento | Supabase Storage | Mismo modelo de RLS, URLs firmadas para imágenes privadas |
| Funciones backend | Cloudflare Pages Functions | Conviven con el sitio, capa gratuita, runtime de Workers |
| Correo | Resend | $0 hasta 3 mil correos al mes, buena DX, plantillas sencillas |
| WhatsApp | Enlaces `wa.me` (recomendado) o Meta Cloud API | Los enlaces no cuestan y alcanzan para una lista de boda |
| Spotify | Spotify Web API (OAuth 2.0 + PKCE) | Flujo estándar para SPA, sin client secret en el navegador |
| Mapa | Embed de Google Maps (iframe) | Gratis, sin JS extra, se puede mejorar luego con el JS API |
| Calendario | Archivo `.ics` + enlace profundo de Google Calendar | Universal — funciona en cualquier app de calendario |
| Hosting | Cloudflare Pages | Gratis, CDN global, dominio propio, Functions integradas |

---

## 3. Estructura del repositorio

```
zc-wedding/
├── index.html                 # Página principal (invitación + scroll narrativo)
├── gallery.html               # Módulo de galería
├── admin.html                 # Panel para super administradores
├── styles/
│   ├── main.css               # Estilos de la página principal
│   ├── gallery.css
│   └── admin.css
├── scripts/
│   ├── main.js                # Animaciones de scroll, cuenta regresiva, formularios
│   ├── auth.js                # Wrapper de Supabase Auth (compartido)
│   ├── gallery.js
│   └── admin.js
├── photos/                    # Fotografía de la pareja en B/N. Reemplazar placeholders.
│   ├── hero.jpg
│   ├── portrait-novia.jpg
│   ├── portrait-novio.jpg
│   ├── pareja-1.jpg
│   └── detalle.jpg
├── assets/
│   ├── invite.ics             # Archivo de calendario
│   └── og.jpg                 # Imagen para preview de Open Graph
├── functions/                 # Cloudflare Pages Functions (servidor)
│   └── api/
│       ├── send-invite.js     # POST — envía correo + arma enlace de WhatsApp
│       ├── spotify-search.js  # GET  — proxy del Search API de Spotify
│       ├── spotify-approve.js # POST — el super admin aprueba la canción y la agrega al playlist
│       └── spotify-callback.js# GET  — callback OAuth para conectar Spotify del super admin
├── supabase/
│   ├── schema.sql             # Tablas y políticas RLS (aplicar desde el editor SQL de Supabase)
│   └── seed.sql               # Lista de invitados precargada
├── .env.example               # Plantilla de variables de entorno
├── README.md
└── IMPLEMENTATION.md          # Este archivo
```

---

## 3.5 Manifiesto de fotos

Sesión pre-boda en `/Pre wedding Sesh/` (14 archivos B/N, alta resolución). Cada foto se copia a `/photos/` con un nombre semántico para que el HTML/CSS las referencie por su rol y no por su ID original. Los archivos originales se conservan en `/Pre wedding Sesh/` como respaldo maestro.

| Slot (`/photos/`) | Origen | Composición | Sección donde vive |
| --- | --- | --- | --- |
| `hero.jpg` | IMG_7850 | Vertical, beso en la mejilla, fondo blanco | Portada — invitación principal |
| `monogram-bg.jpg` | IMG_8330 | Vertical, escalera, mucho aire blanco | Detrás del monograma "K & E" |
| `countdown.jpg` | IMG_8334 | Vertical, beso en la mejilla, bokeh nocturno | Fondo de la cuenta regresiva |
| `story-1.jpg` | IMG_7852 | Horizontal, beso bajo sombrillas | Story 1 — "el lugar" |
| `story-2.jpg` | IMG_81649 | Vertical, close-up de caras sonriendo | Story 2 — "la complicidad" |
| `story-3.jpg` | IMG_82113 | Vertical, vestido en movimiento | Story 3 — "el movimiento" |
| `detail-1.jpg` | IMG_8311 | Vertical, anillo sobre el hombro del novio | Detalle intercalado |
| `detail-2.jpg` | IMG_8331 | Vertical, manos abrazando nuca con anillo | Detalle intercalado |
| `venue.jpg` | IMG_81926 | Horizontal, abrazo en porche colonial blanco | Sección del lugar |
| `dress-code.jpg` | IMG_82400 | Vertical, abrazo junto a portón de hierro | Sección dress code |
| `music.jpg` | IMG_81544 | Vertical, palmeras, sonrisa amplia | Sección música/Spotify |
| `gallery-teaser.jpg` | IMG_8333 | Vertical, sombrillas, balaustre | Adelanto de galería |
| `closing.jpg` | IMG_82236 | Vertical, bajo el candelabro en arco | Cierre antes del footer |
| `footer.jpg` | IMG_105526 | Horizontal, escalera, sonrisa | Footer / epílogo |

**Para producción:** las fotos originales pesan entre 1.4 MB y 10.8 MB. Antes del despliegue final hay que pasar un ciclo de optimización — recomendado: redimensionar a 2400 px en el lado largo, exportar como JPEG 0.85 y como WebP 0.82, servir con `<picture>` con `srcset` para que móviles bajen versiones más livianas. Total objetivo: cada foto ≤ 350 KB en JPEG, ≤ 220 KB en WebP. Carga inicial del sitio (sólo hero + monogram-bg) bajo 600 KB.

---

## 4. Esquema de Supabase

Aplicar en el editor SQL de Supabase después de crear el proyecto.

```sql
-- 4.1 PROFILES (extiende auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  phone text,
  role text not null default 'guest' check (role in ('guest', 'super_admin')),
  rsvp_status text not null default 'pending' check (rsvp_status in ('pending','confirmed','declined')),
  rsvp_confirmed_at timestamptz,
  plus_one_count int not null default 0,
  dietary_restrictions text,
  invited_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Crea el perfil automáticamente cuando aparece el usuario en auth.users
create function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4.2 PHOTOS (galería)
create table photos (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  size_bytes bigint not null,
  width int,
  height int,
  taken_at timestamptz,
  caption text,
  uploaded_at timestamptz default now()
);
create index on photos (uploader_id);
create index on photos (uploaded_at desc);

-- 4.3 SUGERENCIAS DE CANCIONES
create table song_suggestions (
  id uuid primary key default gen_random_uuid(),
  suggester_id uuid not null references profiles(id) on delete cascade,
  spotify_track_id text not null,
  track_name text not null,
  artist_name text not null,
  album_art_url text,
  preview_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  unique (suggester_id, spotify_track_id)
);

-- 4.4 CREDENCIALES DE SPOTIFY (un solo registro: dueño del playlist)
create table spotify_credentials (
  id int primary key default 1 check (id = 1),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  playlist_id text not null,
  updated_at timestamptz default now()
);

-- 4.5 POLÍTICAS RLS
alter table profiles enable row level security;
alter table photos enable row level security;
alter table song_suggestions enable row level security;
alter table spotify_credentials enable row level security;

-- Helper: ¿el usuario actual es super admin?
create function public.is_super_admin()
returns boolean language sql stable security definer as $$
  select coalesce((select role = 'super_admin' from profiles where id = auth.uid()), false);
$$;

-- profiles
create policy "el usuario lee su propio perfil" on profiles
  for select using (auth.uid() = id);
create policy "los super admins leen todos los perfiles" on profiles
  for select using (public.is_super_admin());
create policy "el usuario actualiza su propio perfil" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "los super admins actualizan cualquier perfil" on profiles
  for update using (public.is_super_admin());

-- photos
create policy "el usuario lee sus propias fotos" on photos
  for select using (auth.uid() = uploader_id);
create policy "los super admins leen todas las fotos" on photos
  for select using (public.is_super_admin());
create policy "el usuario sube sus propias fotos" on photos
  for insert with check (auth.uid() = uploader_id);
create policy "los super admins eliminan cualquier foto" on photos
  for delete using (public.is_super_admin());

-- song_suggestions
create policy "el usuario lee sus propias sugerencias" on song_suggestions
  for select using (auth.uid() = suggester_id);
create policy "los super admins leen todas las sugerencias" on song_suggestions
  for select using (public.is_super_admin());
create policy "el usuario crea sugerencias" on song_suggestions
  for insert with check (auth.uid() = suggester_id);
create policy "los super admins actualizan sugerencias" on song_suggestions
  for update using (public.is_super_admin());

-- spotify_credentials — solo se accede desde el servidor con la service-role key (no hay políticas para el cliente)
```

### Políticas del bucket de Storage

Desde el dashboard de Supabase → Storage → crear el bucket `wedding-photos` (privado, no público).

```sql
-- Cada invitado solo puede escribir dentro de la carpeta con su UID
create policy "el invitado sube a su propia carpeta" on storage.objects
  for insert with check (
    bucket_id = 'wedding-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "el invitado lee su propia carpeta" on storage.objects
  for select using (
    bucket_id = 'wedding-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "los super admins leen todo el bucket" on storage.objects
  for select using (
    bucket_id = 'wedding-photos' and public.is_super_admin()
  );

create policy "los super admins eliminan cualquier foto" on storage.objects
  for delete using (
    bucket_id = 'wedding-photos' and public.is_super_admin()
  );
```

### Asignar super administradores

Después de que Karlita y Edgardo entren por primera vez con enlace mágico, marcar sus perfiles desde el editor SQL:

```sql
update profiles set role = 'super_admin'
where email in ('karlita@example.com', 'edgardo@example.com');
```

---

## 5. Autenticación — Enlace mágico (Magic Link)

**Por qué enlace mágico y no contraseña:** evento por invitación, los invitados no son técnicos, no queremos lidiar con recuperación de contraseñas. Un correo → un clic → sesión iniciada.

### Flujo

1. El invitado recibe la invitación (correo y/o WhatsApp) con el enlace `https://tu-dominio.com/?invite=<guest_id>`.
2. La página lee el parámetro `?invite=` y autocompleta el correo a partir del registro precargado en `profiles`.
3. El invitado pulsa **Confirmar asistencia**.
4. El frontend ejecuta `supabase.auth.signInWithOtp({ email })` → Supabase envía el enlace mágico al correo.
5. El invitado abre el enlace en su bandeja → vuelve al sitio en `/?type=magiclink&...` → el cliente JS detecta la sesión.
6. Con sesión activa, el formulario de asistencia se desbloquea. Al enviarlo se actualiza `profiles` (`rsvp_status = 'confirmed'`).

### Frontend (esquema)

```js
// scripts/auth.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function sendMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}/?confirmed=1` }
  });
  if (error) throw error;
}

supabase.auth.onAuthStateChange((event, session) => {
  if (session) document.body.dataset.authed = 'true';
  else delete document.body.dataset.authed;
});
```

### Configuración en Supabase

- **Auth → URL Configuration:** agregar `https://tu-dominio.com` y `http://localhost:8788` a las URLs de redirección permitidas.
- **Auth → Email templates:** personalizar la plantilla "Magic Link" con la estética B/N y la voz de la pareja.
- **Auth → Providers → Email:** habilitar; deshabilitar "Confirm email" (no aplica para OTP), expiración de OTP en 1 hora.

---

## 6. Invitaciones por correo (Resend)

### Configuración

1. Crear cuenta en resend.com → verificar un dominio propio (en desarrollo se puede usar el remitente de pruebas de Resend).
2. Generar API key y guardarla como `RESEND_API_KEY` en Cloudflare Pages → Settings → Environment Variables.
3. Configurar SPF y DKIM en el dominio según indica Resend (15 minutos).

### Cloudflare Function

```js
// functions/api/send-invite.js
export async function onRequestPost({ request, env }) {
  // Verificar que quien llama es super admin (validar el JWT contra Supabase /auth/v1/user)
  const auth = request.headers.get('Authorization');
  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: env.SUPABASE_ANON_KEY }
  });
  if (!userRes.ok) return new Response('No autorizado', { status: 401 });

  const { to, name, inviteUrl } = await request.json();

  const html = renderInviteEmail({ name, inviteUrl }); // ver plantilla abajo

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Karlita & Edgardo <invitacion@tu-dominio.com>',
      to,
      subject: 'Karlita & Edgardo · 16.08.2026',
      html,
      attachments: [{ filename: 'invitacion.ics', path: 'https://tu-dominio.com/assets/invite.ics' }]
    })
  });

  if (!r.ok) return new Response(await r.text(), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}
```

### Estilo de la plantilla

- HTML puro, sin CSS externo, todo inline (los clientes de correo son quisquillosos).
- Una imagen hero (la pareja en B/N), encabezado serif "K & E", la fecha, y un botón "Confirmar asistencia" que apunta a `https://tu-dominio.com/?invite=<id>`.
- Texto plano alternativo incluido.
- Asunto, cuerpo y CTA en español latinoamericano.

---

## 7. Invitaciones por WhatsApp

Hay dos caminos viables. **Para una boda (~100-300 invitados), tomar la Opción A.** La Opción B solo vale la pena si necesitas automatización masiva.

### Opción A — enlaces `wa.me` (recomendada)

Construir una tabla de invitados en el panel admin con un botón "Enviar por WhatsApp" en cada fila. Al hacer clic se abre WhatsApp con el mensaje precargado:

```js
function whatsappLink({ phone, name, inviteUrl }) {
  const msg = encodeURIComponent(
`Hola ${name} 💌

Karlita y Edgardo te invitan a celebrar su boda.
Domingo 16 de agosto de 2026 · 4:00 PM
Hilton San Salvador

Confirma tu asistencia aquí:
${inviteUrl}`);
  return `https://wa.me/${phone.replace(/\D/g,'')}?text=${msg}`;
}
```

- **Ventajas:** $0, se envía desde tu WhatsApp personal (más cálido), sin trámites de aprobación.
- **Desventajas:** un clic por invitado, sin acuse de recibo. Con 200 invitados son ~30 minutos divididos entre la pareja — vale la pena.

### Opción B — Meta WhatsApp Cloud API

Solo si quieres envíos automatizados (por ejemplo, recordatorio "una semana antes").

1. Crear una cuenta de Meta Business → verificarla.
2. Agregar el producto WhatsApp → obtener el phone number ID y un access token permanente.
3. Enviar una **plantilla de mensaje** para aprobación (las transaccionales se aprueban en ~24 h).
4. Enviar con:
   ```
   POST https://graph.facebook.com/v18.0/{phone-number-id}/messages
   Authorization: Bearer {access-token}
   {
     "messaging_product": "whatsapp",
     "to": "503XXXXXXXX",
     "type": "template",
     "template": { "name": "wedding_invite", "language": { "code": "es" }, ... }
   }
   ```
5. Capa gratuita: 1000 conversaciones de servicio al mes.

**Trade-off:** ~3-5 días de configuración (esperando verificación de Meta y aprobación de plantilla) para automatizar algo que vas a usar ~3 veces. Mejor la Opción A.

---

## 8. Spotify — playlist colaborativa con aprobación

Los invitados **sugieren** canciones; solo los super admins **las agregan** al playlist real.

### Configuración

1. developer.spotify.com → Dashboard → Crear app.
2. Redirect URI: `https://tu-dominio.com/api/spotify-callback`.
3. Guardar `SPOTIFY_CLIENT_ID` y `SPOTIFY_CLIENT_SECRET` como variables de entorno en Cloudflare.
4. Crear el playlist real desde el Spotify personal de Karlita o Edgardo y copiar el ID del playlist.

### Búsqueda (cualquier invitado)

Los invitados necesitan buscar canciones. Se usa **Client Credentials flow** — no requiere login del usuario, solo permite búsquedas y lectura.

```js
// functions/api/spotify-search.js
let cachedToken = null;

async function getAppToken(env) {
  if (cachedToken && cachedToken.expires_at > Date.now()) return cachedToken.access_token;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)
    },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  cachedToken = { access_token: data.access_token, expires_at: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  const token = await getAppToken(env);
  const r = await fetch(`https://api.spotify.com/v1/search?type=track&limit=8&q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return new Response(await r.text(), { headers: { 'Content-Type': 'application/json' } });
}
```

UI del invitado: caja de búsqueda con sugerencias → llama a `/api/spotify-search?q=...` → muestra tarjetas de canción → al hacer clic, inserta una fila en `song_suggestions` con `status='pending'`.

### El super admin conecta su Spotify (una sola vez)

OAuth Authorization Code con PKCE. El admin pulsa "Conectar Spotify" → redirige a Spotify → vuelve a `/api/spotify-callback` con un code → se intercambia por access + refresh tokens → se guarda en `spotify_credentials` (registro único).

```js
// functions/api/spotify-callback.js
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const verifier = url.searchParams.get('verifier'); // se pasa por state en el flujo real

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${url.origin}/api/spotify-callback`,
      client_id: env.SPOTIFY_CLIENT_ID,
      code_verifier: verifier
    })
  });
  const t = await tokenRes.json();
  // Upsert en spotify_credentials usando la service-role key
  // ...
}
```

### Aprobar una sugerencia (solo super admin)

```js
// functions/api/spotify-approve.js
export async function onRequestPost({ request, env }) {
  // 1. Validar que quien llama es super admin (igual que en send-invite)
  // 2. Leer la fila de song_suggestions
  // 3. Refrescar el token si ya expiró
  // 4. POST https://api.spotify.com/v1/playlists/{playlist_id}/tracks
  //    body: { uris: [`spotify:track:${spotify_track_id}`] }
  // 5. Actualizar song_suggestions.status = 'approved'
}
```

### UI

- **Página principal:** formulario "Sugiere una canción" (buscar → enviar). Sin engaños — mostrar "Tu sugerencia llegó. Karlita y Edgardo la van a revisar."
- **Panel admin:** lista de sugerencias pendientes con botones Aprobar / Rechazar. Aprobar llama a `/api/spotify-approve`.

---

## 9. Calendario — agregar el evento al calendario del invitado

Solución universal: ofrecer tanto un archivo `.ics` descargable como un enlace profundo a Google Calendar.

### `assets/invite.ics` (archivo estático)

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Boda Zamora-Carcamo//ES
BEGIN:VEVENT
UID:zc-wedding-2026-08-16@tu-dominio.com
DTSTAMP:20260501T000000Z
DTSTART;TZID=America/El_Salvador:20260816T160000
DTEND;TZID=America/El_Salvador:20260816T230000
SUMMARY:Boda Karlita & Edgardo
LOCATION:Hilton San Salvador, Av. Las Magnolias y Bvd. del Hipódromo, San Salvador, El Salvador
DESCRIPTION:Boda de Karlita Cárcamo y Edgardo Zamora.
URL:https://tu-dominio.com
END:VEVENT
END:VCALENDAR
```

Apple Calendar, Outlook y Thunderbird abren el `.ics` directamente.

### Enlace profundo de Google Calendar

```js
const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE`
  + `&text=${encodeURIComponent('Boda Karlita & Edgardo')}`
  + `&dates=20260816T220000Z/20260817T050000Z`
  + `&details=${encodeURIComponent('Hilton San Salvador. Confirma tu asistencia: https://tu-dominio.com')}`
  + `&location=${encodeURIComponent('Hilton San Salvador, El Salvador')}`;
```

(El Salvador está en UTC-6 sin horario de verano. 4:00 PM local = 22:00 UTC.)

### UI

Dos botones en la página principal: **Google Calendar** (enlace profundo) y **Apple / Outlook** (descarga `.ics`). Si se detecta Safari móvil, mostrar solo el `.ics` ya que los enlaces profundos de Google se comportan raro en iOS.

---

## 10. Mapa — Hilton San Salvador

Lo más simple, gratis y sin API key — embed con iframe:

```html
<iframe
  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d...!2zSGlsdG9uIFNhbiBTYWx2YWRvcg..."
  width="100%" height="480" style="border:0; filter: grayscale(1) contrast(1.1);"
  loading="lazy" referrerpolicy="no-referrer-when-downgrade"
  allowfullscreen></iframe>
```

El truco es `filter: grayscale(1)` — convierte el mapa de colores de Google a la paleta B/N sin pagar por el JS API.

**Camino de mejora** (si después se quiere más pulido): usar el JavaScript API de Google Maps con un estilo oscuro/B&N personalizado, o Mapbox GL JS con estilo monocromo. Los dos requieren API key pero dan control total sobre marcadores, tipografía y comportamiento.

Agregar un botón **"Cómo llegar"** debajo del mapa: `https://www.google.com/maps/dir/?api=1&destination=Hilton+San+Salvador`.

---

## 11. Módulo de galería

Página aparte (`/gallery.html`) para que la lógica de roles no infle la página principal.

### Vista del invitado común

- Zona de drop / input de archivos (multiselección).
- Redimensionado en el cliente (canvas HTML → 2000px en el lado largo, JPEG 0.9) antes de subir — ahorra ancho de banda y costo de Storage.
- Subida a `wedding-photos/<user_uid>/<uuid>.jpg`.
- Después de subir, insertar fila en `photos` con `size_bytes`, `width`, `height`, `taken_at` (de los EXIF si están disponibles).
- La grilla de abajo solo muestra las fotos del usuario (RLS lo asegura — no puede consultar las de otros). Clic → lightbox a pantalla completa con descarga.

### Vista del super admin

- Toggle: **Mis fotos · Todas las fotos**.
- Cuando elige "Todas", consulta todas las fotos (RLS le permite ver todo).
- Menú de orden: **Por persona · Por fecha · Por tamaño** (agrupa o reordena la grilla).
- Cada tarjeta muestra avatar/nombre del autor + fecha + tamaño.
- Descarga masiva: seleccionar fotos → "Descargar ZIP" (una function arma el zip con stream desde Storage y lo regresa).

### Esquema de subida

```js
async function uploadPhoto(file) {
  const resized = await resizeImage(file, 2000); // canvas
  const { data: { user } } = await supabase.auth.getUser();
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage.from('wedding-photos').upload(path, resized);
  if (upErr) throw upErr;
  const { error: rowErr } = await supabase.from('photos').insert({
    uploader_id: user.id,
    storage_path: path,
    size_bytes: resized.size,
    width: resized.width, height: resized.height,
    taken_at: extractExifDate(file) ?? null,
  });
  if (rowErr) throw rowErr;
}
```

### Despliegue de imágenes

Para las fotos del propio invitado: consultar `photos` filtrando por `uploader_id = auth.uid()`, y para cada fila llamar `supabase.storage.from('wedding-photos').createSignedUrl(path, 3600)` (URL firmada, válida por una hora). Carga diferida con `loading="lazy"`.

---

## 12. Confirmación de asistencia (RSVP)

Vive en la página principal, oculto detrás del login.

```sql
-- Ya está en la tabla profiles:
-- rsvp_status: 'pending' | 'confirmed' | 'declined'
-- plus_one_count: int
-- dietary_restrictions: text
```

### Campos del formulario

- Confirmar / No podré asistir (toggle).
- Acompañante (sí/no, luego nombre).
- Restricciones alimentarias (textarea).
- Enviar → `update profiles set rsvp_status='confirmed', plus_one_count=?, ... where id=auth.uid()`.

### Vista del super admin (admin.html)

Conteo en vivo: confirmados, pendientes, declinados, total de acompañantes. Tabla con todos los invitados. Exportar CSV. Enviar recordatorio (correo o WhatsApp).

---

## 13. Cuenta regresiva al 16 de agosto de 2026, 4:00 PM

```js
const target = new Date('2026-08-16T16:00:00-06:00');

function tick() {
  const diff = target - new Date();
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins  = Math.floor((diff % 3_600_000) / 60_000);
  const secs  = Math.floor((diff % 60_000) / 1000);
  // ...actualizar el DOM
}
setInterval(tick, 1000); tick();
```

Nota de animación: usar una sola transición compartida `transition: transform 400ms cubic-bezier(0.23, 1, 0.32, 1)` por dígito; al hacer tick, deslizar el dígito viejo hacia arriba (`translateY(-100%)`) y el nuevo hacia su lugar. No animar con keyframes cada segundo — pelea contra el navegador. Transiciones CSS + reemplazo del DOM son más suaves e interrumpibles.

Etiquetas en español: **Días · Horas · Minutos · Segundos**.

---

## 14. Animaciones — narrativa con scroll

Una sola página de aterrizaje que se anima *con* el invitado mientras hace scroll. Tres primitivas:

| Herramienta | Para |
| --- | --- |
| `IntersectionObserver` (JS) | Reveals únicos cuando una sección entra a la vista (funciona en todos los navegadores) |
| `animation-timeline: view()` (CSS) | Animaciones continuas ligadas al progreso del scroll (Chrome/Edge — fallback elegante) |
| Transiciones CSS | Toda la retroalimentación de hover/press (interrumpibles, aceleradas por GPU) |

### Patrones que se usan

- **Hero:** zoom Ken Burns sutil sobre la foto de la pareja (12 s ease-in-out, solo transform). Los nombres aparecen con stagger de 80 ms.
- **Reveals de sección:** `opacity 0 → 1`, `translateY(40px) → 0`, 800 ms con `cubic-bezier(0.23, 1, 0.32, 1)`. Se dispara cuando 25% de la sección está en pantalla.
- **Tipografía gigante ("KARLITA & EDGARDO"):** reveal con clip-path desde abajo → `inset(0 0 100% 0) → inset(0 0 0 0)`, 1200 ms, ligado al scroll para que se "dibuje" mientras el invitado avanza.
- **Reveals de fotos:** clip-path desde un borde más imagen escalando de `1.1 → 1.0` para imitar un travelling analógico.
- **Lista del itinerario:** stagger de 60 ms por entrada, `translateY(20px) → 0`.
- **Botones:** `transform: scale(0.97)` en `:active`, 160 ms ease-out. Focus ring personalizado, paleta B/N.

### Tokens de easing (en CSS)

```css
:root {
  --ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
}
```

### Movimiento reducido

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Conservar las transiciones de opacidad — quitar solo el movimiento.

---

## 15. Despliegue en Cloudflare

### Pages

1. Subir el repo a GitHub (`zc-wedding`).
2. Dashboard de Cloudflare → Pages → Connect to Git → seleccionar el repo.
3. Build settings: **Framework preset: None.** Build command: *(vacío)*. Output directory: `/`.
4. Deploy. Te dan una URL `*.pages.dev` de inmediato.
5. Conectar dominio propio (Settings → Custom domains).

### Pages Functions

La carpeta `/functions/` se detecta automáticamente. Cada archivo `.js` se vuelve un endpoint:

- `functions/api/send-invite.js` → `https://tu-dominio.com/api/send-invite`
- `functions/api/spotify-search.js` → `https://tu-dominio.com/api/spotify-search`

No hay paso de despliegue aparte; viajan con el sitio.

### Variables de entorno

Pages → tu proyecto → Settings → Environment variables. Agregar para **Production** (y **Preview** si quieres):

```
SUPABASE_URL              = https://xxx.supabase.co
SUPABASE_ANON_KEY         = eyJh...                (segura para el cliente)
SUPABASE_SERVICE_KEY      = eyJh...                (solo servidor, nunca en el cliente)
RESEND_API_KEY            = re_...
SPOTIFY_CLIENT_ID         = ...
SPOTIFY_CLIENT_SECRET     = ...
SPOTIFY_PLAYLIST_ID       = ...
```

Para el código del navegador, exponer solo las llaves públicas (URL y anon key). Esas están diseñadas para ser públicas — es RLS quien protege los datos.

### Desarrollo local

```bash
npm i -g wrangler
wrangler pages dev . --port 8788
```

Corre el sitio estático y las Functions juntas, leyendo variables desde `.dev.vars`.

---

## 16. Open Graph y vista previa al compartir

Cuando alguien comparte el enlace en WhatsApp o iMessage, queremos un preview B/N elegante.

```html
<meta property="og:title" content="Karlita & Edgardo · 16.08.2026">
<meta property="og:description" content="Nuestra boda. Hilton San Salvador.">
<meta property="og:image" content="https://tu-dominio.com/assets/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
```

`og.jpg` debe ser de 1200×630, blanco y negro, con el monograma y la fecha.

---

## 17. Plan por fases — frontend primero, backend al final

Estrategia: construir todo el sitio como **estático y mockeado** primero. Esto permite ver, sentir y aprobar la experiencia completa antes de cablear nada al backend. Cuando el frontend esté pulido y aprobado, cada formulario se "enchufa" a su pieza de Supabase / Cloudflare Function sin tocar el diseño.

> Beneficio del enfoque: la pareja ve la invitación funcionando desde la fase 1 y la puede ir compartiendo internamente en familia para feedback. Los errores de copy, layout o animación se descubren temprano (cuando son baratos de arreglar) y no compiten con bugs de integración.

### Etapa A — Frontend (sin backend)

| Fase | Objetivo | Entregables | Tiempo |
| --- | --- | --- | --- |
| **1** | **Cimientos** | Repo `zc-wedding` inicializado en GitHub, conectado a Cloudflare Pages. Carpeta `/photos/` con las 14 fotos copiadas y renombradas. Reset CSS, tokens de diseño (paleta, tipografías, easings), grilla base, layout responsive. HTML de las secciones puesto sin animaciones. La página renderiza, las fotos cargan, todo es estático. | 4-6 h |
| **2** | **Tipografía editorial** | Monograma "K & E", nombres gigantes "KARLITA & EDGARDO", fechas, jerarquía editorial completa. Microtipografía: tracking, leading, kerning. Tipografías cargadas desde Google Fonts o self-hosted. Pruebas en móvil para asegurar legibilidad. | 3 h |
| **3** | **Animaciones de entrada y scroll** | `IntersectionObserver` para reveals. Reveals con clip-path para fotos (entrada cinematográfica). Stagger en listas (itinerario). Parallax sutil de fondos. Custom easings (`--ease-out-strong`, etc.). Soporte para `prefers-reduced-motion`. | 4-5 h |
| **4** | **Cuenta regresiva** | Lógica que calcula días/horas/minutos/segundos en tiempo real. Animación de los dígitos al cambiar (transición CSS, no keyframes). Estados especiales: último día ("Mañana es el día"), día del evento ("¡Hoy nos casamos!"), post-evento (count-up). | 2 h |
| **5** | **Calendario y mapa** | Botón "Agregar a Google Calendar" (deep link). Botón "Apple/Outlook" (descarga `.ics`). Detección de Safari móvil. Iframe del mapa del Hilton con `filter: grayscale(1)`. Botón "Cómo llegar". | 1 h |
| **6** | **Formularios mockeados** | UI completa de: input de correo + "Enviar enlace mágico", formulario de RSVP, formulario de sugerencia de canción. Validación, estados de carga, mensajes de éxito/error simulados. Los formularios *no* envían nada todavía — solo muestran el flujo. Esto permite testear UX sin backend. | 3 h |
| **7** | **Galería (estática)** | `gallery.html` con layout completo. Grilla responsive. Lightbox con teclado (Esc, ← →). UI de drag-and-drop visual. Toggle "Mis fotos / Todas las fotos" con datos mock. Menú de orden (por persona/fecha/tamaño) con datos mock. | 3 h |
| **8** | **Panel admin (estático)** | `admin.html` con tabla de invitados (datos mock), contadores (confirmados/pendientes/rechazados), botones generadores de enlaces `wa.me`, vista de sugerencias musicales pendientes con Aprobar/Rechazar. Todo conectado a un objeto JS local. | 2 h |
| **9** | **Pulido y QA** | Imagen Open Graph (1200×630, B/N). Favicon (monograma K&E). Pasada de accesibilidad: tabbing por teclado, focus rings visibles, etiquetas ARIA donde aplique, contraste verificado. QA en dispositivo real (iPhone Safari, Android Chrome). Lighthouse: > 90 en performance, accesibilidad, mejores prácticas. | 3 h |
| **10** | **Lanzamiento de la versión estática** | Push a GitHub → Cloudflare Pages despliega. URL `*.pages.dev` lista para compartir internamente. Conectar dominio si ya existe. Primera revisión real con familia/amigos cercanos. | 1 h |

**Subtotal frontend: ~26-30 h.** Al final de la fase 10, la pareja tiene una invitación visualmente terminada que pueden compartir como adelanto. Todos los formularios "funcionan" en lo visual, solo no guardan datos.

### Etapa B — Backend (después de aprobar frontend)

| Fase | Objetivo | Entregables | Tiempo |
| --- | --- | --- | --- |
| **11** | **Setup de Supabase** | Proyecto creado. `schema.sql` aplicado. Bucket `wedding-photos` creado con políticas RLS. Configuración de Auth: URLs de redirect, plantilla de Magic Link en español latinoamericano, expiración de OTP. | 2 h |
| **12** | **Auth real** | Cliente Supabase JS conectado. Input de correo en la portada llama a `signInWithOtp`. Manejo del callback al volver del enlace mágico. La sesión activa desbloquea el formulario de RSVP. Karlita y Edgardo marcados como `super_admin`. | 2 h |
| **13** | **RSVP en vivo** | Formulario conecta a `update profiles`. Persiste el estado tras recargar. Vista admin lee datos reales y muestra contadores en vivo. Exportar a CSV. | 2 h |
| **14** | **Correo (Resend)** | Cuenta Resend configurada. Dominio verificado (SPF/DKIM/DMARC). Cloudflare Function `send-invite.js`. Plantilla HTML de correo en español latinoamericano. Pruebas de entregabilidad (no spam). | 3 h |
| **15** | **Lista de invitados + WhatsApp** | Mecanismo para importar/capturar invitados (CSV, formulario admin). El panel admin genera enlaces `wa.me` dinámicos por invitado. | 2 h |
| **16** | **Spotify — búsqueda y sugerencias** | App de Spotify creada. `spotify-search.js` con Client Credentials. Frontend conecta el formulario de sugerencia a `song_suggestions`. Las sugerencias aparecen en el panel admin. | 3 h |
| **17** | **Spotify — aprobación** | OAuth PKCE para conectar la cuenta de Karlita o Edgardo. Tokens guardados en `spotify_credentials`. `spotify-approve.js` agrega la canción aprobada al playlist real. | 3 h |
| **18** | **Galería real** | Subida a Supabase Storage. `photos` table conectada. Vista del invitado lista sus propias fotos con URLs firmadas. Vista del super admin con orden por persona/fecha/tamaño. Descarga masiva (ZIP) opcional. | 4 h |
| **19** | **QA end-to-end + lanzamiento real** | Pruebas con un par de invitados de confianza (los testers reciben correo + WhatsApp y completan el flujo). Ajustes finales. Envío masivo de invitaciones. Monitoreo los primeros días. | 3 h |

**Subtotal backend: ~24-26 h.**

**Total general: ~50-56 h.** Las fases 1-10 pueden completarse en 2-3 fines de semana; las fases 11-19 caben en otras 2-3 semanas trabajando por las tardes. Recomendación: terminar la etapa A antes de tocar la B. No mezclar.

---

## 18. Checklist antes del lanzamiento

- [ ] Todas las fotos B/N reales subidas a `/photos/`.
- [ ] Probadas las políticas RLS de Supabase (ingresar como un invitado de prueba y confirmar que no puede ver datos ajenos).
- [ ] Enlace mágico probado en Safari iPhone, Chrome iPhone, Chrome Android, Chrome/Safari de escritorio.
- [ ] El `.ics` abre correctamente en Apple Calendar, Outlook y Google.
- [ ] El iframe del mapa carga y aplica el filtro grayscale.
- [ ] El correo llega al inbox (no a spam) — verificar que SPF, DKIM y DMARC pasan.
- [ ] El enlace de WhatsApp abre la app con el texto precargado.
- [ ] La búsqueda de Spotify regresa resultados; la sugerencia se guarda; al aprobar se publica en el playlist.
- [ ] La subida a la galería funciona; el invitado común solo ve sus fotos; el super admin ve todas.
- [ ] La cuenta regresiva muestra la hora correcta en la zona horaria del visitante (probar también desde fuera de El Salvador).
- [ ] Se respeta `prefers-reduced-motion`.
- [ ] La página carga en menos de 2 s con 4G (Lighthouse).
- [ ] El preview de Open Graph se ve bien en WhatsApp e iMessage.
- [ ] Todo el contenido visible está en español latinoamericano (sin "vosotros", sin localismos de España).

---

## 19. Preguntas pendientes antes de implementar

Cada respuesta se va plasmando aquí para que el plan crezca con las decisiones tomadas. Las marcadas con 🔴 bloquean la **fase 1** del frontend; las 🟡 bloquean fases posteriores; las ⚪ son refinamientos que pueden quedar abiertos un rato.

### A. Información del evento (la mayoría 🔴)

1. 🔴 **Padres de los novios.** ¿Qué nombres aparecen en la invitación? El formato típico salvadoreño/mexicano es:
   *"Con la gracia de Dios y la bendición de nuestros padres,*
   *Sr. _________ y Sra. _________ (papás de Karlita)*
   *Sr. _________ y Sra. _________ (papás de Edgardo)"*
   — _Respuesta:_ ___________
2. 🟡 **Padrinos.** ¿Hay padrinos de boda (de honor, de velación, de arras, de lazo, anillos)? Si sí, nombres y rol — aparecen en la sección de itinerario o en una sección dedicada.
   — _Respuesta:_ ___________
3. 🔴 **Tipo de ceremonia.** ¿Católica? ¿Civil? ¿Religiosa simbólica? ¿Una sola o ceremonia religiosa + recepción separadas?
   — _Respuesta:_ ___________
4. 🔴 **Lugar de la ceremonia religiosa (si aplica).** ¿Es en el Hilton mismo o en una iglesia aparte? Si es aparte, dirección y hora.
   — _Respuesta:_ ___________
5. 🔴 **Itinerario detallado del 16 de agosto.** Confirmado el evento principal a las 4:00 PM, pero ¿cuál es el cronograma completo? Por ejemplo:
   - 4:00 PM — Ceremonia
   - 5:30 PM — Cocktail / hora feliz
   - 7:00 PM — Recepción y cena
   - 8:30 PM — Primer baile
   - 9:00 PM — Pista abierta
   - 11:00 PM — Pastel
   - 1:00 AM — Cierre
   — _Respuesta:_ ___________
6. 🔴 **Dress code.** ¿Cocktail formal, formal, etiqueta rigurosa (corbata negra)? ¿Hay colores que no quieren ver (típicamente blanco, marfil, beige)?
   — _Respuesta:_ ___________
7. 🟡 **RSVP — fecha límite.** ¿Hasta cuándo pueden confirmar? Recomendación: 4 semanas antes, o sea hasta el **19 de julio de 2026**.
   — _Respuesta:_ ___________
8. 🟡 **Niños.** ¿Evento solo para adultos o niños bienvenidos? Esto va en una nota cordial cerca del RSVP.
   — _Respuesta:_ ___________
9. 🟡 **Mesa de regalos / lista de bodas.** ¿Tiendas, links, registro digital (Liverpool, Amazon, Zola, sobre, transferencia)? ¿O prefieren no incluir?
   — _Respuesta:_ ___________
10. 🟡 **Hospedaje.** ¿Hay tarifa preferencial en el Hilton para invitados de fuera o algún hotel cercano recomendado?
    — _Respuesta:_ ___________
11. ⚪ **Transporte.** ¿Habrá shuttle desde algún punto o el Hilton solo? ¿Valet parking incluido?
    — _Respuesta:_ ___________
12. ⚪ **Hashtag.** ¿Quieren un hashtag para redes (#KarliyEdgardo, #ZamoraCarcamo, etc.)? Aparece sutil en el footer.
    — _Respuesta:_ ___________
13. ⚪ **Mensaje de bienvenida.** ¿Quieren escribir un párrafo personal de la pareja para abrir la invitación (justo después del hero)? 2-4 líneas.
    — _Respuesta:_ ___________

### B. Marca y estilo (🔴)

14. 🔴 **Orden de los nombres.** ¿"Karlita & Edgardo" (novia primero, lo tradicional) o "Edgardo & Karlita" (orden del repo `zc-wedding`)?
    — _Respuesta:_ ___________
15. 🔴 **Monograma.** ¿Lo diseño tipográficamente como "K & E" en serif (clásico estilo invitación), o tienen un logo de boda ya hecho?
    — _Respuesta:_ ___________
16. 🔴 **Tipografías.** Mi propuesta: **Playfair Display** o **DM Serif Display** (serif desplegado para nombres gigantes) + **Inter** o **Söhne** (sans neutra para cuerpo) + opcional una itálica fina (**Cormorant**) para detalles. ¿OK o prefieren explorar otras combinaciones?
    — _Respuesta:_ ___________
17. 🟡 **Acento de color.** ¿100% blanco/negro/grises o aceptan un acento muy sutil (champagne dorado, sepia ligero, plateado tenue) en CTAs y detalles?
    — _Respuesta:_ ___________
18. ⚪ **Apellidos completos.** ¿En alguna parte se nombran completos (por ejemplo "Karlita Cárcamo Apellido2 & Edgardo Zamora Apellido2") o solo primer nombre + primer apellido?
    — _Respuesta:_ ___________

### C. Logística para invitados (🟡)

19. 🟡 **Acompañantes.** ¿Cada invitado tiene un cupo fijo de acompañantes definido al precargarlos en la lista, o el invitado lo elige al confirmar (con un máximo)?
    — _Respuesta:_ ___________
20. 🟡 **Idioma único.** Confirmado: solo español. Pero si hay familia en EE.UU. que prefiera inglés, ¿agregamos toggle de idioma o mantenemos solo español?
    — _Respuesta:_ ___________
21. 🟡 **Modo invitación vs vista pública.** ¿La página es accesible para cualquiera con el link (vista pública) o solo abre el contenido completo cuando hay un parámetro `?invite=...` válido?
    — _Respuesta:_ ___________
22. ⚪ **Forma del enlace personalizado.** Para el link de invitación, ¿prefieren ID corto y bonito (`?i=ab12`) o ID descriptivo (`?invite=karla-cousin-marta`)?
    — _Respuesta:_ ___________

### D. Decisiones técnicas (🟡 / ⚪)

23. 🟡 **Dominio.** ¿Tienen ya un dominio (por ejemplo `karlitayedgardo.com`, `kyezamora.com`, `bodakye.com`) o despliego provisionalmente en `*.pages.dev` y lo movemos cuando lo compren?
    — _Respuesta:_ ___________
24. 🟡 **Dominio para correo (Resend).** Para enviar desde `invitacion@su-dominio.com` se necesita el dominio verificado. ¿Mismo dominio del sitio o uno separado?
    — _Respuesta:_ ___________
25. 🟡 **WhatsApp.** Confirmar Opción A (enlaces `wa.me`, ustedes hacen clic en cada uno — recomendado para 100-300 invitados) vs Opción B (Meta Cloud API automatizada).
    — _Respuesta:_ ___________
26. 🟡 **Spotify.** ¿Ya existe el playlist o lo creamos desde cero? Si existe, copia del link.
    — _Respuesta:_ ___________
27. 🟡 **Importación de la lista de invitados.** ¿Tienen ya un Excel/Google Sheet con los nombres, correos y teléfonos? ¿Cuántos invitados aproximadamente?
    — _Respuesta:_ ___________
28. ⚪ **Música de fondo en el sitio.** ¿Quieren que la página reproduzca una canción suave al cargar (con botón de mute visible)? Es muy elegante pero a algunos les molesta en móvil.
    — _Respuesta:_ ___________
29. ⚪ **Animación de carga inicial.** ¿Pre-loader con monograma K&E que se desvanece antes del hero? Suma 1-2 segundos perceptuales pero da sensación premium.
    — _Respuesta:_ ___________

### E. Después del evento (⚪)

30. ⚪ **Sustitución de fotos pre-boda por fotos de la boda.** Después del 16 de agosto, ¿quieren que el sitio cambie automáticamente a un "modo agradecimiento" con fotos del evento, o lo actualizamos manualmente?
    — _Respuesta:_ ___________
31. ⚪ **Vida útil del sitio.** ¿Lo dejamos vivo indefinidamente como recuerdo, o lo apagamos pasados X meses?
    — _Respuesta:_ ___________

---

> **Cómo proceder:** la pareja responde primero las 🔴 (son ~10 preguntas), con eso ya puedo empezar la fase 1. Las 🟡 se pueden ir respondiendo durante las fases 2-5. Las ⚪ se pueden dejar para el final.

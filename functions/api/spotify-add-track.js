/* ============================================================
   POST /api/spotify-add-track   body: { trackId: string }
   Agrega un track a la playlist de la boda usando el
   refresh token del dueño de la playlist.
   Requiere: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET,
             SPOTIFY_REFRESH_TOKEN en Cloudflare.
   ============================================================ */

import { readEnv, json } from './_utils.js';

const PLAYLIST_ID = '4FzoQmrCXMBEkqJAOfl19h';

// Obtiene un access token de usuario a partir del refresh token.
// Devuelve { token } o { error } con el detalle de Spotify.
async function getUserToken(env) {
  const clientId = readEnv(env, 'SPOTIFY_CLIENT_ID');
  const clientSecret = readEnv(env, 'SPOTIFY_CLIENT_SECRET');
  const refreshToken = readEnv(env, 'SPOTIFY_REFRESH_TOKEN');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: `No se pudo refrescar el token de Spotify (${res.status}): ${data.error_description || data.error || 'desconocido'}. Vuelve a generar el SPOTIFY_REFRESH_TOKEN en /api/spotify-authorize.` };
  }
  return { token: data.access_token };
}

export async function onRequestPost({ request, env }) {
  const refreshToken = readEnv(env, 'SPOTIFY_REFRESH_TOKEN');
  if (!refreshToken) {
    return json({ error: 'SPOTIFY_REFRESH_TOKEN no configurado. Visita /api/spotify-authorize para obtenerlo.' }, 503);
  }

  let trackId;
  try {
    const body = await request.json();
    trackId = body?.trackId;
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }
  if (!trackId) return json({ error: 'trackId requerido' }, 400);

  try {
    const auth = await getUserToken(env);
    if (auth.error) return json({ error: auth.error }, 502);

    const res = await fetch(`https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const spMsg = body?.error?.message || '';
      let hint = '';
      if (res.status === 403) {
        hint = ' La cuenta que autorizó no puede modificar esta playlist. Autoriza en /api/spotify-authorize con la MISMA cuenta dueña de la playlist (o haz la playlist colaborativa) y verifica el PLAYLIST_ID.';
      } else if (res.status === 401) {
        hint = ' El token no es válido o le faltan permisos. Vuelve a generar el SPOTIFY_REFRESH_TOKEN en /api/spotify-authorize.';
      } else if (res.status === 404) {
        hint = ' No se encontró la playlist. Revisa el PLAYLIST_ID.';
      }
      return json({ error: `Spotify ${res.status}: ${spMsg}${hint}` }, 502);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
